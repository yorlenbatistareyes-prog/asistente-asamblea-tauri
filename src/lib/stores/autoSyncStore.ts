import { writable, get } from 'svelte/store';
import { SyncService } from '$lib/services/syncService';
import { DbSyncHelper } from '$lib/services/dbSyncHelper';
import { sesionApp } from './authStore'; 
import { invoke } from '@tauri-apps/api/core';
import { FolderSync, SyncConflictError, SyncLinkRequiredError } from '$lib/services/folderSync';

export type SyncState = 'inactivo' | 'esperando' | 'sincronizando' | 'al_dia' | 'conflicto' | 'vinculacion' | 'error';

// 🔒 CANDADO ANTI-ECO: Evita que la sync reaccione a sus propios guardados
export let guardandoMetadatosInternos = false;

// 🔥 FUNCIÓN PARA PODER CAMBIAR EL CANDADO DESDE OTROS ARCHIVOS
export function setCandadoSincronizacion(estado: boolean) {
    guardandoMetadatosInternos = estado;
}

// --- STORE DETALLADA ---
export const syncStatus = writable({
    estado: 'inactivo' as SyncState, // Nace invisible
    mensaje: '',
    nubeDispositivo: '', 
    nubeFecha: ''       
});

// Nombre de este dispositivo (para que otros sepan quién subió qué)
export const lastDeviceName = writable(typeof window !== 'undefined' ? localStorage.getItem('rassembly_device_name') || 'PC Local' : 'PC Local');

// ⏱️ Dos temporizadores independientes para que no interfieran entre sí
let debounceServidorTimer: ReturnType<typeof setTimeout>;
let debounceCarpetaTimer: ReturnType<typeof setTimeout>;

/**
 * Disparador exclusivo para el Servidor Web (Requiere Sesión)
 */
function dispararSincronizacionServidor() {
    const sesion = get(sesionApp);
    
    // Si no hay sesión, ignoramos el servidor en silencio sin afectar la carpeta local
    if (!sesion.isLoggedIn) {
        return;
    }

    console.log("⏳ [SyncServer] Iniciando temporizador del servidor (5s)...");
    syncStatus.update(s => ({ ...s, estado: 'esperando', mensaje: 'Cambio detectado, esperando...' }));
    
    if (debounceServidorTimer) clearTimeout(debounceServidorTimer);

    debounceServidorTimer = setTimeout(async () => {
        await ejecutarProcesoDeSincronizacion();
    }, 5000); 
}

/**
 * Disparador exclusivo para la Carpeta Compartida (Independiente del servidor)
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
 * Núcleo con Control Optimista y Mensajería Detallada (Servidor Web)
 */
