use crate::database::obtener_ruta_db;
use tauri::{command, AppHandle};
use std::fs;
use std::path::PathBuf;
use rusqlite::Connection;

// Importaciones para la encriptación
use aes_gcm::{aead::Aead, Aes256Gcm, Key, KeyInit, Nonce};
use pbkdf2::pbkdf2_hmac; 
use sha2::Sha256;
use serde_json::{json, Value};

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

    let ruta_sync: String = conn.query_row(
        "SELECT ruta FROM configuracion_sync WHERE id = 1", [], |row| row.get(0)
    ).map_err(|_| "No has configurado una carpeta de sincronización en Datos.".to_string())?;

    // 1. OBTENER LA ASAMBLEA
    let asamblea = conn.query_row(
        "SELECT tema, fecha, identificador, lugar, idioma, ensayo_lugar, ensayo_fecha, ensayo_hora, ensayo_notas, recorridos_info, instrucciones_esp, jw_stream_studio FROM asambleas WHERE id = ?1",
        [id_asamblea],
        |row| {
            Ok(json!({
                "tema": row.get::<_, Option<String>>(0)?,
                "fecha": row.get::<_, Option<String>>(1)?,
                "identificador": row.get::<_, Option<String>>(2)?,
                "lugar": row.get::<_, Option<String>>(3)?,
                "idioma": row.get::<_, Option<String>>(4)?,
                "ensayo_lugar": row.get::<_, Option<String>>(5)?,
                "ensayo_fecha": row.get::<_, Option<String>>(6)?,
                "ensayo_hora": row.get::<_, Option<String>>(7)?,
                "ensayo_notas": row.get::<_, Option<String>>(8)?,
                "recorridos_info": row.get::<_, Option<String>>(9)?,
                "instrucciones_esp": row.get::<_, Option<String>>(10)?,
                "jw_stream_studio": row.get::<_, Option<bool>>(11)?
            }))
        }
    ).map_err(|e| format!("Error al extraer asamblea: {}", e))?;

    // 2. OBTENER TODO EL PROGRAMA (Usando nombres de columnas correctos)
    let mut stmt_prog = conn.prepare("SELECT dia, sesion, hora_inicio, tema, tipo, duracion, numero_bosquejo, estado, fuente, es_betelita, es_interprete, es_visitante FROM programa WHERE asamblea_id = ?1").unwrap();
    let programa_iter = stmt_prog.query_map([id_asamblea], |row| {
        Ok(json!({
            "dia": row.get::<_, Option<String>>(0)?,
            "sesion": row.get::<_, Option<String>>(1)?,
            "hora_inicio": row.get::<_, Option<String>>(2)?,
            "tema": row.get::<_, Option<String>>(3)?,
            "tipo": row.get::<_, Option<String>>(4)?,
            "duracion": row.get::<_, Option<i32>>(5)?,
            "numero_bosquejo": row.get::<_, Option<String>>(6)?,
            "estado": row.get::<_, Option<String>>(7)?,
            "fuente": row.get::<_, Option<String>>(8)?,
            "es_betelita": row.get::<_, Option<bool>>(9)?,
            "es_interprete": row.get::<_, Option<bool>>(10)?,
            "es_visitante": row.get::<_, Option<bool>>(11)?
        }))
    }).unwrap();
    let programa: Vec<serde_json::Value> = programa_iter.filter_map(Result::ok).collect();

    // 3. OBTENER ASIGNACIONES ESPECIALES
    let mut stmt_asig = conn.prepare("SELECT dia, fecha, tipo_asignacion, persona_id, estado, esta_presente, ensayo_terminado FROM asignaciones_especiales WHERE asamblea_id = ?1").unwrap();
    let asignaciones_iter = stmt_asig.query_map([id_asamblea], |row| {
        Ok(json!({
            "dia": row.get::<_, Option<String>>(0)?,
            "fecha": row.get::<_, Option<String>>(1)?,
            "tipo_asignacion": row.get::<_, Option<String>>(2)?,
            "persona_id": row.get::<_, Option<i32>>(3)?,
            "estado": row.get::<_, Option<String>>(4)?,
            "esta_presente": row.get::<_, Option<bool>>(5)?,
            "ensayo_terminado": row.get::<_, Option<bool>>(6)?
        }))
    }).unwrap();
    let asignaciones: Vec<serde_json::Value> = asignaciones_iter.filter_map(Result::ok).collect();

    // EMPAQUETAR EN UN JSON GIGANTE
    let datos_export = json!({
        "asamblea": asamblea,
        "programa": programa,
        "asignaciones": asignaciones
    });
    
    let datos_json = datos_export.to_string();

    // 4. ENCRIPTAR CON AES-256
    let mut key = [0u8; 32];
    let salt = b"rassembly_salt_2026"; 
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 1000, &mut key);
    
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let nonce = Nonce::from_slice(b"rassembly_iv"); 
    let ciphertext = cipher.encrypt(nonce, datos_json.as_bytes())
        .map_err(|_| "Error crítico al encriptar los datos.".to_string())?;

    let nombre_limpio = nombre_asamblea.replace(" ", "_").replace("/", "-").replace("\\", "-");
    let nombre_archivo = format!("{}.rassembly", nombre_limpio);
    
    let mut ruta_final = PathBuf::from(ruta_sync);
    ruta_final.push(nombre_archivo);

    fs::write(&ruta_final, ciphertext).map_err(|e| format!("Error al guardar el archivo en la nube: {}", e))?;

    Ok(())
}

