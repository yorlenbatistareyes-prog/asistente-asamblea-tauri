pub mod database;
pub mod models;

pub mod commands {
    pub mod asambleas;
    pub mod congregaciones;
    pub mod correspondencia;
    pub mod importar;
    pub mod locales;
    pub mod oficina;
    pub mod personas;
    pub mod programa;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            match database::initialize_database(app.handle()) {
                Ok(_) => println!("✅ Base de datos OK"),
                Err(e) => println!("❌ Error DB: {}", e),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // LOCALES (SALONES)
            commands::locales::crear_local,
            commands::locales::obtener_locales,
            commands::locales::eliminar_local, // <--- NUEVO COMANDO REGISTRADO
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
            commands::asambleas::crear_asamblea,
            commands::asambleas::obtener_asambleas,
            commands::asambleas::eliminar_asamblea,
            // IMPORTAR
            commands::importar::importar_personas_csv,
            commands::importar::importar_congregaciones_csv,
            commands::importar::importar_programa_jw,
            // PROGRAMA
            commands::programa::obtener_programa_dia,
            commands::programa::asignar_parte,
            commands::programa::obtener_oficina_dia,
            commands::programa::generar_programa_base,
            commands::programa::limpiar_programa,
            commands::programa::crear_parte,
            commands::programa::eliminar_parte,
            commands::programa::alternar_estado_parte,
            // OFICINA
            commands::oficina::obtener_asignaciones_especiales,
            commands::oficina::guardar_asignacion_especial,
            commands::oficina::eliminar_asignacion_especial,
            // CORRESPONDENCIA
            commands::correspondencia::obtener_plantilla,
            commands::correspondencia::guardar_plantilla,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
