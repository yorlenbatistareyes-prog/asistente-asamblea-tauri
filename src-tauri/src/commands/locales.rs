use crate::models::Local;
use rusqlite::{params, Connection, Result};
use tauri::{command, AppHandle};

// Función auxiliar para conectar a la base de datos
fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

// COMANDO 1: Crear un nuevo local
#[command]
pub fn crear_local(
    app: AppHandle,
    nombre: String,
    direccion: String,
    ciudad: String,      // <--- NUEVO ARGUMENTO
    estado: String,      // <--- NUEVO ARGUMENTO
    capacidad: i32,
) -> Result<String, String> {
    let conn = conectar_db(&app);

    // Actualizamos la consulta SQL para incluir ciudad y estado
    match conn.execute(
        "INSERT INTO locales (nombre, direccion, ciudad, estado, capacidad) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![nombre, direccion, ciudad, estado, capacidad],
    ) {
        Ok(_) => Ok("Local guardado correctamente".to_string()),
        Err(e) => Err(format!("Error al guardar: {}", e)),
    }
}

// COMANDO 2: Obtener la lista de locales
#[command]
pub fn obtener_locales(app: AppHandle) -> Result<Vec<Local>, String> {
    let conn = conectar_db(&app);

    // Actualizamos el SELECT para traer ciudad y estado
    let mut stmt = conn
        .prepare("SELECT id, nombre, direccion, ciudad, estado, capacidad FROM locales ORDER BY nombre ASC")
        .map_err(|e| e.to_string())?;

    let locales_iter = stmt
        .query_map([], |row| {
            Ok(Local {
                id: row.get(0)?,
                nombre: row.get(1)?,
                direccion: row.get(2).ok(),
                ciudad: row.get(3).ok(),     // <--- RECUPERAMOS CIUDAD
                estado: row.get(4).ok(),     // <--- RECUPERAMOS ESTADO
                capacidad: row.get(5).ok(),  // (Se desplaza el índice de capacidad)
            })
        })
        .map_err(|e| e.to_string())?;

    let mut locales = Vec::new();
    for local in locales_iter {
        if let Ok(l) = local {
            locales.push(l);
        }
    }

    Ok(locales)
}

// COMANDO 3: Eliminar un local
#[command]
pub fn eliminar_local(app: AppHandle, id: i32) -> Result<String, String> {
    let conn = conectar_db(&app);
    
    // Si borras un salón, desvinculamos las asambleas que lo usaban
    conn.execute("UPDATE asambleas SET local_id = NULL WHERE local_id = ?1", params![id]).ok();

    match conn.execute("DELETE FROM locales WHERE id = ?1", params![id]) {
        Ok(_) => Ok("Local eliminado".to_string()),
        Err(e) => Err(format!("Error al eliminar: {}", e)),
    }
}