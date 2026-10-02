// src-tauri/src/lib.rs

pub mod database;
pub mod encriptar;
pub mod models;
pub mod sync_cmds;

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
    pub mod mensajeria;
    pub mod oficina; // <--- IMPORTANTE: Este archivo debe existir como oficina.rs
    pub mod personas;
    pub mod programa;
}

use crate::database::DbState;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::{Manager, State}; // Necesario para mover archivos

fn aplicar_restauracion_pendiente(
    app_dir: &Path,
    nombre_db: &str,
    ruta_pendiente: &Path,
) -> Result<(), String> {
    database::validar_archivo_db(ruta_pendiente)?;

    let ruta_db = app_dir.join(nombre_db);
    let marca_tiempo = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let ruta_respaldo = app_dir.join(format!("{}.pre-restore-{}", nombre_db, marca_tiempo));
    let habia_db = ruta_db.exists();

    if habia_db {
        fs::copy(&ruta_db, &ruta_respaldo)
            .map_err(|e| format!("No se pudo proteger la BD actual: {}", e))?;
        fs::remove_file(&ruta_db)
            .map_err(|e| format!("No se pudo preparar el reemplazo de la BD: {}", e))?;
    }

    if let Err(error) = fs::rename(ruta_pendiente, &ruta_db) {
        if habia_db {
            if let Err(restore_error) = fs::copy(&ruta_respaldo, &ruta_db) {
                return Err(format!(
                    "Falló la instalación de la BD ({}) y también su recuperación desde {} ({}).",
                    error,
                    ruta_respaldo.display(),
                    restore_error
                ));
            }
        }
        return Err(format!("No se pudo instalar la BD restaurada: {}", error));
    }

    for sufijo in ["-wal", "-shm"] {
        let ruta_auxiliar = app_dir.join(format!("{}{}", nombre_db, sufijo));
        if ruta_auxiliar.exists() {
            if let Err(error) = fs::remove_file(&ruta_auxiliar) {
                eprintln!("No se pudo quitar {}: {}", ruta_auxiliar.display(), error);
            }
        }
    }

    if habia_db {
        println!("Copia previa conservada en {}", ruta_respaldo.display());
    }
    Ok(())
}

#[tauri::command]
fn aplicar_restauracion_binaria_pendiente(
    app: tauri::AppHandle,
    db_state: State<'_, DbState>,
) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let ruta_db = app_dir.join(database::DB_NAME);
    let ruta_pendiente = app_dir.join("asamblea_db_restore.sqlite");

    if !ruta_pendiente.exists() {
        return Err("No hay una restauración binaria pendiente.".into());
    }
    database::validar_archivo_db(&ruta_pendiente)?;

    let marca_tiempo = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let ruta_respaldo = app_dir.join(format!(
        "{}.runtime-rollback-{}",
        database::DB_NAME,
        marca_tiempo
    ));

    let mut conexion = db_state
        .conn
        .lock()
        .map_err(|e| format!("No se pudo bloquear la base de datos: {}", e))?;
    let conexion_temporal = rusqlite::Connection::open_in_memory()
        .map_err(|e| format!("No se pudo preparar la conexión: {}", e))?;
    let conexion_anterior = std::mem::replace(&mut *conexion, conexion_temporal);
    if let Err((conexion_anterior, error)) = conexion_anterior.close() {
        *conexion = conexion_anterior;
        return Err(format!("No se pudo cerrar la base de datos actual: {}", error));
    }

    if ruta_db.exists() {
        if let Err(error) = fs::copy(&ruta_db, &ruta_respaldo) {
            let reapertura = database::initialize_database(&app)
                .map_err(|e| format!("No se pudo reabrir la base de datos: {}", e));
            if let Ok(reapertura) = reapertura {
                *conexion = reapertura;
            }
            return Err(format!("No se pudo proteger la base de datos actual: {}", error));
        }
    }

    if let Err(error) = aplicar_restauracion_pendiente(
        &app_dir,
        database::DB_NAME,
        &ruta_pendiente,
    ) {
        if ruta_respaldo.exists() {
            fs::copy(&ruta_respaldo, &ruta_db)
                .map_err(|e| format!("{} Además, falló la recuperación de la base anterior: {}", error, e))?;
        }
        let reapertura = database::initialize_database(&app)
            .map_err(|e| format!("{} No se pudo reabrir la base anterior: {}", error, e))?;
        *conexion = reapertura;
        return Err(error);
    }

    match database::initialize_database(&app) {
        Ok(conexion_restaurada) => {
            *conexion = conexion_restaurada;
            let _ = fs::remove_file(&ruta_respaldo);
            Ok(())
        }
        Err(error) => {
            if ruta_respaldo.exists() {
                fs::copy(&ruta_respaldo, &ruta_db).map_err(|e| {
                    format!(
                        "No se pudo abrir la base restaurada ({}) ni recuperar la anterior: {}",
                        error, e
                    )
                })?;
            }
            for sufijo in ["-wal", "-shm"] {
                let ruta_auxiliar = app_dir.join(format!("{}{}", database::DB_NAME, sufijo));
                let _ = fs::remove_file(ruta_auxiliar);
            }
            let conexion_anterior = database::initialize_database(&app)
                .map_err(|e| format!("No se pudo reabrir la base anterior: {}", e))?;
            *conexion = conexion_anterior;
            Err(format!("No se pudo abrir la base restaurada: {}", error))
        }
    }
}

