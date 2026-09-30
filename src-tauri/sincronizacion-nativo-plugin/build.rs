fn main() {
    tauri_plugin::Builder::new(&[
        "elegirCarpeta",
        "escribirArchivo",
        "leerArchivo",
        "validarCarpeta",
        "guardarContenidoBase64",
    ])
        .android_path("android")
        .try_build()
        .expect("No se pudo preparar tauri-plugin-sincronizacion-nativo");
}
