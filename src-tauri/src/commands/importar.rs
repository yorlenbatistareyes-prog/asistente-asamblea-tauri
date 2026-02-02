use tauri::{AppHandle, command};
use rusqlite::{Connection, Result, params, OptionalExtension};
use std::fs::File;
use std::path::PathBuf;
use std::io::{Read, Seek, SeekFrom};
use chrono::Datelike; 

fn conectar_db(app: &AppHandle) -> Connection {
    let db_path = crate::database::obtener_ruta_db(app);
    Connection::open(db_path).unwrap()
}

// ==========================================
// 1. ESTRUCTURAS DE DATOS
// ==========================================

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
    #[serde(alias = "Nombre completo", alias = "Orador")] 
    nombre_completo: Option<String>,
    #[serde(alias = "Nombre")] 
    nombre: Option<String>,
    #[serde(alias = "Segundo nombre")] 
    segundo_nombre: Option<String>,
    #[serde(alias = "Apellidos", alias = "Apellido")] 
    apellidos: Option<String>,
    #[serde(alias = "Congregación")] 
    congregacion: Option<String>,
    #[serde(alias = "Teléfono (Celular)", alias = "Teléfono móvil", alias = "Móvil")] 
    celular: Option<String>,
    #[serde(alias = "Teléfono", alias = "Teléfono fijo")] 
    fijo: Option<String>,
    #[serde(alias = "Correo electrónico (Correo electrónico (jw.org))", alias = "Correo electrónico", alias = "Email")] 
    email: Option<String>,
    #[serde(alias = "Tipo de privilegio", alias = "Privilegios")]
    privilegio: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct FilaProgramaJW {
    #[serde(alias = "Día", alias = "Dia")] fecha: String,       
    #[serde(alias = "Hora")] hora: String,        
    #[serde(alias = "Título")] titulo: String,
    #[serde(alias = "Fuente")] fuente: Option<String>,      
    #[serde(alias = "Orador")] orador: Option<String>, 
    #[serde(alias = "Congregación")] congregacion: Option<String>,
    #[serde(alias = "Teléfono móvil")] movil: Option<String>,
    #[serde(alias = "Teléfono fijo")] fijo: Option<String>,
    #[serde(alias = "Correo electrónico")] email: Option<String>,
}

// ==========================================
// 2. HERRAMIENTAS
// ==========================================

fn preparar_lector(ruta: &str) -> Result<csv::Reader<File>, String> {
    let path = PathBuf::from(ruta);
    let mut file = File::open(&path).map_err(|e| format!("No se pudo abrir el archivo: {}", e))?;
    let mut bom = [0; 3]; let _ = file.read(&mut bom);
    let start_pos = if bom == [0xEF, 0xBB, 0xBF] { 3 } else { 0 };
    file.seek(SeekFrom::Start(start_pos)).unwrap();
    let mut buffer = [0; 200]; let _ = file.read(&mut buffer);
    let delimiter = if buffer.contains(&b';') { b';' } else { b',' };
    file.seek(SeekFrom::Start(start_pos)).unwrap();
    let rdr = csv::ReaderBuilder::new().delimiter(delimiter).flexible(true).trim(csv::Trim::All).from_reader(file);
    Ok(rdr)
}

// ==========================================
// 3. COMANDOS
// ==========================================

#[command]
pub fn importar_congregaciones_csv(app: AppHandle, ruta_archivo: String) -> Result<String, String> {
    let mut rdr = preparar_lector(&ruta_archivo)?;
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut stmt_check = tx.prepare("SELECT id FROM congregaciones WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?1))").map_err(|e| e.to_string())?;
    let mut stmt_update = tx.prepare("UPDATE congregaciones SET numero_congregacion = ?1, circuito = ?2 WHERE id = ?3").map_err(|e| e.to_string())?;
    let mut stmt_insert = tx.prepare("INSERT INTO congregaciones (nombre, numero_congregacion, circuito) VALUES (?1, ?2, ?3)").map_err(|e| e.to_string())?;

    let mut actualizadas = 0;
    let mut nuevas = 0;

    for result in rdr.deserialize() {
        let fila: FilaCongregacionMaster = match result { Ok(f) => f, Err(_) => continue };
        let nombre = fila.nombre.trim();
        if nombre.is_empty() { continue; }
        let numero = fila.numero.unwrap_or_default();
        let circuito = fila.circuito.unwrap_or_default();

        let existe: Option<i32> = stmt_check.query_row(params![nombre], |row| row.get(0)).optional().unwrap_or(None);

        if let Some(id) = existe {
            stmt_update.execute(params![numero, circuito, id]).unwrap_or(0);
            actualizadas += 1;
        } else {
            stmt_insert.execute(params![nombre, numero, circuito]).unwrap_or(0);
            nuevas += 1;
        }
    }
    drop(stmt_check); drop(stmt_update); drop(stmt_insert);
    tx.commit().map_err(|e| e.to_string())?;
    Ok(format!("✅ {} nuevas, {} actualizadas.", nuevas, actualizadas))
}

