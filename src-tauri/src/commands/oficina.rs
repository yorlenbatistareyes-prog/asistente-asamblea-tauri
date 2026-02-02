// src-tauri/src/commands/oficina.rs

use crate::models::AsignacionEspecialDTO;
use rusqlite::{params, Connection, Result};
use tauri::{command, AppHandle};

fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

// --- LECTURA: Obtener todas las asignaciones especiales de un día ---
#[command]
pub fn obtener_asignaciones_especiales(app: AppHandle, dia: String) -> Result<Vec<AsignacionEspecialDTO>, String> {
    let conn = conectar_db(&app);
    
    let sql = "
        SELECT 
            ae.id, 
            ae.tipo_asignacion, 
            ae.persona_id, 
            p.nombre_completo,
            c.nombre as nombre_congregacion
        FROM asignaciones_especiales ae
        JOIN personas p ON ae.persona_id = p.id
        LEFT JOIN congregaciones c ON p.id_congregacion = c.id
        WHERE ae.dia = ?1
    ";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    
    let filas = stmt.query_map(params![dia], |row| {
        Ok(AsignacionEspecialDTO {
            id: row.get(0)?,
            tipo_asignacion: row.get(1)?,
            persona_id: row.get(2)?,
            nombre_completo: row.get(3)?,
            nombre_congregacion: row.get(4).ok(),
        })
    }).map_err(|e| e.to_string())?;

    let mut resultado = Vec::new();
    for fila in filas {
        resultado.push(fila.map_err(|e| e.to_string())?);
    }
    Ok(resultado)
}

// --- ESCRITURA: Guardar una asignación ---
#[command]
pub fn guardar_asignacion_especial(
    app: AppHandle, 
    dia: String, 
    tipo_asignacion: String, 
    persona_id: i32
) -> Result<String, String> {
    let conn = conectar_db(&app);
    
    // Lógica especial:
    // - Si es 'personal_oficina', pueden haber varios, solo insertamos (el índice único evita duplicados exactos).
    // - Si es otro rol (ej. 'presidente_manana'), solo puede haber UNO por día. Borramos el anterior si existe.
    
    if tipo_asignacion != "personal_oficina" {
        conn.execute(
            "DELETE FROM asignaciones_especiales WHERE dia = ?1 AND tipo_asignacion = ?2",
            params![dia, tipo_asignacion]
        ).map_err(|e| e.to_string())?;
    }

    conn.execute(
        "INSERT INTO asignaciones_especiales (dia, tipo_asignacion, persona_id) VALUES (?1, ?2, ?3)",
        params![dia, tipo_asignacion, persona_id]
    ).map_err(|e| e.to_string())?;
    
    Ok("Asignación guardada".to_string())
}

// --- BORRADO: Eliminar una asignación específica (útil para personal de oficina) ---
#[command]
pub fn eliminar_asignacion_especial(app: AppHandle, id: i32) -> Result<String, String> {
    let conn = conectar_db(&app);
    conn.execute("DELETE FROM asignaciones_especiales WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok("Asignación eliminada".to_string())
}
