use crate::database::obtener_ruta_db;
use tauri::{command, AppHandle};
use std::fs;
use std::path::PathBuf;
use rusqlite::{Connection, params};

// Importaciones para la encriptación y JSON
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

    match conn.execute("VACUUM INTO ?", [ruta_destino]) {
        Ok(_) => Ok("Respaldo completo de la base de datos creado.".to_string()),
        Err(e) => Err(format!("Error al generar respaldo: {}", e)),
    }
}

#[command]
pub fn importar_base_datos(app: AppHandle, ruta_origen: String) -> Result<String, String> {
    let ruta_db_actual = obtener_ruta_db(&app);
    let ruta_pendiente = ruta_db_actual.with_file_name("restaurar_pendiente.sqlite");

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
        DELETE FROM detalles_oficina;
        DELETE FROM recordatorios_oradores;
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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS configuracion_sync (id INTEGER PRIMARY KEY CHECK (id = 1), ruta TEXT)",
        [],
    ).map_err(|e| e.to_string())?;

    match ruta {
        Some(r) => {
            conn.execute("INSERT OR REPLACE INTO configuracion_sync (id, ruta) VALUES (1, ?1)", [&r])
                .map_err(|e| format!("Error al guardar ruta: {}", e))?;
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
// 3. EXPORTAR ASAMBLEA (CLON ABSOLUTO DE TODAS LAS TABLAS)
// =========================================================================

#[command]
pub fn exportar_asamblea_encriptada(
    app: AppHandle,
    id_asamblea: i32,
    password: String,
    nombre_asamblea: String,
    emailDestino: Vec<String>,
) -> Result<(), String> {
    let db_path = obtener_ruta_db(&app);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let ruta_sync: String = conn.query_row(
        "SELECT ruta FROM configuracion_sync WHERE id = 1", [], |row| row.get(0)
    ).map_err(|_| "No has configurado una carpeta de sincronización en Datos.".to_string())?;

    // 1. ASAMBLEA Y COMITÉ
    let asamblea = conn.query_row(
        "SELECT tema, fecha, identificador, local_id, ensayo_lugar, ensayo_fecha, ensayo_hora, recorridos_info, instrucciones_esp, ensayo_notas, jw_stream_studio, lugar, idioma, coordinador_id, coordinador_aux_id, prog_super_id, prog_aux_id, aloj_super_id, aloj_aux_id, audio_video_super_id, video_super_id, audio_super_id, plataforma_super_id, bautismo_super_id, bautismo_aux_id, notas_programa FROM asambleas WHERE id = ?1",
        [id_asamblea],
        |row| {
            let local_id: Option<i32> = row.get(3)?;
            let local_data = if let Some(lid) = local_id {
                conn.query_row("SELECT nombre, direccion, ciudad, estado, capacidad FROM locales WHERE id = ?1", [lid], |r| {
                    Ok(json!({"nombre": r.get::<_, String>(0)?, "direccion": r.get::<_, Option<String>>(1)?, "ciudad": r.get::<_, Option<String>>(2)?, "estado": r.get::<_, Option<String>>(3)?, "capacidad": r.get::<_, Option<i32>>(4)?}))
                }).ok()
            } else { None };

            Ok(json!({
                "tema": row.get::<_, String>(0)?, "fecha": row.get::<_, String>(1)?, "identificador": row.get::<_, Option<String>>(2)?,
                "local": local_data, "ensayo_lugar": row.get::<_, Option<String>>(4)?, "ensayo_fecha": row.get::<_, Option<String>>(5)?,
                "ensayo_hora": row.get::<_, Option<String>>(6)?, "recorridos_info": row.get::<_, Option<String>>(7)?, "instrucciones_esp": row.get::<_, Option<String>>(8)?,
                "ensayo_notas": row.get::<_, Option<String>>(9)?, "jw_stream_studio": row.get::<_, Option<bool>>(10)?, "lugar": row.get::<_, Option<String>>(11)?, "idioma": row.get::<_, Option<String>>(12)?,
                "coordinador_id": row.get::<_, Option<i32>>(13)?, "coordinador_aux_id": row.get::<_, Option<i32>>(14)?, "prog_super_id": row.get::<_, Option<i32>>(15)?, "prog_aux_id": row.get::<_, Option<i32>>(16)?,
                "aloj_super_id": row.get::<_, Option<i32>>(17)?, "aloj_aux_id": row.get::<_, Option<i32>>(18)?, "audio_video_super_id": row.get::<_, Option<i32>>(19)?, "video_super_id": row.get::<_, Option<i32>>(20)?,
                "audio_super_id": row.get::<_, Option<i32>>(21)?, "plataforma_super_id": row.get::<_, Option<i32>>(22)?, "bautismo_super_id": row.get::<_, Option<i32>>(23)?, "bautismo_aux_id": row.get::<_, Option<i32>>(24)?,
                "notas_programa": row.get::<_, Option<String>>(25)?
            }))
        }
    ).map_err(|e| format!("Error extrayendo asamblea: {}", e))?;

    // 2. CONGREGACIONES
    let mut stmt_cong = conn.prepare("SELECT id, nombre, circuito, numero_congregacion FROM congregaciones WHERE asamblea_id = ?1").map_err(|e| e.to_string())?;
    let congregaciones: Vec<Value> = stmt_cong.query_map([id_asamblea], |row| {
        Ok(json!({"old_id": row.get::<_, i32>(0)?, "nombre": row.get::<_, String>(1)?, "circuito": row.get::<_, Option<String>>(2)?, "numero_congregacion": row.get::<_, Option<String>>(3)?}))
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();

    // 3. PERSONAS
    let mut stmt_pers = conn.prepare("SELECT id, nombre_completo, sexo, privilegios, id_congregacion, congregacion, circuito, telefono, telefono_fijo, email, email_jwpub, responsabilidades, disponibilidad FROM personas WHERE asamblea_id = ?1").map_err(|e| e.to_string())?;
    let personas: Vec<Value> = stmt_pers.query_map([id_asamblea], |row| {
        Ok(json!({
            "old_id": row.get::<_, i32>(0)?, "nombre_completo": row.get::<_, String>(1)?, "sexo": row.get::<_, Option<String>>(2)?, "privilegios": row.get::<_, Option<String>>(3)?,
            "old_cong_id": row.get::<_, Option<i32>>(4)?, "congregacion_nombre": row.get::<_, Option<String>>(5)?, "circuito": row.get::<_, Option<String>>(6)?,
            "telefono": row.get::<_, Option<String>>(7)?, "telefono_fijo": row.get::<_, Option<String>>(8)?, "email": row.get::<_, Option<String>>(9)?,
            "email_jwpub": row.get::<_, Option<String>>(10)?, "responsabilidades": row.get::<_, Option<String>>(11)?, "disponibilidad": row.get::<_, Option<String>>(12)?
        }))
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();

    // 4. DETALLES OFICINA
    let mut stmt_ofi = conn.prepare("SELECT d.persona_id, d.responsabilidades, d.disponibilidad FROM detalles_oficina d JOIN personas p ON p.id = d.persona_id WHERE p.asamblea_id = ?1").map_err(|e| e.to_string())?;
    let detalles_oficina: Vec<Value> = stmt_ofi.query_map([id_asamblea], |row| {
        Ok(json!({"old_persona_id": row.get::<_, i32>(0)?, "responsabilidades": row.get::<_, Option<String>>(1)?, "disponibilidad": row.get::<_, Option<String>>(2)?}))
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();

    // 5. PROGRAMA
    let mut stmt_prog = conn.prepare("SELECT dia, sesion, hora_inicio, tema, tipo, duracion, orador_id, es_video, estado, esta_presente, numero_bosquejo, ensayo_terminado, fuente, es_betelita, es_interprete, es_visitante, requiere_ensayo, fecha_ensayo, hora_ensayo, lugar_ensayo, notas_ensayo, check_viernes, check_dia, check_30m FROM programa WHERE asamblea_id = ?1").map_err(|e| e.to_string())?;
    let programa: Vec<Value> = stmt_prog.query_map([id_asamblea], |row| {
        Ok(json!({
            "dia": row.get::<_, String>(0)?, "sesion": row.get::<_, String>(1)?, "hora_inicio": row.get::<_, Option<String>>(2)?, "tema": row.get::<_, String>(3)?,
            "tipo": row.get::<_, Option<String>>(4)?, "duracion": row.get::<_, Option<i32>>(5)?, "old_orador_id": row.get::<_, Option<i32>>(6)?, "es_video": row.get::<_, Option<bool>>(7)?,
            "estado": row.get::<_, Option<String>>(8)?, "esta_presente": row.get::<_, Option<bool>>(9)?, "numero_bosquejo": row.get::<_, Option<String>>(10)?, "ensayo_terminado": row.get::<_, Option<bool>>(11)?,
            "fuente": row.get::<_, Option<String>>(12)?, "es_betelita": row.get::<_, Option<bool>>(13)?, "es_interprete": row.get::<_, Option<bool>>(14)?, "es_visitante": row.get::<_, Option<bool>>(15)?,
            "requiere_ensayo": row.get::<_, Option<bool>>(16)?, "fecha_ensayo": row.get::<_, Option<String>>(17)?, "hora_ensayo": row.get::<_, Option<String>>(18)?, "lugar_ensayo": row.get::<_, Option<String>>(19)?,
            "notas_ensayo": row.get::<_, Option<String>>(20)?, "check_viernes": row.get::<_, Option<bool>>(21)?, "check_dia": row.get::<_, Option<bool>>(22)?, "check_30m": row.get::<_, Option<bool>>(23)?
        }))
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();

    // 6. ASIGNACIONES ESPECIALES
    let mut stmt_asig = conn.prepare("SELECT dia, fecha, tipo_asignacion, persona_id, estado, esta_presente, ensayo_terminado FROM asignaciones_especiales WHERE asamblea_id = ?1").map_err(|e| e.to_string())?;
    let asignaciones: Vec<Value> = stmt_asig.query_map([id_asamblea], |row| {
        Ok(json!({"dia": row.get::<_, String>(0)?, "fecha": row.get::<_, Option<String>>(1)?, "tipo_asignacion": row.get::<_, String>(2)?, "old_persona_id": row.get::<_, i32>(3)?, "estado": row.get::<_, Option<String>>(4)?, "esta_presente": row.get::<_, Option<bool>>(5)?, "ensayo_terminado": row.get::<_, Option<bool>>(6)?}))
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();

    // 7. RECORDATORIOS
    let mut stmt_rec = conn.prepare("SELECT persona_id, texto, fecha_recordatorio FROM recordatorios_oradores WHERE asamblea_id = ?1").map_err(|e| e.to_string())?;
    let recordatorios: Vec<Value> = stmt_rec.query_map([id_asamblea], |row| {
        Ok(json!({"old_persona_id": row.get::<_, i32>(0)?, "texto": row.get::<_, Option<String>>(1)?, "fecha_recordatorio": row.get::<_, Option<String>>(2)?}))
    }).map_err(|e| e.to_string())?.filter_map(Result::ok).collect();

    let datos_json = json!({ 
        "autorizado": emailDestino, // 👈 EL SELLO
        "asamblea": asamblea, 
        "congregaciones": congregaciones, 
        "personas": personas, 
        "detalles_oficina": detalles_oficina, 
        "programa": programa, 
        "asignaciones": asignaciones, 
        "recordatorios": recordatorios 
    }).to_string();

    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), b"rassembly_salt_2026", 1000, &mut key);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let ciphertext = cipher.encrypt(Nonce::from_slice(b"rassembly_iv"), datos_json.as_bytes()).map_err(|_| "Error crítico de encriptación")?;

    let nombre_archivo = format!("{}.rassembly", nombre_asamblea.replace(" ", "_").replace("/", "-"));
    let mut ruta_final = PathBuf::from(ruta_sync);
    ruta_final.push(nombre_archivo);

    fs::write(&ruta_final, ciphertext).map_err(|e| format!("Error al guardar archivo: {}", e))?;

    Ok(())
}

// =========================================================================
// 4. IMPORTAR ASAMBLEA (INYECCIÓN RELACIONAL INTELIGENTE)
// =========================================================================

#[command]
pub fn importar_asamblea_encriptada(app: AppHandle, password: String, ruta_archivo: String) -> Result<(), String> {
    // 1. DESENCRIPTAR
    let ciphertext = fs::read(&ruta_archivo).map_err(|e| format!("Error de archivo: {}", e))?;
    
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), b"rassembly_salt_2026", 1000, &mut key);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    
    let decrypted = cipher.decrypt(Nonce::from_slice(b"rassembly_iv"), ciphertext.as_ref())
        .map_err(|_| "Clave incorrecta o archivo corrupto")?;

    let json_string = String::from_utf8(decrypted).map_err(|_| "Codificación inválida")?;
    let parsed: Value = serde_json::from_str(&json_string).map_err(|_| "Error de formato")?;

    // 2. VERIFICACIÓN DE IDENTIDAD (AUTORIZACIÓN)
    let db_path = obtener_ruta_db(&app);
    let conn_val = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    let correo_autorizado = parsed["autorizado"].as_str().unwrap_or("");
    let email_usuario: String = conn_val.query_row(
        "SELECT email FROM configuracion WHERE id = 1", [], |r| r.get(0)
    ).unwrap_or_else(|_| "no_configurado".to_string());

    if !correo_autorizado.is_empty() && correo_autorizado != email_usuario {
        return Err(format!(
            "❌ ACCESO DENEGADO. Archivo sellado para: {}. Tu correo configurado es: {}", 
            correo_autorizado, email_usuario
        ));
    }
    drop(conn_val); // Liberamos la conexión de validación

    // 3. INICIAR TRANSACCIÓN Y PROCESAR DATOS
    let mut conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    let asm = &parsed["asamblea"]; // asm disponible aquí

    // 1. LOCAL
    let mut local_id: Option<i64> = None;
    if let Some(l) = asm["local"].as_object() {
        tx.execute("INSERT INTO locales (nombre, direccion, ciudad, estado, capacidad) VALUES (?1, ?2, ?3, ?4, ?5)", 
            params![l["nombre"].as_str(), l["direccion"].as_str(), l["ciudad"].as_str(), l["estado"].as_str(), l["capacidad"].as_i64()])
            .map_err(|e| format!("Error en local: {}", e))?;
        local_id = Some(tx.last_insert_rowid());
    }

    // 2. ASAMBLEA
    tx.execute("INSERT INTO asambleas (tema, fecha, identificador, local_id, ensayo_lugar, ensayo_fecha, ensayo_hora, recorridos_info, instrucciones_esp, ensayo_notas, jw_stream_studio, lugar, idioma, notas_programa) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
        params![asm["tema"].as_str(), asm["fecha"].as_str(), asm["identificador"].as_str(), local_id, asm["ensayo_lugar"].as_str(), asm["ensayo_fecha"].as_str(), asm["ensayo_hora"].as_str(), asm["recorridos_info"].as_str(), asm["instrucciones_esp"].as_str(), asm["ensayo_notas"].as_str(), asm["jw_stream_studio"].as_bool(), asm["lugar"].as_str(), asm["idioma"].as_str(), asm["notas_programa"].as_str()])
        .map_err(|e| format!("Error en asamblea: {}", e))?;
    
    let nueva_asamblea_id = tx.last_insert_rowid();

    // 3. CONGREGACIONES
    let mut map_cong = std::collections::HashMap::new();
    if let Some(congs) = parsed["congregaciones"].as_array() {
        for c in congs {
            tx.execute("INSERT INTO congregaciones (asamblea_id, nombre, circuito, numero_congregacion) VALUES (?1,?2,?3,?4)", 
                params![nueva_asamblea_id, c["nombre"].as_str(), c["circuito"].as_str(), c["numero_congregacion"].as_str()])
                .map_err(|e| format!("Error en congregaciones: {}", e))?;
            map_cong.insert(c["old_id"].as_i64().unwrap(), tx.last_insert_rowid());
        }
    }

    // 4. PERSONAS
    let mut map_pers = std::collections::HashMap::new();
    if let Some(pers) = parsed["personas"].as_array() {
        for p in pers {
            let new_cong_id = p["old_cong_id"].as_i64().and_then(|oid| map_cong.get(&oid)).copied();
            tx.execute("INSERT INTO personas (asamblea_id, nombre_completo, sexo, privilegios, id_congregacion, congregacion, circuito, telefono, telefono_fijo, email, email_jwpub, responsabilidades, disponibilidad) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
                params![nueva_asamblea_id, p["nombre_completo"].as_str(), p["sexo"].as_str(), p["privilegios"].as_str(), new_cong_id, p["congregacion_nombre"].as_str(), p["circuito"].as_str(), p["telefono"].as_str(), p["telefono_fijo"].as_str(), p["email"].as_str(), p["email_jwpub"].as_str(), p["responsabilidades"].as_str(), p["disponibilidad"].as_str()])
                .map_err(|e| format!("Error en personas: {}", e))?;
            map_pers.insert(p["old_id"].as_i64().unwrap(), tx.last_insert_rowid());
        }
    }

    // 5. DETALLES OFICINA
    if let Some(detalles) = parsed["detalles_oficina"].as_array() {
        for d in detalles {
            if let Some(new_pers_id) = d["old_persona_id"].as_i64().and_then(|oid| map_pers.get(&oid)).copied() {
                tx.execute("INSERT INTO detalles_oficina (persona_id, responsabilidades, disponibilidad) VALUES (?1, ?2, ?3)", 
                    params![new_pers_id, d["responsabilidades"].as_str(), d["disponibilidad"].as_str()])
                    .map_err(|e| format!("Error en detalles_oficina: {}", e))?;
            }
        }
    }

    // 6. ACTUALIZAR COMITÉ
    let map_id = |key: &str| -> Option<i64> { asm[key].as_i64().and_then(|oid| map_pers.get(&oid)).copied() };
    tx.execute("UPDATE asambleas SET coordinador_id=?1, coordinador_aux_id=?2, prog_super_id=?3, prog_aux_id=?4, aloj_super_id=?5, aloj_aux_id=?6, audio_video_super_id=?7, video_super_id=?8, audio_super_id=?9, plataforma_super_id=?10, bautismo_super_id=?11, bautismo_aux_id=?12 WHERE id=?13",
        params![map_id("coordinador_id"), map_id("coordinador_aux_id"), map_id("prog_super_id"), map_id("prog_aux_id"), map_id("aloj_super_id"), map_id("aloj_aux_id"), map_id("audio_video_super_id"), map_id("video_super_id"), map_id("audio_super_id"), map_id("plataforma_super_id"), map_id("bautismo_super_id"), map_id("bautismo_aux_id"), nueva_asamblea_id])
        .map_err(|e| format!("Error actualizando comité: {}", e))?;

    // 7. PROGRAMA
    if let Some(prog) = parsed["programa"].as_array() {
        for p in prog {
            let new_orador_id = p["old_orador_id"].as_i64().and_then(|oid| map_pers.get(&oid)).copied();
            tx.execute("INSERT INTO programa (asamblea_id, dia, sesion, hora_inicio, tema, tipo, duracion, orador_id, es_video, estado, esta_presente, numero_bosquejo, ensayo_terminado, fuente, es_betelita, es_interprete, es_visitante, requiere_ensayo, fecha_ensayo, hora_ensayo, lugar_ensayo, notas_ensayo, check_viernes, check_dia, check_30m) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25)",
                params![nueva_asamblea_id, p["dia"].as_str(), p["sesion"].as_str(), p["hora_inicio"].as_str(), p["tema"].as_str(), p["tipo"].as_str(), p["duracion"].as_i64(), new_orador_id, p["es_video"].as_bool(), p["estado"].as_str(), p["esta_presente"].as_bool(), p["numero_bosquejo"].as_str(), p["ensayo_terminado"].as_bool(), p["fuente"].as_str(), p["es_betelita"].as_bool(), p["es_interprete"].as_bool(), p["es_visitante"].as_bool(), p["requiere_ensayo"].as_bool(), p["fecha_ensayo"].as_str(), p["hora_ensayo"].as_str(), p["lugar_ensayo"].as_str(), p["notas_ensayo"].as_str(), p["check_viernes"].as_bool(), p["check_dia"].as_bool(), p["check_30m"].as_bool()])
                .map_err(|e| format!("Error en programa: {}", e))?;
        }
    }

    // 8. ASIGNACIONES
    if let Some(asig) = parsed["asignaciones"].as_array() {
        for a in asig {
            if let Some(new_pers_id) = a["old_persona_id"].as_i64().and_then(|oid| map_pers.get(&oid)).copied() {
                tx.execute("INSERT INTO asignaciones_especiales (asamblea_id, dia, fecha, tipo_asignacion, persona_id, estado, esta_presente, ensayo_terminado) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                    params![nueva_asamblea_id, a["dia"].as_str(), a["fecha"].as_str(), a["tipo_asignacion"].as_str(), new_pers_id, a["estado"].as_str(), a["esta_presente"].as_bool(), a["ensayo_terminado"].as_bool()])
                    .map_err(|e| format!("Error en asignaciones: {}", e))?;
            }
        }
    }

    // 9. RECORDATORIOS
    if let Some(rec) = parsed["recordatorios"].as_array() {
        for r in rec {
            if let Some(new_pers_id) = r["old_persona_id"].as_i64().and_then(|oid| map_pers.get(&oid)).copied() {
                tx.execute("INSERT INTO recordatorios_oradores (asamblea_id, persona_id, texto, fecha_recordatorio) VALUES (?1,?2,?3,?4)",
                    params![nueva_asamblea_id, new_pers_id, r["texto"].as_str(), r["fecha_recordatorio"].as_str()])
                    .map_err(|e| format!("Error en recordatorios: {}", e))?;
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}