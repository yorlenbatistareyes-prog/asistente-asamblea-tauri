use std::{env, fs, path::PathBuf};

fn main() {
    tauri_build::build();

    println!("cargo:rerun-if-changed=android/PluginSincronizacionNativo.kt");

    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
        let manifest_dir = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap());
        let source = manifest_dir.join("android/PluginSincronizacionNativo.kt");
        let destination = manifest_dir.join(
            "gen/android/app/src/main/java/com/rassembly/app/PluginSincronizacionNativo.kt",
        );

        fs::create_dir_all(destination.parent().unwrap())
            .expect("No se pudo crear el directorio del plugin Android");
        fs::copy(source, destination).expect("No se pudo copiar el plugin Android de sincronización");
    }
}
