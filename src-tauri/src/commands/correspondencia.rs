use rusqlite::{params, Connection, Result};
use tauri::{command, AppHandle};

#[command]
pub fn obtener_plantilla(app: AppHandle, id: String) -> Result<String, String> {
    let db_path = crate::database::obtener_ruta_db(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT contenido_html FROM plantillas_cartas WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    
    let contenido: String = stmt.query_row([id], |row| row.get(0))
        .unwrap_or_else(|_| "Escribe tu plantilla aquí...".to_string());
        
    Ok(contenido)
}

#[command]
pub fn guardar_plantilla(app: AppHandle, id: String, contenido: String) -> Result<(), String> {
    let db_path = crate::database::obtener_ruta_db(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT OR REPLACE INTO plantillas_cartas (id, contenido_html) VALUES (?1, ?2)",
        params![id, contenido],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}
