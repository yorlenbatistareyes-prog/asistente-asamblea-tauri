use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use rand::RngCore;
use std::fs;
use tauri::{AppHandle, Manager};

// 1. Genera una llave de 256 bits y la devuelve en formato texto
#[tauri::command]
pub fn generar_llave_invisible() -> String {
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    general_purpose::STANDARD.encode(key)
}

// 2. Encripta datos de texto (compatibilidad con formato viejo)
#[tauri::command]
pub fn encriptar_maletin(texto_plano: String, llave_base64: String) -> Result<String, String> {
    let key_bytes = general_purpose::STANDARD
        .decode(llave_base64)
        .map_err(|e| format!("Error al leer llave: {}", e))?;

    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let cifrado = cipher
        .encrypt(nonce, texto_plano.as_bytes())
        .map_err(|e| format!("Error al encriptar: {}", e))?;

    let mut paquete_completo = nonce_bytes.to_vec();
    paquete_completo.extend_from_slice(&cifrado);

    Ok(general_purpose::STANDARD.encode(paquete_completo))
}

// 3. Desencripta datos de texto (compatibilidad con formato viejo)
#[tauri::command]
pub fn desencriptar_maletin(
    paquete_base64: String,
    llave_base64: String,
) -> Result<String, String> {
    let key_bytes = general_purpose::STANDARD
        .decode(llave_base64)
        .map_err(|e| format!("Error al leer llave: {}", e))?;

    let paquete_bytes = general_purpose::STANDARD
        .decode(paquete_base64)
        .map_err(|e| format!("Error al leer archivo: {}", e))?;

    if paquete_bytes.len() < 12 {
        return Err("El archivo está corrupto o es muy corto.".into());
    }

    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let (nonce_bytes, cifrado) = paquete_bytes.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let texto_plano = cipher
        .decrypt(nonce, cifrado)
        .map_err(|_| "La llave es incorrecta o el archivo fue modificado.".to_string())?;

    String::from_utf8(texto_plano).map_err(|e| format!("Error de texto: {}", e))
}

// ==========================================
// 4. NUEVAS FUNCIONES: Encriptar/Desencriptar BD COMPLETA (copia binaria)
// ==========================================

#[tauri::command]
pub fn exportar_db_binaria_encriptada(
    llave_base64: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join(crate::database::DB_NAME);
    let snapshot_path = app_dir.join("asamblea_db_export_snapshot.sqlite");

    // 1. Crear snapshot consistente con VACUUM INTO
    let _ = fs::remove_file(&snapshot_path);
    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("Error al abrir la BD: {}", e))?;
    conn.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    let snapshot_sql = format!(
        "VACUUM INTO '{}'",
        snapshot_path.to_string_lossy().replace('\'', "''")
    );
    conn.execute_batch(&snapshot_sql)
        .map_err(|e| format!("Error creando snapshot: {}", e))?;
    drop(conn);

    // 2. Leer bytes del snapshot
    let db_bytes = fs::read(&snapshot_path)
        .map_err(|e| format!("Error leyendo snapshot: {}", e))?;
    let _ = fs::remove_file(&snapshot_path);

    // 3. Encriptar bytes
    let key_bytes = general_purpose::STANDARD
        .decode(&llave_base64)
        .map_err(|e| format!("Error al leer llave: {}", e))?;
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let cifrado = cipher
        .encrypt(nonce, db_bytes.as_ref())
        .map_err(|e| format!("Error al encriptar: {}", e))?;

    let mut paquete_completo = nonce_bytes.to_vec();
    paquete_completo.extend_from_slice(&cifrado);

      let paquete_base64 = general_purpose::STANDARD.encode(paquete_completo);
    Ok(format!("RASSEMBLY2:{}:{}", llave_base64, paquete_base64))
}

#[tauri::command]
pub fn importar_db_binaria_encriptada(
    paquete_base64: String,
    llave_base64: String,
    app_handle: AppHandle,
) -> Result<(), String> {

        // 1. Detectar formato con prefijo (llave embebida)
    let (llave_efectiva, paquete_efectivo) = if let Some(resto) = paquete_base64.strip_prefix("RASSEMBLY2:") {
        let (llave_embebida, paquete) = resto
            .split_once(':')
            .ok_or_else(|| "El archivo de sincronización está corrupto.".to_string())?;
        (llave_embebida.to_string(), paquete.to_string())
    } else {
        (llave_base64.clone(), paquete_base64.clone())
    };

    // 2. Desencriptar con la llave efectiva
    let key_bytes = general_purpose::STANDARD
        .decode(&llave_efectiva)
        .map_err(|e| format!("Error al leer llave: {}", e))?;
    if key_bytes.len() != 32 {
        return Err("La llave de sincronización no tiene el tamaño esperado.".into());
    }
    let paquete_bytes = general_purpose::STANDARD
        .decode(&paquete_efectivo)
        .map_err(|e| format!("Error al leer archivo: {}", e))?;

    if paquete_bytes.len() < 28 {
        return Err("El archivo está corrupto o es muy corto.".into());
    }

    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let (nonce_bytes, cifrado) = paquete_bytes.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let db_bytes = cipher
        .decrypt(nonce, cifrado)
        .map_err(|_| "La llave es incorrecta o el archivo fue modificado.".to_string())?;

    // Guardar y validar primero un temporal para no dejar una restauración inválida.
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let restore_path = app_dir.join("asamblea_db_restore.sqlite");
    let staging_path = app_dir.join("asamblea_db_restore.sqlite.tmp");

    fs::write(&staging_path, db_bytes)
        .map_err(|e| format!("Error al escribir BD restaurada: {}", e))?;
    if let Err(error) = crate::database::validar_archivo_db(&staging_path) {
        let _ = fs::remove_file(&staging_path);
        return Err(error);
    }
    if restore_path.exists() {
        fs::remove_file(&restore_path)
            .map_err(|e| format!("No se pudo reemplazar la restauración pendiente: {}", e))?;
    }
    fs::rename(&staging_path, &restore_path)
        .map_err(|e| format!("No se pudo preparar la BD restaurada: {}", e))?;

    println!("✅ BD restaurada guardada como pendiente: {}", restore_path.display());
    Ok(())
}