// ==========================================
// COMANDO PARA LLAMAR POR TELÉFONO (Windows)
// ==========================================
#[tauri::command]
fn llamar_telefono(telefono: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("cmd")
            .args(&["/C", "start", format!("tel:{}", telefono).as_str()])
            .output()
            .map_err(|e| format!("Error al ejecutar comando: {}", e))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("No se pudo abrir el marcador: {}", stderr));
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Esta función solo está implementada para Windows".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        // --- AÑADE ESTA LÍNEA AQUÍ (Sin Stronghold) ---
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // --- PLUGINS ---
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sincronizacion_nativo::init())

        // --- AQUÍ ESTÁ EL CAMBIO: LÓGICA DE INICIO ---
        .setup(|app| {
            let app_handle = app.handle();
            let app_dir = app_handle.path().app_data_dir().unwrap();

            // Crea la carpeta si no existe
            if !app_dir.exists() {
                let _ = fs::create_dir_all(&app_dir);
            }

            // IMPORTANTE: Este nombre debe ser IGUAL al que usas en database.rs
            // --- CORRECCIÓN AQUÍ ---
            // Usamos la constante que definiste en database.rs
            // Así siempre coincidirán los nombres.
            let nombre_db = database::DB_NAME;

            let ruta_pendiente = app_dir.join("restaurar_pendiente.sqlite");

            // 1. REVISAR SI HAY UNA RESTAURACIÓN PENDIENTE
            if ruta_pendiente.exists() {
                match aplicar_restauracion_pendiente(&app_dir, nombre_db, &ruta_pendiente) {
                    Ok(()) => println!("✅ Base de datos restaurada correctamente."),
                    Err(error) => eprintln!("❌ Restauración pendiente rechazada: {}", error),
                }
            }

            // Detectar una restauración binaria pendiente.
            let ruta_restore_binaria = app_dir.join("asamblea_db_restore.sqlite");
            if ruta_restore_binaria.exists() {
                match aplicar_restauracion_pendiente(&app_dir, nombre_db, &ruta_restore_binaria) {
                    Ok(()) => println!("✅ BD restaurada (binaria) aplicada correctamente."),
                    Err(error) => eprintln!("❌ Restauración binaria rechazada: {}", error),
                }
            }

            // 2. INICIAR LA BASE DE DATOS (Igual que siempre)
            match database::initialize_database(app.handle()) {
                Ok(conn) => {
                    println!("✅ Base de datos conectada y lista");
                    // --- ASEGURAR TABLA CONFIGURACIÓN ---
                    // Esto evita errores cuando la app busque el correo del usuario
                    let _ = conn.execute(
                        "CREATE TABLE IF NOT EXISTS configuracion (
                             id INTEGER PRIMARY KEY CHECK (id = 1),
                             email TEXT NOT NULL DEFAULT '',
                            nombre_usuario TEXT
                       )",
                        [],
                    );
                    // Aseguramos que exista el registro 1
                    let _ = conn.execute(
                        "INSERT OR IGNORE INTO configuracion (id, email) VALUES (1, '')",
                        [],
                    );
                    app.manage(DbState {
                        conn: Mutex::new(conn),
                    });
                }
                Err(e) => println!("❌ Error inicializando DB: {}", e),
            }
            Ok(())
        })
        // --- REGISTRO DE COMANDOS (INVOKE HANDLER) ---
        .invoke_handler(tauri::generate_handler![
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
            commands::personas::guardar_recordatorio_orador,
            // ASAMBLEA
            commands::asambleas::guardar_info_evento,
            commands::asambleas::guardar_comite,
            commands::asambleas::obtener_asamblea_activa,
            commands::asambleas::obtener_asamblea_por_id,
            commands::asambleas::crear_asamblea,
            commands::asambleas::obtener_asambleas,
            commands::asambleas::eliminar_asamblea,
            commands::asambleas::guardar_color_serie,
            commands::asambleas::cargar_colores_series,
            commands::asambleas::obtener_info_extra_evento,
            commands::asambleas::actualizar_check_registro,
            // 👇 NUEVOS COMANDOS DE ASISTENCIA Y BAUTISMOS 👇
            commands::asambleas::obtener_asistencia_asamblea,
            commands::asambleas::guardar_asistencia_db,
            commands::asambleas::guardar_bautismos_db,
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
            commands::oficina::guardar_detalles_oficina,
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
            commands::configuracion::obtener_configuracion_pdf, // <-- NUEVO
            commands::configuracion::guardar_configuracion_pdf,
            commands::configuracion::guardar_config_membrete,
            commands::configuracion::obtener_config_membrete,
            // --- ACTUALIZACIONES ---
            commands::actualizaciones::check_for_updates,
            // DATOS (Lo nuevo)
            commands::datos::exportar_base_datos,
            commands::datos::exportar_base_datos_base64,
            commands::datos::importar_base_datos,
            commands::datos::importar_base_datos_base64,
            commands::datos::limpiar_datos,
            commands::datos::guardar_ruta_sync,
            commands::datos::obtener_ruta_sync,
            commands::datos::exportar_asamblea_encriptada,
            commands::datos::importar_asamblea_encriptada,
            llamar_telefono,
            // NUBE: COMANDOS DE SINCRONIZACIÓN
            // ==========================================
            sync_cmds::obtener_last_sync_local,
            sync_cmds::actualizar_last_sync_local,
            sync_cmds::exportar_db_json,
            sync_cmds::importar_db_json,
            commands::programa::guardar_nota_directa,
            sync_cmds::exportar_db_encriptada_global, // 👈 NUEVO
            sync_cmds::importar_db_encriptada_global, // 👈 NUEVO
            encriptar::generar_llave_invisible,
            encriptar::encriptar_maletin,
            encriptar::desencriptar_maletin,
            // 👇 NUEVOS COMANDOS BINARIOS 👇
            encriptar::exportar_db_binaria_encriptada,
            encriptar::importar_db_binaria_encriptada,
            aplicar_restauracion_binaria_pendiente,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
