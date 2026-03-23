// src-tauri/src/lib.rs

pub mod database;
pub mod models;

// Declaración de módulos de comandos
// Asegúrate de que los archivos existan en la carpeta src-tauri/src/commands/
pub mod commands {
    pub mod actualizaciones;
    pub mod asambleas;
    pub mod configuracion;
    pub mod congregaciones;
    pub mod correspondencia;
    pub mod datos;
    pub mod emails;
    pub mod importar;
    pub mod impresion;
    pub mod locales;
    pub mod mensajeria;
    pub mod oficina; // <--- IMPORTANTE: Este archivo debe existir como oficina.rs
    pub mod personas;
    pub mod programa;
}

use crate::database::DbState;
use std::sync::Mutex;
use tauri::{Manager, State};
use std::fs; // Necesario para mover archivos

// ==========================================
// 1. ESTADO Y COMANDO DE SINCRONIZACIÓN
// ==========================================
pub struct SyncState {
    pub auto_export: Mutex<bool>,
    pub sync_path: Mutex<String>,
}

#[tauri::command]
fn actualizar_config_sync(state: State<'_, SyncState>, auto_export: bool, sync_path: String) {
    *state.auto_export.lock().unwrap() = auto_export;
    *state.sync_path.lock().unwrap() = sync_path;
}
// ==========================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        // --- PLUGINS ---
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        
        // 2. REGISTRAMOS LA MEMORIA PARA LA SINCRONIZACIÓN
        .manage(SyncState {
            auto_export: Mutex::new(false),
            sync_path: Mutex::new(String::new()),
        })
        // Si usas el reinicio automático en Restaurar, necesitas este plugin
        // --- BASE DE DATOS ---
        // --- AQUÍ ESTÁ EL CAMBIO: LÓGICA DE INICIO ---
        .setup(|app| {
            let app_handle = app.handle();
            let app_dir = app_handle.path().app_data_dir().unwrap();
            
            // Crea la carpeta si no existe
            if !app_dir.exists() { let _ = fs::create_dir_all(&app_dir); }

            // IMPORTANTE: Este nombre debe ser IGUAL al que usas en database.rs
            // --- CORRECCIÓN AQUÍ ---
            // Usamos la constante que definiste en database.rs
            // Así siempre coincidirán los nombres.
            let nombre_db = database::DB_NAME;
            
            let ruta_db_real = app_dir.join(nombre_db);
            let ruta_pendiente = app_dir.join("restaurar_pendiente.sqlite");

           // 1. REVISAR SI HAY UNA RESTAURACIÓN PENDIENTE
if ruta_pendiente.exists() {
    println!("♻️ Restauración detectada. Iniciando limpieza...");

    // Definir rutas de archivos temporales (WAL y SHM)
    let ruta_wal = app_dir.join(format!("{}-wal", nombre_db));
    let ruta_shm = app_dir.join(format!("{}-shm", nombre_db));

    // Borrar archivos viejos para evitar Error 500
    if ruta_wal.exists() { let _ = fs::remove_file(&ruta_wal); }
    if ruta_shm.exists() { let _ = fs::remove_file(&ruta_shm); }
    
    // Borrar la DB vieja
    if ruta_db_real.exists() { let _ = fs::remove_file(&ruta_db_real); }

    // Poner la nueva en su lugar
    match fs::rename(&ruta_pendiente, &ruta_db_real) {
        Ok(_) => println!("✅ Base de datos restaurada correctamente."),
        Err(_) => {
            // Plan B: Copiar y borrar si rename falla
            let _ = fs::copy(&ruta_pendiente, &ruta_db_real);
            let _ = fs::remove_file(&ruta_pendiente);
        }
    }

    // --- NUEVO: Verificar y optimizar la base de datos restaurada ---
    if let Ok(temp_conn) = rusqlite::Connection::open(&ruta_db_real) {
        // Ejecutar VACUUM para compactar y asegurar integridad
        if let Err(e) = temp_conn.execute("VACUUM;", []) {
            eprintln!("❌ Error al ejecutar VACUUM en base restaurada: {}", e);
        } else {
            println!("✅ VACUUM completado en base restaurada");
        }
        // Verificar integridad (opcional, pero útil para depurar)
        let integrity: Result<String, _> = temp_conn.query_row("PRAGMA integrity_check;", [], |row| row.get(0));
        match integrity {
            Ok(msg) => println!("✅ Integridad de base restaurada: {}", msg),
            Err(e) => eprintln!("❌ Error en integridad de base restaurada: {}", e),
        }
    } else {
        eprintln!("❌ No se pudo abrir la base restaurada para verificación");
    }
}

            // 2. INICIAR LA BASE DE DATOS (Igual que siempre)
            match database::initialize_database(app.handle()) {
               Ok(conn) => {
                   println!("✅ Base de datos conectada y lista");
                   app.manage(DbState { conn: Mutex::new(conn) });
               }
               Err(e) => println!("❌ Error inicializando DB: {}", e),
            }
            Ok(())
        }) 

            .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<SyncState>();
                let auto_export = *state.auto_export.lock().unwrap();
                let sync_path = state.sync_path.lock().unwrap().clone();

                if auto_export && !sync_path.trim().is_empty() {
                    if let Ok(app_data_dir) = window.app_handle().path().app_data_dir() {
                        // OJO: Usamos database::DB_NAME que ya tienes definido
                        let db_path = app_data_dir.join(database::DB_NAME);
                        let dest_path = std::path::Path::new(&sync_path).join("rassembly_sync_backup.db");
                        
                        let _ = fs::copy(&db_path, &dest_path);
                    }
                }
            }
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
            commands::programa::actualizar_detalles_parte, // <--- AQUÍ ESTÁ EL CAMBIO
            commands::programa::obtener_oficina_dia,
            commands::programa::generar_programa_base,
            commands::programa::limpiar_programa,
            commands::programa::crear_parte,
            commands::programa::eliminar_parte,
            commands::programa::alternar_estado_parte,
            
            // --- OFICINA (Aquí estaba el problema antes) ---
            commands::oficina::obtener_asignaciones_especiales,
            commands::oficina::guardar_asignacion_especial, // <--- ¡ESTE ES EL QUE FALTABA!
            commands::oficina::eliminar_asignacion_especial,
            commands::oficina::alternar_estado_oficina,

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
            
            // DATOS (Lo nuevo)
            commands::datos::exportar_base_datos,
            commands::datos::importar_base_datos,
            commands::datos::limpiar_datos,
            actualizar_config_sync
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
