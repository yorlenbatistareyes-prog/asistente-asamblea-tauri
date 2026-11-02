use crate::database::DbState;
use crate::sync_cmds;
use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager, State};

const FORMAT_VERSION: u32 = 1;
const MAX_FILE_BYTES: usize = 64 * 1024 * 1024;
const MAX_DATABASE_JSON_BYTES: usize = 48 * 1024 * 1024;
const PAIRING_PREFIX: &str = "RASM1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SyncFileInfo {
    pub format_version: u32,
    pub file_id: String,
    pub version: u64,
    pub digest: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SyncCheckpoint {
    pub version: u64,
    pub digest: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SyncEnvelope {
    format_version: u32,
    file_id: String,
    version: u64,
    nonce: String,
    ciphertext: String,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SyncSnapshot {
    format_version: u32,
    database_json: String,
}

#[derive(Debug, Serialize)]
pub struct NewSyncIdentity {
    pub file_id: String,
    pub pairing_code: String,
}

fn valid_file_id(file_id: &str) -> bool {
    file_id.len() == 32
        && file_id
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    if hex.len() % 2 != 0 {
        return Err("La identidad del archivo no es válida.".into());
    }
    let mut bytes = Vec::with_capacity(hex.len() / 2);
    for index in (0..hex.len()).step_by(2) {
        let chunk = &hex[index..index + 2];
        let value = u8::from_str_radix(chunk, 16)
            .map_err(|_| "La identidad del archivo no es válida.".to_string())?;
        bytes.push(value);
    }
    Ok(bytes)
}

fn compact_file_id(file_id: &str) -> Result<String, String> {
    let bytes = hex_to_bytes(file_id)?;
    Ok(general_purpose::URL_SAFE_NO_PAD.encode(bytes))
}

fn expand_compact_file_id(value: &str) -> Result<String, String> {
    let bytes = general_purpose::URL_SAFE_NO_PAD
        .decode(value)
        .map_err(|_| "La identidad del código de vinculación no es válida.".to_string())?;
    if bytes.len() != 16 {
        return Err("La identidad del código de vinculación no es válida.".into());
    }
    Ok(bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

fn parse_pairing_code(code: &str) -> Result<(String, [u8; 32]), String> {
    if code.len() > 128 {
        return Err("El código de vinculación no es válido.".into());
    }
    let mut parts = code.split(':');
    let prefix = parts.next();
    let file_id_or_alias = parts.next();
    let key = parts.next();
    if prefix != Some(PAIRING_PREFIX) || parts.next().is_some() {
        return Err("El código de vinculación no tiene un formato reconocido.".into());
    }

    let file_id = file_id_or_alias.unwrap_or_default();
    let file_id = if valid_file_id(file_id) {
        file_id.to_owned()
    } else {
        expand_compact_file_id(file_id)?
    };
    if !valid_file_id(&file_id) {
        return Err("La identidad del código de vinculación no es válida.".into());
    }

    let decoded = general_purpose::URL_SAFE_NO_PAD
        .decode(key.unwrap_or_default())
        .map_err(|_| "El código de vinculación no es válido.".to_string())?;
    let key: [u8; 32] = decoded.try_into().map_err(|_| {
        "La clave del código de vinculación no tiene el tamaño esperado.".to_string()
    })?;
    Ok((file_id, key))
}

fn make_pairing_code(file_id: &str, key: &[u8; 32]) -> String {
    let compact_file_id = compact_file_id(file_id).unwrap_or_else(|_| file_id.to_owned());
    format!(
        "{PAIRING_PREFIX}:{compact_file_id}:{}",
        general_purpose::URL_SAFE_NO_PAD.encode(key)
    )
}

fn associated_data(file_id: &str, version: u64) -> Vec<u8> {
    format!("RAssembly sync\0{FORMAT_VERSION}\0{file_id}\0{version}").into_bytes()
}

fn inspect_envelope(text: &str) -> Result<SyncEnvelope, String> {
    if text.is_empty() {
        return Err("El archivo de sincronización está vacío.".into());
    }
    if text.len() > MAX_FILE_BYTES {
        return Err("El archivo de sincronización supera el límite de 64 MiB.".into());
    }
    let envelope: SyncEnvelope = serde_json::from_str(text)
        .map_err(|_| "El archivo no tiene un formato de sincronización válido.".to_string())?;
    if envelope.format_version != FORMAT_VERSION {
        return Err(format!(
            "La versión de formato {} no es compatible.",
            envelope.format_version
        ));
    }
    if !valid_file_id(&envelope.file_id) {
        return Err("La identidad del archivo de sincronización no es válida.".into());
    }
    if envelope.version == 0 || envelope.version > i64::MAX as u64 {
        return Err("La versión del archivo de sincronización no es válida.".into());
    }
    let nonce = general_purpose::STANDARD
        .decode(&envelope.nonce)
        .map_err(|_| "El archivo de sincronización está corrupto (nonce inválido).".to_string())?;
    if nonce.len() != 12 {
        return Err("El archivo de sincronización está corrupto (nonce inválido).".into());
    }
    let ciphertext = general_purpose::STANDARD
        .decode(&envelope.ciphertext)
        .map_err(|_| "El archivo de sincronización está corrupto (datos inválidos).".to_string())?;
    if ciphertext.len() < 16 || ciphertext.len() > MAX_FILE_BYTES {
        return Err(
            "El archivo de sincronización está corrupto o supera el tamaño permitido.".into(),
        );
    }
    Ok(envelope)
}

fn envelope_digest(text: &str) -> String {
    Sha256::digest(text.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn canonical_database_json(database_json: &str) -> Result<serde_json::Value, String> {
    let mut value: serde_json::Value = serde_json::from_str(database_json)
        .map_err(|_| "La instantánea de la base de datos no es válida.".to_string())?;
    let tables = value
        .as_object_mut()
        .ok_or_else(|| "La instantánea de la base de datos no es válida.".to_string())?;

    for rows in tables.values_mut() {
        if let Some(rows) = rows.as_array_mut() {
            rows.sort_by_key(|row| {
                row.get("id")
                    .map(|value| value.to_string())
                    .unwrap_or_default()
            });
        }
    }

    Ok(value)
}

fn database_snapshots_equal(local: &str, shared: &str) -> Result<bool, String> {
    Ok(canonical_database_json(local)? == canonical_database_json(shared)?)
}

fn decrypt_snapshot(text: &str, pairing_code: &str) -> Result<(SyncFileInfo, String), String> {
    let envelope = inspect_envelope(text)?;
    let (file_id, key_bytes) = parse_pairing_code(pairing_code)?;
    if file_id != envelope.file_id {
        return Err(
            "Este archivo pertenece a otra identidad. Vincúlalo con su código de seguridad.".into(),
        );
    }

    let nonce_bytes = general_purpose::STANDARD
        .decode(&envelope.nonce)
        .map_err(|_| "El archivo de sincronización está corrupto.".to_string())?;
    let ciphertext = general_purpose::STANDARD
        .decode(&envelope.ciphertext)
        .map_err(|_| "El archivo de sincronización está corrupto.".to_string())?;
    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|_| "La clave del archivo de sincronización no es válida.".to_string())?;
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(&nonce_bytes),
            Payload {
                msg: &ciphertext,
                aad: &associated_data(&envelope.file_id, envelope.version),
            },
        )
        .map_err(|_| "El código es incorrecto o el archivo fue modificado.".to_string())?;
    if plaintext.len() > MAX_DATABASE_JSON_BYTES + 1024 {
        return Err("La instantánea descifrada supera el tamaño permitido.".into());
    }
    let snapshot: SyncSnapshot = serde_json::from_slice(&plaintext)
        .map_err(|_| "La instantánea cifrada está corrupta o no es compatible.".to_string())?;
    if snapshot.format_version != FORMAT_VERSION
        || snapshot.database_json.len() > MAX_DATABASE_JSON_BYTES
    {
        return Err("La instantánea cifrada tiene un formato o tamaño no válido.".into());
    }
    serde_json::from_str::<sync_cmds::BackupData>(&snapshot.database_json)
        .map_err(|_| "La base de datos del archivo no tiene un formato compatible.".to_string())?;

    Ok((
        SyncFileInfo {
            format_version: envelope.format_version,
            file_id: envelope.file_id,
            version: envelope.version,
            digest: envelope_digest(text),
        },
        snapshot.database_json,
    ))
}

fn encrypt_snapshot(
    database_json: String,
    file_id: &str,
    version: u64,
    pairing_code: &str,
) -> Result<String, String> {
    if database_json.len() > MAX_DATABASE_JSON_BYTES {
        return Err("La base de datos supera el límite de 48 MiB para sincronización.".into());
    }
    if version == 0 || version > i64::MAX as u64 || !valid_file_id(file_id) {
        return Err("La identidad o versión de sincronización no es válida.".into());
    }
    let (code_file_id, key_bytes) = parse_pairing_code(pairing_code)?;
    if code_file_id != file_id {
        return Err("El código de seguridad pertenece a otra identidad.".into());
    }

    let snapshot = SyncSnapshot {
        format_version: FORMAT_VERSION,
        database_json,
    };
    let plaintext = serde_json::to_vec(&snapshot)
        .map_err(|_| "No se pudo preparar la instantánea de sincronización.".to_string())?;
    if plaintext.len() > MAX_DATABASE_JSON_BYTES + 1024 {
        return Err("La instantánea supera el tamaño permitido.".into());
    }

    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|_| "La clave del archivo de sincronización no es válida.".to_string())?;
    let mut nonce_bytes = [0; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(&nonce_bytes),
            Payload {
                msg: &plaintext,
                aad: &associated_data(file_id, version),
            },
        )
        .map_err(|_| "No se pudo cifrar la instantánea de sincronización.".to_string())?;
    let envelope = SyncEnvelope {
        format_version: FORMAT_VERSION,
        file_id: file_id.to_owned(),
        version,
        nonce: general_purpose::STANDARD.encode(nonce_bytes),
        ciphertext: general_purpose::STANDARD.encode(ciphertext),
    };
    let encoded = serde_json::to_string(&envelope)
        .map_err(|_| "No se pudo serializar el archivo de sincronización.".to_string())?;
    if encoded.len() > MAX_FILE_BYTES {
        return Err("El archivo cifrado supera el límite de 64 MiB.".into());
    }
    Ok(encoded)
}

fn checkpoint_table(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS rassembly_sync_checkpoint (
            file_id TEXT PRIMARY KEY CHECK(length(file_id) = 32),
            version INTEGER NOT NULL CHECK(version >= 0),
            digest TEXT NOT NULL DEFAULT ''
        )",
        [],
    )
    .map_err(|_| "No se pudo preparar el estado local de sincronización.".to_string())?;
    let columns = conn
        .prepare("PRAGMA table_info(rassembly_sync_checkpoint)")
        .and_then(|mut statement| {
            statement
                .query_map([], |row| row.get::<_, String>(1))?
                .collect::<rusqlite::Result<Vec<_>>>()
        })
        .map_err(|_| "No se pudo comprobar el esquema local de sincronización.".to_string())?;
    if !columns.iter().any(|column| column == "digest") {
        conn.execute(
            "ALTER TABLE rassembly_sync_checkpoint ADD COLUMN digest TEXT NOT NULL DEFAULT ''",
            [],
        )
        .map_err(|_| "No se pudo actualizar el esquema local de sincronización.".to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "android")]
fn validate_selected_file(file: &str) -> Result<String, String> {
    if file.len() > 8192 || !file.starts_with("content://") || file.contains('\0') {
        return Err("Selecciona un archivo válido mediante el selector del sistema.".into());
    }
    Ok(file.to_owned())
}

#[cfg(not(target_os = "android"))]
fn validate_selected_file(file: &str) -> Result<String, String> {
    if file.len() > 4096 || file.contains('\0') {
        return Err("La ruta seleccionada no es válida.".into());
    }
    let selected = PathBuf::from(file);
    if !selected.is_absolute() {
        return Err("La ruta del archivo debe proceder del selector del sistema.".into());
    }
    if !selected
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("rassembly"))
        .unwrap_or(false)
    {
        return Err("Selecciona un archivo con extensión .rassembly.".into());
    }
    let parent = selected
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let canonical_parent = fs::canonicalize(parent)
        .map_err(|_| "No se pudo validar la carpeta del archivo seleccionado.".to_string())?;
    if !canonical_parent.is_dir() {
        return Err("La ubicación seleccionada no es una carpeta válida.".into());
    }
    let name = selected
        .file_name()
        .ok_or_else(|| "La ruta seleccionada no contiene un nombre de archivo.".to_string())?;
    let candidate = canonical_parent.join(name);
    if candidate.exists() {
        let canonical_file = fs::canonicalize(&candidate)
            .map_err(|_| "No se pudo validar el archivo seleccionado.".to_string())?;
        if canonical_file.parent() != Some(canonical_parent.as_path()) || !canonical_file.is_file()
        {
            return Err(
                "El archivo seleccionado no es un archivo regular en la ubicación elegida.".into(),
            );
        }
        return Ok(canonical_file.to_string_lossy().into_owned());
    }
    Ok(candidate.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn guardar_archivo_sync(
    archivo: Option<String>,
    db_state: State<DbState>,
) -> Result<(), String> {
    let conn = db_state
        .conn
        .lock()
        .map_err(|_| "No se pudo guardar la configuración de sincronización.".to_string())?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS rassembly_folder_sync_file (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            file_uri TEXT NOT NULL
        )",
        [],
    )
    .map_err(|_| "No se pudo preparar la configuración de sincronización.".to_string())?;
    if let Some(file) = archivo {
        let validated = validate_selected_file(&file)?;
        conn.execute(
            "INSERT INTO rassembly_folder_sync_file(id, file_uri) VALUES (1, ?1)
             ON CONFLICT(id) DO UPDATE SET file_uri = excluded.file_uri",
            [&validated],
        )
        .map_err(|_| "No se pudo guardar el archivo seleccionado.".to_string())?;
    } else {
        conn.execute("DELETE FROM rassembly_folder_sync_file WHERE id = 1", [])
            .map_err(|_| "No se pudo quitar el archivo de sincronización.".to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn obtener_archivo_sync(db_state: State<DbState>) -> Result<Option<String>, String> {
    let conn = db_state
        .conn
        .lock()
        .map_err(|_| "No se pudo leer la configuración de sincronización.".to_string())?;
    configured_sync_file(&conn)
}

fn configured_sync_file(conn: &rusqlite::Connection) -> Result<Option<String>, String> {
    let table_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='rassembly_folder_sync_file')",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "No se pudo comprobar la configuración de sincronización.".to_string())?;
    if !table_exists {
        return Ok(None);
    }
    let selected = conn.query_row(
        "SELECT file_uri FROM rassembly_folder_sync_file WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    );
    match selected {
        Ok(file) => validate_selected_file(&file).map(Some),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(_) => Err("No se pudo leer el archivo de sincronización guardado.".into()),
    }
}

#[tauri::command]
pub fn leer_archivo_sync(db_state: State<DbState>) -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        let _ = db_state;
        Err("En Android, los archivos deben leerse mediante el selector SAF.".into())
    }
    #[cfg(not(target_os = "android"))]
    {
        let conn = db_state
            .conn
            .lock()
            .map_err(|_| "No se pudo leer la configuración de sincronización.".to_string())?;
        let selected = configured_sync_file(&conn)?
            .ok_or_else(|| "No hay un archivo de sincronización seleccionado.".to_string())?;
        drop(conn);
        let path = PathBuf::from(selected);
        let metadata = fs::metadata(&path)
            .map_err(|_| "No se pudo acceder al archivo seleccionado.".to_string())?;
        if !metadata.is_file() || metadata.len() > MAX_FILE_BYTES as u64 {
            return Err(
                "El archivo seleccionado no es válido o supera el límite de 64 MiB.".into(),
            );
        }
        let mut bytes = Vec::new();
        fs::File::open(path)
            .and_then(|file| {
                file.take((MAX_FILE_BYTES + 1) as u64)
                    .read_to_end(&mut bytes)
            })
            .map_err(|_| "No se pudo leer el archivo seleccionado.".to_string())?;
        if bytes.len() > MAX_FILE_BYTES {
            return Err("El archivo seleccionado supera el límite de 64 MiB.".into());
        }
        String::from_utf8(bytes)
            .map_err(|_| "El archivo de sincronización no contiene texto UTF-8 válido.".into())
    }
}

#[tauri::command]
pub fn escribir_archivo_sync(
    contenido: String,
    permitir_sobrescritura: bool,
    version_compartida_esperada: Option<u64>,
    huella_compartida_esperada: Option<String>,
    app_handle: AppHandle,
    db_state: State<DbState>,
) -> Result<(), String> {
    #[cfg(not(windows))]
    {
        let _ = (
            contenido,
            permitir_sobrescritura,
            version_compartida_esperada,
            huella_compartida_esperada,
            app_handle,
            db_state,
        );
        Err(
            "La escritura directa de archivos está disponible en Windows; en Android usa SAF."
                .into(),
        )
    }
    #[cfg(windows)]
    {
        let envelope = inspect_envelope(&contenido)?;
        let new_info = SyncFileInfo {
            format_version: envelope.format_version,
            file_id: envelope.file_id,
            version: envelope.version,
            digest: envelope_digest(&contenido),
        };
        let key = load_key(&app_handle, &new_info.file_id)?
            .ok_or_else(|| "Este archivo requiere vinculación antes de escribir.".to_string())?;
        let code = make_pairing_code(&new_info.file_id, &key);
        let (authenticated_new_info, _) = decrypt_snapshot(&contenido, &code)?;
        if authenticated_new_info != new_info {
            return Err("La instantánea de salida no superó la validación.".into());
        }

        let mut conn = db_state
            .conn
            .lock()
            .map_err(|_| "No se pudo escribir el archivo de sincronización.".to_string())?;
        let selected = configured_sync_file(&conn)?
            .ok_or_else(|| "No hay un archivo de sincronización seleccionado.".to_string())?;
        let path = PathBuf::from(selected);
        let local = checkpoint(&conn, &new_info.file_id)?;
        let shared = if path.exists() {
            let metadata = fs::metadata(&path)
                .map_err(|_| "No se pudo comprobar el archivo seleccionado.".to_string())?;
            if !metadata.is_file() || metadata.len() > MAX_FILE_BYTES as u64 {
                return Err(
                    "El archivo seleccionado no es válido o supera el límite de 64 MiB.".into(),
                );
            }
            let mut current_bytes = Vec::new();
            fs::File::open(&path)
                .and_then(|file| {
                    file.take((MAX_FILE_BYTES + 1) as u64)
                        .read_to_end(&mut current_bytes)
                })
                .map_err(|_| {
                    "No se pudo leer el archivo compartido antes de escribir.".to_string()
                })?;
            if current_bytes.len() > MAX_FILE_BYTES {
                return Err("El archivo compartido supera el límite de 64 MiB.".into());
            }
            let current = String::from_utf8(current_bytes)
                .map_err(|_| "El archivo compartido no contiene texto UTF-8 válido.".to_string())?;
            if current.trim().is_empty() {
                None
            } else {
                let envelope = inspect_envelope(&current)?;
                let info = SyncFileInfo {
                    format_version: envelope.format_version,
                    file_id: envelope.file_id,
                    version: envelope.version,
                    digest: envelope_digest(&current),
                };
                if info.file_id != new_info.file_id {
                    return Err(
                        "El archivo tiene otra identidad; vincúlalo antes de cambiarlo.".into(),
                    );
                }
                decrypt_snapshot(&current, &code)?;
                Some(info)
            }
        } else {
            None
        };

        if let Some(shared_info) = &shared {
            if version_compartida_esperada != Some(shared_info.version)
                || huella_compartida_esperada.as_deref() != Some(shared_info.digest.as_str())
            {
                return Err(format!(
                    "SYNC_CONFLICT:{}:{}",
                    shared_info.version, local.version
                ));
            }
            let changed = hay_conflicto(shared_info, &local);
            if changed && !permitir_sobrescritura {
                return Err(format!(
                    "SYNC_CONFLICT:{}:{}",
                    shared_info.version, local.version
                ));
            }
            let minimum_version = local.version.max(shared_info.version) + 1;
            if new_info.version != minimum_version {
                return Err(format!(
                    "SYNC_CONFLICT:{}:{}",
                    shared_info.version, local.version
                ));
            }
        } else if version_compartida_esperada.is_some()
            || huella_compartida_esperada.is_some()
            || local.version != 0
            || new_info.version != 1
        {
            return Err(
                "Solo se puede inicializar un archivo vacío con su primera versión v1.".into(),
            );
        }

        let tx = conn
            .transaction()
            .map_err(|_| "No se pudo preparar el checkpoint de sincronización.".to_string())?;
        fs::write(&path, contenido.as_bytes())
            .map_err(|_| "No se pudo escribir el archivo compartido.".to_string())?;
        save_checkpoint(&tx, &new_info.file_id, new_info.version, &new_info.digest)?;
        tx.commit().map_err(|_| {
            "El archivo se escribió, pero no se pudo guardar su checkpoint local.".to_string()
        })
    }
}

fn checkpoint(conn: &rusqlite::Connection, file_id: &str) -> Result<SyncCheckpoint, String> {
    checkpoint_table(conn)?;
    match conn.query_row(
        "SELECT version, digest FROM rassembly_sync_checkpoint WHERE file_id = ?1",
        [file_id],
        |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
    ) {
        Ok((version, digest)) if version >= 0 => Ok(SyncCheckpoint {
            version: version as u64,
            digest,
        }),
        Ok(_) => Err("El contador local de sincronización está corrupto.".into()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(SyncCheckpoint {
            version: 0,
            digest: String::new(),
        }),
        Err(_) => Err("No se pudo leer el contador local de sincronización.".into()),
    }
}

fn checkpoint_version(conn: &rusqlite::Connection, file_id: &str) -> Result<u64, String> {
    checkpoint(conn, file_id).map(|local| local.version)
}

fn hay_conflicto(remote: &SyncFileInfo, local: &SyncCheckpoint) -> bool {
    local.version != remote.version || (!local.digest.is_empty() && local.digest != remote.digest)
}

fn save_checkpoint(
    conn: &rusqlite::Connection,
    file_id: &str,
    version: u64,
    digest: &str,
) -> Result<(), String> {
    if !valid_file_id(file_id)
        || version > i64::MAX as u64
        || digest.len() != 64
        || !digest.bytes().all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("La identidad o versión de sincronización no es válida.".into());
    }
    checkpoint_table(conn)?;
    conn.execute(
        "INSERT INTO rassembly_sync_checkpoint(file_id, version, digest) VALUES (?1, ?2, ?3)
         ON CONFLICT(file_id) DO UPDATE SET version = excluded.version, digest = excluded.digest",
        rusqlite::params![file_id, version as i64, digest],
    )
    .map_err(|_| "No se pudo guardar el contador local de sincronización.".to_string())?;
    Ok(())
}

#[tauri::command]
pub fn nuevo_codigo_sync() -> NewSyncIdentity {
    let mut id = [0u8; 16];
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut id);
    OsRng.fill_bytes(&mut key);
    let file_id: String = id.iter().map(|byte| format!("{byte:02x}")).collect();
    NewSyncIdentity {
        pairing_code: make_pairing_code(&file_id, &key),
        file_id,
    }
}

#[tauri::command]
pub fn guardar_codigo_sync(codigo: String, app_handle: AppHandle) -> Result<String, String> {
    let (file_id, key) = parse_pairing_code(&codigo)?;
    save_key(&app_handle, &file_id, &key)?;
    Ok(file_id)
}

#[tauri::command]
pub fn obtener_codigo_sync(
    file_id: String,
    app_handle: AppHandle,
) -> Result<Option<String>, String> {
    if !valid_file_id(&file_id) {
        return Err("La identidad del archivo de sincronización no es válida.".into());
    }
    load_key(&app_handle, &file_id).map(|key| key.map(|bytes| make_pairing_code(&file_id, &bytes)))
}

#[tauri::command]
pub fn inspeccionar_archivo_sync(archivo: String) -> Result<SyncFileInfo, String> {
    let envelope = inspect_envelope(&archivo)?;
    Ok(SyncFileInfo {
        format_version: envelope.format_version,
        file_id: envelope.file_id,
        version: envelope.version,
        digest: envelope_digest(&archivo),
    })
}

#[tauri::command]
pub fn exportar_snapshot_sync(
    file_id: String,
    version: u64,
    codigo: String,
    db_state: State<DbState>,
) -> Result<String, String> {
    let (code_file_id, _) = parse_pairing_code(&codigo)?;
    if code_file_id != file_id {
        return Err("El código de seguridad pertenece a otro archivo.".into());
    }
    let mut conn = db_state
        .conn
        .lock()
        .map_err(|_| "No se pudo acceder a la base de datos local.".to_string())?;
    let local_version = checkpoint_version(&conn, &file_id)?;
    if version <= local_version {
        return Err(
            "La nueva versión debe ser mayor que el contador local de este archivo.".into(),
        );
    }
    let tx = conn
        .transaction()
        .map_err(|_| "No se pudo iniciar una instantánea consistente.".to_string())?;
    let database_json = sync_cmds::preparar_backup(&tx)?;
    tx.commit()
        .map_err(|_| "No se pudo finalizar la instantánea de la base de datos.".to_string())?;
    encrypt_snapshot(database_json, &file_id, version, &codigo)
}

#[tauri::command]
pub fn preparar_snapshot_si_cambio_sync(
    file_id: String,
    version: u64,
    codigo: String,
    archivo_compartido: String,
    db_state: State<DbState>,
) -> Result<Option<String>, String> {
    let (shared_info, shared_database_json) = decrypt_snapshot(&archivo_compartido, &codigo)?;
    if shared_info.file_id != file_id {
        return Err("El archivo compartido pertenece a otra identidad.".into());
    }
    let (code_file_id, _) = parse_pairing_code(&codigo)?;
    if code_file_id != file_id {
        return Err("El código de seguridad pertenece a otro archivo.".into());
    }

    let mut conn = db_state
        .conn
        .lock()
        .map_err(|_| "No se pudo acceder a la base de datos local.".to_string())?;
    let local_version = checkpoint_version(&conn, &file_id)?;
    if version <= local_version {
        return Err(
            "La nueva versión debe ser mayor que el contador local de este archivo.".into(),
        );
    }
    let tx = conn
        .transaction()
        .map_err(|_| "No se pudo iniciar una instantánea consistente.".to_string())?;
    let database_json = sync_cmds::preparar_backup(&tx)?;
    tx.commit()
        .map_err(|_| "No se pudo finalizar la instantánea de la base de datos.".to_string())?;

    if database_snapshots_equal(&database_json, &shared_database_json)? {
        return Ok(None);
    }

    encrypt_snapshot(database_json, &file_id, version, &codigo).map(Some)
}

#[tauri::command]
pub fn autenticar_codigo_sync(archivo: String, codigo: String) -> Result<SyncFileInfo, String> {
    decrypt_snapshot(&archivo, &codigo).map(|(info, _)| info)
}

#[tauri::command]
pub fn importar_snapshot_sync(
    archivo: String,
    codigo: String,
    db_state: State<DbState>,
) -> Result<SyncFileInfo, String> {
    let (info, database_json) = decrypt_snapshot(&archivo, &codigo)?;
    let mut conn = db_state
        .conn
        .lock()
        .map_err(|_| "No se pudo guardar el estado restaurado.".to_string())?;
    let tx = conn
        .transaction()
        .map_err(|_| "No se pudo iniciar la restauración de la instantánea.".to_string())?;
    sync_cmds::importar_backup_en_transaccion(&tx, &database_json)?;
    save_checkpoint(&tx, &info.file_id, info.version, &info.digest)?;
    tx.commit().map_err(|_| {
        "No se pudo guardar la restauración y su versión de forma atómica.".to_string()
    })?;
    Ok(info)
}

#[tauri::command]
pub fn obtener_checkpoint_sync(
    file_id: String,
    db_state: State<DbState>,
) -> Result<SyncCheckpoint, String> {
    if !valid_file_id(&file_id) {
        return Err("La identidad del archivo de sincronización no es válida.".into());
    }
    let conn = db_state
        .conn
        .lock()
        .map_err(|_| "No se pudo leer el estado local de sincronización.".to_string())?;
    checkpoint(&conn, &file_id)
}

#[tauri::command]
pub fn guardar_checkpoint_sync(
    file_id: String,
    version: u64,
    digest: String,
    db_state: State<DbState>,
) -> Result<(), String> {
    if version == 0 {
        return Err("No se puede guardar una versión de sincronización vacía.".into());
    }
    let conn = db_state
        .conn
        .lock()
        .map_err(|_| "No se pudo guardar el estado local de sincronización.".to_string())?;
    let local = checkpoint(&conn, &file_id)?;
    if version < local.version {
        return Err("El contador local solo puede avanzar después de una sincronización.".into());
    }
    if version == local.version {
        return if digest == local.digest {
            Ok(())
        } else {
            Err("La huella local no coincide con la versión ya guardada.".into())
        };
    }
    save_checkpoint(&conn, &file_id, version, &digest)
}

fn key_path(app: &AppHandle, file_id: &str) -> Result<PathBuf, String> {
    if !valid_file_id(file_id) {
        return Err("La identidad del archivo de sincronización no es válida.".into());
    }
    let dir = app.path().app_data_dir().map_err(|_| {
        "No se pudo acceder al almacenamiento privado de la aplicación.".to_string()
    })?;
    fs::create_dir_all(&dir)
        .map_err(|_| "No se pudo crear el almacenamiento privado de la aplicación.".to_string())?;
    Ok(dir.join(format!("sync-key-{file_id}.bin")))
}

#[cfg(windows)]
fn save_key(app: &AppHandle, file_id: &str, key: &[u8; 32]) -> Result<(), String> {
    let path = key_path(app, file_id)?;
    let protected = protect_windows_key(file_id, key)?;
    let temp_path = path.with_extension("tmp");
    fs::write(&temp_path, protected).map_err(|_| {
        "No se pudo proteger la clave de sincronización en este dispositivo.".to_string()
    })?;
    fs::rename(&temp_path, &path)
        .map_err(|_| "No se pudo guardar la clave protegida de sincronización.".to_string())
}

#[cfg(not(windows))]
fn save_key(_app: &AppHandle, _file_id: &str, _key: &[u8; 32]) -> Result<(), String> {
    Err("El almacenamiento protegido de claves está disponible en Windows y Android.".into())
}

#[cfg(windows)]
fn load_key(app: &AppHandle, file_id: &str) -> Result<Option<[u8; 32]>, String> {
    let path = key_path(app, file_id)?;
    if !path.exists() {
        return Ok(None);
    }
    let metadata = fs::metadata(&path)
        .map_err(|_| "No se pudo leer la clave protegida de sincronización.".to_string())?;
    if !metadata.is_file() || metadata.len() > 4096 {
        return Err("La clave protegida de sincronización está corrupta.".into());
    }
    let mut protected = Vec::new();
    fs::File::open(path)
        .and_then(|file| file.take(4097).read_to_end(&mut protected))
        .map_err(|_| "No se pudo leer la clave protegida de sincronización.".to_string())?;
    if protected.len() > 4096 {
        return Err("La clave protegida de sincronización está corrupta.".into());
    }
    unprotect_windows_key(file_id, &protected).map(Some)
}

#[cfg(not(windows))]
fn load_key(_app: &AppHandle, _file_id: &str) -> Result<Option<[u8; 32]>, String> {
    Err("El almacenamiento protegido de claves está disponible en Windows y Android.".into())
}

#[cfg(windows)]
fn protect_windows_key(file_id: &str, key: &[u8; 32]) -> Result<Vec<u8>, String> {
    use std::{ptr, slice};
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB},
    };
    let entropy = file_id.as_bytes();
    let input = CRYPT_INTEGER_BLOB {
        cbData: key.len() as u32,
        pbData: key.as_ptr() as *mut u8,
    };
    let optional_entropy = CRYPT_INTEGER_BLOB {
        cbData: entropy.len() as u32,
        pbData: entropy.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };
    // DPAPI binds the key to the current Windows user; this FFI boundary is limited to key wrapping.
    let ok = unsafe {
        CryptProtectData(
            &input,
            ptr::null(),
            &optional_entropy,
            ptr::null_mut(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err("Windows no pudo proteger la clave de sincronización.".into());
    }
    let protected =
        unsafe { slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        LocalFree(output.pbData.cast());
    }
    Ok(protected)
}

#[cfg(windows)]
fn unprotect_windows_key(file_id: &str, protected: &[u8]) -> Result<[u8; 32], String> {
    use std::{ptr, slice};
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
        },
    };
    let entropy = file_id.as_bytes();
    let input = CRYPT_INTEGER_BLOB {
        cbData: protected.len() as u32,
        pbData: protected.as_ptr() as *mut u8,
    };
    let optional_entropy = CRYPT_INTEGER_BLOB {
        cbData: entropy.len() as u32,
        pbData: entropy.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };
    // DPAPI unwrapping is the only unsafe operation; the returned buffer is copied and freed immediately.
    let ok = unsafe {
        CryptUnprotectData(
            &input,
            ptr::null_mut(),
            &optional_entropy,
            ptr::null_mut(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(
            "No se pudo desbloquear la clave de sincronización en esta cuenta de Windows.".into(),
        );
    }
    let bytes = unsafe { slice::from_raw_parts(output.pbData, output.cbData as usize) };
    let key: Result<[u8; 32], _> = bytes.try_into();
    unsafe {
        LocalFree(output.pbData.cast());
    }
    key.map_err(|_| "La clave protegida de sincronización está corrupta.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_code(file_id: &str, key: [u8; 32]) -> String {
        make_pairing_code(file_id, &key)
    }

    #[test]
    fn pairing_code_has_random_identity_and_key() {
        let first = nuevo_codigo_sync();
        let second = nuevo_codigo_sync();
        assert_ne!(first.file_id, second.file_id);
        assert_ne!(first.pairing_code, second.pairing_code);
        assert!(parse_pairing_code(&first.pairing_code).is_ok());
    }

    #[test]
    fn encrypted_sync_file_authenticates_metadata_and_round_trips() {
        let file_id = "0123456789abcdef0123456789abcdef";
        let code = test_code(file_id, [7; 32]);
        let json = r#"{"asambleas":[],"locales":[],"congregaciones":[],"personas":[],"programa":[],"asignaciones":[],"plantillas_cartas":[],"plantillas_email":[],"configuracion":[]}"#;
        let encrypted = encrypt_snapshot(json.to_owned(), file_id, 1, &code).unwrap();
        let (info, restored) = decrypt_snapshot(&encrypted, &code).unwrap();
        assert_eq!(info.version, 1);
        assert_eq!(info.file_id, file_id);
        assert_eq!(restored, json);

        let mut tampered: serde_json::Value = serde_json::from_str(&encrypted).unwrap();
        tampered["version"] = serde_json::json!(2);
        let tampered = serde_json::to_string(&tampered).unwrap();
        assert!(decrypt_snapshot(&tampered, &code).is_err());
    }

    #[test]
    fn snapshot_comparison_ignores_row_order_but_detects_data_changes() {
        let first = r#"{"personas":[{"id":2,"nombre":"B"},{"id":1,"nombre":"A"}],"configuracion":[]}"#;
        let same_data_different_order =
            r#"{"configuracion":[],"personas":[{"nombre":"A","id":1},{"nombre":"B","id":2}]}"#;
        let changed_data = r#"{"personas":[{"id":1,"nombre":"A"},{"id":2,"nombre":"C"}],"configuracion":[]}"#;

        assert!(database_snapshots_equal(first, same_data_different_order).unwrap());
        assert!(!database_snapshots_equal(first, changed_data).unwrap());
    }

    #[test]
    fn different_identity_and_wrong_key_are_rejected() {
        let file_id = "0123456789abcdef0123456789abcdef";
        let code = test_code(file_id, [1; 32]);
        let other_code = test_code(file_id, [2; 32]);
        let other_identity = test_code("fedcba9876543210fedcba9876543210", [1; 32]);
        let json = r#"{"asambleas":[],"locales":[],"congregaciones":[],"personas":[],"programa":[],"asignaciones":[],"plantillas_cartas":[],"plantillas_email":[],"configuracion":[]}"#;
        let encrypted = encrypt_snapshot(json.to_owned(), file_id, 1, &code).unwrap();
        assert!(decrypt_snapshot(&encrypted, &other_code).is_err());
        assert!(decrypt_snapshot(&encrypted, &other_identity).is_err());
    }

    #[test]
    fn empty_corrupt_unsupported_and_oversized_files_are_rejected() {
        assert!(inspect_envelope("").is_err());
        assert!(inspect_envelope("not-json").is_err());
        assert!(inspect_envelope(&"x".repeat(MAX_FILE_BYTES + 1)).is_err());
        let unsupported = r#"{"format_version":9,"file_id":"0123456789abcdef0123456789abcdef","version":1,"nonce":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA=="}"#;
        assert!(inspect_envelope(unsupported).is_err());
    }

    #[test]
    fn checkpoint_values_are_independent_by_identity() {
        let first = "0123456789abcdef0123456789abcdef";
        let second = "fedcba9876543210fedcba9876543210";
        let digest_a = "a".repeat(64);
        let digest_b = "b".repeat(64);
        let path = std::env::temp_dir().join(format!(
            "rassembly-sync-checkpoint-{}-{}.sqlite",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        {
            let db = rusqlite::Connection::open(&path).unwrap();
            save_checkpoint(&db, first, 9, &digest_a).unwrap();
            save_checkpoint(&db, second, 1, &digest_b).unwrap();
            save_checkpoint(&db, first, 3, &digest_b).unwrap();
            assert_eq!(checkpoint_version(&db, first).unwrap(), 3);
            assert_eq!(checkpoint_version(&db, second).unwrap(), 1);
        }
        let db = rusqlite::Connection::open(&path).unwrap();
        assert_eq!(checkpoint(&db, first).unwrap().digest, digest_b);
        assert_eq!(checkpoint_version(&db, second).unwrap(), 1);
        drop(db);
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn restored_shared_checkpoint_does_not_remain_a_conflict() {
        let file_id = "0123456789abcdef0123456789abcdef";
        let first_digest = "a".repeat(64);
        let latest_digest = "b".repeat(64);
        let db = rusqlite::Connection::open_in_memory().unwrap();

        save_checkpoint(&db, file_id, 1, &first_digest).unwrap();
        let latest_shared = SyncFileInfo {
            format_version: FORMAT_VERSION,
            file_id: file_id.to_owned(),
            version: 2,
            digest: latest_digest.clone(),
        };
        assert!(hay_conflicto(&latest_shared, &checkpoint(&db, file_id).unwrap()));

        // Restore updates the checkpoint alongside the imported database in one transaction.
        let tx = db.unchecked_transaction().unwrap();
        save_checkpoint(&tx, file_id, latest_shared.version, &latest_shared.digest).unwrap();
        tx.commit().unwrap();

        let restored = checkpoint(&db, file_id).unwrap();
        assert!(!hay_conflicto(&latest_shared, &restored));
        assert!(database_snapshots_equal(
            r#"{"personas":[{"id":1,"nombre":"actualizado"}]}"#,
            r#"{"personas":[{"nombre":"actualizado","id":1}]}"#
        )
        .unwrap());
    }

    #[test]
    fn higher_or_changed_shared_contents_are_conflicts() {
        let file_id = "0123456789abcdef0123456789abcdef";
        let local = SyncCheckpoint {
            version: 3,
            digest: "a".repeat(64),
        };
        let same_version = SyncFileInfo {
            format_version: FORMAT_VERSION,
            file_id: file_id.to_owned(),
            version: 3,
            digest: "a".repeat(64),
        };
        let replaced_contents = SyncFileInfo {
            digest: "b".repeat(64),
            ..same_version.clone()
        };
        let newer = SyncFileInfo {
            version: 4,
            ..same_version.clone()
        };
        assert!(!hay_conflicto(&same_version, &local));
        assert!(hay_conflicto(&replaced_contents, &local));
        assert!(hay_conflicto(&newer, &local));
    }

    #[test]
    fn selected_file_requires_rassembly_extension_and_regular_file() {
        let dir = std::env::temp_dir().join(format!("rassembly-sync-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("shared.rassembly");
        fs::write(&file, "data").unwrap();
        assert!(validate_selected_file(file.to_str().unwrap()).is_ok());
        assert!(validate_selected_file(dir.to_str().unwrap()).is_err());
        let _ = fs::remove_file(file);
        let _ = fs::remove_dir(dir);
    }
}
