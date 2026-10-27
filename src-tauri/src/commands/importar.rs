use chrono::Datelike;
use rusqlite::{params, Connection, OptionalExtension, Result};
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
    let mut contador = 0;

    {
        let mut stmt_find_cong = tx.prepare("SELECT id FROM congregaciones WHERE asamblea_id = ?1 AND LOWER(TRIM(nombre)) = LOWER(TRIM(?2))").map_err(|e| e.to_string())?;
        let mut stmt_ins_cong = tx.prepare("INSERT INTO congregaciones (asamblea_id, nombre, numero_congregacion) VALUES (?1, ?2, '')").map_err(|e| e.to_string())?;
        let mut stmt_check_pers = tx
            .prepare("SELECT id FROM personas WHERE asamblea_id = ?1 AND nombre_completo = ?2")
            .map_err(|e| e.to_string())?;
        let mut stmt_ins_pers = tx.prepare("INSERT INTO personas (asamblea_id, nombre_completo, sexo, privilegios, id_congregacion, telefono, email) VALUES (?1, ?2, 'M', ?3, ?4, ?5, ?6)").map_err(|e| e.to_string())?;
        let mut stmt_upd_pers = tx.prepare("UPDATE personas SET id_congregacion = ?1, privilegios = ?2, telefono = ?3, email = ?4 WHERE id = ?5").map_err(|e| e.to_string())?;

        for result in rdr.deserialize() {
            let fila: FilaPersonaJWHub = match result {
                Ok(f) => f,
                Err(_) => continue,
            };
            let mut partes = Vec::new();
            if let Some(n) = fila.nombre {
                if !n.trim().is_empty() {
                    partes.push(n);
                }
            }
            if let Some(s) = fila.segundo_nombre {
                if !s.trim().is_empty() {
                    partes.push(s);
                }
            }
            if let Some(a) = fila.apellidos {
                if !a.trim().is_empty() {
                    partes.push(a);
                }
            }
            let nombre_final = partes.join(" ");
            if nombre_final.trim().is_empty() {
                continue;
            }

            // ✅ CORRECCIÓN: Permitimos que sea Nulo si viene vacío
            let mut id_cong: Option<i32> = None;

            if let Some(cong) = &fila.congregacion {
                let c_limpio = cong.trim();
                if !c_limpio.is_empty() {
                    let existe_c: Option<i32> = stmt_find_cong
                        .query_row(params![asamblea_id, c_limpio], |row| row.get(0))
                        .optional()
                        .unwrap_or(None);
                    if let Some(cid) = existe_c {
                        id_cong = Some(cid);
                    } else {
                        stmt_ins_cong
                            .execute(params![asamblea_id, c_limpio])
                            .unwrap_or(0);
                        id_cong = Some(tx.last_insert_rowid() as i32);
                    }
                }
            }

            let tel = fila.celular.or(fila.fijo).unwrap_or_default();
            let email = fila.email.unwrap_or_default();
            let privi = fila.privilegio.unwrap_or_default();

            let existe_p: Option<i32> = stmt_check_pers
                .query_row(params![asamblea_id, &nombre_final], |row| row.get(0))
                .optional()
                .unwrap_or(None);

            if let Some(pid) = existe_p {
                stmt_upd_pers
                    .execute(params![id_cong, privi, tel, email, pid])
                    .unwrap_or(0);
            } else {
                stmt_ins_pers
                    .execute(params![
                        asamblea_id,
                        nombre_final,
                        privi,
                        id_cong, // Ahora pasará NULL si no tiene en lugar de 0
                        tel,
                        email
                    ])
                    .unwrap_or(0);
            }
            contador += 1;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(format!("✅ {} personas procesadas.", contador))
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
    {
        let mut stmt_check = tx.prepare("SELECT id FROM congregaciones WHERE asamblea_id = ?1 AND LOWER(TRIM(nombre)) = LOWER(TRIM(?2))").map_err(|e| e.to_string())?;
        let mut stmt_insert = tx.prepare("INSERT INTO congregaciones (asamblea_id, nombre, numero_congregacion, circuito) VALUES (?1, ?2, ?3, ?4)").map_err(|e| e.to_string())?;
        for result in rdr.deserialize() {
            let fila: FilaCongregacionMaster = match result {
                Ok(f) => f,
                Err(_) => continue,
            };
            if fila.nombre.trim().is_empty() {
                continue;
            }
            let existe: Option<i32> = stmt_check
                .query_row(params![asamblea_id, fila.nombre.trim()], |row| row.get(0))
                .optional()
                .unwrap_or(None);
            if existe.is_none() {
                stmt_insert
                    .execute(params![
                        asamblea_id,
                        fila.nombre.trim(),
                        fila.numero.unwrap_or_default(),
                        fila.circuito.unwrap_or_default()
                    ])
                    .unwrap_or(0);
            }
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok("✅ Congregaciones importadas.".to_string())
}

#[command]
pub fn importar_programa_jw(
    app: AppHandle,
    asamblea_id: i32,
    ruta_archivo: String,
) -> Result<String, String> {
    let mut rdr = preparar_lector(&ruta_archivo)?;
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let mut stmt_find_cong = tx.prepare("SELECT id FROM congregaciones WHERE asamblea_id = ?1 AND LOWER(TRIM(nombre)) = LOWER(TRIM(?2))").map_err(|e| e.to_string())?;
        let mut stmt_ins_cong = tx.prepare("INSERT INTO congregaciones (asamblea_id, nombre, numero_congregacion) VALUES (?1, ?2, '')").map_err(|e| e.to_string())?;
        let mut stmt_find_pers = tx
            .prepare("SELECT id FROM personas WHERE asamblea_id = ?1 AND nombre_completo = ?2")
            .map_err(|e| e.to_string())?;

        // 👇 ACTUALIZADO: Añadido circuito (?6) y telefono_fijo (?7)
        let mut stmt_ins_pers = tx.prepare("INSERT INTO personas (asamblea_id, nombre_completo, sexo, privilegios, id_congregacion, telefono, email, circuito, telefono_fijo) VALUES (?1, ?2, 'M', 'Orador', ?3, ?4, ?5, ?6, ?7)").map_err(|e| e.to_string())?;

        // 👇 ACTUALIZADO: Añadido numero_bosquejo (?13)
        let mut stmt_ins_prog = tx
            .prepare(
                "
            INSERT INTO programa (
                asamblea_id, dia, sesion, hora_inicio, tema, tipo, duracion, 
                orador_id, es_video, estado, esta_presente, 
                fuente, es_betelita, es_interprete, es_visitante, numero_bosquejo
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8, 'Pendiente', 0, ?9, ?10, ?11, ?12, ?13)
        ",
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
            let partes_hora: Vec<&str> = fila.hora.split(':').collect();
            let hora_limpia = if partes_hora.len() >= 2 {
                format!("{:0>2}:{:0>2}", partes_hora[0], partes_hora[1])
            } else {
                fila.hora.clone()
            };
            let sesion = if hora_limpia < "13:00".to_string() {
                "Mañana"
            } else {
                "Tarde"
            };
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

                        // ✅ AÑADIDO: Si el orador ya existe, le actualizamos el circuito
                        let _ = tx.execute(
                            "UPDATE personas SET circuito = ?1, telefono_fijo = ?2 WHERE id = ?3",
                            params![
                                fila.circuito.clone().unwrap_or_default(),
                                fila.fijo.clone().unwrap_or_default(),
                                pid
                            ],
                        );
                    } else {
                        // ✅ CORRECCIÓN: Ahora es Option<i32>, permite nulos
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

                        // 👇 ACTUALIZADO: Pasamos id_cong como Option, permite nulos (sin congregación)
                        stmt_ins_pers
                            .execute(params![
                                asamblea_id,
                                nombre_final,
                                id_cong, // Ahora pasa NULL si no tiene congregación
                                fila.movil.unwrap_or_default(),
                                fila.email.unwrap_or_default(),
                                fila.circuito.unwrap_or_default(), // ?6
                                fila.fijo.unwrap_or_default()      // ?7
                            ])
                            .unwrap_or(0);
                        orador_id = Some(tx.last_insert_rowid() as i32);
                    }
                }
            }

            // Convertimos los valores de texto del CSV a booleanos para la DB
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

            // 👇 ACTUALIZADO: Pasamos el bosquejo a la tabla programa
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
                    fuente,                            // ?9
                    es_betel,                          // ?10
                    es_inter,                          // ?11
                    es_visit,                          // ?12
                    fila.bosquejo.unwrap_or_default()  // ?13 (Número de bosquejo)
                ])
                .unwrap_or(0);
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok("✅ Programa importado.".to_string())
}
