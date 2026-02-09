use crate::database;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use tauri::{command, AppHandle};

#[derive(Serialize)]
pub struct DatosImpresion {
    nombre: String,
    apellidos: String,
    tema: String,
    numero_bosquejo: String,
    fecha: String,
    hora: String,
    lugar: String,
    direccion: String,
    ciudad: String,
    congregacion: String,
}

// Valores por defecto para evitar errores si faltan datos
impl Default for DatosImpresion {
    fn default() -> Self {
        DatosImpresion {
            nombre: "Hermano".to_string(),
            apellidos: "".to_string(),
            tema: "".to_string(),
            numero_bosquejo: "".to_string(),
            fecha: "".to_string(),
            hora: "".to_string(),
            lugar: "Salón de Asambleas".to_string(),
            direccion: "".to_string(),
            ciudad: "".to_string(),
            congregacion: "".to_string(),
        }
    }
}

#[command]
pub fn obtener_datos_para_impresion(
    app: AppHandle,
    tipo: String,
    id_referencia: i32,
) -> Result<DatosImpresion, String> {
    let db_path = database::obtener_ruta_db(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    // --- CASO 1: ORADOR (Desde tabla 'programa') ---
    if tipo == "orador" {
        // CORRECCIÓN:
        // 1. Usamos 'p.congregacion' en lugar de 'p.nombre_congregacion'
        // 2. Usamos 'prog.tema' directamente (sin tabla discursos)
        let mut stmt = conn
            .prepare(
                "
            SELECT 
                p.nombre_completo, 
                IFNULL(p.congregacion, ''), 
                prog.tema,
                IFNULL(prog.tipo, ''), 
                prog.fecha, 
                prog.hora_inicio
            FROM programa prog
            JOIN personas p ON prog.persona_id = p.id
            WHERE prog.id = ?1
        ",
            )
            .map_err(|e| format!("Error SQL Orador: {}", e))?;

        let datos = stmt
            .query_row(params![id_referencia], |row| {
                let nombre_completo: String = row.get(0).unwrap_or_default();

                Ok(DatosImpresion {
                    nombre: nombre_completo,
                    apellidos: "".to_string(),
                    congregacion: row.get(1).unwrap_or_default(),
                    tema: row.get(2).unwrap_or_default(),
                    numero_bosquejo: row.get(3).unwrap_or_default(),
                    fecha: row.get(4).unwrap_or_default(),
                    hora: row.get(5).unwrap_or_default(),
                    ..Default::default()
                })
            })
            .optional()
            .map_err(|e| e.to_string())?;

        return Ok(datos.unwrap_or_default());
    }
    // --- CASO 2: OFICINA (Presidente, Oración, etc.) ---
    else if tipo == "presidente" || tipo == "oracion" || tipo == "oficina" {
        // CORRECCIÓN: Igual aquí, usamos 'p.congregacion'
        let mut stmt = conn
            .prepare(
                "
            SELECT 
                p.nombre_completo,
                IFNULL(p.congregacion, ''),
                ae.fecha,
                ae.tipo_asignacion
            FROM asignaciones_especiales ae
            JOIN personas p ON ae.persona_id = p.id
            WHERE ae.id = ?1
        ",
            )
            .map_err(|e| format!("Error SQL Oficina: {}", e))?;

        let datos = stmt
            .query_row(params![id_referencia], |row| {
                let _rol: String = row.get(3).unwrap_or_default(); // El guion bajo evita el warning amarillo
                let tema_ficticio = if tipo == "presidente" {
                    "Presidente de la Sesión"
                } else {
                    "Oración"
                };

                Ok(DatosImpresion {
                    nombre: row.get(0).unwrap_or_default(),
                    congregacion: row.get(1).unwrap_or_default(),
                    fecha: row.get(2).unwrap_or_default(),
                    tema: tema_ficticio.to_string(),
                    ..Default::default()
                })
            })
            .optional()
            .map_err(|e| e.to_string())?;

        return Ok(datos.unwrap_or_default());
    }

    Err("Tipo de impresión no reconocido".to_string())
}
