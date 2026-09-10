use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use rand::RngCore;

// 1. Genera una llave de 256 bits y la devuelve en formato texto
#[tauri::command]
pub fn generar_llave_invisible() -> String {
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    general_purpose::STANDARD.encode(key)
}

// 2. Encripta los datos antes de guardarlos en la carpeta
#[tauri::command]
pub fn encriptar_maletin(texto_plano: String, llave_base64: String) -> Result<String, String> {
    let key_bytes = general_purpose::STANDARD
        .decode(llave_base64)
        .map_err(|e| format!("Error al leer llave: {}", e))?;
    
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let cifrado = cipher
        .encrypt(nonce, texto_plano.as_bytes())
        .map_err(|e| format!("Error al encriptar: {}", e))?;

    let mut paquete_completo = nonce_bytes.to_vec();
    paquete_completo.extend_from_slice(&cifrado);

    Ok(general_purpose::STANDARD.encode(paquete_completo))
}

// 3. Desencripta los datos cuando vienen de Google Drive
#[tauri::command]
pub fn desencriptar_maletin(paquete_base64: String, llave_base64: String) -> Result<String, String> {
    let key_bytes = general_purpose::STANDARD
        .decode(llave_base64)
        .map_err(|e| format!("Error al leer llave: {}", e))?;
    
    let paquete_bytes = general_purpose::STANDARD
        .decode(paquete_base64)
        .map_err(|e| format!("Error al leer archivo: {}", e))?;

    if paquete_bytes.len() < 12 {
        return Err("El archivo está corrupto o es muy corto.".into());
    }

    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let (nonce_bytes, cifrado) = paquete_bytes.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let texto_plano = cipher
        .decrypt(nonce, cifrado)
        .map_err(|_| "La llave es incorrecta o el archivo fue modificado.".to_string())?;

    String::from_utf8(texto_plano).map_err(|e| format!("Error de texto: {}", e))
}