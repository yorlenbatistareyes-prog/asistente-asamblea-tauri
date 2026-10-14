use chrono::Datelike;
use rusqlite::{params, Connection, OptionalExtension, Result};
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::path::PathBuf;
use tauri::{command, AppHandle};

fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

// --- ESTRUCTURAS DE DESERIALIZACIÓN ---
#[derive(Debug, serde::Deserialize)]
struct FilaCongregacionMaster {
    #[serde(alias = "Congregación", alias = "Congregacion")]
    nombre: String,
    #[serde(alias = "Número de congregación", alias = "Número", alias = "Numero")]
    numero: Option<String>,
    #[serde(alias = "Circuito")]
    circuito: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct FilaPersonaJWHub {
    #[serde(alias = "Nombre")]
    nombre: Option<String>,
    #[serde(alias = "Segundo nombre")]
    segundo_nombre: Option<String>,
    #[serde(alias = "Apellidos")]
    apellidos: Option<String>,
    #[serde(alias = "Congregación")]
    congregacion: Option<String>,
    #[serde(
        alias = "Teléfono (Celular)",
        alias = "Teléfono móvil",
        alias = "Móvil"
    )]
    celular: Option<String>,
    #[serde(alias = "Teléfono", alias = "Teléfono fijo")]
    fijo: Option<String>,
    #[serde(
        alias = "Correo electrónico (Correo electrónico (jw.org))",
        alias = "Correo electrónico"
    )]
    email: Option<String>,
    #[serde(alias = "Tipo de privilegio", alias = "Privilegios")]
    privilegio: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct FilaProgramaJW {
    #[serde(alias = "Día", alias = "Dia")]
    fecha: String,
    #[serde(alias = "Hora")]
    hora: String,
    // ✅ NUEVO: Bosquejo
    #[serde(alias = "Bosquejo", alias = "Outline")]
    bosquejo: Option<String>,
    #[serde(alias = "Título")]
    titulo: String,
    #[serde(alias = "Fuente", alias = "Source material")]
    fuente: Option<String>,
    #[serde(alias = "Orador", alias = "Speaker")]
    orador: Option<String>,
    // ✅ NUEVO: Circuito
    #[serde(alias = "Circuito", alias = "Circuit")]
    circuito: Option<String>,
    #[serde(alias = "Congregación", alias = "Congregation")]
    congregacion: Option<String>,
    #[serde(alias = "Teléfono móvil", alias = "Mobile phone")]
    movil: Option<String>,
    // ✅ NUEVO: Teléfono fijo
    #[serde(alias = "Teléfono fijo", alias = "Landline")]
    fijo: Option<String>,
    #[serde(alias = "Correo electrónico", alias = "Email address")]
    email: Option<String>,
    #[serde(
        alias = "Speaker Bethelite",
        alias = "Orador betelita",
        alias = "Betelita"
    )]
    es_betelita: Option<String>,
    #[serde(alias = "Interpreter", alias = "Intérprete", alias = "Interprete")]
    es_interprete: Option<String>,
    #[serde(
        alias = "Visiting speaker",
        alias = "Orador visitante",
        alias = "Visitante"
    )]
    es_visitante: Option<String>,
}

fn preparar_lector(ruta: &str) -> Result<csv::Reader<File>, String> {
    let path = PathBuf::from(ruta);
    let file = File::open(&path).map_err(|e| format!("No se pudo abrir el archivo: {}", e))?;
    let rdr = csv::ReaderBuilder::new()
        .delimiter(b',')
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(file);
    Ok(rdr)
}

// --- COMANDOS ---

