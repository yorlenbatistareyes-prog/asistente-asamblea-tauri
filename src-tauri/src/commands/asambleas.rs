use crate::models::Asamblea;
use rusqlite::{params, Connection, Result};
use tauri::{command, AppHandle};

fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

#[command]
pub fn guardar_info_evento(
    app: AppHandle,
    id: Option<i32>,
    tema: String,
    fecha: String,
    local_id: i32,
    ensayo_lugar: String,  // <--- NUEVO
    ensayo_fecha: String,  // <--- NUEVO
    ensayo_hora: String,   // <--- NUEVO
    ensayo_notas: String,  // <--- NUEVO
    es_jw_stream: bool     // <--- NUEVO
) -> Result<String, String> {
    let conn = conectar_db(&app);
    
    // Convertimos bool a integer para SQLite
    let stream_val = if es_jw_stream { 1 } else { 0 };

    if let Some(actual_id) = id {
        conn.execute(
            "UPDATE asambleas SET tema=?1, fecha=?2, local_id=?3, ensayo_lugar=?4, ensayo_fecha=?5, ensayo_hora=?6, ensayo_notas=?7, jw_stream_studio=?8 WHERE id=?9",
            params![tema, fecha, local_id, ensayo_lugar, ensayo_fecha, ensayo_hora, ensayo_notas, stream_val, actual_id],
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO asambleas (tema, fecha, local_id, ensayo_lugar, ensayo_fecha, ensayo_hora, ensayo_notas, jw_stream_studio) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![tema, fecha, local_id, ensayo_lugar, ensayo_fecha, ensayo_hora, ensayo_notas, stream_val],
        ).map_err(|e| e.to_string())?;
    }
    Ok("Información actualizada".to_string())
}

#[command]
pub fn guardar_comite(app: AppHandle, presidente_id: Option<i32>) -> Result<String, String> {
    let conn = conectar_db(&app);
    // Actualizamos solo el presidente de la asamblea activa
    conn.execute(
        "UPDATE asambleas SET presidente_id = ?1 WHERE id = (SELECT MAX(id) FROM asambleas)",
        params![presidente_id]
    ).map_err(|e| e.to_string())?;
    
    Ok("Comité guardado".to_string())
}

#[command]
pub fn obtener_asamblea_activa(app: AppHandle) -> Result<Option<Asamblea>, String> {
    let conn = conectar_db(&app);
    
    // Hacemos JOIN con 'locales' para obtener el nombre del local
    let sql = "
        SELECT 
            a.id, 
            a.tema, 
            a.fecha, 
            a.local_id, 
            a.presidente_id,
            l.nombre as nombre_local
        FROM asambleas a
        LEFT JOIN locales l ON a.local_id = l.id
        ORDER BY a.id DESC 
        LIMIT 1
    ";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    
    let asamblea_iter = stmt.query_map([], |row| {
        Ok(Asamblea {
            id: row.get(0)?,
            tema: row.get(1)?,
            fecha: row.get(2)?,
            local_id: row.get(3).ok(),
            presidente_id: row.get(4).ok(),
            nombre_local: row.get(5).ok(), // Correcto
        })
    }).map_err(|e| e.to_string())?;

    let mut lista = Vec::new();
    for a in asamblea_iter {
        lista.push(a.map_err(|e| e.to_string())?);
    }
    
    Ok(lista.into_iter().next())
}

// --- NUEVAS FUNCIONES PARA EL TABLERO (AGREGADAS) ---

#[tauri::command]
pub fn crear_asamblea(app: AppHandle, tema: String, fecha: String, lugar: String) -> Result<i64, String> {
    let conn = conectar_db(&app);

    // Insertamos la nueva asamblea inicializando TODOS los campos necesarios.
    // - local_id: NULL (se elegirá después)
    // - jw_stream_studio: 0 (falso por defecto)
    // - Resto de campos de texto: '' (vacíos para evitar errores de null en Svelte)
    conn.execute(
        "INSERT INTO asambleas (
            tema, fecha, ensayo_lugar, 
            local_id, jw_stream_studio, 
            ensayo_notas, recorridos_info,
            ensayo_fecha, ensayo_hora, instrucciones_esp
        ) VALUES (?1, ?2, ?3, NULL, 0, '', '', '', '', '')",
        params![tema, fecha, lugar],
    ).map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[command]
pub fn obtener_asambleas(app: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let conn = conectar_db(&app);

    // Obtenemos una lista ligera para mostrar en el tablero
    let mut stmt = conn.prepare("SELECT id, tema, fecha, ensayo_lugar FROM asambleas ORDER BY id DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "tema": row.get::<_, String>(1)?,
            "fecha": row.get::<_, String>(2)?,
            "lugar": row.get::<_, String>(3).unwrap_or_default(),
        }))
    }).map_err(|e| e.to_string())?;

    let mut asambleas = Vec::new();
    for row in rows {
        asambleas.push(row.map_err(|e| e.to_string())?);
    }
    Ok(asambleas)
}

#[command]
pub fn eliminar_asamblea(app: AppHandle, id: i64) -> Result<(), String> {
    let conn = conectar_db(&app);

    // Borramos la asamblea especificada
    conn.execute("DELETE FROM asambleas WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

