use crate::database::DbState;
use crate::models::ConfiguracionGeneral; // Asegúrate de tener este modelo en models.rs
use tauri::State;

// 1. COMANDO PARA OBTENER LA CONFIGURACIÓN
#[tauri::command]
pub async fn obtener_configuracion_general(
    state: State<'_, DbState>,
) -> Result<ConfiguracionGeneral, String> {
    let conn = state.conn.lock().unwrap();

    // Seleccionamos todas las columnas ahora
    let mut stmt = conn
        .prepare(
            "SELECT nombre, segundo_nombre, apellido, sufijo, email, email_jwpub, movil, identificador, fecha_creacion, tema, idioma 
             FROM configuracion WHERE id = 1"
        )
        .map_err(|e| e.to_string())?;

    let config = stmt
        .query_row([], |row| {
            Ok(ConfiguracionGeneral {
                nombre: row.get(0)?,
                segundo_nombre: row.get(1)?,
                apellido: row.get(2)?,
                sufijo: row.get(3)?,
                email: row.get(4)?,
                email_jwpub: row.get(5)?,
                movil: row.get(6)?,
                identificador: row.get(7)?,
                fecha_creacion: row.get(8)?,
                tema: row.get(9)?,
                idioma: row.get(10)?,
            })
        })
        .unwrap_or_else(|_| {
            // Valores por defecto si no existe registro
            ConfiguracionGeneral {
                nombre: Some("Yorlen".to_string()),
                segundo_nombre: None,
                apellido: None,
                sufijo: None,
                email: None,
                email_jwpub: None,
                movil: None,
                identificador: None,
                fecha_creacion: None,
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

    conn.execute(
        "INSERT INTO configuracion 
         (id, nombre, segundo_nombre, apellido, sufijo, email, email_jwpub, movil, identificador, fecha_creacion, tema, idioma) 
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET
         nombre = excluded.nombre,
         segundo_nombre = excluded.segundo_nombre,
         apellido = excluded.apellido,
         sufijo = excluded.sufijo,
         email = excluded.email,
         email_jwpub = excluded.email_jwpub,
         movil = excluded.movil,
         identificador = excluded.identificador,
         fecha_creacion = excluded.fecha_creacion,
         tema = excluded.tema,
         idioma = excluded.idioma",
        rusqlite::params![
            config.nombre, config.segundo_nombre, config.apellido, config.sufijo,
            config.email, config.email_jwpub, config.movil, config.identificador,
            config.fecha_creacion, config.tema, config.idioma,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// 3. COMANDO PARA GUARDAR LA CONFIGURACIÓN DEL PDF
#[tauri::command]
pub async fn guardar_configuracion_pdf(
    state: State<'_, DbState>,
    datos: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();

    conn.execute(
        "INSERT INTO configuraciones_pdf (id, datos_json) VALUES (1, ?1)
         ON CONFLICT(id) DO UPDATE SET datos_json = excluded.datos_json",
        rusqlite::params![datos],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// 4. COMANDO PARA OBTENER LA CONFIGURACIÓN DEL PDF
#[tauri::command]
pub async fn obtener_configuracion_pdf(
    state: State<'_, DbState>,
) -> Result<Option<String>, String> {
    // 1. Importamos la extensión aquí mismo para asegurar que el compilador la vea
    use rusqlite::OptionalExtension;

    let conn = state.conn.lock().unwrap();

    let res: Option<String> = conn
        .query_row(
            "SELECT datos_json FROM configuraciones_pdf WHERE id = 1",
            [],
            // 2. Le decimos explícitamente a Rust que extraiga un texto (String)
            |row| row.get::<usize, String>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(res)
}

// 5. COMANDO PARA GUARDAR EL MEMBRETE
#[tauri::command]
pub async fn guardar_config_membrete(
    state: tauri::State<'_, DbState>,
    config: String, 
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();

    conn.execute(
        "INSERT INTO configuracion_membrete (id, datos_json) VALUES (1, ?1)
         ON CONFLICT(id) DO UPDATE SET datos_json = excluded.datos_json",
        rusqlite::params![config],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn obtener_config_membrete(
    state: tauri::State<'_, DbState>,
) -> Result<Option<String>, String> {
    use rusqlite::OptionalExtension;
    let conn = state.conn.lock().unwrap();

    let res: Option<String> = conn
        .query_row(
            "SELECT datos_json FROM configuracion_membrete WHERE id = 1",
            [],
            |row| row.get::<usize, String>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(res)
}