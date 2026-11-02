fn main() {
    tauri_plugin::Builder::new(&[
        "pickSyncFile",
        "createSyncFile",
        "readSyncFile",
        "writeSyncFile",
        "saveSyncKey",
        "getSyncKey",
    ])
        .android_path("android")
        .try_build()
        .expect("No se pudo preparar tauri-plugin-sincronizacion-nativo");
}
