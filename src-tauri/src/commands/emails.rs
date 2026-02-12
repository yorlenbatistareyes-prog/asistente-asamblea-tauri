use tauri::State;
use crate::database::DbState;
use serde::{Deserialize, Serialize};
// IMPORTANTE: Importamos explícitamente 'Row' y 'Error' de rusqlite
use rusqlite::{Row, Error}; 

#[derive(Debug, Serialize, Deserialize)]
pub struct PlantillaEmail {
    pub id: String,
    pub asunto: String,
    pub cuerpo: String,
}

// 1. OBTENER PLANTILLA DE EMAIL
#[tauri::command]
pub fn obtener_plantilla_email(id: String, state: State<DbState>) -> Result<PlantillaEmail, String> {
    // Bloqueamos el Mutex
    let conn = state.conn.lock().map_err(|_| "Error de conexión DB".to_string())?;
    
    // CORRECCIÓN 1: Especificamos que 'e' es un 'Error'
    let mut stmt = conn.prepare("SELECT asunto, cuerpo FROM plantillas_email WHERE id = ?1")
        .map_err(|e: Error| e.to_string())?; 

    // CORRECCIÓN 2: Especificamos que 'row' es un '&Row'
    let result = stmt.query_row([&id], |row: &Row| {
        Ok(PlantillaEmail {
            id: id.clone(),
            // Usamos unwrap_or_default por si acaso el campo es NULL en la BD
            asunto: row.get(0).unwrap_or_default(), 
            cuerpo: row.get(1).unwrap_or_default(),
        })
    });

    match result {
        Ok(p) => Ok(p),
        Err(_) => {
            // Si no existe (error QueryReturnedNoRows), devolvemos un objeto vacío
            // para que el Frontend no falle, simplemente mostrará campos vacíos.
            Ok(PlantillaEmail {
                id,
                asunto: "".to_string(),
                cuerpo: "".to_string(),
            })
        }
    }
}

// 2. GUARDAR PLANTILLA DE EMAIL
// en emails.rs

#[tauri::command]
pub fn guardar_plantilla_email(id: String, asunto: String, cuerpo: String, state: State<DbState>) -> Result<(), String> {
    println!("🦀 RUST: Intentando guardar plantilla..."); // <--- LOG 1
    println!(" -> ID: {}", id);
    println!(" -> Asunto: {}", asunto);

    let conn = state.conn.lock().map_err(|_| "Error de bloqueo de conexión".to_string())?;
    
    // Usamos INSERT OR REPLACE para asegurar que se guarde sí o sí
    let resultado = conn.execute(
        "INSERT OR REPLACE INTO plantillas_email (id, asunto, cuerpo) VALUES (?1, ?2, ?3)",
        [&id, &asunto, &cuerpo],
    );

    match resultado {
        Ok(_) => {
            println!("✅ RUST: ¡Guardado exitoso en la BD!"); // <--- LOG EXITO
            Ok(())
        },
        Err(e) => {
            println!("❌ RUST ERROR: {}", e); // <--- LOG ERROR
            Err(e.to_string())
        }
    }
}