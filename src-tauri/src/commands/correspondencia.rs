use tauri::{command, AppHandle};
use rusqlite::{params, Connection};

// Asumimos que tienes una función pública en database.rs para obtener la ruta
// Si no la tienes pública, asegúrate de añadir 'pub' en src/database.rs
use crate::database; 

#[command]
pub fn obtener_plantilla(app: AppHandle, id: String) -> Result<String, String> {
    // 1. Obtener ruta de la DB
    let db_path = database::obtener_ruta_db(&app);
    
    // 2. Abrir conexión
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Error al abrir DB: {}", e))?;

    // 3. Preparar consulta
    // Usamos 'optional' para manejar elegantemente si no existe el registro
    let mut stmt = conn
        .prepare("SELECT contenido_html FROM plantillas_cartas WHERE id = ?1")
        .map_err(|e| format!("Error al preparar consulta: {}", e))?;

    // 4. Ejecutar y mapear
    let result = stmt.query_row(params![id], |row| {
        row.get::<_, String>(0)
    });

    // 5. Manejar resultado
    match result {
        Ok(contenido) => Ok(contenido),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // Si no hay plantilla guardada, devolvemos un texto por defecto o vacío
            Ok("<p>Escribe aquí el contenido de la carta...</p>".to_string())
        },
        Err(e) => Err(format!("Error al leer plantilla: {}", e)),
    }
}

#[command]
pub fn guardar_plantilla(app: AppHandle, id: String, contenido: String) -> Result<(), String> {
    let db_path = database::obtener_ruta_db(&app);
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Error al abrir DB: {}", e))?;

    // 6. Asegurar que la tabla existe (Por seguridad, aunque debería estar en init_db)
    // Esto previene errores si la tabla 'plantillas_cartas' no fue creada en la migración inicial
    conn.execute(
        "CREATE TABLE IF NOT EXISTS plantillas_cartas (
            id TEXT PRIMARY KEY,
            contenido_html TEXT
        )",
        [],
    ).map_err(|e| format!("Error creando tabla: {}", e))?;

    // 7. Insertar o Reemplazar (Upsert)
    conn.execute(
        "INSERT OR REPLACE INTO plantillas_cartas (id, contenido_html) VALUES (?1, ?2)",
        params![id, contenido],
    )
    .map_err(|e| format!("Error al guardar plantilla: {}", e))?;

    Ok(())
}