async function ejecutarProcesoDeSincronizacion() {
    syncStatus.update(s => ({ ...s, estado: 'sincronizando', mensaje: 'Sincronizando...' }));
    
    try {
        // 1. EL RADAR (Chequeo de concurrencia)
        const fechaLocalStr = await DbSyncHelper.obtenerFechaUltimaSincronizacion();
        const estadoNube = await SyncService.chequearEstadoNube();
        const miDispositivo = get(lastDeviceName); 

        if (estadoNube && estadoNube.last_synced_at) {
            const tiempoLocal = fechaLocalStr ? new Date(fechaLocalStr).getTime() : 0;
            const tiempoNube = new Date(estadoNube.last_synced_at).getTime();

            // 🔥 REGLA DE ORO: Solo es conflicto si la nube es más nueva Y el dispositivo es DISTINTO
            if (tiempoNube > tiempoLocal && estadoNube.last_device !== miDispositivo) {
                console.warn("⚠️ CONFLICTO REAL DETECTADO (Otro dispositivo)");
                syncStatus.set({
                    estado: 'conflicto',
                    mensaje: 'Hay datos más nuevos en la nube.',
                    nubeDispositivo: estadoNube.last_device || 'Otro dispositivo',
                    nubeFecha: estadoNube.last_synced_at
                });
                return; 
            }
        }

        // 2. EMPAQUETADO (Rust entra en acción)
        const backupJson = await DbSyncHelper.prepararRespaldoLocal();

        // 3. SUBIDA (JS envía al servidor)
        const nuevaFechaISO = new Date().toISOString();
        const dispositivo = get(lastDeviceName);

        await SyncService.subirRespaldo(backupJson, nuevaFechaISO, dispositivo);

        // 👇 🔒 ACTIVAMOS EL CANDADO ANTES DE GUARDAR
        guardandoMetadatosInternos = true;

        // 4. ÉXITO (Guardamos marca en SQLite local vía Rust)
        await DbSyncHelper.actualizarFechaSincronizacion(nuevaFechaISO);

        // 👇 🔓 APAGAMOS EL CANDADO (Damos 2 segundos para que el evento pase ignorado)
        setTimeout(() => {
            guardandoMetadatosInternos = false;
        }, 2000);

        syncStatus.set({
            estado: 'al_dia',
            mensaje: '¡Sincronizado!',
            nubeDispositivo: '',
            nubeFecha: ''
        });

        // Ocultar mensaje de éxito tras 3 segundos
        setTimeout(() => {
            syncStatus.update(s => ({ ...s, estado: 'inactivo', mensaje: '' }));
        }, 3000);

    } catch (e) {
        console.error("❌ Error en sync:", e);
        syncStatus.update(s => ({ 
            ...s, 
            estado: 'error', 
            mensaje: 'Error de conexión' 
        }));
    }
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

export function resetearEstadoSincronizacion() {
    syncStatus.set({ estado: 'al_dia', mensaje: '', nubeDispositivo: '', nubeFecha: '' });
}

// ==========================================
// RADARES (VIGILANCIA EN SEGUNDO PLANO)
// ==========================================
let radarTimer: ReturnType<typeof setInterval> | null = null;
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

// --- RADAR DE SERVIDOR WEB ---
export function iniciarRadarNube() {
    const sesion = get(sesionApp);
    if (!sesion.isLoggedIn || radarTimer) return;

    radarTimer = setInterval(async () => {
        try {
            const estadoNube = await SyncService.chequearEstadoNube();
            const miDispositivo = get(lastDeviceName);

            if (estadoNube && estadoNube.last_synced_at) {
                const fechaLocalStr = await DbSyncHelper.obtenerFechaUltimaSincronizacion();
                const tiempoLocal = fechaLocalStr ? new Date(fechaLocalStr).getTime() : 0;
                const tiempoNube = new Date(estadoNube.last_synced_at).getTime();

                if (tiempoNube > tiempoLocal) {
                    if (estadoNube.last_device !== miDispositivo) {
                        syncStatus.set({
                            estado: 'conflicto',
                            mensaje: 'Hay datos nuevos en la nube.',
                            nubeDispositivo: estadoNube.last_device || 'Otro dispositivo',
                            nubeFecha: estadoNube.last_synced_at
                        });
                        detenerRadarNube(); // Detenemos radar web también ante conflicto
                    } else {
                        await DbSyncHelper.actualizarFechaSincronizacion(estadoNube.last_synced_at);
                    }
                }
            }
        } catch (e) {
            // Silencio
        }
    }, 30000); 
}

export function detenerRadarNube() {
    if (radarTimer) {
        clearInterval(radarTimer);
        radarTimer = null;
    }
}

// 🔥 NUEVO: FUNCIÓN INTELIGENTE PARA DESCARGAR DATOS
export async function descargarDatos() {
    try {
        syncStatus.update(s => ({ ...s, estado: 'sincronizando', mensaje: 'Descargando...' }));
        
        const estadoActual = get(syncStatus);

        if (estadoActual.nubeDispositivo === 'Archivo compartido') {
            const archivo = await invoke<string | null>('obtener_archivo_sync');
            if (!archivo) throw new Error('No hay un archivo de sincronización configurado.');
            const candadoYaActivo = guardandoMetadatosInternos;
            setCandadoSincronizacion(true);
            try {
                await FolderSync.restore(archivo);
            } finally {
                setCandadoSincronizacion(candadoYaActivo);
            }

        // 👉 ¿EL CONFLICTO VINO DEL SERVIDOR WEB?
        } else {
            const respaldoNube = await SyncService.descargarRespaldo(); 
            await DbSyncHelper.aplicarRespaldoNube(respaldoNube.backup_data); 
            
            if (respaldoNube.last_synced_at) {
                await DbSyncHelper.actualizarFechaSincronizacion(respaldoNube.last_synced_at);
            }
        }

        syncStatus.set({ estado: 'al_dia', mensaje: '¡Datos actualizados!', nubeDispositivo: '', nubeFecha: '' });
        
        // Refrescamos la ventana para que la interfaz cargue los nuevos datos
        setTimeout(() => window.location.reload(), 1500);

    } catch (e) {
        console.error("Error al descargar los datos:", e);
        alert("Fallo al descargar. Revisa tu conexión a internet o el acceso a la carpeta de sincronización.");
        syncStatus.update(s => ({ ...s, estado: 'error', mensaje: 'Error al descargar' }));
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

            const sesion = get(sesionApp);
            const sesionActiva = !!sesion?.isLoggedIn;

            if (!rutaCarpeta && !sesionActiva) {
                return;
            }
            
            syncStatus.set({ estado: 'esperando', mensaje: 'Cambio detectado, esperando...', nubeDispositivo: '', nubeFecha: '' });
            
            if (sesionActiva) dispararSincronizacionServidor();
            if (rutaCarpeta) dispararSincronizacionCarpeta();
            
        }, 1000); 
    });
}