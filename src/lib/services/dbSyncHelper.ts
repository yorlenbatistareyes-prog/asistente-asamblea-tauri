// src/lib/services/dbSyncHelper.ts

import { invoke } from '@tauri-apps/api/core';
import { obtenerOCrearLlave } from '$lib/utils/seguridad'; // Asegúrate de que esta ruta coincida con tu proyecto

export const DbSyncHelper = {
    async prepararRespaldoLocal(): Promise<string> {
        try {
            // 1. Obtenemos nuestra llave invisible
            const llave = await obtenerOCrearLlave();

            // 2. Pedimos a Rust la base de datos ya cifrada
            const paqueteCifrado = await invoke<string>('exportar_db_encriptada_global', {
                llaveBase64: llave
            });
            if (!paqueteCifrado) throw new Error("Rust devolvió un paquete cifrado vacío");

            // 3. Creamos una "maleta" que contiene la DB cifrada y los datos de la interfaz
            const payload = {
                es_encriptado: true,
                db_cifrada: paqueteCifrado,
                borradores_local: {} as any
            };

            // 4. Inyectamos los borradores de LocalStorage
            if (typeof window !== 'undefined') {
                payload.borradores_local = {
                    asambleaActiva: localStorage.getItem('asambleaActiva'),
                    resumen: localStorage.getItem('resumen'),
                    temaApp: localStorage.getItem('temaApp')
                };
            }

            // 5. Convertimos la maleta entera a string para enviarla al servidor web
            return JSON.stringify(payload);

        } catch (error) {
            console.error("Error en prepararRespaldoLocal:", error);
            throw error; 
        }
    },

    async aplicarRespaldoNube(jsonDataStr: string): Promise<boolean> {
        try {
            if (!jsonDataStr) throw new Error("El JSON de la nube está vacío");
            
            // 1. Abrimos la maleta descargada
            const payload = JSON.parse(jsonDataStr);

            // 2. Restauramos los borradores en el navegador
            if (payload.borradores_local && typeof window !== 'undefined') {
                if (payload.borradores_local.asambleaActiva) {
                    localStorage.setItem('asambleaActiva', payload.borradores_local.asambleaActiva);
                }
                if (payload.borradores_local.resumen) {
                    localStorage.setItem('resumen', payload.borradores_local.resumen);
                }
                if (payload.borradores_local.temaApp) {
                    localStorage.setItem('temaApp', payload.borradores_local.temaApp);
                }
            }

            // 3. Enrutamos los datos a Rust dependiendo de si están cifrados o no
            if (payload.es_encriptado && payload.db_cifrada) {
                // 🔒 FLUJO SEGURO (Nuevo formato)
                const llave = await obtenerOCrearLlave();
                await invoke('importar_db_encriptada_global', { 
                    paqueteBase64: payload.db_cifrada,
                    llaveBase64: llave
                });
            } else {
                // 🔓 FLUJO RETROCOMPATIBLE (Por si descargas un respaldo viejo)
                delete payload.borradores_local;
                const dataLimpiaParaRust = JSON.stringify(payload);
                await invoke('importar_db_json', { jsonData: dataLimpiaParaRust });
            }
            
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