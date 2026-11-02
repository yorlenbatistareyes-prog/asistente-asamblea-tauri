import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { FolderSync, SyncConflictError, SyncLinkRequiredError } from '$lib/services/folderSync';

export type SyncState = 'inactivo' | 'esperando' | 'sincronizando' | 'al_dia' | 'conflicto' | 'vinculacion' | 'error';

import { relaunch } from '@tauri-apps/plugin-process';

// 🔒 CANDADO ANTI-ECO: Evita que la sync reaccione a sus propios guardados
export let guardandoMetadatosInternos = false;
let operacionesConCandado = 0;

// 🔥 FUNCIÓN PARA PODER CAMBIAR EL CANDADO DESDE OTROS ARCHIVOS
export function setCandadoSincronizacion(estado: boolean) {
    operacionesConCandado = Math.max(0, operacionesConCandado + (estado ? 1 : -1));
    guardandoMetadatosInternos = operacionesConCandado > 0;
}

// --- STORE DETALLADA ---
export const syncStatus = writable({
    estado: 'inactivo' as SyncState, // Nace invisible
    mensaje: '',
    nubeDispositivo: '', 
    nubeFecha: ''       
});

// Nombre ÚNICO de este dispositivo
function generarNombreUnico() {
    if (typeof window === 'undefined') return 'PC Local';
    let nombre = localStorage.getItem('rassembly_device_name');
    if (!nombre) {
        const esAndroid = /android/i.test(navigator.userAgent);
        const prefijo = esAndroid ? 'Android' : 'PC';
        nombre = `${prefijo}-${Math.floor(Math.random() * 10000)}`;
        localStorage.setItem('rassembly_device_name', nombre);
    }
    return nombre;
}

export const lastDeviceName = writable(generarNombreUnico());

let debounceCarpetaTimer: ReturnType<typeof setTimeout>;

/**
 * Programa la sincronización del archivo compartido tras los cambios locales.
 */
function dispararSincronizacionCarpeta() {
    if (debounceCarpetaTimer) clearTimeout(debounceCarpetaTimer);

    // UI: Avisamos que detectamos el cambio y activamos el estado visual de espera
    syncStatus.update(s => ({ ...s, estado: 'esperando', mensaje: 'Cambio detectado, esperando...' }));

    debounceCarpetaTimer = setTimeout(async () => {
        await ejecutarSincronizacionCarpetaLocal();
    }, 5000);
}

/**
 * 📁 Respaldo automático cifrado en la carpeta local de Google Drive / OneDrive
 */
async function ejecutarSincronizacionCarpetaLocal() {
    try {
        const archivo = await invoke<string | null>('obtener_archivo_sync');
        if (!archivo) return;

        syncStatus.update(s => ({ ...s, estado: 'sincronizando', mensaje: 'Sincronizando archivo compartido...' }));
        const info = await FolderSync.sync(archivo);

        syncStatus.set({
            estado: 'al_dia',
            mensaje: info.changed
                ? `Archivo sincronizado (v${info.version})`
                : `Sin cambios locales; archivo compartido en v${info.version}`,
            nubeDispositivo: '',
            nubeFecha: ''
        });

        setTimeout(() => {
            syncStatus.update(s => ({ ...s, estado: 'inactivo', mensaje: '' }));
        }, 3000);

    } catch (error) {
        actualizarEstadoErrorCarpeta(error);
    }
}

function actualizarEstadoErrorCarpeta(error: unknown) {
    if (error instanceof SyncConflictError) {
        syncStatus.set({
            estado: 'conflicto',
            mensaje: `Conflicto: archivo v${error.remoteVersion}, dispositivo v${error.localVersion}.`,
            nubeDispositivo: 'Archivo compartido',
            nubeFecha: ''
        });
        detenerRadarCarpeta();
    } else if (error instanceof SyncLinkRequiredError) {
        syncStatus.set({
            estado: 'vinculacion',
            mensaje: error.message,
            nubeDispositivo: '',
            nubeFecha: ''
        });
    } else {
        syncStatus.update(s => ({
            ...s,
            estado: 'error',
            mensaje: 'No se pudo sincronizar el archivo. Comprueba el formato y los permisos.'
        }));
    }
}

// ==========================================
// RADAR DE ARCHIVO COMPARTIDO
// ==========================================
let radarCarpetaInterval: ReturnType<typeof setInterval> | null = null;

