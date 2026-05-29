use crate::models::{AsignacionEspecial, PartePrograma};
use rusqlite::{params, Connection, OptionalExtension, Result};
use tauri::{command, AppHandle};

fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

#[command]
pub fn obtener_programa_dia(
    app: AppHandle,
    asamblea_id: i32,
    dia: String,
) -> Result<Vec<PartePrograma>, String> {
    let conn = conectar_db(&app);
    
    // ✅ Añadidos los 3 checks al final del SELECT
    let sql = "
    SELECT 
        p.id, p.dia, p.sesion, p.hora_inicio, p.tema, p.tipo, p.duracion,
        p.orador_id, per.nombre_completo, c.nombre,
        per.email, per.telefono, 
        p.es_video, p.estado, p.esta_presente,
        p.numero_bosquejo, p.ensayo_terminado,
        p.fuente, p.es_betelita, p.es_interprete, p.es_visitante,
        per.circuito,
        p.requiere_ensayo, p.fecha_ensayo, p.hora_ensayo, p.lugar_ensayo, p.notas_ensayo,
        p.check_viernes, p.check_dia, p.check_30m
        FROM programa p
        LEFT JOIN personas per ON p.orador_id = per.id
        LEFT JOIN congregaciones c ON per.id_congregacion = c.id
        WHERE p.asamblea_id = ?1 AND p.dia = ?2
        ORDER BY p.hora_inicio ASC
    ";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let partes = stmt
        .query_map(params![asamblea_id, dia], |row| {
            Ok(PartePrograma {
                id: row.get(0)?,
                dia: row.get(1)?,
                sesion: row.get(2)?,
                hora_inicio: row.get(3).ok(),
                tema: row.get(4)?,
                tipo: row.get(5).ok(),
                duracion: row.get(6).ok(),
                orador_id: row.get(7).ok(),
                nombre_orador: row.get(8).ok(),
                congregacion_orador: row.get(9).ok(),
                email_orador: row.get(10).ok(),
                telefono_orador: row.get(11).ok(),
                es_video: row.get(12).unwrap_or(false),
                estado: row.get(13).ok(),
                esta_presente: row.get(14).unwrap_or(false),
                numero_bosquejo: row.get(15).ok(),
                ensayo_terminado: row.get(16).unwrap_or(false),
                fuente: row.get(17).unwrap_or_else(|_| Some("en_persona".to_string())),
                es_betelita: row.get(18).unwrap_or(false),
                es_interprete: row.get(19).unwrap_or(false),
                es_visitante: row.get(20).unwrap_or(false),
                circuito_orador: row.get(21).ok(), 
                requiere_ensayo: row.get(22).unwrap_or(false),
                fecha_ensayo: row.get(23).ok(),
                hora_ensayo: row.get(24).ok(),
                lugar_ensayo: row.get(25).ok(),
                notas_ensayo: row.get(26).ok(),
                // ✅ LEEMOS LOS DATOS AQUÍ (Índices 27, 28 y 29)
                check_viernes: row.get(27).unwrap_or(false),
                check_dia: row.get(28).unwrap_or(false),
                check_30m: row.get(29).unwrap_or(false),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut res = Vec::new();
    for p in partes {
        res.push(p.map_err(|e| e.to_string())?);
    }
    Ok(res)
}

#[command]
pub fn asignar_parte(
    app: AppHandle,
    id_parte: i32,
    orador_id: Option<i32>,
    es_video: bool,
    numero_bosquejo: Option<String>,
) -> Result<String, String> {
    let conn = conectar_db(&app);

    let bosquejo_actual = if es_video { None } else { numero_bosquejo };

    let params = params![
        orador_id,
        es_video,
        "Confirmado",
        bosquejo_actual.as_deref(),
        id_parte
    ];

    conn.execute(
        "UPDATE programa SET orador_id = ?1, es_video = ?2, estado = ?3, numero_bosquejo = ?4 WHERE id = ?5", 
        params
    ).map_err(|e| e.to_string())?;

    Ok("Ok".to_string())
}

#[command]
pub fn crear_parte(
    app: AppHandle,
    asamblea_id: i32,
    dia: String,
    sesion: String,
    hora: String,
    tema: String,
    tipo: String,
    duracion: i32,
    nombre_orador: Option<String>,
    congregacion: Option<String>,
    email: Option<String>,
    telefono: Option<String>,
    numero_bosquejo: Option<String>,
    // ✅ NUEVOS CAMPOS AÑADIDOS
    fuente: String,
    es_betelita: bool,
    es_interprete: bool,
    es_visitante: bool,
) -> Result<String, String> {
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut orador_id_final: Option<i32> = None;
    let estado = "Pendiente".to_string();

    if tipo != "Video" {
        if let Some(nombre) = nombre_orador {
            if !nombre.trim().is_empty() {
                let existe: Option<i32> = tx
                    .query_row(
                        "SELECT id FROM personas WHERE asamblea_id = ?1 AND nombre_completo = ?2",
                        params![asamblea_id, nombre.trim()],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|e| e.to_string())?;

                if let Some(id) = existe {
                    orador_id_final = Some(id);
                } else {
                    let mut id_cong = 0;
                    if let Some(c) = congregacion {
                        let c_id: Option<i32> = tx.query_row(
                            "SELECT id FROM congregaciones WHERE asamblea_id = ?1 AND nombre = ?2", 
                            params![asamblea_id, c], 
                            |row| row.get(0)
                        ).optional().unwrap_or(None);

                        if let Some(id) = c_id {
                            id_cong = id;
                        } else {
                            tx.execute(
                                "INSERT INTO congregaciones (asamblea_id, nombre, numero_congregacion) VALUES (?1, ?2, '')", 
                                params![asamblea_id, c]
                            ).map_err(|e| e.to_string())?;
                            id_cong = tx.last_insert_rowid() as i32;
                        }
                    }

                    tx.execute(
                        "INSERT INTO personas (asamblea_id, nombre_completo, sexo, id_congregacion, email, telefono) VALUES (?1, ?2, 'M', ?3, ?4, ?5)", 
                        params![
                            asamblea_id, 
                            nombre.trim(), 
                            id_cong, 
                            email.unwrap_or_default(), 
                            telefono.unwrap_or_default()
                        ]
                    ).map_err(|e| e.to_string())?;

                    orador_id_final = Some(tx.last_insert_rowid() as i32);
                }
            }
        }
    }

    let bosquejo_final = if tipo == "Video" { None } else { numero_bosquejo };
    let fuente_final = if tipo == "Video" { "video".to_string() } else { fuente };

    // ✅ INSERCIÓN ACTUALIZADA CON LOS NUEVOS VALORES
    tx.execute(
        "INSERT INTO programa (
            asamblea_id, dia, sesion, hora_inicio, tema, tipo, duracion, estado, 
            orador_id, es_video, esta_presente, numero_bosquejo, 
            fuente, es_betelita, es_interprete, es_visitante
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, ?11, ?12, ?13, ?14, ?15)", 
        params![
            asamblea_id, dia, sesion, hora, tema, tipo, duracion, estado, 
            orador_id_final, tipo == "Video", bosquejo_final.as_deref(),
            fuente_final, es_betelita, es_interprete, es_visitante
        ]
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok("Creado".to_string())
}

#[command]
pub fn actualizar_detalles_parte(
    app: AppHandle,
    id_parte: i32,
    numero_bosquejo: Option<String>,
    fuente: String,
    es_betelita: bool,
    es_interprete: bool,
    es_visitante: bool,
    duracion: i32, 
    // 👇 NUEVOS PARÁMETROS PARA ENSAYOS
    requiere_ensayo: bool,
    fecha_ensayo: Option<String>,
    hora_ensayo: Option<String>,
    lugar_ensayo: Option<String>,
    notas_ensayo: Option<String>,
) -> Result<String, String> {
    let conn = conectar_db(&app);

    conn.execute(
        "UPDATE programa SET 
            numero_bosquejo = ?1, 
            fuente = ?2, 
            es_betelita = ?3, 
            es_interprete = ?4, 
            es_visitante = ?5,
            duracion = ?6,
            requiere_ensayo = ?7,
            fecha_ensayo = ?8,
            hora_ensayo = ?9,
            lugar_ensayo = ?10,
            notas_ensayo = ?11
         WHERE id = ?12",
        params![
            numero_bosquejo.as_deref(), 
            fuente, 
            es_betelita, 
            es_interprete, 
            es_visitante,
            duracion, 
            // 👇 PASAMOS LOS DATOS A LA BASE DE DATOS
            requiere_ensayo,
            fecha_ensayo.as_deref(),
            hora_ensayo.as_deref(),
            lugar_ensayo.as_deref(),
            notas_ensayo.as_deref(),
            id_parte
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok("Datos actualizados".to_string())
}

#[command]
pub fn alternar_estado_parte(
    app: AppHandle,
    id: i32,
    tipo_accion: String,
    valor_nuevo: bool, // Cambiamos el nombre para que sea claro: esto es lo que QUEREMOS guardar
) -> Result<String, String> {
    let conn = conectar_db(&app);
    
    let sql = match tipo_accion.as_str() {
        "confirmacion" => {
            // Si valor_nuevo es TRUE, queremos guardar 'Confirmado'.
            if valor_nuevo {
                "UPDATE programa SET estado = 'Confirmado' WHERE id = ?1"
            } else {
                "UPDATE programa SET estado = 'Pendiente' WHERE id = ?1"
            }
        }
        "presencia" => {
            // Forzamos el valor exacto (1 o 0) en lugar de usar NOT
            if valor_nuevo {
                "UPDATE programa SET esta_presente = 1 WHERE id = ?1"
            } else {
                "UPDATE programa SET esta_presente = 0 WHERE id = ?1"
            }
        }
        "ensayo_terminado" => {
         if valor_nuevo {
        "UPDATE programa SET ensayo_terminado = 1 WHERE id = ?1"
    } else {
        "UPDATE programa SET ensayo_terminado = 0 WHERE id = ?1"
    }
}
        _ => return Err("Acción desconocida".to_string()),
    };

    conn.execute(sql, params![id])
        .map_err(|e| e.to_string())?;

    Ok("Actualizado".to_string())
}

#[command]
pub fn eliminar_parte(app: AppHandle, id: i32) -> Result<String, String> {
    conectar_db(&app)
        .execute("DELETE FROM programa WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok("Eliminado".to_string())
}

#[command]
pub fn limpiar_programa(app: AppHandle, asamblea_id: i32) -> Result<String, String> {
    conectar_db(&app)
        .execute(
            "DELETE FROM programa WHERE asamblea_id = ?1",
            params![asamblea_id],
        )
        .map_err(|e| e.to_string())?;
    Ok("Limpiado".to_string())
}

#[command]
pub fn generar_programa_base(_app: AppHandle) -> Result<String, String> {
    Ok("".to_string())
}

#[command]
pub fn obtener_oficina_dia(
    _app: AppHandle,
    _dia: String,
) -> Result<Vec<AsignacionEspecial>, String> {
    Ok(vec![])
}

#[command]
pub fn guardar_nota_directa(
    app: AppHandle,
    id: i32,
    nota: String
) -> Result<(), String> {
    let conn = conectar_db(&app);
    
    // UPDATE directo sin tocar otras tablas, sin restricciones externas
    conn.execute(
        "UPDATE personas SET notas = ?1 WHERE id = ?2",
        params![nota, id]
    ).map_err(|e| e.to_string())?;

    Ok(())
}
