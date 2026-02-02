use rusqlite::{params, Connection, Result};
use tauri::{command, AppHandle};

#[command]
pub fn obtener_plantilla(app: AppHandle, id: String) -> Result<String, String> {
    // 1. Obtenemos la conexión usando tu módulo de base de datos existente
    let db_path = crate::database::obtener_ruta_db(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    // 2. Preparamos la consulta
    let mut stmt = conn.prepare("SELECT contenido_html FROM plantillas_cartas WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    
    // 3. Ejecutamos la consulta
    // NOTA: Usamos params![id] para consistencia y evitar errores de tipos
    let result: Result<String, _> = stmt.query_row(params![id], |row| row.get(0));

    // 4. Manejamos el resultado: Si existe devuelve el texto, si no existe devuelve texto por defecto
    match result {
        Ok(contenido) => Ok(contenido),
        Err(_) => Ok("<p>Escribe el contenido de la carta aquí...</p>".to_string()),
    }
}

#[command]
pub fn guardar_plantilla(app: AppHandle, id: String, contenido: String) -> Result<(), String> {
    let db_path = crate::database::obtener_ruta_db(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    // 5. Insertar o Reemplazar (Upsert)
    conn.execute(
        "INSERT OR REPLACE INTO plantillas_cartas (id, contenido_html) VALUES (?1, ?2)",
        params![id, contenido],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}
