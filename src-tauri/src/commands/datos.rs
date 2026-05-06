use crate::database::obtener_ruta_db;
use tauri::{command, AppHandle};
use std::fs;
use std::path::PathBuf;
use rusqlite::Connection;

// Importaciones para la encriptación
use aes_gcm::{aead::Aead, Aes256Gcm, Key, KeyInit, Nonce};
use pbkdf2::pbkdf2_hmac; 
use sha2::Sha256;

// =========================================================================
// 1. RESPALDOS MANUALES DE LA BASE DE DATOS COMPLETA
// =========================================================================

#[command]
pub fn exportar_base_datos(app: AppHandle, ruta_destino: String) -> Result<String, String> {
    let ruta_db_actual = obtener_ruta_db(&app);
    let conn = Connection::open(&ruta_db_actual).map_err(|e| e.to_string())?;

    if std::path::Path::new(&ruta_destino).exists() {
        let _ = fs::remove_file(&ruta_destino);
    }

    // VACUUM INTO crea una copia limpia y compactada del archivo .sqlite
    match conn.execute("VACUUM INTO ?", [ruta_destino]) {
        Ok(_) => Ok("Respaldo completo de la base de datos creado.".to_string()),
        Err(e) => Err(format!("Error al generar respaldo: {}", e)),
    }
}

#[command]
pub fn importar_base_datos(app: AppHandle, ruta_origen: String) -> Result<String, String> {
    let ruta_db_actual = obtener_ruta_db(&app);
    let ruta_pendiente = ruta_db_actual.with_file_name("restaurar_pendiente.sqlite");

    // Cerramos cualquier transacción pendiente
    if let Ok(conn) = Connection::open(&ruta_db_actual) {
        let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE);", []);
        let _ = conn.execute("PRAGMA journal_mode=DELETE;", []);
    }

    match fs::copy(&ruta_origen, &ruta_pendiente) {
        Ok(_) => Ok("Datos preparados. Reinicia la aplicación para aplicar los cambios.".to_string()),
        Err(e) => Err(format!("Error al preparar la restauración: {}", e)),
    }
}

#[command]
pub fn limpiar_datos(app: AppHandle) -> Result<String, String> {
    let db_path = obtener_ruta_db(&app);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let sql = r#"
        PRAGMA foreign_keys = OFF;
        DELETE FROM asignaciones_especiales;
        DELETE FROM programa;
        DELETE FROM personas;
        DELETE FROM congregaciones;
        DELETE FROM asambleas;
        DELETE FROM locales;
        DELETE FROM plantillas_cartas;
        DELETE FROM plantillas_email;
        DELETE FROM sqlite_sequence WHERE name NOT IN ('configuracion', 'configuracion_sync');
        PRAGMA foreign_keys = ON;
    "#;

    conn.execute_batch(sql).map_err(|e| e.to_string())?;
    let _ = conn.execute("VACUUM", []); 

    Ok("Base de datos vaciada correctamente.".to_string())
}

// =========================================================================
// 2. GESTIÓN DE CARPETA DE SINCRONIZACIÓN (Drive/OneDrive)
// =========================================================================

#[command]
pub fn guardar_ruta_sync(app: AppHandle, ruta: Option<String>) -> Result<(), String> {
    let db_path = obtener_ruta_db(&app);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Creamos una tabla dedicada para no chocar con tu tabla 'configuracion' actual
    conn.execute(
        "CREATE TABLE IF NOT EXISTS configuracion_sync (id INTEGER PRIMARY KEY CHECK (id = 1), ruta TEXT)",
        [],
    ).map_err(|e| e.to_string())?;

    match ruta {
        Some(r) => {
            conn.execute(
                "INSERT OR REPLACE INTO configuracion_sync (id, ruta) VALUES (1, ?1)",
                [&r],
            ).map_err(|e| format!("Error al guardar ruta: {}", e))?;
        }
        None => {
            conn.execute("DELETE FROM configuracion_sync WHERE id = 1", []).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[command]
pub fn obtener_ruta_sync(app: AppHandle) -> Result<Option<String>, String> {
    let db_path = obtener_ruta_db(&app);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let exists: i32 = conn.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='configuracion_sync'",
        [], |row| row.get(0)
    ).unwrap_or(0);

    if exists == 0 { return Ok(None); }

    let mut stmt = conn.prepare("SELECT ruta FROM configuracion_sync WHERE id = 1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let valor: String = row.get(0).map_err(|e| e.to_string())?;
        Ok(Some(valor))
    } else {
        Ok(None)
    }
}

// =========================================================================
// 3. EXPORTAR/IMPORTAR ASAMBLEA INDIVIDUAL (.rassembly)
// =========================================================================

#[command]
pub fn exportar_asamblea_encriptada(
    app: AppHandle,
    id_asamblea: i32,
    password: String,
    nombre_asamblea: String,
) -> Result<(), String> {
    let db_path = obtener_ruta_db(&app);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Obtenemos la ruta de la tabla dedicada
    let ruta_sync: String = conn.query_row(
        "SELECT ruta FROM configuracion_sync WHERE id = 1", [], |row| row.get(0)
    ).map_err(|_| "No has configurado una carpeta de sincronización en Datos.".to_string())?;

    // JSON con los datos (AQUÍ DEBERÍAS RELLENAR CON SQL REAL MÁS ADELANTE)
    let datos_json = format!(
        r#"{{"asamblea_id": {}, "nombre": "{}", "datos": "..."}}"#,
        id_asamblea, nombre_asamblea
    );

    // Derivación de clave y encriptación
    let mut key = [0u8; 32];
    let salt = b"rassembly_salt_2026"; 
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 1000, &mut key);
    
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let nonce = Nonce::from_slice(b"rassembly_iv"); 
    let ciphertext = cipher.encrypt(nonce, datos_json.as_bytes())
        .map_err(|_| "Error al encriptar archivo.".to_string())?;

    let nombre_archivo = format!("{}.rassembly", nombre_asamblea.replace(" ", "_"));
    let mut ruta_final = PathBuf::from(ruta_sync);
    ruta_final.push(nombre_archivo);

    fs::write(&ruta_final, ciphertext).map_err(|e| format!("Error al escribir archivo: {}", e))?;

    Ok(())
}

#[command]
pub fn importar_asamblea_encriptada(
    app: AppHandle,
    password: String,
    ruta_archivo: String,
) -> Result<(), String> {
    let ciphertext = fs::read(&ruta_archivo).map_err(|e| format!("Error al leer el archivo: {}", e))?;

    let mut key = [0u8; 32];
    let salt = b"rassembly_salt_2026";
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 1000, &mut key);
    
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let nonce = Nonce::from_slice(b"rassembly_iv");
    
    let decrypted_data = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "Clave incorrecta o archivo dañado.".to_string())?;

    let json_string = String::from_utf8(decrypted_data)
        .map_err(|_| "Error al procesar datos.".to_string())?;

    // Aquí iría la lógica para hacer INSERT en las tablas locales
    println!("Asamblea lista para importar: {}", json_string);

    Ok(())
}