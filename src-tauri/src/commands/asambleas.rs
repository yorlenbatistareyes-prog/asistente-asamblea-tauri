use crate::models::Asamblea;
use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::Serialize;
use serde_json::json;
use tauri::{command, AppHandle};

fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

// --- ESTRUCTURA PARA EL PDF (NUEVO) ---
#[derive(Serialize)]
pub struct InfoEvento {
    lugar: String,
    direccion: String,
    fecha_ensayo: String,
    hora_ensayo: String,
}

// 1. OBTENER INFO EXTRA PARA IMPRESIÓN (Esta es la función clave)
#[command]
pub fn obtener_info_extra_evento(app: AppHandle, asamblea_id: i32) -> Result<InfoEvento, String> {
    let conn = conectar_db(&app);

    // 👈 Lectura directa, sin LEFT JOIN
    let mut stmt = conn
        .prepare(
            "
        SELECT 
            IFNULL(lugar, 'Salón de Asambleas'), 
            '', 
            IFNULL(ensayo_fecha, ''), 
            IFNULL(ensayo_hora, '') 
        FROM asambleas
        WHERE id = ?1
    ",
        )
        .map_err(|e| e.to_string())?;

    let info = stmt
        .query_row(params![asamblea_id], |row| {
            Ok(InfoEvento {
                lugar: row.get(0).unwrap_or_default(),
                direccion: row.get(1).unwrap_or_default(),
                fecha_ensayo: row.get(2).unwrap_or_default(),
                hora_ensayo: row.get(3).unwrap_or_default(),
            })
        })
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(info.unwrap_or(InfoEvento {
        lugar: "".to_string(),
        direccion: "".to_string(),
        fecha_ensayo: "".to_string(),
        hora_ensayo: "".to_string(),
    }))
}

