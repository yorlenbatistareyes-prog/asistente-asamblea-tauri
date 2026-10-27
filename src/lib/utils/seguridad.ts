import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';

const BOVEDA_PATH = 'boveda_seguridad.json';

// Esta función busca la llave. Si no existe (primera vez), la crea y la guarda sola.
export async function obtenerOCrearLlave(): Promise<string> {
    try {
        // Abrimos la "caja fuerte" de la app
        const boveda = await load(BOVEDA_PATH);
        
        // Buscamos si ya existe una llave guardada
        let llave = await boveda.get<string>('llave_maestra');

        if (!llave) {
            console.log("No hay llave. Generando una nueva desde Rust...");
            // Llamamos al comando de Rust que creamos en el Paso 2
            llave = await invoke<string>('generar_llave_invisible');
            
            // La guardamos de forma segura y permanente
            await boveda.set('llave_maestra', llave);
            await boveda.save();
            console.log("Llave generada y guardada exitosamente.");
        }

        return llave;
    } catch (error) {
        console.error("Error al gestionar la llave de seguridad:", error);
        throw error;
    }
}