#[command]
pub fn importar_personas_csv(
    app: AppHandle,
    asamblea_id: i32,
    ruta_archivo: String,
) -> Result<String, String> {
    let mut rdr = preparar_lector(&ruta_archivo)?;
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut procesadas = 0;

    {
        let congregaciones_existentes = {
            let mut stmt = tx.prepare("SELECT id, nombre FROM congregaciones WHERE asamblea_id = ?1").map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![asamblea_id], |row| {
                Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
            rows
        };
        
        let mut congregaciones_por_nombre: HashMap<String, i32> = congregaciones_existentes
            .into_iter()
            .map(|(id, nombre)| (crate::database::normalizar_clave(&nombre), id))
            .collect();
            
        let mut stmt_ins_cong = tx.prepare(
            "INSERT INTO congregaciones (asamblea_id, nombre, numero_congregacion) 
             VALUES (?1, ?2, '') 
             ON CONFLICT(asamblea_id, nombre) DO NOTHING"
        ).map_err(|e| e.to_string())?;
        
        // UPSERT Inteligente: Actualiza sin borrar datos previos si el CSV viene vacío en algunos campos
        let mut stmt_ins_pers = tx.prepare(
            "INSERT INTO personas (asamblea_id, nombre_completo, sexo, privilegios, id_congregacion, telefono, email) 
             VALUES (?1, ?2, 'M', ?3, ?4, ?5, ?6)
             ON CONFLICT(asamblea_id, nombre_completo) DO UPDATE SET
                 privilegios = COALESCE(NULLIF(excluded.privilegios, ''), personas.privilegios),
                 id_congregacion = COALESCE(excluded.id_congregacion, personas.id_congregacion),
                 telefono = COALESCE(NULLIF(excluded.telefono, ''), personas.telefono),
                 email = COALESCE(NULLIF(excluded.email, ''), personas.email)"
        ).map_err(|e| e.to_string())?;

        for result in rdr.deserialize() {
            let fila: FilaPersonaJWHub = match result {
                Ok(f) => f,
                Err(_) => continue,
            };
            
            let mut partes = Vec::new();
            if let Some(n) = fila.nombre { if !n.trim().is_empty() { partes.push(n); } }
            if let Some(s) = fila.segundo_nombre { if !s.trim().is_empty() { partes.push(s); } }
            if let Some(a) = fila.apellidos { if !a.trim().is_empty() { partes.push(a); } }
            
            let nombre_final = partes.join(" ").split_whitespace().collect::<Vec<_>>().join(" ");
            if nombre_final.trim().is_empty() {
                continue;
            }

            let mut id_cong: Option<i32> = None;

            if let Some(cong) = &fila.congregacion {
                let c_limpio = cong.trim();
                if !c_limpio.is_empty() {
                    let clave_congregacion = crate::database::normalizar_clave(c_limpio);
                    if let Some(cid) = congregaciones_por_nombre.get(&clave_congregacion) {
                        id_cong = Some(*cid);
                    } else {
                        stmt_ins_cong
                            .execute(params![asamblea_id, c_limpio])
                            .map_err(|e| format!("Error al crear congregación importada: {}", e))?;
                        let id = tx.last_insert_rowid() as i32;
                        congregaciones_por_nombre.insert(clave_congregacion, id);
                        id_cong = Some(id);
                    }
                }
            }

            let tel = fila.celular.or(fila.fijo).unwrap_or_default();
            let email = fila.email.unwrap_or_default();
            let privi = fila.privilegio.unwrap_or_default();

            stmt_ins_pers
                .execute(params![
                    asamblea_id,
                    nombre_final,
                    privi,
                    id_cong,
                    tel,
                    email
                ])
                .map_err(|e| format!("Error al importar/actualizar persona: {}", e))?;
            procesadas += 1;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(format!("✅ {} personas procesadas (añadidas o actualizadas).", procesadas))
}

#[command]
pub fn importar_congregaciones_csv(
    app: AppHandle,
    asamblea_id: i32,
    ruta_archivo: String,
) -> Result<String, String> {
    let mut rdr = preparar_lector(&ruta_archivo)?;
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut procesadas = 0;
    
    {
        // UPSERT Inteligente para congregaciones
        let mut stmt_insert = tx.prepare(
            "INSERT INTO congregaciones (asamblea_id, nombre, numero_congregacion, circuito) 
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(asamblea_id, nombre) DO UPDATE SET
                 numero_congregacion = COALESCE(NULLIF(excluded.numero_congregacion, ''), congregaciones.numero_congregacion),
                 circuito = COALESCE(NULLIF(excluded.circuito, ''), congregaciones.circuito)"
        ).map_err(|e| e.to_string())?;
        
        for result in rdr.deserialize() {
            let fila: FilaCongregacionMaster = match result {
                Ok(f) => f,
                Err(_) => continue,
            };
            if fila.nombre.trim().is_empty() {
                continue;
            }
            let nombre = fila.nombre.split_whitespace().collect::<Vec<_>>().join(" ");

            stmt_insert
                .execute(params![
                    asamblea_id,
                    nombre,
                    fila.numero.unwrap_or_default(),
                    fila.circuito.unwrap_or_default()
                ])
                .map_err(|e| format!("Error al importar/actualizar congregación: {}", e))?;
            procesadas += 1;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(format!("✅ {} congregaciones procesadas (añadidas o actualizadas).", procesadas))
}

#[command]
pub fn importar_programa_jw(
    app: AppHandle,
    asamblea_id: i32,
    ruta_archivo: String,
) -> Result<String, String> {
    let rdr = preparar_lector(&ruta_archivo)?;
    importar_programa_jw_desde_lector(&app, asamblea_id, rdr)
}

#[command]
pub fn importar_programa_jw_contenido(
    app: AppHandle,
    asamblea_id: i32,
    contenido: String,
) -> Result<String, String> {
    if contenido.trim().is_empty() {
        return Err("El archivo CSV está vacío.".to_string());
    }

    let rdr = csv::ReaderBuilder::new()
        .delimiter(b',')
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(std::io::Cursor::new(contenido.into_bytes()));
    importar_programa_jw_desde_lector(&app, asamblea_id, rdr)
}

fn importar_programa_jw_desde_lector<R: std::io::Read>(
    app: &AppHandle,
    asamblea_id: i32,
    mut rdr: csv::Reader<R>,
) -> Result<String, String> {
    let mut conn = conectar_db(app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let mut stmt_find_cong = tx.prepare("SELECT id FROM congregaciones WHERE asamblea_id = ?1 AND LOWER(TRIM(nombre)) = LOWER(TRIM(?2))").map_err(|e| e.to_string())?;
        
        let mut stmt_ins_cong = tx.prepare(
            "INSERT INTO congregaciones (asamblea_id, nombre, numero_congregacion) 
             VALUES (?1, ?2, '') 
             ON CONFLICT(asamblea_id, nombre) DO NOTHING"
        ).map_err(|e| e.to_string())?;
        
        let mut stmt_find_pers = tx
            .prepare("SELECT id FROM personas WHERE asamblea_id = ?1 AND nombre_completo = ?2")
            .map_err(|e| e.to_string())?;

        let mut stmt_ins_pers = tx.prepare(
            "INSERT INTO personas (asamblea_id, nombre_completo, sexo, privilegios, id_congregacion, telefono, email, circuito, telefono_fijo) 
             VALUES (?1, ?2, 'M', 'Orador', ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(asamblea_id, nombre_completo) DO UPDATE SET
                 id_congregacion = COALESCE(excluded.id_congregacion, personas.id_congregacion),
                 telefono = COALESCE(NULLIF(excluded.telefono, ''), personas.telefono),
                 email = COALESCE(NULLIF(excluded.email, ''), personas.email),
                 circuito = COALESCE(NULLIF(excluded.circuito, ''), personas.circuito),
                 telefono_fijo = COALESCE(NULLIF(excluded.telefono_fijo, ''), personas.telefono_fijo)"
        ).map_err(|e| e.to_string())?;

        // UPSERT Inteligente para el programa: Mantiene el orador actual si el CSV viene sin orador
        let mut stmt_ins_prog = tx
            .prepare(
                "INSERT INTO programa (
                    asamblea_id, dia, sesion, hora_inicio, tema, tipo, duracion, 
                    orador_id, es_video, estado, esta_presente, 
                    fuente, es_betelita, es_interprete, es_visitante, numero_bosquejo
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8, 'Pendiente', 0, ?9, ?10, ?11, ?12, ?13)
                 ON CONFLICT(asamblea_id, dia, hora_inicio, tema) DO UPDATE SET
                    sesion = excluded.sesion,
                    tipo = excluded.tipo,
                    orador_id = COALESCE(excluded.orador_id, programa.orador_id),
                    es_video = excluded.es_video,
                    fuente = excluded.fuente,
                    es_betelita = excluded.es_betelita,
                    es_interprete = excluded.es_interprete,
                    es_visitante = excluded.es_visitante,
                    numero_bosquejo = COALESCE(NULLIF(excluded.numero_bosquejo, ''), programa.numero_bosquejo)"
            )
            .map_err(|e| e.to_string())?;

        for result in rdr.deserialize() {
            let fila: FilaProgramaJW = match result {
                Ok(f) => f,
                Err(_) => continue,
            };
            
            let dia_semana = match chrono::NaiveDate::parse_from_str(&fila.fecha, "%Y-%m-%d") {
                Ok(d) => match d.weekday() {
                    chrono::Weekday::Fri => "Viernes",
                    chrono::Weekday::Sat => "Sábado",
                    chrono::Weekday::Sun => "Domingo",
                    _ => "Viernes",
                },
                Err(_) => "Viernes",
            };
            
            // --- CORRECCIÓN DE HORA 12H A 24H ---
            let partes_hora: Vec<&str> = fila.hora.split(':').collect();
            let mut hora_limpia = fila.hora.clone();
            
            if partes_hora.len() >= 2 {
                let h_str: String = partes_hora[0].chars().filter(|c| c.is_ascii_digit()).collect();
                let m_str: String = partes_hora[1].chars().filter(|c| c.is_ascii_digit()).collect();
                
                if let (Ok(mut h), Ok(m)) = (h_str.parse::<u32>(), m_str.parse::<u32>()) {
                    let texto_hora = fila.hora.to_lowercase();
                    let es_pm = texto_hora.contains("pm") || texto_hora.contains("p.m");
                    
                    if es_pm && h < 12 {
                        h += 12;
                    } else if h >= 1 && h <= 6 {
                        // REGLA: Si la hora es de 1 a 6, en el contexto del programa SIEMPRE es de la tarde.
                        h += 12;
                    }
                    
                    hora_limpia = format!("{:0>2}:{:0>2}", h, m);
                }
            }
            
            let sesion = if hora_limpia < "12:00".to_string() {
                "Mañana"
            } else {
                "Tarde"
            };
            // -------------------------------------
            
            let fuente = fila.fuente.unwrap_or_default();
            let es_video = fuente == "Video" || fila.titulo.contains("Producción audiovisual");
            let tipo = if es_video { "Video" } else { "Discurso" };

            let mut orador_id: Option<i32> = None;
            
            if !es_video {
                if let Some(raw_orador) = fila.orador {
                    let nombre_final = if let Some((ap, nom)) = raw_orador.split_once(',') {
                        format!("{} {}", nom.trim(), ap.trim())
                    } else {
                        raw_orador.clone()
                    };
                    
                    let existe_p: Option<i32> = stmt_find_pers
                        .query_row(params![asamblea_id, &nombre_final], |row| row.get(0))
                        .optional()
                        .unwrap_or(None);
                        
                    if let Some(pid) = existe_p {
                        orador_id = Some(pid);

                        // Actualización inteligente para el orador existente
                        let _ = tx.execute(
                            "UPDATE personas SET 
                                circuito = COALESCE(NULLIF(?1, ''), circuito), 
                                telefono_fijo = COALESCE(NULLIF(?2, ''), telefono_fijo) 
                             WHERE id = ?3",
                            params![
                                fila.circuito.clone().unwrap_or_default(),
                                fila.fijo.clone().unwrap_or_default(),
                                pid
                            ],
                        );
                    } else {
                        let mut id_cong: Option<i32> = None;

                        if let Some(c) = fila.congregacion {
                            let c_limpio = c.trim();
                            if !c_limpio.is_empty() {
                                let ex_c: Option<i32> = stmt_find_cong
                                    .query_row(params![asamblea_id, c_limpio], |row| row.get(0))
                                    .optional()
                                    .unwrap_or(None);
                                    
                                if let Some(cid) = ex_c {
                                    id_cong = Some(cid);
                                } else {
                                    stmt_ins_cong
                                        .execute(params![asamblea_id, c_limpio])
                                        .unwrap_or(0);
                                    id_cong = Some(tx.last_insert_rowid() as i32);
                                }
                            }
                        }

                        stmt_ins_pers
                            .execute(params![
                                asamblea_id,
                                nombre_final,
                                id_cong, 
                                fila.movil.unwrap_or_default(),
                                fila.email.unwrap_or_default(),
                                fila.circuito.unwrap_or_default(), 
                                fila.fijo.unwrap_or_default()      
                            ])
                            .unwrap_or(0);
                        orador_id = Some(tx.last_insert_rowid() as i32);
                    }
                }
            }

            let es_betel = fila
                .es_betelita
                .map(|s| {
                    s.to_lowercase().contains('y')
                        || s.to_lowercase().contains('s')
                        || s.to_lowercase().contains('í')
                })
                .unwrap_or(false);
                
            let es_inter = fila
                .es_interprete
                .map(|s| {
                    s.to_lowercase().contains('y')
                        || s.to_lowercase().contains('s')
                        || s.to_lowercase().contains('í')
                })
                .unwrap_or(false);
                
            let es_visit = fila
                .es_visitante
                .map(|s| {
                    s.to_lowercase().contains('y')
                        || s.to_lowercase().contains('s')
                        || s.to_lowercase().contains('í')
                })
                .unwrap_or(false);

            stmt_ins_prog
                .execute(params![
                    asamblea_id,
                    dia_semana,
                    sesion,
                    hora_limpia,
                    fila.titulo,
                    tipo,
                    orador_id,
                    es_video,
                    fuente,                            
                    es_betel,                          
                    es_inter,                          
                    es_visit,                          
                    fila.bosquejo.unwrap_or_default()  
                ])
                .unwrap_or(0);
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok("✅ Programa actualizado con éxito desde el CSV.".to_string())
}