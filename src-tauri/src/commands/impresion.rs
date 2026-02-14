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
    fecha_asignacion: String,
    hora_asignacion: String,
    lugar: String,
    direccion: String,
    ciudad: String,
    congregacion: String,
    fecha_ensayo: String,
    hora_ensayo: String,
    lugar_ensayo: String,
    saludo: String,
}

// Valores por defecto mejorados para la correspondencia
impl Default for DatosImpresion {
    fn default() -> Self {
        DatosImpresion {
            nombre: "Hermano".to_string(),
            apellidos: "".to_string(),
            tema: "".to_string(),
            numero_bosquejo: "".to_string(),
            fecha_asignacion: "".to_string(),
            hora_asignacion: "".to_string(),
            lugar: "Salón de Asambleas".to_string(),
            direccion: "".to_string(),
            ciudad: "".to_string(),
            congregacion: "".to_string(),
            fecha_ensayo: "".to_string(),
            hora_ensayo: "".to_string(),
            lugar_ensayo: "el Salón de Asambleas".to_string(),
            saludo: "Hermano".to_string(),
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

    // --- CASO 1: ORADOR ---
    if tipo == "orador" {
        let mut stmt = conn
            .prepare(
                "
            SELECT 
                p.nombre_completo, 
                IFNULL(p.congregacion, ''), 
                prog.tema,
                IFNULL(prog.tipo, ''), 
                prog.fecha, 
                prog.hora_inicio,
                IFNULL(p.sexo, 'M')
            FROM programa prog
            JOIN personas p ON prog.persona_id = p.id
            WHERE prog.id = ?1
        ",
            )
            .map_err(|e| format!("Error SQL Orador: {}", e))?;

        let datos = stmt
            .query_row(params![id_referencia], |row| {
                let sexo: String = row.get(6).unwrap_or_else(|_| "M".to_string());
                let saludo = if sexo == "F" { "Hermana" } else { "Hermano" };

                Ok(DatosImpresion {
                    nombre: row.get(0).unwrap_or_default(),
                    congregacion: row.get(1).unwrap_or_default(),
                    tema: row.get(2).unwrap_or_default(),
                    numero_bosquejo: row.get(3).unwrap_or_default(),
                    fecha_asignacion: row.get(4).unwrap_or_default(),
                    hora_asignacion: row.get(5).unwrap_or_default(),
                    saludo: saludo.to_string(),
                    ..Default::default()
                })
            })
            .optional()
            .map_err(|e| e.to_string())?;

        return Ok(datos.unwrap_or_default());
    }
    
    // --- CASO 2: OFICINA (Presidente, Oración, etc.) ---
    else if tipo == "presidente" || tipo == "oracion" || tipo == "oficina" {
        let mut stmt = conn
            .prepare(
                "
            SELECT 
                p.nombre_completo,
                IFNULL(p.congregacion, ''),
                ae.fecha,
                ae.tipo_asignacion,
                IFNULL(p.sexo, 'M')
            FROM asignaciones_especiales ae
            JOIN personas p ON ae.persona_id = p.id
            WHERE ae.id = ?1
        ",
            )
            .map_err(|e| format!("Error SQL Oficina: {}", e))?;

        let datos = stmt
            .query_row(params![id_referencia], |row| {
                let sexo: String = row.get(4).unwrap_or_else(|_| "M".to_string());
                let saludo = if sexo == "F" { "Hermana" } else { "Hermano" };
                
                let tema_ficticio = if tipo == "presidente" {
                    "Presidente de la Sesión"
                } else {
                    "Oración"
                };

                Ok(DatosImpresion {
                    nombre: row.get(0).unwrap_or_default(),
                    congregacion: row.get(1).unwrap_or_default(),
                    fecha_asignacion: row.get(2).unwrap_or_default(),
                    tema: tema_ficticio.to_string(),
                    saludo: saludo.to_string(),
                    ..Default::default()
                })
            })
            .optional()
            .map_err(|e| e.to_string())?;

        return Ok(datos.unwrap_or_default());
    }

    Err("Tipo de impresión no reconocido".to_string())
}