// 2. GUARDAR INFORMACIÓN
#[command]
pub fn guardar_info_evento(
    app: AppHandle,
    id: Option<i32>,
    tema: String,
    fecha: String,
    identificador: String, // 👈 Añadido
    lugar: String,         // 👈 Añadido
    idioma: String,        // 👈 Añadido
    ensayo_lugar: String,
    ensayo_fecha: String,
    ensayo_hora: String,
    ensayo_notas: String,
    recorridos_info: String,
    instrucciones_esp: String,
    es_jw_stream: bool,
    presidente: Option<String>,
) -> Result<String, String> {
    let conn = conectar_db(&app);
    let stream_val = if es_jw_stream { 1 } else { 0 };

    if let Some(actual_id) = id {
        conn.execute(
            "UPDATE asambleas SET 
                tema=?1, fecha=?2, identificador=?3, lugar=?4, idioma=?5,
                ensayo_lugar=?6, ensayo_fecha=?7, ensayo_hora=?8, 
                ensayo_notas=?9, recorridos_info=?10, instrucciones_esp=?11, 
                jw_stream_studio=?12, presidente=?13  
              WHERE id=?14",
            params![
                tema, fecha, identificador, lugar, idioma,
                ensayo_lugar, ensayo_fecha, ensayo_hora, 
                ensayo_notas, recorridos_info, instrucciones_esp, 
                stream_val, presidente, actual_id
            ],
        )
        .map_err(|e| e.to_string())?;
    } else {
        // (El INSERT se queda igual porque aquí solo actualizamos)
        conn.execute(
            "INSERT INTO asambleas (
                tema, fecha, identificador, lugar, idioma, ensayo_lugar, ensayo_fecha, ensayo_hora, 
                ensayo_notas, recorridos_info, instrucciones_esp, jw_stream_studio, presidente
            ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12, ?13)",
            params![
                tema, fecha, identificador, lugar, idioma, ensayo_lugar, ensayo_fecha, ensayo_hora, 
                ensayo_notas, recorridos_info, instrucciones_esp, stream_val, presidente
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok("Información actualizada correctamente".to_string())
}

// 3. GUARDAR COMITÉ
#[command]
pub fn guardar_comite(
    app: AppHandle,
    id: i32,
    coordinador_id: Option<i32>,
    coordinador_aux_id: Option<i32>,
    prog_super_id: Option<i32>,
    prog_aux_id: Option<i32>,
    aloj_super_id: Option<i32>,
    aloj_aux_id: Option<i32>,
    audio_video_id: Option<i32>,
    video_id: Option<i32>,
    audio_id: Option<i32>,
    plataforma_id: Option<i32>,
    bautismo_super_id: Option<i32>,
    bautismo_aux_id: Option<i32>,
) -> Result<String, String> {
    println!("=== Guardando comité ===");
    println!("ID de asamblea: {}", id);
    println!("coordinador_id: {:?}", coordinador_id);
    println!("coordinador_aux_id: {:?}", coordinador_aux_id);
    println!("prog_super_id: {:?}", prog_super_id);
    println!("prog_aux_id: {:?}", prog_aux_id);
    println!("aloj_super_id: {:?}", aloj_super_id);
    println!("aloj_aux_id: {:?}", aloj_aux_id);
    println!("audio_video_id: {:?}", audio_video_id);
    println!("video_id: {:?}", video_id);
    println!("audio_id: {:?}", audio_id);
    println!("plataforma_id: {:?}", plataforma_id);
    println!("bautismo_super_id: {:?}", bautismo_super_id);
    println!("bautismo_aux_id: {:?}", bautismo_aux_id);

    let conn = conectar_db(&app);

    let rows_affected = conn
        .execute(
            "UPDATE asambleas SET 
            coordinador_id = ?1,
            coordinador_aux_id = ?2,
            prog_super_id = ?3,
            prog_aux_id = ?4,
            aloj_super_id = ?5,
            aloj_aux_id = ?6,
            audio_video_super_id = ?7,
            video_super_id = ?8,
            audio_super_id = ?9,
            plataforma_super_id = ?10,
            bautismo_super_id = ?11,
            bautismo_aux_id = ?12
         WHERE id = ?13",
            params![
                coordinador_id,
                coordinador_aux_id,
                prog_super_id,
                prog_aux_id,
                aloj_super_id,
                aloj_aux_id,
                audio_video_id,
                video_id,
                audio_id,
                plataforma_id,
                bautismo_super_id,
                bautismo_aux_id,
                id
            ],
        )
        .map_err(|e| e.to_string())?;

    println!("Filas actualizadas: {}", rows_affected);
    if rows_affected == 0 {
        println!(
            "⚠️ No se actualizó ninguna fila. Verifica que el ID {} exista.",
            id
        );
    }

    Ok("Comité guardado correctamente".to_string())
}

// 4. OBTENER ASAMBLEA
#[command]
pub fn obtener_asamblea_activa(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let conn = conectar_db(&app);

    let sql = "
        SELECT 
            id, tema, fecha, identificador,
            ensayo_lugar, ensayo_fecha, ensayo_hora, ensayo_notas, 
            recorridos_info, instrucciones_esp, jw_stream_studio,
            lugar, idioma,
            coordinador_id, coordinador_aux_id,
            prog_super_id, prog_aux_id,
            aloj_super_id, aloj_aux_id,
            audio_video_super_id, video_super_id, audio_super_id, plataforma_super_id,
            bautismo_super_id, bautismo_aux_id, presidente
        FROM asambleas 
        ORDER BY id DESC LIMIT 1
    ";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let result = stmt
        .query_row([], |row| {
            Ok(json!({
                "id": row.get::<_, i32>(0)?,
                "tema": row.get::<_, String>(1)?,
                "fecha": row.get::<_, String>(2)?,
                "identificador": row.get::<_, Option<String>>(3).ok(),
                "ensayo_lugar": row.get::<_, String>(4).unwrap_or_default(),
                "ensayo_fecha": row.get::<_, String>(5).unwrap_or_default(),
                "ensayo_hora": row.get::<_, String>(6).unwrap_or_default(),
                "ensayo_notas": row.get::<_, String>(7).unwrap_or_default(),
                "recorridos_info": row.get::<_, String>(8).unwrap_or_default(),
                "instrucciones_esp": row.get::<_, String>(9).unwrap_or_default(),
                "jw_stream_studio": row.get::<_, i32>(10).unwrap_or(0) == 1,
                "lugar": row.get::<_, Option<String>>(11).ok(), // 👈 Directo de asambleas
                "idioma": row.get::<_, Option<String>>(12).ok(),
                // Comité
                "coordinador_id": row.get::<_, Option<i32>>(13).ok(),
                "coordinador_aux_id": row.get::<_, Option<i32>>(14).ok(),
                "prog_super_id": row.get::<_, Option<i32>>(15).ok(),
                "prog_aux_id": row.get::<_, Option<i32>>(16).ok(),
                "aloj_super_id": row.get::<_, Option<i32>>(17).ok(),
                "aloj_aux_id": row.get::<_, Option<i32>>(18).ok(),
                "audio_video_super_id": row.get::<_, Option<i32>>(19).ok(),
                "video_super_id": row.get::<_, Option<i32>>(20).ok(),
                "audio_super_id": row.get::<_, Option<i32>>(21).ok(),
                "plataforma_super_id": row.get::<_, Option<i32>>(22).ok(),
                "bautismo_super_id": row.get::<_, Option<i32>>(23).ok(),
                "bautismo_aux_id": row.get::<_, Option<i32>>(24).ok(),
                "presidente": row.get::<_, Option<String>>(25).ok(),
            }))
        })
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[command]
pub fn obtener_asamblea_por_id(
    app: AppHandle,
    id: i32,
) -> Result<Option<serde_json::Value>, String> {
    let conn = conectar_db(&app);

    let sql = "
        SELECT 
            id, tema, fecha, identificador,
            ensayo_lugar, ensayo_fecha, ensayo_hora, ensayo_notas, 
            recorridos_info, instrucciones_esp, jw_stream_studio,
            lugar, idioma,
            coordinador_id, coordinador_aux_id,
            prog_super_id, prog_aux_id,
            aloj_super_id, aloj_aux_id,
            audio_video_super_id, video_super_id, audio_super_id, plataforma_super_id,
            bautismo_super_id, bautismo_aux_id, presidente
        FROM asambleas 
        WHERE id = ?1
    ";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let result = stmt
        .query_row([id], |row| {
            Ok(json!({
                "id": row.get::<_, i32>(0)?,
                "tema": row.get::<_, String>(1)?,
                "fecha": row.get::<_, String>(2)?,
                "identificador": row.get::<_, Option<String>>(3).ok(),
                "ensayo_lugar": row.get::<_, String>(4).unwrap_or_default(),
                "ensayo_fecha": row.get::<_, String>(5).unwrap_or_default(),
                "ensayo_hora": row.get::<_, String>(6).unwrap_or_default(),
                "ensayo_notas": row.get::<_, String>(7).unwrap_or_default(),
                "recorridos_info": row.get::<_, String>(8).unwrap_or_default(),
                "instrucciones_esp": row.get::<_, String>(9).unwrap_or_default(),
                "jw_stream_studio": row.get::<_, i32>(10).unwrap_or(0) == 1,
                "lugar": row.get::<_, Option<String>>(11).ok(),
                "idioma": row.get::<_, Option<String>>(12).ok(),
                // Comité
                "coordinador_id": row.get::<_, Option<i32>>(13).ok(),
                "coordinador_aux_id": row.get::<_, Option<i32>>(14).ok(),
                "prog_super_id": row.get::<_, Option<i32>>(15).ok(),
                "prog_aux_id": row.get::<_, Option<i32>>(16).ok(),
                "aloj_super_id": row.get::<_, Option<i32>>(17).ok(),
                "aloj_aux_id": row.get::<_, Option<i32>>(18).ok(),
                "audio_video_super_id": row.get::<_, Option<i32>>(19).ok(),
                "video_super_id": row.get::<_, Option<i32>>(20).ok(),
                "audio_super_id": row.get::<_, Option<i32>>(21).ok(),
                "plataforma_super_id": row.get::<_, Option<i32>>(22).ok(),
                "bautismo_super_id": row.get::<_, Option<i32>>(23).ok(),
                "bautismo_aux_id": row.get::<_, Option<i32>>(24).ok(),
                "presidente": row.get::<_, Option<String>>(25).ok(),
            }))
        })
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(result)
}

// 5. CREAR ASAMBLEA
#[tauri::command]
pub fn crear_asamblea(
    app: AppHandle,
    tema: String,
    fecha: String,
    lugar: String, 
    idioma: String,
    identificador: String, // 👈 local_id desterrado
) -> Result<i64, String> {
    let conn = conectar_db(&app);
    conn.execute(
        "INSERT INTO asambleas (
            tema, fecha, identificador, 
            ensayo_lugar, jw_stream_studio, ensayo_notas, 
            recorridos_info, ensayo_fecha, ensayo_hora, instrucciones_esp,
            lugar, idioma
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            tema,          
            fecha,         
            identificador, 
            "",            // ensayo_lugar
            0,             // jw_stream_studio
            "",            // ensayo_notas
            "",            // recorridos_info
            "",            // ensayo_fecha
            "",            // ensayo_hora
            "",            // instrucciones_esp
            lugar,         
            idioma         
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}


// 6. LISTAR Y ELIMINAR
#[command]
pub fn obtener_asambleas(app: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let conn = conectar_db(&app);
    let mut stmt = conn
        .prepare("SELECT id, tema, fecha, identificador, lugar, idioma FROM asambleas ORDER BY id DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "tema": row.get::<_, String>(1)?,
            "fecha": row.get::<_, String>(2)?,
            "identificador": row.get::<_, Option<String>>(3)?,
            "lugar": row.get::<_, Option<String>>(4)?, // 👈 Índice 4 ahora
            "idioma": row.get::<_, Option<String>>(5)? // 👈 Índice 5 ahora
        }))
    }).map_err(|e| e.to_string())?;
    let mut asambleas = Vec::new();
    for row in rows {
        asambleas.push(row.map_err(|e| e.to_string())?);
    }
    Ok(asambleas)
}


