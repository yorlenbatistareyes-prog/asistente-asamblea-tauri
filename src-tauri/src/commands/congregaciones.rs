use crate::models::Congregacion;
use rusqlite::{params, Connection, Result};
use tauri::{command, AppHandle};

fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

#[command]
pub fn crear_congregacion(
    app: AppHandle,
    nombre: String,
    circuito: String,
    numero: String,
) -> Result<String, String> {
    let conn = conectar_db(&app);
    match conn.execute(
        "INSERT INTO congregaciones (nombre, circuito, numero_congregacion) VALUES (?1, ?2, ?3)",
        params![nombre, circuito, numero],
    ) {
        Ok(_) => Ok("Congregación guardada".to_string()),
        Err(e) => Err(format!("Error: {}", e)),
    }
}

#[command]
pub fn obtener_congregaciones(app: AppHandle) -> Result<Vec<Congregacion>, String> {
    let conn = conectar_db(&app);
    let mut stmt = conn.prepare("SELECT id, nombre, circuito, numero_congregacion FROM congregaciones ORDER BY nombre ASC")
        .map_err(|e| e.to_string())?;

    let iter = stmt.query_map([], |row| {
        Ok(Congregacion {
            id: row.get(0)?,
            nombre: row.get(1)?,
            circuito: row.get(2).ok(),
            numero_congregacion: row.get(3).ok(),
        })
    }).map_err(|e| e.to_string())?;

    let mut lista = Vec::new();
    for item in iter {
        if let Ok(c) = item { lista.push(c); }
    }
    Ok(lista)
}

#[command]
pub fn eliminar_congregacion(app: AppHandle, id: i32) -> Result<String, String> {
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 1. Desvincular personas
    tx.execute("UPDATE personas SET id_congregacion = NULL WHERE id_congregacion = ?1", params![id])
        .map_err(|e| format!("Error al desvincular: {}", e))?;

    // 2. Borrar congregación
    tx.execute("DELETE FROM congregaciones WHERE id = ?1", params![id])
        .map_err(|e| format!("Error al eliminar: {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok("Congregación eliminada".to_string())
}

#[command]
pub fn limpiar_congregaciones(app: AppHandle) -> Result<String, String> {
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("UPDATE personas SET id_congregacion = NULL", [])
        .map_err(|e| format!("Error al desvincular: {}", e))?;

    tx.execute("DELETE FROM congregaciones", [])
        .map_err(|e| format!("Error al limpiar: {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok("Todas las congregaciones eliminadas".to_string())
}