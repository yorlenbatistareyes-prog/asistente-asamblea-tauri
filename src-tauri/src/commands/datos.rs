use crate::database::obtener_ruta_db;
use tauri::{command, AppHandle};
use std::fs;
use rusqlite::Connection;

// --- 1. EXPORTAR (RESPALDO SEGURO) ---
#[command]
pub fn exportar_base_datos(app: AppHandle, ruta_destino: String) -> Result<String, String> {
    let ruta_db_actual = obtener_ruta_db(&app);
    
    // Usamos la conexión para hacer un backup "en caliente" seguro
    let conn = Connection::open(&ruta_db_actual).map_err(|e| e.to_string())?;

    // Si el archivo destino ya existe, lo borramos primero para evitar error de SQL
    if std::path::Path::new(&ruta_destino).exists() {
        let _ = fs::remove_file(&ruta_destino);
    }

    // VACUUM INTO crea una copia compactada y sin archivos temporales basura
    match conn.execute("VACUUM INTO ?", [ruta_destino]) {
        Ok(_) => Ok("Respaldo creado correctamente.".to_string()),
        Err(e) => Err(format!("Error al generar respaldo: {}", e)),
    }
}

// --- 2. IMPORTAR (PREPARAR PARA REINICIO) ---
#[command]
pub fn importar_base_datos(app: AppHandle, ruta_origen: String) -> Result<String, String> {
    let ruta_db_actual = obtener_ruta_db(&app);
    let ruta_pendiente = ruta_db_actual.with_file_name("restaurar_pendiente.sqlite");

    // Forzamos cierre limpio del WAL antes de copiar
    if let Ok(conn) = Connection::open(&ruta_db_actual) {
        let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE);", []);
        let _ = conn.execute("PRAGMA journal_mode=DELETE;", []);
    }

    match fs::copy(&ruta_origen, &ruta_pendiente) {
        Ok(_) => Ok("Datos preparados. La aplicación se reiniciará para aplicar los cambios.".to_string()),
        Err(e) => Err(format!("Error al preparar la restauración: {}", e)),
    }
}

// --- 3. LIMPIAR TODO (BORRADO PROFUNDO) ---
#[command]
pub fn limpiar_datos(app: AppHandle) -> Result<String, String> {
    let db_path = obtener_ruta_db(&app);
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Borramos datos pero mantenemos la estructura
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
        -- Reiniciar contadores, excepto configuración
        DELETE FROM sqlite_sequence WHERE name != 'configuracion';
        PRAGMA foreign_keys = ON;
    "#;

    conn.execute_batch(sql).map_err(|e| e.to_string())?;

    // Forzamos limpieza de archivo WAL
    let _ = conn.execute("VACUUM", []); 

    Ok("Base de datos vaciada correctamente.".to_string())
}