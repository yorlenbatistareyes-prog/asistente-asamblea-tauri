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
    asamblea_id: i32, // <--- NUEVO: Para saber de qué asamblea es
    nombre: String,
    circuito: String,
    numero: String,
) -> Result<String, String> {
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let nombre = nombre.split_whitespace().collect::<Vec<_>>().join(" ");
    let clave_nombre = crate::database::normalizar_clave(&nombre);
    if clave_nombre.is_empty() {
        return Err("El nombre de la congregación no puede estar vacío.".to_string());
    }

    let nombres_existentes = {
        let mut stmt = tx
            .prepare("SELECT nombre FROM congregaciones WHERE asamblea_id = ?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![asamblea_id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };
    if nombres_existentes
        .iter()
        .any(|existente| crate::database::normalizar_clave(existente) == clave_nombre)
    {
        return Ok("La congregación ya existe en esta asamblea; no se añadió un duplicado.".to_string());
    }

    tx.execute(
        "INSERT INTO congregaciones (asamblea_id, nombre, circuito, numero_congregacion) VALUES (?1, ?2, ?3, ?4)",
        params![asamblea_id, nombre, circuito, numero],
    )
    .map_err(|e| format!("Error: {}", e))?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok("Congregación guardada".to_string())
}

#[command]
pub fn obtener_congregaciones(
    app: AppHandle,
    asamblea_id: i32,
) -> Result<Vec<Congregacion>, String> {
    let conn = conectar_db(&app);

    // FILTRAMOS POR ASAMBLEA (WHERE asamblea_id = ?1)
    let mut stmt = conn.prepare("SELECT id, nombre, circuito, numero_congregacion FROM congregaciones WHERE asamblea_id = ?1 ORDER BY nombre ASC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![asamblea_id], |row| {
            Ok(Congregacion {
                id: row.get(0)?,
                nombre: row.get(1)?,
                circuito: row.get(2).ok(),
                numero_congregacion: row.get(3).ok(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut lista = Vec::new();
    for item in iter {
        if let Ok(c) = item {
            lista.push(c);
        }
    }
    Ok(lista)
}

#[command]
pub fn eliminar_congregacion(app: AppHandle, id: i32) -> Result<String, String> {
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 1. Desvincular personas (se mantiene igual, borra por ID único de congregación)
    tx.execute(
        "UPDATE personas SET id_congregacion = NULL WHERE id_congregacion = ?1",
        params![id],
    )
    .map_err(|e| format!("Error al desvincular: {}", e))?;

    // 2. Borrar congregación
    tx.execute("DELETE FROM congregaciones WHERE id = ?1", params![id])
        .map_err(|e| format!("Error al eliminar: {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok("Congregación eliminada".to_string())
}

#[command]
pub fn limpiar_congregaciones(app: AppHandle, asamblea_id: i32) -> Result<String, String> {
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 1. Desvincular personas SOLO de las congregaciones de ESTA asamblea
    // (Buscamos las congregaciones de esta asamblea y les quitamos la gente)
    tx.execute(
        "UPDATE personas SET id_congregacion = NULL WHERE id_congregacion IN (SELECT id FROM congregaciones WHERE asamblea_id = ?1)",
        params![asamblea_id]
    ).map_err(|e| format!("Error al desvincular: {}", e))?;

    // 2. Borrar congregaciones SOLO de esta asamblea
    tx.execute(
        "DELETE FROM congregaciones WHERE asamblea_id = ?1",
        params![asamblea_id],
    )
    .map_err(|e| format!("Error al limpiar: {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok("Todas las congregaciones de esta asamblea han sido eliminadas".to_string())
}
