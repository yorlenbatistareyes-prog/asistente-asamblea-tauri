use crate::models::Persona;
use rusqlite::{params, Connection, Result};
use tauri::{command, AppHandle};

fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

#[command]
pub fn crear_persona(
    app: AppHandle,
    nombre_completo: String,
    genero: String,
    privilegios: String,
    id_congregacion: i32, // Viene como 0 si no tiene congregación
    telefono: String,
    email: String,
) -> Result<String, String> {
    let conn = conectar_db(&app);
    
    // TRUCO: Si es 0, lo convertimos en None (NULL en SQL)
    let id_cong_final = if id_congregacion == 0 { None } else { Some(id_congregacion) };

    match conn.execute(
        "INSERT INTO personas (nombre_completo, genero, privilegios, id_congregacion, telefono, email) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![nombre_completo, genero, privilegios, id_cong_final, telefono, email],
    ) {
        Ok(_) => Ok("Persona creada exitosamente".to_string()),
        Err(e) => Err(format!("Error al crear persona: {}", e)),
    }
}

#[command]
pub fn obtener_personas(app: AppHandle) -> Result<Vec<Persona>, String> {
    let conn = conectar_db(&app);
    
    // El LEFT JOIN asegura que traiga a la persona aunque no tenga congregación
    let mut stmt = conn.prepare(
        "SELECT p.id, p.nombre_completo, p.genero, p.privilegios, p.id_congregacion, p.telefono, p.email, c.nombre 
         FROM personas p 
         LEFT JOIN congregaciones c ON p.id_congregacion = c.id
         ORDER BY p.nombre_completo ASC"
    ).map_err(|e| e.to_string())?;

    let personas_iter = stmt.query_map([], |row| {
        Ok(Persona {
            id: row.get(0)?,
            nombre_completo: row.get(1)?,
            genero: row.get(2)?,
            privilegios: row.get(3).ok(),
            id_congregacion: row.get(4).ok(),
            telefono: row.get(5).ok(),
            email: row.get(6).ok(),
            nombre_congregacion: row.get(7).ok(), 
        })
    }).map_err(|e| e.to_string())?;

    let mut personas = Vec::new();
    for p in personas_iter {
        personas.push(p.map_err(|e| e.to_string())?);
    }
    Ok(personas)
}

#[command]
pub fn actualizar_persona(
    app: AppHandle,
    id: i32,
    nombre_completo: String,
    genero: String,
    privilegios: String,
    id_congregacion: i32,
    telefono: String,
    email: String,
) -> Result<String, String> {
    let conn = conectar_db(&app);

    // TRUCO: Si es 0, lo convertimos en None (NULL en SQL)
    let id_cong_final = if id_congregacion == 0 { None } else { Some(id_congregacion) };

    match conn.execute(
        "UPDATE personas SET nombre_completo = ?1, genero = ?2, privilegios = ?3, id_congregacion = ?4, telefono = ?5, email = ?6 WHERE id = ?7",
        params![nombre_completo, genero, privilegios, id_cong_final, telefono, email, id],
    ) {
        Ok(_) => Ok("Persona actualizada correctamente".to_string()),
        Err(e) => Err(format!("Error al actualizar: {}", e)),
    }
}

// --- FUNCIONES DE ELIMINACIÓN ---

#[command]
pub fn eliminar_persona(app: AppHandle, id: i32) -> Result<String, String> {
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("UPDATE programa SET orador_id = NULL WHERE orador_id = ?1", params![id])
        .map_err(|e| format!("Error desvinculando programa: {}", e))?;

    tx.execute("UPDATE asambleas SET presidente_id = NULL WHERE presidente_id = ?1", params![id])
        .map_err(|e| format!("Error desvinculando asamblea: {}", e))?;

    tx.execute("DELETE FROM asignaciones_especiales WHERE persona_id = ?1", params![id])
        .map_err(|e| format!("Error borrando asignaciones especiales: {}", e))?;

    tx.execute("DELETE FROM personas WHERE id = ?1", params![id])
        .map_err(|e| format!("Error eliminando persona: {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok("Persona eliminada".to_string())
}

#[command]
pub fn limpiar_personas(app: AppHandle) -> Result<String, String> {
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("UPDATE programa SET orador_id = NULL", [])
        .map_err(|e| format!("Error desvinculando programa: {}", e))?;

    tx.execute("UPDATE asambleas SET presidente_id = NULL", [])
        .map_err(|e| format!("Error desvinculando asambleas: {}", e))?;

    tx.execute("DELETE FROM asignaciones_especiales", [])
        .map_err(|e| format!("Error limpiando asignaciones especiales: {}", e))?;

    tx.execute("DELETE FROM personas", [])
        .map_err(|e| format!("Error limpiando lista: {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok("Lista vaciada".to_string())
}