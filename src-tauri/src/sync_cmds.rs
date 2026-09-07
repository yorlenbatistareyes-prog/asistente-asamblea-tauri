use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use tauri::State;

// Asegúrate de que esta ruta apunte correctamente a donde definiste DbState
use crate::database::DbState;

// ==========================================
// 1. ESTRUCTURAS DE DATOS COMPLETAS (EL CLON EXACTO)
// ==========================================

#[derive(Serialize, Deserialize, Debug)]
pub struct AsambleaSync {
    pub id: i64,
    pub tema: String,
    pub fecha: String,
    pub identificador: Option<String>,
    pub local_id: Option<i64>,
    pub ensayo_lugar: Option<String>,
    pub ensayo_fecha: Option<String>,
    pub ensayo_hora: Option<String>,
    pub recorridos_info: Option<String>,
    pub instrucciones_esp: Option<String>,
    pub ensayo_notas: Option<String>,
    pub jw_stream_studio: i64,
    pub coordinador_id: Option<i64>,
    pub coordinador_aux_id: Option<i64>,
    pub prog_super_id: Option<i64>,
    pub prog_aux_id: Option<i64>,
    pub aloj_super_id: Option<i64>,
    pub aloj_aux_id: Option<i64>,
    pub audio_video_super_id: Option<i64>,
    pub video_super_id: Option<i64>,
    pub audio_super_id: Option<i64>,
    pub plataforma_super_id: Option<i64>,
    pub bautismo_super_id: Option<i64>,
    pub bautismo_aux_id: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct LocalSync {
    pub id: i64,
    pub nombre: String,
    pub direccion: Option<String>,
    pub ciudad: Option<String>,
    pub estado: Option<String>,
    pub capacidad: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CongregacionSync {
    pub id: i64,
    pub asamblea_id: Option<i64>,
    pub nombre: String,
    pub circuito: Option<String>,
    pub numero_congregacion: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PersonaSync {
    pub id: i64,
    pub asamblea_id: Option<i64>,
    pub nombre_completo: String,
    pub sexo: Option<String>,
    pub privilegios: Option<String>,
    pub id_congregacion: Option<i64>,
    pub congregacion: Option<String>,
    pub telefono: Option<String>,
    pub email: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProgramaSync {
    pub id: i64,
    pub asamblea_id: Option<i64>,
    pub dia: String,
    pub sesion: String,
    pub hora_inicio: Option<String>,
    pub tema: String,
    pub tipo: Option<String>,
    pub duracion: Option<i64>,
    pub orador_id: Option<i64>,
    pub es_video: bool,
    pub estado: Option<String>,
    pub esta_presente: bool,
    pub numero_bosquejo: Option<String>,
    pub ensayo_terminado: bool,
    pub fuente: Option<String>,
    pub es_betelita: bool,
    pub es_interprete: bool,
    pub es_visitante: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AsignacionSync {
    pub id: i64,
    pub asamblea_id: Option<i64>,
    pub dia: String,
    pub fecha: Option<String>,
    pub tipo_asignacion: String,
    pub persona_id: i64,
    pub estado: Option<String>,
    pub esta_presente: bool,
    pub ensayo_terminado: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PlantillaCartaSync {
    pub id: String,
    pub contenido_html: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PlantillaEmailSync {
    pub id: String,
    pub asunto: Option<String>,
    pub cuerpo: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ConfiguracionSync {
    pub id: i64,
    pub nombre: Option<String>,
    pub segundo_nombre: Option<String>,
    pub apellido: Option<String>,
    pub sufijo: Option<String>,
    pub email: Option<String>,
    pub email_jwpub: Option<String>,
    pub movil: Option<String>,
    pub identificador: Option<String>,
    pub fecha_creacion: Option<String>,
    pub tema: Option<String>,
    pub idioma: Option<String>,
    pub last_synced_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BackupData {
    pub asambleas: Vec<AsambleaSync>,
    pub locales: Vec<LocalSync>,
    pub congregaciones: Vec<CongregacionSync>,
    pub personas: Vec<PersonaSync>,
    pub programa: Vec<ProgramaSync>,
    pub asignaciones: Vec<AsignacionSync>,
    pub plantillas_cartas: Vec<PlantillaCartaSync>,
    pub plantillas_email: Vec<PlantillaEmailSync>,
    pub configuracion: Vec<ConfiguracionSync>, // Aunque sea 1 fila, lo mandamos como array por consistencia
}

// ==========================================
// 2. COMANDOS DE CONTROL DE FECHA (OPTIMISTA)
// ==========================================

#[tauri::command]
pub fn obtener_last_sync_local(db_state: State<DbState>) -> Result<Option<String>, String> {
    let conn = db_state.conn.lock().unwrap();
    let _ = conn.execute(
        "ALTER TABLE configuracion ADD COLUMN last_synced_at TEXT",
        [],
    );
    let mut stmt = conn
        .prepare("SELECT last_synced_at FROM configuracion WHERE id = 1")
        .map_err(|e| e.to_string())?;
    let fecha: Option<String> = stmt.query_row([], |row| row.get(0)).unwrap_or(None);
    Ok(fecha)
}

#[tauri::command]
pub fn actualizar_last_sync_local(fecha: String, db_state: State<DbState>) -> Result<(), String> {
    let conn = db_state.conn.lock().unwrap();
    let _ = conn.execute(
        "ALTER TABLE configuracion ADD COLUMN last_synced_at TEXT",
        [],
    );
    conn.execute(
        "UPDATE configuracion SET last_synced_at = ?1 WHERE id = 1",
        params![fecha],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ==========================================
// 3. EXPORTAR A LA NUBE (RUST -> JS)
// ==========================================

#[tauri::command]
pub fn exportar_db_json(db_state: State<DbState>) -> Result<String, String> {
    let conn = db_state.conn.lock().unwrap();

    let backup = BackupData {
        asambleas: extraer_asambleas(&conn)?,
        locales: extraer_locales(&conn)?,
        congregaciones: extraer_congregaciones(&conn)?,
        personas: extraer_personas(&conn)?,
        programa: extraer_programa(&conn)?,
        asignaciones: extraer_asignaciones(&conn)?,
        plantillas_cartas: extraer_plantillas_cartas(&conn)?,
        plantillas_email: extraer_plantillas_email(&conn)?,
        configuracion: extraer_configuracion(&conn)?,
    };

    serde_json::to_string(&backup).map_err(|e| format!("Error serializando: {}", e))
}

// ==========================================
// 4. IMPORTAR DE LA NUBE (JS -> RUST)
// ==========================================

#[tauri::command]
pub fn importar_db_json(json_data: String, db_state: State<DbState>) -> Result<(), String> {
    let mut conn = db_state.conn.lock().unwrap();
    let backup: BackupData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Error deserializando JSON: {}", e))?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("PRAGMA foreign_keys = OFF;", [])
        .map_err(|e| e.to_string())?;

    // Vaciamos TODO
    tx.execute("DELETE FROM asignaciones_especiales", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM programa", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM personas", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM congregaciones", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM locales", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM asambleas", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM plantillas_cartas", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM plantillas_email", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM configuracion", [])
        .map_err(|e| e.to_string())?;

    // Insertamos la configuración
    for c in backup.configuracion {
        tx.execute("INSERT INTO configuracion (id, nombre, segundo_nombre, apellido, sufijo, email, email_jwpub, movil, identificador, fecha_creacion, tema, idioma, last_synced_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![c.id, c.nombre, c.segundo_nombre, c.apellido, c.sufijo, c.email, c.email_jwpub, c.movil, c.identificador, c.fecha_creacion, c.tema, c.idioma, c.last_synced_at]).map_err(|e| e.to_string())?;
    }

    // Insertamos plantillas
    for p in backup.plantillas_cartas {
        tx.execute(
            "INSERT INTO plantillas_cartas (id, contenido_html) VALUES (?1, ?2)",
            params![p.id, p.contenido_html],
        )
        .map_err(|e| e.to_string())?;
    }
    for p in backup.plantillas_email {
        tx.execute(
            "INSERT INTO plantillas_email (id, asunto, cuerpo) VALUES (?1, ?2, ?3)",
            params![p.id, p.asunto, p.cuerpo],
        )
        .map_err(|e| e.to_string())?;
    }

    // Insertamos el resto de las tablas
    for l in backup.locales {
        tx.execute("INSERT INTO locales (id, nombre, direccion, ciudad, estado, capacidad) VALUES (?1, ?2, ?3, ?4, ?5, ?6)", params![l.id, l.nombre, l.direccion, l.ciudad, l.estado, l.capacidad]).map_err(|e| e.to_string())?;
    }
    for a in backup.asambleas {
        tx.execute("INSERT INTO asambleas (id, tema, fecha, identificador, local_id, ensayo_lugar, ensayo_fecha, ensayo_hora, recorridos_info, instrucciones_esp, ensayo_notas, jw_stream_studio, coordinador_id, coordinador_aux_id, prog_super_id, prog_aux_id, aloj_super_id, aloj_aux_id, audio_video_super_id, video_super_id, audio_super_id, plataforma_super_id, bautismo_super_id, bautismo_aux_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
            params![a.id, a.tema, a.fecha, a.identificador, a.local_id, a.ensayo_lugar, a.ensayo_fecha, a.ensayo_hora, a.recorridos_info, a.instrucciones_esp, a.ensayo_notas, a.jw_stream_studio, a.coordinador_id, a.coordinador_aux_id, a.prog_super_id, a.prog_aux_id, a.aloj_super_id, a.aloj_aux_id, a.audio_video_super_id, a.video_super_id, a.audio_super_id, a.plataforma_super_id, a.bautismo_super_id, a.bautismo_aux_id]).map_err(|e| e.to_string())?;
    }
    for c in backup.congregaciones {
        tx.execute("INSERT INTO congregaciones (id, asamblea_id, nombre, circuito, numero_congregacion) VALUES (?1, ?2, ?3, ?4, ?5)", params![c.id, c.asamblea_id, c.nombre, c.circuito, c.numero_congregacion]).map_err(|e| e.to_string())?;
    }
    for p in backup.personas {
        tx.execute("INSERT INTO personas (id, asamblea_id, nombre_completo, sexo, privilegios, id_congregacion, congregacion, telefono, email) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)", params![p.id, p.asamblea_id, p.nombre_completo, p.sexo, p.privilegios, p.id_congregacion, p.congregacion, p.telefono, p.email]).map_err(|e| e.to_string())?;
    }
    for pg in backup.programa {
        tx.execute("INSERT INTO programa (id, asamblea_id, dia, sesion, hora_inicio, tema, tipo, duracion, orador_id, es_video, estado, esta_presente, numero_bosquejo, ensayo_terminado, fuente, es_betelita, es_interprete, es_visitante) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            params![pg.id, pg.asamblea_id, pg.dia, pg.sesion, pg.hora_inicio, pg.tema, pg.tipo, pg.duracion, pg.orador_id, pg.es_video, pg.estado, pg.esta_presente, pg.numero_bosquejo, pg.ensayo_terminado, pg.fuente, pg.es_betelita, pg.es_interprete, pg.es_visitante]).map_err(|e| e.to_string())?;
    }
    for asig in backup.asignaciones {
        tx.execute("INSERT INTO asignaciones_especiales (id, asamblea_id, dia, fecha, tipo_asignacion, persona_id, estado, esta_presente, ensayo_terminado) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)", params![asig.id, asig.asamblea_id, asig.dia, asig.fecha, asig.tipo_asignacion, asig.persona_id, asig.estado, asig.esta_presente, asig.ensayo_terminado]).map_err(|e| e.to_string())?;
    }

    tx.execute("PRAGMA foreign_keys = ON;", [])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

// ==========================================
// 5. HELPERS PARA EXTRAER DATOS
// ==========================================
fn extraer_configuracion(conn: &Connection) -> Result<Vec<ConfiguracionSync>, String> {
    let _ = conn.execute(
        "ALTER TABLE configuracion ADD COLUMN last_synced_at TEXT",
        [],
    ); // Seguro
    let mut stmt = conn.prepare("SELECT id, nombre, segundo_nombre, apellido, sufijo, email, email_jwpub, movil, identificador, fecha_creacion, tema, idioma, last_synced_at FROM configuracion").unwrap();
    let map_iter = stmt
        .query_map([], |row| {
            Ok(ConfiguracionSync {
                id: row.get(0)?,
                nombre: row.get(1)?,
                segundo_nombre: row.get(2)?,
                apellido: row.get(3)?,
                sufijo: row.get(4)?,
                email: row.get(5)?,
                email_jwpub: row.get(6)?,
                movil: row.get(7)?,
                identificador: row.get(8)?,
                fecha_creacion: row.get(9)?,
                tema: row.get(10)?,
                idioma: row.get(11)?,
                last_synced_at: row.get(12)?,
            })
        })
        .unwrap();
    Ok(map_iter.filter_map(Result::ok).collect())
}

fn extraer_plantillas_cartas(conn: &Connection) -> Result<Vec<PlantillaCartaSync>, String> {
    let mut stmt = conn
        .prepare("SELECT id, contenido_html FROM plantillas_cartas")
        .unwrap();
    let map_iter = stmt
        .query_map([], |row| {
            Ok(PlantillaCartaSync {
                id: row.get(0)?,
                contenido_html: row.get(1)?,
            })
        })
        .unwrap();
    Ok(map_iter.filter_map(Result::ok).collect())
}

fn extraer_plantillas_email(conn: &Connection) -> Result<Vec<PlantillaEmailSync>, String> {
    let mut stmt = conn
        .prepare("SELECT id, asunto, cuerpo FROM plantillas_email")
        .unwrap();
    let map_iter = stmt
        .query_map([], |row| {
            Ok(PlantillaEmailSync {
                id: row.get(0)?,
                asunto: row.get(1)?,
                cuerpo: row.get(2)?,
            })
        })
        .unwrap();
    Ok(map_iter.filter_map(Result::ok).collect())
}

fn extraer_asambleas(conn: &Connection) -> Result<Vec<AsambleaSync>, String> {
    let mut stmt = conn.prepare("SELECT * FROM asambleas").unwrap();
    let map_iter = stmt
        .query_map([], |row| {
            Ok(AsambleaSync {
                id: row.get(0)?,
                tema: row.get(1)?,
                fecha: row.get(2)?,
                identificador: row.get(3)?,
                local_id: row.get(4)?,
                ensayo_lugar: row.get(5)?,
                ensayo_fecha: row.get(6)?,
                ensayo_hora: row.get(7)?,
                recorridos_info: row.get(8)?,
                instrucciones_esp: row.get(9)?,
                ensayo_notas: row.get(10)?,
                jw_stream_studio: row.get(11)?,
                coordinador_id: row.get(12)?,
                coordinador_aux_id: row.get(13)?,
                prog_super_id: row.get(14)?,
                prog_aux_id: row.get(15)?,
                aloj_super_id: row.get(16)?,
                aloj_aux_id: row.get(17)?,
                audio_video_super_id: row.get(18)?,
                video_super_id: row.get(19)?,
                audio_super_id: row.get(20)?,
                plataforma_super_id: row.get(21)?,
                bautismo_super_id: row.get(22)?,
                bautismo_aux_id: row.get(23)?,
            })
        })
        .unwrap();
    Ok(map_iter.filter_map(Result::ok).collect())
}

fn extraer_locales(conn: &Connection) -> Result<Vec<LocalSync>, String> {
    let mut stmt = conn.prepare("SELECT * FROM locales").unwrap();
    let map_iter = stmt
        .query_map([], |row| {
            Ok(LocalSync {
                id: row.get(0)?,
                nombre: row.get(1)?,
                direccion: row.get(2)?,
                ciudad: row.get(3)?,
                estado: row.get(4)?,
                capacidad: row.get(5)?,
            })
        })
        .unwrap();
    Ok(map_iter.filter_map(Result::ok).collect())
}

fn extraer_congregaciones(conn: &Connection) -> Result<Vec<CongregacionSync>, String> {
    let mut stmt = conn.prepare("SELECT * FROM congregaciones").unwrap();
    let map_iter = stmt
        .query_map([], |row| {
            Ok(CongregacionSync {
                id: row.get(0)?,
                asamblea_id: row.get(1)?,
                nombre: row.get(2)?,
                circuito: row.get(3)?,
                numero_congregacion: row.get(4)?,
            })
        })
        .unwrap();
    Ok(map_iter.filter_map(Result::ok).collect())
}

fn extraer_personas(conn: &Connection) -> Result<Vec<PersonaSync>, String> {
    let mut stmt = conn.prepare("SELECT * FROM personas").unwrap();
    let map_iter = stmt
        .query_map([], |row| {
            Ok(PersonaSync {
                id: row.get(0)?,
                asamblea_id: row.get(1)?,
                nombre_completo: row.get(2)?,
                sexo: row.get(3)?,
                privilegios: row.get(4)?,
                id_congregacion: row.get(5)?,
                congregacion: row.get(6)?,
                telefono: row.get(7)?,
                email: row.get(8)?,
            })
        })
        .unwrap();
    Ok(map_iter.filter_map(Result::ok).collect())
}

fn extraer_programa(conn: &Connection) -> Result<Vec<ProgramaSync>, String> {
    let mut stmt = conn.prepare("SELECT * FROM programa").unwrap();
    let map_iter = stmt
        .query_map([], |row| {
            Ok(ProgramaSync {
                id: row.get(0)?,
                asamblea_id: row.get(1)?,
                dia: row.get(2)?,
                sesion: row.get(3)?,
                hora_inicio: row.get(4)?,
                tema: row.get(5)?,
                tipo: row.get(6)?,
                duracion: row.get(7)?,
                orador_id: row.get(8)?,
                es_video: row.get(9)?,
                estado: row.get(10)?,
                esta_presente: row.get(11)?,
                numero_bosquejo: row.get(12)?,
                ensayo_terminado: row.get(13)?,
                fuente: row.get(14)?,
                es_betelita: row.get(15)?,
                es_interprete: row.get(16)?,
                es_visitante: row.get(17)?,
            })
        })
        .unwrap();
    Ok(map_iter.filter_map(Result::ok).collect())
}

fn extraer_asignaciones(conn: &Connection) -> Result<Vec<AsignacionSync>, String> {
    let mut stmt = conn
        .prepare("SELECT * FROM asignaciones_especiales")
        .unwrap();
    let map_iter = stmt
        .query_map([], |row| {
            Ok(AsignacionSync {
                id: row.get(0)?,
                asamblea_id: row.get(1)?,
                dia: row.get(2)?,
                fecha: row.get(3)?,
                tipo_asignacion: row.get(4)?,
                persona_id: row.get(5)?,
                estado: row.get(6)?,
                esta_presente: row.get(7)?,
                ensayo_terminado: row.get(8)?,
            })
        })
        .unwrap();
    Ok(map_iter.filter_map(Result::ok).collect())
}