// --- RADAR DE CARPETA LIMPIO PARA PRODUCCIÓN ---
export function iniciarRadarCarpeta() {
    if (radarCarpetaInterval) return;

    const comprobarArchivoCompartido = async () => {
        try {
            const archivo = await invoke<string | null>('obtener_archivo_sync');
            if (!archivo || guardandoMetadatosInternos) return;
            const info = await FolderSync.inspect(archivo);
            const local = await invoke<{ version: number; digest: string }>('obtener_checkpoint_sync', {
                fileId: info.file_id
            });
            if (info.version !== local.version || (local.digest !== '' && local.digest !== info.digest)) {
                actualizarEstadoErrorCarpeta(new SyncConflictError(
                    info.version,
                    local.version,
                    info.version === local.version && local.digest !== info.digest
                ));
            } else if (get(syncStatus).estado === 'vinculacion' || get(syncStatus).estado === 'conflicto') {
                syncStatus.set({
                    estado: 'al_dia',
                    mensaje: `Archivo compartido actualizado (v${info.version}).`,
                    nubeDispositivo: '',
                    nubeFecha: ''
                });
            }
        } catch (error) {
            actualizarEstadoErrorCarpeta(error);
        }
    };

    void comprobarArchivoCompartido();
    radarCarpetaInterval = setInterval(() => {
        void comprobarArchivoCompartido();
    }, 15000);
}

export function detenerRadarCarpeta() {
    if (radarCarpetaInterval) {
        clearInterval(radarCarpetaInterval);
        radarCarpetaInterval = null;
    }
}

// Restore the current shared-file version on this device.
export async function descargarDatos() {
    try {
        syncStatus.update(s => ({ ...s, estado: 'sincronizando', mensaje: 'Restaurando archivo compartido...' }));
        
        const esAndroid = /android/i.test(navigator.userAgent);
        const archivo = await invoke<string | null>('obtener_archivo_sync');
        if (!archivo) throw new Error('No hay un archivo de sincronización configurado.');
        const candadoYaActivo = guardandoMetadatosInternos;
        setCandadoSincronizacion(true);
        try {
            await FolderSync.restore(archivo);
        } finally {
            setCandadoSincronizacion(candadoYaActivo);
        }

        syncStatus.set({ estado: 'al_dia', mensaje: '¡Datos actualizados!', nubeDispositivo: '', nubeFecha: '' });
        
        document.body.style.cursor = 'wait';
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 🔥 REINICIO INTELIGENTE
        if (esAndroid) {
            window.location.reload();
        } else {
            await relaunch();
        }

    } catch (e) {
        console.error("Error al descargar los datos:", e);
        alert("Fallo al restaurar. Revisa el acceso al archivo compartido.");
        syncStatus.update(s => ({ ...s, estado: 'error', mensaje: 'Error al restaurar' }));
    }
}

export async function sobrescribirArchivoCompartido() {
    const archivo = await invoke<string | null>('obtener_archivo_sync');
    if (!archivo) throw new Error('No hay un archivo de sincronización configurado.');
    try {
        syncStatus.update(s => ({ ...s, estado: 'sincronizando', mensaje: 'Guardando sobrescritura confirmada...' }));
        const info = await FolderSync.sync(archivo, true);
        syncStatus.set({
            estado: 'al_dia',
            mensaje: `Sobrescritura confirmada (v${info.version}).`,
            nubeDispositivo: '',
            nubeFecha: ''
        });
    } catch (error) {
        actualizarEstadoErrorCarpeta(error);
        throw error;
    }
}

// 📡 EL AURICULAR: Escuchamos el grito del embudo (db.ts) de forma controlada
if (typeof window !== 'undefined') {
    let filtroAntiBucle: ReturnType<typeof setTimeout>;

    window.addEventListener('db_local_cambiada', () => {
        if (guardandoMetadatosInternos) {
            return;
        }

        clearTimeout(filtroAntiBucle);

        filtroAntiBucle = setTimeout(async () => {
            let rutaCarpeta: string | null = null;
            try {
                rutaCarpeta = await invoke<string | null>('obtener_archivo_sync');
            } catch (e) {
                rutaCarpeta = null;
            }

            if (!rutaCarpeta) {
                return;
            }
            
            syncStatus.set({ estado: 'esperando', mensaje: 'Cambio detectado, esperando...', nubeDispositivo: '', nubeFecha: '' });
            dispararSincronizacionCarpeta();
            
        }, 1000); 
    });
}