#[command]
pub fn importar_personas_csv(app: AppHandle, ruta_archivo: String) -> Result<String, String> {
    let mut rdr = preparar_lector(&ruta_archivo)?;
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut stmt_find_cong = tx.prepare("SELECT id FROM congregaciones WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?1))").map_err(|e| e.to_string())?;
    let mut stmt_ins_cong = tx.prepare("INSERT INTO congregaciones (nombre, numero_congregacion) VALUES (?1, '')").map_err(|e| e.to_string())?;
    let mut stmt_check_pers = tx.prepare("SELECT id FROM personas WHERE nombre_completo = ?1").map_err(|e| e.to_string())?;
    let mut stmt_ins_pers = tx.prepare("INSERT INTO personas (nombre_completo, genero, privilegios, id_congregacion, telefono, email) VALUES (?1, 'Hombre', ?2, ?3, ?4, ?5)").map_err(|e| e.to_string())?;
    let mut stmt_upd_pers = tx.prepare("UPDATE personas SET id_congregacion = ?1, privilegios = ?2, telefono = ?3, email = ?4 WHERE id = ?5").map_err(|e| e.to_string())?;

    let mut contador = 0;
    for result in rdr.deserialize() {
        let fila: FilaPersonaJWHub = match result { Ok(f) => f, Err(_) => continue };
        let nombre_final = if fila.nombre.is_some() {
            let n = fila.nombre.clone().unwrap_or_default();
            let s = fila.segundo_nombre.clone().unwrap_or_default();
            let a = fila.apellidos.clone().unwrap_or_default();
            let mut partes = Vec::new();
            if !n.trim().is_empty() { partes.push(n.trim()); }
            if !s.trim().is_empty() { partes.push(s.trim()); }
            if !a.trim().is_empty() { partes.push(a.trim()); }
            partes.join(" ")
        } else if let Some(nc) = &fila.nombre_completo {
            if let Some((ap, nom)) = nc.split_once(',') { format!("{} {}", nom.trim(), ap.trim()) } else { nc.clone() }
        } else { continue; };

        if nombre_final.trim().is_empty() { continue; }

        let mut id_cong = 0;
        if let Some(cong) = &fila.congregacion {
            if !cong.trim().is_empty() {
                let existe: Option<i32> = stmt_find_cong.query_row(params![cong.trim()], |row| row.get(0)).optional().unwrap_or(None);
                if let Some(cid) = existe { id_cong = cid; } 
                else {
                    stmt_ins_cong.execute(params![cong.trim()]).unwrap_or(0);
                    id_cong = tx.last_insert_rowid() as i32;
                }
            }
        }

        let tel = fila.celular.or(fila.fijo).unwrap_or_default();
        let email = fila.email.unwrap_or_default();
        let privi = fila.privilegio.unwrap_or_default();

        let existe_p: Option<i32> = stmt_check_pers.query_row(params![nombre_final], |row| row.get(0)).optional().unwrap_or(None);
        if let Some(pid) = existe_p {
            stmt_upd_pers.execute(params![id_cong, privi, tel, email, pid]).unwrap_or(0);
        } else {
            stmt_ins_pers.execute(params![nombre_final, privi, id_cong, tel, email]).unwrap_or(0);
        }
        contador += 1;
    }

    drop(stmt_find_cong); drop(stmt_ins_cong); drop(stmt_check_pers); drop(stmt_ins_pers); drop(stmt_upd_pers);
    tx.commit().map_err(|e| e.to_string())?;
    Ok(format!("✅ {} personas procesadas.", contador))
}

