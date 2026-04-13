import { invoke } from '@tauri-apps/api/core';
import { dispararSincronizacionLocal } from '$lib/stores/autoSyncStore';

export const DB = {
    // --- LECTURA (No disparan sincronización) ---
    async obtenerAsambleas() {
        return await invoke('obtener_asambleas');
    },

    async obtenerLocales() {
        return await invoke('obtener_locales');
    },

    // --- ESCRITURA (SÍ disparan sincronización) ---
    async crearAsamblea(datos: any) {
        const resultado = await invoke('crear_asamblea', datos);
        
        // ¡LA MAGIA OCURRE AQUÍ! Avisamos que hubo un cambio
        dispararSincronizacionLocal(); 
        
        return resultado;
    },

    async eliminarAsamblea(id: number) {
        const resultado = await invoke('eliminar_asamblea', { id });
        dispararSincronizacionLocal();
        return resultado;
    },
    
    // Agrega aquí el resto de tus funciones en el futuro (guardar InfoEvento, crear personas, etc.)
};