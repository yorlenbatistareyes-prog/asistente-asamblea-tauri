use crate::models::Local;
use rusqlite::{Connection, Result};
use tauri::{command, AppHandle};

// Función auxiliar para conectar a la base de datos
fn conectar_db(app: &AppHandle) -> Connection {
    // Usamos la ruta centralizada de database.rs
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

// COMANDO 1: Crear un nuevo local
#[command]
pub fn crear_local(
    app: AppHandle,
    nombre: String,
    direccion: String,
    capacidad: i32,
) -> Result<String, String> {
    let conn = conectar_db(&app);

    match conn.execute(
        "INSERT INTO locales (nombre, direccion, capacidad) VALUES (?1, ?2, ?3)",
        &[&nombre, &direccion, &capacidad.to_string()],
    ) {
        Ok(_) => Ok("Local guardado correctamente".to_string()),
        Err(e) => Err(format!("Error al guardar: {}", e)),
    }
}

// COMANDO 2: Obtener la lista de locales
#[command]
pub fn obtener_locales(app: AppHandle) -> Result<Vec<Local>, String> {
    let conn = conectar_db(&app);

    // Agregamos un map_err simple para seguridad, igual que en los otros archivos
    let mut stmt = conn
        .prepare("SELECT id, nombre, direccion, capacidad FROM locales ORDER BY id DESC")
        .map_err(|e| e.to_string())?;

    let locales_iter = stmt
        .query_map([], |row| {
            Ok(Local {
                id: row.get(0)?,
                nombre: row.get(1)?,
                direccion: row.get(2).ok(),
                capacidad: row.get(3).ok(),
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
