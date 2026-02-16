use crate::database;
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::{command, AppHandle};

#[derive(Serialize)]
pub struct PlantillaCarta {
    pub cuerpo: String,
}

#[command]
pub fn obtener_plantilla(app: AppHandle, id: String) -> Result<PlantillaCarta, String> {
    let db_path = database::obtener_ruta_db(&app);
    let conn = Connection::open(db_path).map_err(|e| format!("Error al abrir DB: {}", e))?;

    // Aseguramos la tabla
    conn.execute(
        "CREATE TABLE IF NOT EXISTS plantillas_cartas (
            id TEXT PRIMARY KEY,
            contenido_html TEXT
        )",
        [],
    )
    .map_err(|e| format!("Error al verificar tabla: {}", e))?;

    // Usamos trim() en el ID para evitar errores por espacios invisibles
    let id_limpio = id.trim();

    let mut stmt = conn
        .prepare("SELECT contenido_html FROM plantillas_cartas WHERE id = ?1")
        .map_err(|e| format!("Error al preparar consulta: {}", e))?;

    let result = stmt.query_row(params![id_limpio], |row| row.get::<_, String>(0));

    match result {
        Ok(contenido) => Ok(PlantillaCarta { cuerpo: contenido }),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // Este es el texto que ves en el PDF cuando la DB no encuentra el ID
            Ok(PlantillaCarta {
                cuerpo: "<p>Estimado hermano [[Nombre]]:</p><p>Escriba aquí el contenido de la carta...</p>".to_string()
            })
        }
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
    )
    .map_err(|e| format!("Error creando tabla: {}", e))?;

    let id_limpio = id.trim();

    // INSERT OR REPLACE asegura que se sobrescriba la plantilla vieja
    conn.execute(
        "INSERT OR REPLACE INTO plantillas_cartas (id, contenido_html) VALUES (?1, ?2)",
        params![id_limpio, contenido],
    )
    .map_err(|e| format!("Error al guardar permanentemente: {}", e))?;

    Ok(())
}
