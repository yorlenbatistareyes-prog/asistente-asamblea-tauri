use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub const DB_NAME: &str = "asamblea_db_v7.sqlite";

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

    // --- CORRECCIÓN: AGREGAR COLUMNAS FALTANTES DEL COMITÉ ---
    // Usamos 'let _ =' para ignorar el error si la columna ya existe
    let _ = conn.execute(
        "ALTER TABLE asambleas ADD COLUMN coordinador_id INTEGER",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE asambleas ADD COLUMN coordinador_aux_id INTEGER",
        [],
    );
    let _ = conn.execute("ALTER TABLE asambleas ADD COLUMN prog_super_id INTEGER", []);
    let _ = conn.execute("ALTER TABLE asambleas ADD COLUMN prog_aux_id INTEGER", []);
    let _ = conn.execute("ALTER TABLE asambleas ADD COLUMN aloj_super_id INTEGER", []);
    let _ = conn.execute("ALTER TABLE asambleas ADD COLUMN aloj_aux_id INTEGER", []);
    let _ = conn.execute(
        "ALTER TABLE asambleas ADD COLUMN audio_video_super_id INTEGER",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE asambleas ADD COLUMN video_super_id INTEGER",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE asambleas ADD COLUMN audio_super_id INTEGER",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE asambleas ADD COLUMN plataforma_super_id INTEGER",
        [],
    );
    // Agregamos también Bautismo que implementaste
    let _ = conn.execute(
        "ALTER TABLE asambleas ADD COLUMN bautismo_super_id INTEGER",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE asambleas ADD COLUMN bautismo_aux_id INTEGER",
        [],
    );

    // Asegurar que la tabla personas tenga los campos necesarios para contacto
    let _ = conn.execute("ALTER TABLE personas ADD COLUMN telefono TEXT", []);
    let _ = conn.execute("ALTER TABLE personas ADD COLUMN email TEXT", []);
    // Añadimos específicamente el email de JWPub por si quieres separarlo del personal
    let _ = conn.execute("ALTER TABLE personas ADD COLUMN email_jwpub TEXT", []);

    let _ = conn.execute("ALTER TABLE asambleas ADD COLUMN notas_programa TEXT", []);

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
        circuito TEXT,
        telefono TEXT,
        telefono_fijo TEXT, 
        email TEXT,
        email_jwpub TEXT, 
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
        orador_id INTEGER, 
        es_video BOOLEAN DEFAULT 0, 
        estado TEXT DEFAULT 'Pendiente', 
        esta_presente BOOLEAN DEFAULT 0, 
        numero_bosquejo TEXT, 
        ensayo_terminado BOOLEAN DEFAULT 0,
        fuente TEXT DEFAULT 'en_persona',     -- ✅ NUEVO FILTRO
        es_betelita BOOLEAN DEFAULT 0,        -- ✅ NUEVO FILTRO
        es_interprete BOOLEAN DEFAULT 0,      -- ✅ NUEVO FILTRO
        es_visitante BOOLEAN DEFAULT 0,       -- ✅ NUEVO FILTRO
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

    // Agregar columnas de estado a asignaciones_especiales
    let _ = conn.execute("ALTER TABLE asignaciones_especiales ADD COLUMN estado TEXT DEFAULT 'Pendiente'", []);
    let _ = conn.execute("ALTER TABLE asignaciones_especiales ADD COLUMN esta_presente BOOLEAN DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE asignaciones_especiales ADD COLUMN ensayo_terminado BOOLEAN DEFAULT 0", []);

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
    let _ = conn.execute("ALTER TABLE personas ADD COLUMN circuito TEXT", []);
    let _ = conn.execute("ALTER TABLE personas ADD COLUMN telefono_fijo TEXT", []);
    
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN numero_bosquejo TEXT", []);
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN orador_id INTEGER", []); // Por si acaso existía como persona_id
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN ensayo_terminado BOOLEAN DEFAULT 0", []);
    
    // ✅ NUEVAS MIGRACIONES PARA LOS FILTROS
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN fuente TEXT DEFAULT 'en_persona'", []);
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN es_betelita BOOLEAN DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN es_interprete BOOLEAN DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN es_visitante BOOLEAN DEFAULT 0", []);
    
    // MIGRACIONES PARA ENSAYOS POR PARTE
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN requiere_ensayo BOOLEAN DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN fecha_ensayo TEXT", []);
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN hora_ensayo TEXT", []);
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN lugar_ensayo TEXT", []);
    let _ = conn.execute("ALTER TABLE programa ADD COLUMN notas_ensayo TEXT", []);
    
    // --- 9. CONFIGURACIÓN GENERAL ---

    conn.execute(
        "CREATE TABLE IF NOT EXISTS configuracion (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        nombre TEXT DEFAULT 'Usuario',
        segundo_nombre TEXT,
        apellido TEXT,
        sufijo TEXT,
        email TEXT,
        email_jwpub TEXT,
        movil TEXT,
        identificador TEXT,
        fecha_creacion TEXT,
        tema TEXT DEFAULT 'claro',
        idioma TEXT DEFAULT 'es',
        last_synced_at TEXT
    )",
        [],
    )?;

    // Migraciones para configuracion (agregar columnas faltantes)
    let _ = conn.execute(
        "ALTER TABLE configuracion ADD COLUMN segundo_nombre TEXT",
        []);

    // 👈 NUEVA MIGRACIÓN PREVENTIVA
    let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN last_synced_at TEXT", []);

    let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN apellido TEXT", []);
    let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN sufijo TEXT", []);
    let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN email TEXT", []);
    let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN email_jwpub TEXT", []);
    let _ = conn.execute("ALTER TABLE configuracion ADD COLUMN movil TEXT", []);
    let _ = conn.execute(
        "ALTER TABLE configuracion ADD COLUMN identificador TEXT",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE configuracion ADD COLUMN fecha_creacion TEXT",
        [],
    );

    // Insertamos el registro inicial si la tabla está vacía
    conn.execute(
        "INSERT OR IGNORE INTO configuracion (id, nombre, tema, idioma) 
         VALUES (1, 'Usuario', 'claro', 'es')",
        [],
    )?;

    // --- 10. RECORDATORIOS DE ORADORES ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS recordatorios_oradores (
            asamblea_id INTEGER,
            persona_id INTEGER,
            texto TEXT,
            fecha_recordatorio TEXT,
            PRIMARY KEY(asamblea_id, persona_id),
            FOREIGN KEY(asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE,
            FOREIGN KEY(persona_id) REFERENCES personas(id) ON DELETE CASCADE
        )",
        [],
    )?;

    Ok(conn)
}
