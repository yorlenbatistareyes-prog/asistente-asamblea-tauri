use crate::database::obtener_ruta_db;
use rusqlite::Connection;
use std::fs;
use tauri::{command, AppHandle};

// 1. EXPORTAR (RESPALDO)
#[command]
pub fn exportar_base_datos(app: AppHandle, ruta_destino: String) -> Result<String, String> {
    let ruta_db_actual = obtener_ruta_db(&app);
    match fs::copy(&ruta_db_actual, &ruta_destino) {
        Ok(_) => Ok("Respaldo creado correctamente".to_string()),
        Err(e) => Err(format!("Error: {}", e)),
    }
}

// 2. IMPORTAR (RESTAURAR)
#[command]
pub fn importar_base_datos(app: AppHandle, ruta_origen: String) -> Result<String, String> {
    let ruta_db_actual = obtener_ruta_db(&app);

    // Backup temporal por seguridad
    let ruta_backup = ruta_db_actual.with_extension("bak");
    if ruta_db_actual.exists() {
        let _ = fs::copy(&ruta_db_actual, &ruta_backup);
    }

    match fs::copy(&ruta_origen, &ruta_db_actual) {
        Ok(_) => Ok("Restauración completada".to_string()),
        Err(e) => {
            let _ = fs::rename(&ruta_backup, &ruta_db_actual); // Restaurar backup si falla
            Err(format!("Error: {}", e))
        }
    }
}

// 3. LIMPIAR TODO
#[command]
pub fn limpiar_datos(app: AppHandle) -> Result<String, String> {
    let db_path = obtener_ruta_db(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    // Borramos todo EXCEPTO la tabla 'configuracion'
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
        DELETE FROM sqlite_sequence WHERE name != 'configuracion';
        PRAGMA foreign_keys = ON;
    "#;

    conn.execute_batch(sql).map_err(|e| e.to_string())?;
    Ok("Base de datos vaciada".to_string())
}