#[command]
pub fn importar_asamblea_encriptada(
    app: AppHandle,
    password: String,
    ruta_archivo: String,
) -> Result<(), String> {
    let ciphertext = fs::read(&ruta_archivo).map_err(|e| format!("Error al leer el archivo: {}", e))?;

    // 1. DESENCRIPTAR
    let mut key = [0u8; 32];
    let salt = b"rassembly_salt_2026";
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 1000, &mut key);
    
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let nonce = Nonce::from_slice(b"rassembly_iv");
    
    let decrypted_data = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "⚠️ CLAVE INCORRECTA o archivo dañado. Verifica la contraseña.".to_string())?;

    let json_string = String::from_utf8(decrypted_data)
        .map_err(|_| "Error al decodificar el texto.".to_string())?;

    let parsed: serde_json::Value = serde_json::from_str(&json_string)
        .map_err(|_| "El archivo contiene información corrupta.".to_string())?;

    let db_path = obtener_ruta_db(&app);
    let mut conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // 2. INICIAR TRANSACCIÓN (Si algo falla, no se guarda nada a medias)
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let asm = &parsed["asamblea"];
    
    // 3. INSERTAR LA ASAMBLEA NUEVA
    tx.execute(
        "INSERT INTO asambleas (tema, fecha, identificador, lugar, idioma, ensayo_lugar, ensayo_fecha, ensayo_hora, ensayo_notas, recorridos_info, instrucciones_esp, jw_stream_studio) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            asm["tema"].as_str(),
            asm["fecha"].as_str(),
            asm["identificador"].as_str(),
            asm["lugar"].as_str(),
            asm["idioma"].as_str(),
            asm["ensayo_lugar"].as_str(),
            asm["ensayo_fecha"].as_str(),
            asm["ensayo_hora"].as_str(),
            asm["ensayo_notas"].as_str(),
            asm["recorridos_info"].as_str(),
            asm["instrucciones_esp"].as_str(),
            asm["jw_stream_studio"].as_bool(),
        ]
    ).map_err(|e| format!("Error al insertar asamblea: {}", e))?;

    // 4. CAPTURAR EL NUEVO ID GENERADO
    let nuevo_id = tx.last_insert_rowid();

    // 5. INSERTAR EL PROGRAMA (Asociado al nuevo ID)
    if let Some(prog_arr) = parsed["programa"].as_array() {
        for p in prog_arr {
            tx.execute(
                "INSERT INTO programa (asamblea_id, dia, sesion, hora_inicio, tema, tipo, duracion, numero_bosquejo, estado, fuente, es_betelita, es_interprete, es_visitante) 
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                rusqlite::params![
                    nuevo_id,
                    p["dia"].as_str(),
                    p["sesion"].as_str(),
                    p["hora_inicio"].as_str(),
                    p["tema"].as_str(),
                    p["tipo"].as_str(),
                    p["duracion"].as_i64(),
                    p["numero_bosquejo"].as_str(),
                    p["estado"].as_str(),
                    p["fuente"].as_str(),
                    p["es_betelita"].as_bool(),
                    p["es_interprete"].as_bool(),
                    p["es_visitante"].as_bool(),
                ]
            ).map_err(|e| format!("Error al insertar programa: {}", e))?;
        }
    }

    // 6. INSERTAR ASIGNACIONES (Asociadas al nuevo ID)
    if let Some(asig_arr) = parsed["asignaciones"].as_array() {
        for a in asig_arr {
            tx.execute(
                "INSERT INTO asignaciones_especiales (asamblea_id, dia, fecha, tipo_asignacion, persona_id, estado, esta_presente, ensayo_terminado) 
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    nuevo_id,
                    a["dia"].as_str(),
                    a["fecha"].as_str(),
                    a["tipo_asignacion"].as_str(),
                    a["persona_id"].as_i64(),
                    a["estado"].as_str(),
                    a["esta_presente"].as_bool(),
                    a["ensayo_terminado"].as_bool(),
                ]
            ).map_err(|e| format!("Error al insertar asignaciones: {}", e))?;
        }
    }

    // 7. CONFIRMAR Y GUARDAR TODO DEFINITIVAMENTE
    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}