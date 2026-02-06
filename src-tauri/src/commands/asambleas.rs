use crate::models::Asamblea;
use rusqlite::{params, Connection, Result};
use tauri::{command, AppHandle};

fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

// 1. GUARDAR INFORMACIÓN
#[command]
pub fn guardar_info_evento(
    app: AppHandle,
    id: Option<i32>,
    tema: String,
    fecha: String,
    local_id: Option<i32>,
    ensayo_lugar: String,
    ensayo_fecha: String,
    ensayo_hora: String,
    ensayo_notas: String,
    recorridos_info: String,
    instrucciones_esp: String,
    es_jw_stream: bool,
) -> Result<String, String> {
    let conn = conectar_db(&app);
    let stream_val = if es_jw_stream { 1 } else { 0 };

    if let Some(actual_id) = id {
        conn.execute(
            "UPDATE asambleas SET 
                tema=?1, fecha=?2, local_id=?3, 
                ensayo_lugar=?4, ensayo_fecha=?5, ensayo_hora=?6, 
                ensayo_notas=?7, recorridos_info=?8, instrucciones_esp=?9, 
                jw_stream_studio=?10 
              WHERE id=?11",
            params![
                tema,
                fecha,
                local_id,
                ensayo_lugar,
                ensayo_fecha,
                ensayo_hora,
                ensayo_notas,
                recorridos_info,
                instrucciones_esp,
                stream_val,
                actual_id
            ],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO asambleas (
                tema, fecha, local_id, 
                ensayo_lugar, ensayo_fecha, ensayo_hora, 
                ensayo_notas, recorridos_info, instrucciones_esp, 
                jw_stream_studio
            ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                tema,
                fecha,
                local_id,
                ensayo_lugar,
                ensayo_fecha,
                ensayo_hora,
                ensayo_notas,
                recorridos_info,
                instrucciones_esp,
                stream_val
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok("Información actualizada correctamente".to_string())
}

// 2. GUARDAR COMITÉ
#[command]
pub fn guardar_comite(app: AppHandle, presidente_id: Option<i32>) -> Result<String, String> {
    let conn = conectar_db(&app);
    conn.execute(
        "UPDATE asambleas SET presidente_id = ?1 WHERE id = (SELECT MAX(id) FROM asambleas)",
        params![presidente_id],
    )
    .map_err(|e| e.to_string())?;
    Ok("Comité guardado".to_string())
}

// 3. OBTENER ASAMBLEA
#[command]
pub fn obtener_asamblea_activa(app: AppHandle) -> Result<Option<Asamblea>, String> {
    let conn = conectar_db(&app);

    let sql = "
        SELECT 
            a.id, a.tema, a.fecha, a.local_id, a.presidente_id,
            a.ensayo_lugar, a.ensayo_fecha, a.ensayo_hora, 
            a.ensayo_notas, a.recorridos_info, a.instrucciones_esp, 
            a.jw_stream_studio,
            l.nombre as nombre_local
        FROM asambleas a
        LEFT JOIN locales l ON a.local_id = l.id
        ORDER BY a.id DESC 
        LIMIT 1
    ";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let asamblea_iter = stmt
        .query_map([], |row| {
            Ok(Asamblea {
                id: row.get(0)?,
                tema: row.get(1)?,
                fecha: row.get(2)?,
                local_id: row.get(3).ok(),
                presidente_id: row.get(4).ok(),
                ensayo_lugar: row.get(5).unwrap_or_default(),
                ensayo_fecha: row.get(6).unwrap_or_default(),
                ensayo_hora: row.get(7).unwrap_or_default(),
                ensayo_notas: row.get(8).unwrap_or_default(),
                recorridos_info: row.get(9).unwrap_or_default(),
                instrucciones_esp: row.get(10).unwrap_or_default(),
                jw_stream_studio: row.get::<_, i32>(11).unwrap_or(0) == 1,
                nombre_local: row.get(12).ok(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut lista = Vec::new();
    for a in asamblea_iter {
        if let Ok(item) = a {
            lista.push(item);
        }
    }
    Ok(lista.into_iter().next())
}

// 4. CREAR ASAMBLEA (CORREGIDO)
#[tauri::command]
pub fn crear_asamblea(
    app: AppHandle,
    tema: String,
    fecha: String,
    _lugar: String,
    local_id: Option<i32>,
) -> Result<i64, String> {
    let conn = conectar_db(&app);

    conn.execute(
        "INSERT INTO asambleas (
            tema, fecha, 
            local_id, 
            ensayo_lugar, 
            jw_stream_studio, ensayo_notas, recorridos_info, ensayo_fecha, ensayo_hora, instrucciones_esp
        ) VALUES (?1, ?2, ?3, '', 0, '', '', '', '', '')",
        params![tema, fecha, local_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

// 5. LISTAR
#[command]
pub fn obtener_asambleas(app: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let conn = conectar_db(&app);
    let mut stmt = conn
        .prepare("SELECT id, tema, fecha FROM asambleas ORDER BY id DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "tema": row.get::<_, String>(1)?,
                "fecha": row.get::<_, String>(2)?,
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut asambleas = Vec::new();
    for row in rows {
        asambleas.push(row.map_err(|e| e.to_string())?);
    }
    Ok(asambleas)
}

#[command]
pub fn eliminar_asamblea(app: AppHandle, id: i64) -> Result<(), String> {
    let conn = conectar_db(&app);
    conn.execute("DELETE FROM asambleas WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}