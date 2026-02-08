use tauri::{command, AppHandle};
use rusqlite::{params, Connection};
use crate::database;

// Estructura para devolver los datos al Frontend
#[derive(serde::Serialize)]
pub struct PlantillaMensaje {
    asunto: String,
    cuerpo: String,
}

#[command]
pub fn obtener_plantilla_mensaje(app: AppHandle, id: String) -> Result<PlantillaMensaje, String> {
    let db_path = database::obtener_ruta_db(&app);
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Error DB: {}", e))?;

    // Recuperamos asunto y cuerpo
    let mut stmt = conn
        .prepare("SELECT asunto, cuerpo FROM plantillas_mensajeria WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let result = stmt.query_row(params![id], |row| {
        Ok(PlantillaMensaje {
            asunto: row.get(0)?,
            cuerpo: row.get(1)?,
        })
    });

    match result {
        Ok(data) => Ok(data),
        Err(_) => {
            // Si no existe, devolvemos cadenas vacías para que el frontend use sus defaults
            Ok(PlantillaMensaje {
                asunto: "".to_string(),
                cuerpo: "".to_string(),
            })
        },
    }
}

#[command]
pub fn guardar_plantilla_mensaje(app: AppHandle, id: String, asunto: String, cuerpo: String) -> Result<(), String> {
    let db_path = database::obtener_ruta_db(&app);
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Error DB: {}", e))?;

    // Crear tabla si no existe (con columna extra para 'asunto')
    conn.execute(
        "CREATE TABLE IF NOT EXISTS plantillas_mensajeria (
            id TEXT PRIMARY KEY,
            asunto TEXT,
            cuerpo TEXT
        )",
        [],
    ).map_err(|e| e.to_string())?;

    // Guardar o Actualizar
    conn.execute(
        "INSERT OR REPLACE INTO plantillas_mensajeria (id, asunto, cuerpo) VALUES (?1, ?2, ?3)",
        params![id, asunto, cuerpo],
    )
    .map_err(|e| format!("Error al guardar: {}", e))?;

    Ok(())
}