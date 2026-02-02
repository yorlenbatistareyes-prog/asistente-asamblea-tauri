use crate::models::{PartePrograma, AsignacionEspecial};
use rusqlite::{params, Connection, Result, OptionalExtension};
use tauri::{command, AppHandle};

fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

#[command]
pub fn obtener_programa_dia(app: AppHandle, dia: String) -> Result<Vec<PartePrograma>, String> {
    let conn = conectar_db(&app);
    let sql = "
        SELECT 
            p.id, p.dia, p.sesion, p.hora_inicio, p.tema, p.tipo, p.duracion,
            p.orador_id, per.nombre_completo, c.nombre,
            per.email, per.telefono, 
            p.es_video, p.estado, p.esta_presente
        FROM programa p
        LEFT JOIN personas per ON p.orador_id = per.id
        LEFT JOIN congregaciones c ON per.id_congregacion = c.id
        WHERE p.dia = ?1
        ORDER BY p.hora_inicio ASC
    ";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let partes = stmt.query_map(params![dia], |row| {
        Ok(PartePrograma {
            id: row.get(0)?, dia: row.get(1)?, sesion: row.get(2)?,
            hora_inicio: row.get(3).ok(), tema: row.get(4)?, tipo: row.get(5).ok(),
            duracion: row.get(6).ok(), orador_id: row.get(7).ok(),
            nombre_orador: row.get(8).ok(), congregacion_orador: row.get(9).ok(),
            email_orador: row.get(10).ok(), telefono_orador: row.get(11).ok(),
            es_video: row.get(12).unwrap_or(false), estado: row.get(13).ok(),
            esta_presente: row.get(14).unwrap_or(false), 
        })
    }).map_err(|e| e.to_string())?;
    
    let mut res = Vec::new();
    for p in partes { res.push(p.map_err(|e| e.to_string())?); }
    Ok(res)
}

#[command]
pub fn alternar_estado_parte(app: AppHandle, id: i32, tipo_accion: String, valor_actual: bool) -> Result<String, String> {
    let conn = conectar_db(&app);
    let sql = match tipo_accion.as_str() {
        "confirmacion" => if valor_actual { "UPDATE programa SET estado = 'Pendiente' WHERE id = ?1" } else { "UPDATE programa SET estado = 'Confirmado' WHERE id = ?1" },
        "presencia" => "UPDATE programa SET esta_presente = NOT esta_presente WHERE id = ?1",
        _ => return Err("Acción desconocida".to_string())
    };
    conn.execute(sql, params![id]).map_err(|e| e.to_string())?;
    Ok("Actualizado".to_string())
}

#[command]
pub fn crear_parte(app: AppHandle, dia: String, sesion: String, hora: String, tema: String, tipo: String, duracion: i32, nombre_orador: Option<String>, congregacion: Option<String>, email: Option<String>, telefono: Option<String>) -> Result<String, String> {
    let mut conn = conectar_db(&app); 
    let tx = conn.transaction().map_err(|e| e.to_string())?; 
    let mut orador_id: Option<i32> = None;
    let mut estado = "Pendiente".to_string();
    
    if tipo != "Video" {
        if let Some(nombre) = nombre_orador {
            if !nombre.trim().is_empty() {
                let existe: Option<i32> = tx.query_row("SELECT id FROM personas WHERE nombre_completo = ?1", params![nombre.trim()], |row| row.get(0)).optional().map_err(|e| e.to_string())?;
                if let Some(id) = existe { orador_id = Some(id); } 
                else {
                    let mut id_cong = 0;
                    if let Some(c) = congregacion { 
                        let c_id: Option<i32> = tx.query_row("SELECT id FROM congregaciones WHERE nombre = ?1", params![c], |row| row.get(0)).optional().unwrap_or(None);
                        if let Some(id) = c_id { id_cong = id; } else { tx.execute("INSERT INTO congregaciones (nombre, numero_congregacion) VALUES (?1, '')", params![c]).ok(); id_cong = tx.last_insert_rowid() as i32; }
                    }
                    tx.execute("INSERT INTO personas (nombre_completo, genero, id_congregacion, email, telefono) VALUES (?1, 'Hombre', ?2, ?3, ?4)", params![nombre.trim(), id_cong, email.unwrap_or_default(), telefono.unwrap_or_default()]).map_err(|e| e.to_string())?;
                    orador_id = Some(tx.last_insert_rowid() as i32);
                }
                estado = "Confirmado".to_string();
            }
        }
    }
    
    // CORRECCIÓN AQUÍ: Agregamos 'esta_presente' con valor 0 por defecto
    tx.execute("INSERT INTO programa (dia, sesion, hora_inicio, tema, tipo, duracion, estado, orador_id, es_video, esta_presente) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)", params![dia, sesion, hora, tema, tipo, duracion, estado, orador_id, tipo == "Video"]).map_err(|e| e.to_string())?;
    
    tx.commit().map_err(|e| e.to_string())?;
    Ok("Creado".to_string())
}

#[command] pub fn eliminar_parte(app: AppHandle, id: i32) -> Result<String, String> { conectar_db(&app).execute("DELETE FROM programa WHERE id = ?1", params![id]).map_err(|e| e.to_string())?; Ok("Eliminado".to_string()) }
#[command] pub fn limpiar_programa(app: AppHandle) -> Result<String, String> { conectar_db(&app).execute("DELETE FROM programa", []).map_err(|e| e.to_string())?; Ok("Limpiado".to_string()) }
#[command] pub fn generar_programa_base(_app: AppHandle) -> Result<String, String> { Ok("".to_string()) }
#[command] pub fn obtener_oficina_dia(_app: AppHandle, _dia: String) -> Result<Vec<AsignacionEspecial>, String> { Ok(vec![]) }
#[command] pub fn asignar_parte(app: AppHandle, id_parte: i32, orador_id: Option<i32>, es_video: bool) -> Result<String, String> { conectar_db(&app).execute("UPDATE programa SET orador_id = ?1, es_video = ?2, estado = 'Confirmado' WHERE id = ?3", params![orador_id, es_video, id_parte]).map_err(|e| e.to_string())?; Ok("Ok".to_string()) }