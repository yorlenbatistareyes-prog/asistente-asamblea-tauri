use rusqlite::{Connection, params};
use tauri::{AppHandle, Manager};
use std::fs;
use std::path::PathBuf;

const DB_NAME: &str = "asamblea_db_v5.sqlite"; 

pub fn obtener_ruta_db(app: &AppHandle) -> PathBuf {
    let app_dir = app.path().app_data_dir().expect("Error al obtener directorio de datos");
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).expect("Error creando directorio de datos");
    }
    app_dir.join(DB_NAME)
}

pub fn initialize_database(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = obtener_ruta_db(app);
    let conn = Connection::open(db_path)?;

    // Activar claves foráneas
    conn.execute("PRAGMA foreign_keys = ON;", [])?;

    // 1. LOCALES
    conn.execute("CREATE TABLE IF NOT EXISTS locales (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, direccion TEXT, capacidad INTEGER)", [])?;

    // 2. CONGREGACIONES
    conn.execute("CREATE TABLE IF NOT EXISTS congregaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE, circuito TEXT, numero_congregacion TEXT)", [])?;

    // 3. PERSONAS
    conn.execute("CREATE TABLE IF NOT EXISTS personas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre_completo TEXT NOT NULL, genero TEXT DEFAULT 'Hombre', privilegios TEXT, id_congregacion INTEGER, telefono TEXT, email TEXT, FOREIGN KEY(id_congregacion) REFERENCES congregaciones(id))", [])?;

    // 4. PROGRAMA
    conn.execute("CREATE TABLE IF NOT EXISTS programa (id INTEGER PRIMARY KEY AUTOINCREMENT, dia TEXT NOT NULL, sesion TEXT NOT NULL, hora_inicio TEXT, tema TEXT NOT NULL, tipo TEXT DEFAULT 'Discurso', duracion INTEGER, orador_id INTEGER, es_video BOOLEAN DEFAULT 0, estado TEXT DEFAULT 'Pendiente', esta_presente BOOLEAN DEFAULT 0, FOREIGN KEY(orador_id) REFERENCES personas(id))", [])?;

    // 5. ASAMBLEAS
    conn.execute("CREATE TABLE IF NOT EXISTS asambleas (id INTEGER PRIMARY KEY AUTOINCREMENT, tema TEXT NOT NULL, fecha TEXT NOT NULL, local_id INTEGER, presidente_id INTEGER, ensayo_lugar TEXT, ensayo_fecha TEXT, ensayo_hora TEXT, recorridos_info TEXT, instrucciones_esp TEXT, ensayo_notas TEXT, jw_stream_studio INTEGER DEFAULT 0, FOREIGN KEY(local_id) REFERENCES locales(id), FOREIGN KEY(presidente_id) REFERENCES personas(id))", [])?;

    // 6. ASIGNACIONES ESPECIALES
    conn.execute("CREATE TABLE IF NOT EXISTS asignaciones_especiales (id INTEGER PRIMARY KEY AUTOINCREMENT, dia TEXT NOT NULL, tipo_asignacion TEXT NOT NULL, persona_id INTEGER NOT NULL, FOREIGN KEY(persona_id) REFERENCES personas(id))", [])?;

    // 7. PLANTILLAS DE CORRESPONDENCIA
    conn.execute("CREATE TABLE IF NOT EXISTS plantillas_cartas (id TEXT PRIMARY KEY, contenido_html TEXT NOT NULL)", [])?;

    let plantillas = vec!["oradores", "presidentes", "oraciones"];
    for p in plantillas {
        conn.execute("INSERT OR IGNORE INTO plantillas_cartas (id, contenido_html) VALUES (?1, ?2)", params![p, "<p>Estimado hermano...</p>"])?;
    }

    Ok(())
}