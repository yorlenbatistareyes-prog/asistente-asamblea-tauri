// src-tauri/src/commands/oficina.rs

use crate::models::AsignacionEspecialDTO;
use rusqlite::{params, Connection, OptionalExtension, Result};
use tauri::{command, AppHandle};

fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

pub(crate) fn sincronizar_asignacion_presidente(
    conn: &Connection,
    asamblea_id: i32,
    dia: &str,
    sesion: &str,
    persona_id: Option<i32>,
) -> Result<(), String> {
    let sufijo = match sesion.trim().to_lowercase().as_str() {
        "manana" | "mañana" => "manana",
        "tarde" => "tarde",
        _ => return Err(format!("Sesión no válida para presidente: {sesion}")),
    };
    let tipo_asignacion = format!("presidente_{sufijo}");

    conn.execute(
        "DELETE FROM asignaciones_especiales
         WHERE asamblea_id = ?1 AND dia = ?2 AND tipo_asignacion = ?3",
        params![asamblea_id, dia, tipo_asignacion],
    )
    .map_err(|e| e.to_string())?;

    if let Some(persona_id) = persona_id {
        conn.execute(
            "INSERT INTO asignaciones_especiales
             (asamblea_id, dia, tipo_asignacion, persona_id)
             VALUES (?1, ?2, ?3, ?4)",
            params![asamblea_id, dia, tipo_asignacion, persona_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[command]
pub fn guardar_presidente_sesion(
    app: AppHandle,
    asamblea_id: i32,
    dia: String,
    sesion: String,
    persona_id: Option<i32>,
    hora: Option<String>,
) -> Result<String, String> {
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let sesion_programa = match sesion.trim().to_lowercase().as_str() {
        "manana" | "mañana" => "Mañana",
        "tarde" => "Tarde",
        _ => return Err(format!("Sesión no válida para presidente: {sesion}")),
    };

    let parte_existente: Option<(i32, Option<String>)> = tx
        .query_row(
            "SELECT id, hora_inicio FROM programa
             WHERE asamblea_id = ?1 AND dia = ?2 AND sesion = ?3
               AND lower(trim(tipo)) = 'presidente'
             ORDER BY hora_inicio ASC LIMIT 1",
            params![asamblea_id, dia, sesion_programa],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if persona_id.is_some()
        && parte_existente.is_none()
        && hora.as_deref().unwrap_or_default().trim().is_empty()
    {
        return Err(
            "Indica la hora para crear la parte del presidente en el programa.".to_string(),
        );
    }

    sincronizar_asignacion_presidente(&tx, asamblea_id, &dia, sesion_programa, persona_id)?;

    if let Some((id, _)) = parte_existente {
        tx.execute(
            "UPDATE programa SET orador_id = ?1,
                estado = CASE WHEN ?1 IS NULL THEN 'Pendiente' ELSE 'Confirmado' END
             WHERE id = ?2",
            params![persona_id, id],
        )
        .map_err(|e| e.to_string())?;
    } else if let Some(persona_id) = persona_id {
        tx.execute(
            "INSERT INTO programa
             (asamblea_id, dia, sesion, hora_inicio, tema, tipo, duracion, estado, orador_id, fuente)
             VALUES (?1, ?2, ?3, ?4, 'Presidente de sesión', 'Presidente', 0, 'Confirmado', ?5, 'en_persona')",
            params![
                asamblea_id,
                dia,
                sesion_programa,
                hora.unwrap_or_default(),
                persona_id
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok("Presidente de sesión guardado".to_string())
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
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let asignacion: Option<(i32, String, String)> = tx
        .query_row(
            "SELECT asamblea_id, dia, tipo_asignacion
             FROM asignaciones_especiales WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    tx.execute(
        "DELETE FROM asignaciones_especiales WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    if let Some((asamblea_id, dia, tipo_asignacion)) = asignacion {
        let sesion = match tipo_asignacion.as_str() {
            "presidente_manana" => Some("Mañana"),
            "presidente_tarde" => Some("Tarde"),
            _ => None,
        };
        if let Some(sesion) = sesion {
            let siguiente_presidente: Option<i32> = tx
                .query_row(
                    "SELECT persona_id FROM asignaciones_especiales
                     WHERE asamblea_id = ?1 AND dia = ?2 AND tipo_asignacion = ?3
                     ORDER BY id DESC LIMIT 1",
                    params![asamblea_id, dia, tipo_asignacion],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|e| e.to_string())?;
            sincronizar_asignacion_presidente(
                &tx,
                asamblea_id,
                &dia,
                sesion,
                siguiente_presidente,
            )?;
            let parte_presidente: Option<i32> = tx
                .query_row(
                    "SELECT id FROM programa
                     WHERE asamblea_id = ?1 AND dia = ?2 AND sesion = ?3
                       AND lower(trim(tipo)) = 'presidente'
                     ORDER BY hora_inicio ASC LIMIT 1",
                    params![asamblea_id, dia, sesion],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|e| e.to_string())?;
            if let Some(parte_id) = parte_presidente {
                tx.execute(
                    "UPDATE programa SET orador_id = ?1,
                    estado = CASE WHEN ?1 IS NULL THEN 'Pendiente' ELSE 'Confirmado' END
                     WHERE id = ?2",
                    params![siguiente_presidente, parte_id],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
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

    conn.execute(sql, params![id]).map_err(|e| e.to_string())?;

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
