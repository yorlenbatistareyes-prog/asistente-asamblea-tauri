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
        if (config) {
            appStore.update(s => ({
                ...s,
                usuario: config.nombre_usuario || config.nombre || "Usuario",
                congregacion: config.congregacion || "",
                circuito: config.circuito || ""
            }));
        }
    } catch (e) {
        console.error("Error cargando globales:", e);
    }
}