use crate::database::DbState;
use crate::models::ConfiguracionGeneral; // Asegúrate de tener este modelo en models.rs
use tauri::State;
use rusqlite::params;

// 1. COMANDO PARA OBTENER LA CONFIGURACIÓN
#[tauri::command]
pub async fn obtener_configuracion_general(
    state: State<'_, DbState>,
) -> Result<ConfiguracionGeneral, String> {
    let conn = state.conn.lock().unwrap();
    
    // Intentamos buscar la configuración (asumiendo que solo hay una fila con id=1)
    let mut stmt = conn
        .prepare("SELECT nombre, tema, idioma FROM configuracion WHERE id = 1")
        .map_err(|e| e.to_string())?;

    let config = stmt.query_row([], |row| {
        Ok(ConfiguracionGeneral {
            nombre: row.get(0)?,
            tema: row.get(1)?,
            idioma: row.get(2)?,
        })
    }).unwrap_or_else(|_| {
        // Si no existe, devolvemos valores por defecto para que la app no rompa
        ConfiguracionGeneral {
            nombre: Some("Yorlen".to_string()),
            tema: Some("light".to_string()),
            idioma: Some("es".to_string()),
        }
    });

    Ok(config)
}

// 2. COMANDO PARA GUARDAR LA CONFIGURACIÓN
#[tauri::command]
pub async fn guardar_configuracion_general(
    state: State<'_, DbState>,
    config: ConfiguracionGeneral,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();

    // Insertamos o reemplazamos la configuración del usuario
    conn.execute(
        "INSERT OR REPLACE INTO configuracion (id, nombre, tema, idioma) 
         VALUES (1, ?1, ?2, ?3)",
        params![config.nombre, config.tema, config.idioma],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}