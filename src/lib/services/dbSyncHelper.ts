// src/lib/services/dbSyncHelper.ts

import { invoke } from '@tauri-apps/api/core';
import { obtenerOCrearLlave, cifrarTextoLocal, descifrarTextoLocal } from '$lib/utils/seguridad';

export const DbSyncHelper = {
    async prepararRespaldoLocal(): Promise<string> {
        try {
            // 1. Obtenemos nuestra llave Zero-Knowledge
            const llave = await obtenerOCrearLlave();

            // 2. Pedimos a Rust la base de datos ya cifrada
            const paqueteCifrado = await invoke<string>('exportar_db_encriptada_global', {
                llaveBase64: llave
            });
            if (!paqueteCifrado) throw new Error("Rust devolvió un paquete cifrado vacío");

            // 3. Recopilamos y ciframos también los borradores de LocalStorage
            let borradoresCifrados = '';
            if (typeof window !== 'undefined') {
                const borradores = {
                    asambleaActiva: localStorage.getItem('asambleaActiva'),
                    resumen: localStorage.getItem('resumen'),
                    temaApp: localStorage.getItem('temaApp')
                };
                borradoresCifrados = await cifrarTextoLocal(JSON.stringify(borradores), llave);
            }

            // 4. Creamos la "maleta" 100% blindada (cero texto plano)
            const payload = {
                es_encriptado: true,
                db_cifrada: paqueteCifrado,
                borradores_cifrados: borradoresCifrados
            };

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

            // 2. Enrutamos los datos a Rust dependiendo de si están cifrados o no
            if (payload.es_encriptado && payload.db_cifrada) {
                const llave = await obtenerOCrearLlave();

                // Primero restauramos la DB en Rust (si el PIN es incorrecto, fallará aquí mismo)
                await invoke('importar_db_encriptada_global', { 
                    paqueteBase64: payload.db_cifrada,
                    llaveBase64: llave
                });

                // Si la llave fue correcta, desciframos y aplicamos los borradores de interfaz
                if (payload.borradores_cifrados && typeof window !== 'undefined') {
                    const borradoresJson = await descifrarTextoLocal(payload.borradores_cifrados, llave);
                    const borradores = JSON.parse(borradoresJson);
                    
                    if (borradores.asambleaActiva) localStorage.setItem('asambleaActiva', borradores.asambleaActiva);
                    if (borradores.resumen) localStorage.setItem('resumen', borradores.resumen);
                    if (borradores.temaApp) localStorage.setItem('temaApp', borradores.temaApp);
                } else if (payload.borradores_local && typeof window !== 'undefined') {
                    // Retrocompatibilidad por si descargas un respaldo anterior
                    if (payload.borradores_local.asambleaActiva) localStorage.setItem('asambleaActiva', payload.borradores_local.asambleaActiva);
                    if (payload.borradores_local.resumen) localStorage.setItem('resumen', payload.borradores_local.resumen);
                    if (payload.borradores_local.temaApp) localStorage.setItem('temaApp', payload.borradores_local.temaApp);
                }
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