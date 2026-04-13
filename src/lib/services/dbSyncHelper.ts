// src/lib/services/dbSyncHelper.ts

import { invoke } from '@tauri-apps/api/core';

export const DbSyncHelper = {
    async prepararRespaldoLocal(): Promise<string> {
        try {
            // Especificamos el tipo <string> para que TS no sufra
            const resultado = await invoke<string>('exportar_db_json');
            if (!resultado) throw new Error("Rust devolvió un paquete vacío");
            return resultado;
        } catch (error) {
            console.error("Error en prepararRespaldoLocal:", error);
            throw error; // Re-lanzamos para que la UI capture el error y deje de mostrar "Cargando"
        }
    },

    async aplicarRespaldoNube(jsonDataStr: string): Promise<boolean> {
        try {
            // Asegúrate de que el JSON no sea un string vacío antes de mandarlo
            if (!jsonDataStr) throw new Error("El JSON de la nube está vacío");
            
            await invoke('importar_db_json', { jsonData: jsonDataStr });
            return true;
        } catch (error) {
            console.error("Error en aplicarRespaldoNube:", error);
            throw error;
        }
    },

    async obtenerFechaUltimaSincronizacion(): Promise<string | null> {
        try {
            return await invoke<string | null>('obtener_last_sync_local');
        } catch (error) {
            // Aquí es mejor devolver null que lanzar error, para que la app no explote si es la primera vez
            return null;
        }
    },

    async actualizarFechaSincronizacion(fechaISO: string): Promise<void> {
        try {
            await invoke('actualizar_last_sync_local', { fecha: fechaISO });
        } catch (error) {
            console.error("Error en actualizarFechaSincronizacion:", error);
        }
    }
};