#[command]
pub fn importar_programa_jw(app: AppHandle, ruta_archivo: String) -> Result<String, String> {
    let mut rdr = preparar_lector(&ruta_archivo)?;
    let mut conn = conectar_db(&app);
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    let mut stmt_find_cong = tx.prepare("SELECT id FROM congregaciones WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?1))").map_err(|e| e.to_string())?;
    let mut stmt_ins_cong = tx.prepare("INSERT INTO congregaciones (nombre, numero_congregacion) VALUES (?1, '')").map_err(|e| e.to_string())?;
    let mut stmt_find_pers = tx.prepare("SELECT id FROM personas WHERE nombre_completo = ?1").map_err(|e| e.to_string())?;
    let mut stmt_ins_pers = tx.prepare("INSERT INTO personas (nombre_completo, genero, privilegios, id_congregacion, telefono, email) VALUES (?1, 'Hombre', 'Orador', ?2, ?3, ?4)").map_err(|e| e.to_string())?;
    let mut stmt_ins_prog = tx.prepare("INSERT INTO programa (dia, sesion, hora_inicio, tema, tipo, duracion, orador_id, es_video, estado, esta_presente) VALUES (?1, ?2, ?3, ?4, ?5, 10, ?6, ?7, 'Confirmado', 0)").map_err(|e| e.to_string())?;

    for result in rdr.deserialize() {
        let fila: FilaProgramaJW = match result { Ok(f) => f, Err(_) => continue };
        let dia_semana = match chrono::NaiveDate::parse_from_str(&fila.fecha, "%Y-%m-%d") { 
            Ok(d) => match d.weekday() { 
                chrono::Weekday::Fri => "Viernes", chrono::Weekday::Sat => "Sábado", chrono::Weekday::Sun => "Domingo", _ => "Viernes" 
            }, 
            Err(_) => "Viernes" 
        };
        let partes_hora: Vec<&str> = fila.hora.split(':').collect();
        let hora_limpia = if partes_hora.len() >= 2 { format!("{:0>2}:{:0>2}", partes_hora[0], partes_hora[1]) } else { fila.hora.clone() };
        let sesion = if hora_limpia.as_str() < "13:00" { "Mañana" } else { "Tarde" };
        let fuente = fila.fuente.clone().unwrap_or_default();
        let es_video = fuente == "Video" || fila.titulo.contains("Producción audiovisual");
        let titulo_l = fila.titulo.to_lowercase();
        let tipo = if es_video { "Video" } else if titulo_l.contains("canción") || titulo_l.contains("cántico") { "Cántico" } else if titulo_l.contains("simposio") { "Simposio" } else if titulo_l.contains("lectura") { "Lectura Bíblica" } else { "Discurso" };
        
        let mut orador_id: Option<i32> = None;
        if !es_video && fila.orador.is_some() {
            let raw = fila.orador.clone().unwrap();
            if !raw.trim().is_empty() {
                let nombre_final = if let Some((ap, nom)) = raw.split_once(',') { format!("{} {}", nom.trim(), ap.trim()) } else { raw.clone() };
                let existe: Option<i32> = stmt_find_pers.query_row(params![nombre_final], |row| row.get(0)).optional().unwrap_or(None);
                
                if let Some(id) = existe { orador_id = Some(id); } 
                else {
                    let mut id_cong = 0;
                    if let Some(cong) = &fila.congregacion {
                        if !cong.trim().is_empty() {
                            let ex_cong: Option<i32> = stmt_find_cong.query_row(params![cong.trim()], |row| row.get(0)).optional().unwrap_or(None);
                            if let Some(cid) = ex_cong { id_cong = cid; } 
                            else { stmt_ins_cong.execute(params![cong.trim()]).unwrap_or(0); id_cong = tx.last_insert_rowid() as i32; }
                        }
                    }
                    let tel = fila.movil.clone().or(fila.fijo.clone()).unwrap_or_default();
                    let email = fila.email.clone().unwrap_or_default();
                    stmt_ins_pers.execute(params![nombre_final, id_cong, tel, email]).unwrap_or(0);
                    orador_id = Some(tx.last_insert_rowid() as i32);
                }
            }
        }
        stmt_ins_prog.execute(params![dia_semana, sesion, hora_limpia, fila.titulo, tipo, orador_id, es_video]).unwrap_or(0);
    }
    
    drop(stmt_find_cong); drop(stmt_ins_cong); drop(stmt_find_pers); drop(stmt_ins_pers); drop(stmt_ins_prog);
    tx.commit().map_err(|e| e.to_string())?;
    Ok("Programa importado exitosamente".to_string())
}