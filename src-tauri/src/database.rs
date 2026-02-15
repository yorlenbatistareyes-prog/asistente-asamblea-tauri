use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use std::sync::Mutex;

const DB_NAME: &str = "asamblea_db_v7.sqlite";

pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub fn obtener_ruta_db(app: &AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Error al obtener directorio de datos");

    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).expect("Error creando directorio de datos");
    }
    app_dir.join(DB_NAME)
}

pub fn initialize_database(app: &AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let db_path = obtener_ruta_db(app);
    let conn = Connection::open(db_path)?;

    conn.execute("PRAGMA foreign_keys = ON;", [])?;

    // --- 1. ASAMBLEAS ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS asambleas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        tema TEXT NOT NULL, 
        fecha TEXT NOT NULL,
        identificador TEXT, 
        local_id INTEGER, 
        presidente_id INTEGER, 
        ensayo_lugar TEXT, 
        ensayo_fecha TEXT, 
        ensayo_hora TEXT, 
        recorridos_info TEXT, 
        instrucciones_esp TEXT, 
        ensayo_notas TEXT, 
        jw_stream_studio INTEGER DEFAULT 0
    )",
        [],
    )?;

    let _ = conn.execute("ALTER TABLE asambleas ADD COLUMN identificador TEXT", []);

    // --- 2. LOCALES ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS locales (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        nombre TEXT NOT NULL, 
        direccion TEXT, 
        ciudad TEXT,
        estado TEXT,
        capacidad INTEGER
    )",
        [],
    )?;

    // --- 3. CONGREGACIONES ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS congregaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        asamblea_id INTEGER,
        nombre TEXT NOT NULL, 
        circuito TEXT, 
        numero_congregacion TEXT,
        FOREIGN KEY(asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE
    )",
        [],
    )?;

    // --- 4. PERSONAS (Aseguramos columna 'sexo') ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS personas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        asamblea_id INTEGER,
        nombre_completo TEXT NOT NULL, 
        sexo TEXT DEFAULT 'M', 
        privilegios TEXT, 
        id_congregacion INTEGER, 
        congregacion TEXT, 
        telefono TEXT, 
        email TEXT, 
        FOREIGN KEY(id_congregacion) REFERENCES congregaciones(id) ON DELETE SET NULL,
        FOREIGN KEY(asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE
    )",
        [],
    )?;

    // --- 5. PROGRAMA (Unificado a 'orador_id') ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS programa (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        asamblea_id INTEGER, 
        dia TEXT NOT NULL, 
        sesion TEXT NOT NULL, 
        hora_inicio TEXT, 
        tema TEXT NOT NULL, 
        tipo TEXT DEFAULT 'Discurso', 
        duracion INTEGER, 
        orador_id INTEGER, -- <--- CAMBIADO: Antes era persona_id
        es_video BOOLEAN DEFAULT 0, 
        estado TEXT DEFAULT 'Pendiente', 
        esta_presente BOOLEAN DEFAULT 0, 
        numero_bosquejo TEXT, 
        FOREIGN KEY(orador_id) REFERENCES personas(id),
        FOREIGN KEY(asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE
    )",
        [],
    )?;

    // --- 6. ASIGNACIONES ESPECIALES ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS asignaciones_especiales (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        asamblea_id INTEGER,
        dia TEXT NOT NULL, 
        fecha TEXT,
        tipo_asignacion TEXT NOT NULL, 
        persona_id INTEGER NOT NULL, 
        FOREIGN KEY(persona_id) REFERENCES personas(id),
        FOREIGN KEY(asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE
    )",
        [],
    )?;

    // --- 7. PLANTILLAS ---
    conn.execute("CREATE TABLE IF NOT EXISTS plantillas_cartas (id TEXT PRIMARY KEY, contenido_html TEXT NOT NULL)", [])?;
    
    // --- 8. PLANTILLAS EMAIL ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS plantillas_email (
            id TEXT PRIMARY KEY, 
            asunto TEXT DEFAULT '', 
            cuerpo TEXT DEFAULT ''
        )",
        [],
    )?;

    // --- MIGRACIONES PREVENTIVAS (Para bases de datos existentes) ---
    let _ = conn.execute("ALTER TABLE personas ADD COLUMN sexo TEXT DEFAULT 'M'", []);
    let _ = conn.execute("ALTER TABLE personas ADD COLUMN congregacion TEXT", []);
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN numero_bosquejo TEXT", []);
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN orador_id INTEGER", []); // Por si acaso existía como persona_id

    // --- 9. CONFIGURACIÓN GENERAL ---
    // --- 9. CONFIGURACIÓN GENERAL ---
conn.execute(
    "CREATE TABLE IF NOT EXISTS configuracion (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        nombre TEXT DEFAULT 'Yorlen',
        segundo_nombre TEXT,
        apellido TEXT,
        sufijo TEXT,
        email TEXT,
        email_jwpub TEXT,
        movil TEXT,
        identificador TEXT,
        fecha_creacion TEXT,
        tema TEXT DEFAULT 'claro',
        idioma TEXT DEFAULT 'es'
    )",
    [],
)?;

// Migraciones para configuracion (agregar columnas faltantes)
let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN segundo_nombre TEXT", []);
let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN apellido TEXT", []);
let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN sufijo TEXT", []);
let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN email TEXT", []);
let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN email_jwpub TEXT", []);
let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN movil TEXT", []);
let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN identificador TEXT", []);
let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN fecha_creacion TEXT", []);

    // Insertamos el registro inicial si la tabla está vacía
    conn.execute(
        "INSERT OR IGNORE INTO configuracion (id, nombre, tema, idioma) 
         VALUES (1, 'Yorlen', 'claro', 'es')",
        [],
    )?;
    
   Ok(conn)
}
