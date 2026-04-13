// src/lib/services/dbSyncHelper.ts

import { invoke } from '@tauri-apps/api/core';

export const DbSyncHelper = {
    async prepararRespaldoLocal(): Promise<string> {
        try {
            // 1. Obtenemos la BD pura de Rust
            const resultado = await invoke<string>('exportar_db_json');
            if (!resultado) throw new Error("Rust devolvió un paquete vacío");

            // 2. RESCATE DE BORRADORES (LocalStorage)
            // Convertimos el string a objeto temporalmente
            const dbObjeto = JSON.parse(resultado);

            // 3. Inyectamos lo que tienes en el navegador para que viaje a la nube
            if (typeof window !== 'undefined') { // 👈 AÑADIR ESTA LÍNEA
                dbObjeto.borradores_local = {
                    asambleaActiva: localStorage.getItem('asambleaActiva'),
                    resumen: localStorage.getItem('resumen'),
                    temaApp: localStorage.getItem('temaApp')
                };
            } // 👈 Y CERRAR LA LLAVE AQUÍ

            // 4. Volvemos a empaquetar y enviamos a la nube
            return JSON.stringify(dbObjeto);

        } catch (error) {
            console.error("Error en prepararRespaldoLocal:", error);
            throw error; 
        }
    },

    async aplicarRespaldoNube(jsonDataStr: string): Promise<boolean> {
        try {
            if (!jsonDataStr) throw new Error("El JSON de la nube está vacío");
            
            // 1. DESEMPAQUETAR BORRADORES
            const dbObjeto = JSON.parse(jsonDataStr);

            // Si vienen borradores en la maleta, los guardamos en el navegador local
            if (dbObjeto.borradores_local && typeof window !== 'undefined') {
                if (dbObjeto.borradores_local.asambleaActiva) {
                    localStorage.setItem('asambleaActiva', dbObjeto.borradores_local.asambleaActiva);
                }
                if (dbObjeto.borradores_local.resumen) {
                    localStorage.setItem('resumen', dbObjeto.borradores_local.resumen);
                }
                if (dbObjeto.borradores_local.temaApp) {
                    localStorage.setItem('temaApp', dbObjeto.borradores_local.temaApp);
                }
                
                // Limpiamos el objeto antes de mandarlo a Rust para evitar errores de tablas inexistentes
                delete dbObjeto.borradores_local;
            }

            // 2. Mandar el resto de la base de datos pura a Rust
            const dataLimpiaParaRust = JSON.stringify(dbObjeto);
            await invoke('importar_db_json', { jsonData: dataLimpiaParaRust });
            
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