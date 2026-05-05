// src-tauri/src/commands/oficina.rs

use crate::models::AsignacionEspecialDTO;
use rusqlite::{params, Connection, Result};
use tauri::{command, AppHandle};

fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

// --- LECTURA: Obtener asignaciones de un día PARA UNA ASAMBLEA ESPECÍFICA ---
#[command]
pub fn obtener_asignaciones_especiales(
    app: AppHandle,
    asamblea_id: i32,
    dia: String,
) -> Result<Vec<AsignacionEspecialDTO>, String> {
    let conn = conectar_db(&app);

    let sql = "
        SELECT 
            ae.id, 
            ae.tipo_asignacion, 
            ae.persona_id, 
            p.nombre_completo,
            c.nombre as nombre_congregacion,
            p.telefono,
            p.email,
            ae.estado,
            ae.esta_presente,
            ae.ensayo_terminado,
            d.responsabilidades,
            d.disponibilidad
        FROM asignaciones_especiales ae
        JOIN personas p ON ae.persona_id = p.id
        LEFT JOIN congregaciones c ON p.id_congregacion = c.id
        LEFT JOIN detalles_oficina d ON p.id = d.persona_id 
        WHERE ae.asamblea_id = ?1 AND (ae.dia = ?2 OR ae.tipo_asignacion = 'personal_oficina')
    ";
    // 👆 Fíjate en las dos líneas de arriba: El LEFT JOIN que faltaba y el nuevo WHERE.

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let filas = stmt
        .query_map(params![asamblea_id, dia], |row| {
            Ok(AsignacionEspecialDTO {
                id: row.get(0)?,
                tipo_asignacion: row.get(1)?,
                persona_id: row.get(2)?,
                nombre_completo: row.get(3)?,
                nombre_congregacion: row.get(4).ok(),
                telefono: row.get(5).ok(),
                email: row.get(6).ok(),
                estado: row.get(7).ok(),
                esta_presente: row.get(8)?,
                ensayo_terminado: row.get(9)?,
                responsabilidades: row.get(10).ok(), 
                disponibilidad: row.get(11).ok(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut resultado = Vec::new();
    for fila in filas {
        resultado.push(fila.map_err(|e| e.to_string())?);
    }
    Ok(resultado)
}
// --- ESCRITURA: Guardar una asignación EN ESTA ASAMBLEA ---
#[command]
pub fn guardar_asignacion_especial(
    app: AppHandle,
    asamblea_id: i32, // <--- NUEVO
    dia: String,
    tipo_asignacion: String,
    persona_id: i32,
) -> Result<String, String> {
    let conn = conectar_db(&app);

    // Lógica especial:
    // Si NO es personal de oficina (ej. es Presidente), solo puede haber UNO.
    // Borramos el anterior SOLO DE ESTA ASAMBLEA y ESTE DÍA.
    if tipo_asignacion != "personal_oficina" {
        conn.execute(
            "DELETE FROM asignaciones_especiales WHERE asamblea_id = ?1 AND dia = ?2 AND tipo_asignacion = ?3",
            params![asamblea_id, dia, tipo_asignacion]
        ).map_err(|e| e.to_string())?;
    }

    // Insertamos vinculando a la asamblea
    conn.execute(
        "INSERT INTO asignaciones_especiales (asamblea_id, dia, tipo_asignacion, persona_id) VALUES (?1, ?2, ?3, ?4)",
        params![asamblea_id, dia, tipo_asignacion, persona_id]
    ).map_err(|e| e.to_string())?;

    Ok("Asignación guardada".to_string())
}

// --- BORRADO: Eliminar una asignación (por ID único, no necesita cambios) ---
#[command]
pub fn eliminar_asignacion_especial(app: AppHandle, id: i32) -> Result<String, String> {
    let conn = conectar_db(&app);
    // El ID es único globalmente, así que es seguro borrarlo directo
    conn.execute(
        "DELETE FROM asignaciones_especiales WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok("Asignación eliminada".to_string())
}

#[command]
pub fn alternar_estado_oficina(
    app: AppHandle,
    id: i32,
    tipo_accion: String,
    valor_nuevo: bool,
) -> Result<String, String> {
    let conn = conectar_db(&app);
    
    let sql = match tipo_accion.as_str() {
        "confirmacion" => {
            if valor_nuevo {
                "UPDATE asignaciones_especiales SET estado = 'Confirmado' WHERE id = ?1"
            } else {
                "UPDATE asignaciones_especiales SET estado = 'Pendiente' WHERE id = ?1"
            }
        }
        "presencia" => {
            if valor_nuevo {
                "UPDATE asignaciones_especiales SET esta_presente = 1 WHERE id = ?1"
            } else {
                "UPDATE asignaciones_especiales SET esta_presente = 0 WHERE id = ?1"
            }
        }
        "ensayo_terminado" => {
            if valor_nuevo {
                "UPDATE asignaciones_especiales SET ensayo_terminado = 1 WHERE id = ?1"
            } else {
                "UPDATE asignaciones_especiales SET ensayo_terminado = 0 WHERE id = ?1"
            }
        }
        _ => return Err("Acción desconocida".to_string()),
    };

    conn.execute(sql, params![id])
        .map_err(|e| e.to_string())?;

    Ok("Actualizado".to_string())
}

#[command]
pub fn guardar_detalles_oficina(
    app: AppHandle,
    persona_id: i32, 
    responsabilidades: String, 
    disponibilidad: String,
) -> Result<String, String> {
    let conn = conectar_db(&app);

    conn.execute(
        "INSERT OR REPLACE INTO detalles_oficina (persona_id, responsabilidades, disponibilidad) VALUES (?1, ?2, ?3)",
        params![persona_id, responsabilidades, disponibilidad],
    ).map_err(|e| e.to_string())?;

    Ok("Detalles guardados exitosamente".to_string())
}
