import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

// Controla qué pantalla se ve ('inicio' o 'configuracion')
export const vistaActual = writable('inicio');

// Datos globales de la app
export const appStore = writable({
    usuario: "Usuario",
    congregacion: "",
    circuito: "",
    ultimoAcceso: new Date()
});

// Función para cargar datos básicos al inicio
export async function cargarDatosGlobales() {
    try {
        const config: any = await invoke('obtener_configuracion_general');
        
        // ESTO ES CLAVE: Imprime en la consola (F12) lo que Rust nos está mandando
        console.log("⚙️ Configuración recibida de Rust:", config); 

        if (config) {
            // Evaluamos si viene el nombre. Si viene nombre y apellido, los podemos unir.
            let nombreMostrar = "Usuario"; // Valor por defecto
            
            if (config.nombre) {
                nombreMostrar = config.nombre;
                // Si quisieras que diga "Yorlen Batista", usarías esto:
                // nombreMostrar = `${config.nombre} ${config.apellido || ''}`.trim();
            } else if (config.nombre_usuario) {
                nombreMostrar = config.nombre_usuario;
            }

            appStore.update(s => ({
                ...s,
                usuario: nombreMostrar,
                congregacion: config.congregacion || "",
                circuito: config.circuito || ""
            }));
        }
    } catch (e) {
        console.error("❌ Error cargando globales desde Rust:", e);
    }
}