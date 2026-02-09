use tauri::{command, AppHandle};
use rusqlite::{params, Connection};
use serde::Serialize;
use crate::database;

#[derive(Serialize)]
pub struct PlantillaCarta {
    cuerpo: String,
}

#[command]
pub fn obtener_plantilla(app: AppHandle, id: String) -> Result<PlantillaCarta, String> {
    let db_path = database::obtener_ruta_db(&app);
    let conn = Connection::open(db_path).map_err(|e| format!("Error al abrir DB: {}", e))?;

    // Aseguramos que la tabla exista antes de intentar leer, por si es la primera vez
    conn.execute(
        "CREATE TABLE IF NOT EXISTS plantillas_cartas (
            id TEXT PRIMARY KEY,
            contenido_html TEXT
        )",
        [],
    ).map_err(|e| format!("Error al verificar tabla: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT contenido_html FROM plantillas_cartas WHERE id = ?1")
        .map_err(|e| format!("Error al preparar consulta: {}", e))?;

    let result = stmt.query_row(params![id], |row| {
        row.get::<_, String>(0)
    });

    match result {
        Ok(contenido) => Ok(PlantillaCarta { cuerpo: contenido }),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // Si no existe, devolvemos una estructura base útil
            Ok(PlantillaCarta {
                cuerpo: "<p>Estimado hermano [[Nombre]]:</p><p>Escriba aquí el contenido de la carta...</p>".to_string()
            })
        },
        Err(e) => Err(format!("Error al leer plantilla: {}", e)),
    }
}

#[command]
pub fn guardar_plantilla(app: AppHandle, id: String, contenido: String) -> Result<(), String> {
    let db_path = database::obtener_ruta_db(&app);
    let conn = Connection::open(db_path).map_err(|e| format!("Error al abrir DB: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS plantillas_cartas (
            id TEXT PRIMARY KEY,
            contenido_html TEXT
        )",
        [],
    ).map_err(|e| format!("Error creando tabla: {}", e))?;

    // Usamos INSERT OR REPLACE para que el ID sea único y siempre se actualice el contenido
    conn.execute(
        "INSERT OR REPLACE INTO plantillas_cartas (id, contenido_html) VALUES (?1, ?2)",
        params![id, contenido],
    ).map_err(|e| format!("Error al guardar permanentemente: {}", e))?;

    Ok(())
}