#[command]
pub fn eliminar_asamblea(app: AppHandle, id: i64) -> Result<(), String> {
    let conn = conectar_db(&app);
    conn.execute("DELETE FROM asambleas WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// 7. ACTUALIZAR CAJITAS DE REGISTRO
#[command]
pub fn actualizar_check_registro(
    app: AppHandle,
    id: i32, 
    campo: String, 
    valor: bool,
) -> Result<(), String> {
    
    // Usamos tu función conectar_db() que ya existe en este archivo
    let conn = conectar_db(&app);

    let valor_int = if valor { 1 } else { 0 };

    let campo_valido = match campo.as_str() {
        "check_viernes" => "check_viernes",
        "check_dia" => "check_dia",
        "check_30m" => "check_30m",
        _ => return Err("Campo de check no válido".to_string()),
    };

    let query = format!("UPDATE programa SET {} = ? WHERE id = ?", campo_valido);

    match conn.execute(&query, params![valor_int, id]) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Error al actualizar cajita: {}", e)),
    }
}

use serde::Deserialize;

// 1. Estructura para empaquetar las 6 sesiones de asistencia y bautismos
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EstadisticasAsamblea {
    pub viernes_am: i32,
    pub viernes_pm: i32,
    pub sabado_am: i32,
    pub sabado_pm: i32,
    pub domingo_am: i32,
    pub domingo_pm: i32,
    pub bautismos: i32,
}

// 2. Comando para LEER los datos de la base de datos al abrir la pantalla
#[command]
pub async fn obtener_asistencia_asamblea(
    asamblea_id: i64,
    state: tauri::State<'_, crate::database::DbState>,
) -> Result<EstadisticasAsamblea, String> {
    let conn = state.conn.lock().unwrap();
    
    let mut stmt = conn
        .prepare(
            "SELECT asistencia_v_am, asistencia_v_pm, asistencia_s_am, asistencia_s_pm, 
                    asistencia_d_am, asistencia_d_pm, bautismos 
             FROM asambleas WHERE id = ?",
        )
        .map_err(|e| e.to_string())?;

    let stats = stmt
        .query_row([asamblea_id], |row| {
            Ok(EstadisticasAsamblea {
                viernes_am: row.get(0).unwrap_or(0),
                viernes_pm: row.get(1).unwrap_or(0),
                sabado_am: row.get(2).unwrap_or(0),
                sabado_pm: row.get(3).unwrap_or(0),
                domingo_am: row.get(4).unwrap_or(0),
                domingo_pm: row.get(5).unwrap_or(0),
                bautismos: row.get(6).unwrap_or(0),
            })
        })
        .unwrap_or(EstadisticasAsamblea {
            viernes_am: 0, viernes_pm: 0,
            sabado_am: 0, sabado_pm: 0,
            domingo_am: 0, domingo_pm: 0,
            bautismos: 0,
        });

    Ok(stats)
}

// 3. Comando para GUARDAR las 6 sesiones de asistencia
#[command]
pub async fn guardar_asistencia_db(
    asamblea_id: i64,
    datos: EstadisticasAsamblea,
    state: tauri::State<'_, crate::database::DbState>,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    
    conn.execute(
        "UPDATE asambleas SET 
            asistencia_v_am = ?, asistencia_v_pm = ?, 
            asistencia_s_am = ?, asistencia_s_pm = ?, 
            asistencia_d_am = ?, asistencia_d_pm = ?
         WHERE id = ?",
        [
            datos.viernes_am, datos.viernes_pm,
            datos.sabado_am, datos.sabado_pm,
            datos.domingo_am, datos.domingo_pm,
            asamblea_id as i32,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// 4. Comando para GUARDAR los bautismos de forma independiente
#[command]
pub async fn guardar_bautismos_db(
    asamblea_id: i64,
    cantidad: i32,
    state: tauri::State<'_, crate::database::DbState>,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    
    conn.execute(
        "UPDATE asambleas SET bautismos = ? WHERE id = ?",
        [cantidad, asamblea_id as i32],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// 5. GUARDAR COLOR DE SERIE (para persistir colores de series de discursos)
#[command]
pub fn guardar_color_serie(
    app: AppHandle,
    asamblea_id: i64,
    base_titulo: String,
    color: String,
) -> Result<(), String> {
    let conn = conectar_db(&app);
    conn.execute(
        "INSERT OR REPLACE INTO series_colores (asamblea_id, base_titulo, color) VALUES (?1, ?2, ?3)",
        params![asamblea_id, base_titulo, color],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// 6. CARGAR COLORES DE SERIE
#[command]
pub fn cargar_colores_series(
    app: AppHandle,
    asamblea_id: i64,
) -> Result<Vec<(String, String)>, String> {
    let conn = conectar_db(&app);
    let mut stmt = conn
        .prepare("SELECT base_titulo, color FROM series_colores WHERE asamblea_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![asamblea_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}