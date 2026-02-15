// src-tauri/src/lib.rs

pub mod database;
pub mod models;

// Declaración de módulos de comandos
// Asegúrate de que los archivos existan en la carpeta src-tauri/src/commands/
pub mod commands {
    pub mod asambleas;
    pub mod congregaciones;
    pub mod correspondencia;
    pub mod importar;
    pub mod locales;
    pub mod mensajeria;
    pub mod oficina;    // <--- IMPORTANTE: Este archivo debe existir como oficina.rs
    pub mod personas;
    pub mod programa;
    pub mod impresion;
    pub mod emails;
    pub mod configuracion;
    pub mod actualizaciones;
}

use std::sync::Mutex;
use crate::database::DbState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // --- PLUGINS ---
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init()) 
        
        // --- BASE DE DATOS ---
        .setup(|app| {
            match database::initialize_database(app.handle()) {
               Ok(conn) => {
                   println!("✅ Base de datos inicializada correctamente");
        
               // ESTA ES LA MAGIA QUE FALTABA:
                  app.manage(DbState {
                       conn: Mutex::new(conn),
               });
            }
            Err(e) => {
                println!("❌ Error inicializando DB: {}", e);
                    // Opcional: return Err(e.into());
            }
        }
            // --- ¡ESTO ES LO QUE FALTABA! ---
        Ok(()) 
    })

        // --- REGISTRO DE COMANDOS (INVOKE HANDLER) ---
        .invoke_handler(tauri::generate_handler![
            // LOCALES
            commands::locales::crear_local,
            commands::locales::obtener_locales,
            commands::locales::eliminar_local,
            
            // CONGREGACIONES
            commands::congregaciones::crear_congregacion,
            commands::congregaciones::obtener_congregaciones,
            commands::congregaciones::eliminar_congregacion,
            commands::congregaciones::limpiar_congregaciones,
            
            // PERSONAS
            commands::personas::crear_persona,
            commands::personas::obtener_personas,
            commands::personas::actualizar_persona,
            commands::personas::eliminar_persona,
            commands::personas::limpiar_personas,
            
            // ASAMBLEA
            commands::asambleas::guardar_info_evento,
            commands::asambleas::guardar_comite,
            commands::asambleas::obtener_asamblea_activa,
            commands::asambleas::obtener_asamblea_por_id,
            commands::asambleas::crear_asamblea,
            commands::asambleas::obtener_asambleas,
            commands::asambleas::eliminar_asamblea,
            commands::asambleas::obtener_info_extra_evento,
            
            // IMPORTAR
            commands::importar::importar_personas_csv,
            commands::importar::importar_congregaciones_csv,
            commands::importar::importar_programa_jw,
            
            // PROGRAMA
            commands::programa::obtener_programa_dia,
            commands::programa::asignar_parte,
            commands::programa::actualizar_numero_bosquejo,
            commands::programa::obtener_oficina_dia,
            commands::programa::generar_programa_base,
            commands::programa::limpiar_programa,
            commands::programa::crear_parte,
            commands::programa::eliminar_parte,
            commands::programa::alternar_estado_parte,
            
            // --- OFICINA (Aquí estaba el problema antes) ---
            commands::oficina::obtener_asignaciones_especiales,
            commands::oficina::guardar_asignacion_especial,  // <--- ¡ESTE ES EL QUE FALTABA!
            commands::oficina::eliminar_asignacion_especial,
            
            
            // CORRESPONDENCIA
            commands::correspondencia::obtener_plantilla,
            commands::correspondencia::guardar_plantilla,

            // MENSAJERÍA
            commands::mensajeria::obtener_plantilla_mensaje,
            commands::mensajeria::guardar_plantilla_mensaje,

            // --- EMAILS (NUEVO Y SEPARADO) ---
            commands::emails::obtener_plantilla_email,
            commands::emails::guardar_plantilla_email,

            // IMPRESIÓN
            commands::impresion::obtener_datos_para_impresion,

            // --- CONFIGURACIÓN ---
           commands::configuracion::obtener_configuracion_general,
           commands::configuracion::guardar_configuracion_general,

            // --- ACTUALIZACIONES ---
            commands::actualizaciones::check_for_updates,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}