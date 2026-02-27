#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Simplemente llama a la función 'run' que está en el archivo lib.rs
    rassembly_lib::run();
}
