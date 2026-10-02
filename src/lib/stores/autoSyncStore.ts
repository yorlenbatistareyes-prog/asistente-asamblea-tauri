import { writable, get } from 'svelte/store';
import { SyncService } from '$lib/services/syncService';
import { DbSyncHelper } from '$lib/services/dbSyncHelper';
import { sesionApp } from './authStore'; 
import { invoke } from '@tauri-apps/api/core';
import { PuenteAlmacenamiento } from '$lib/services/puenteAlmacenamiento';
import { obtenerOCrearLlave } from '$lib/utils/seguridad';
import { relaunch } from '@tauri-apps/plugin-process';

export type SyncState = 'inactivo' | 'esperando' | 'sincronizando' | 'al_dia' | 'conflicto' | 'error';

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
        setCandadoSincronizacion(true);

        // 4. ÉXITO (Guardamos marca en SQLite local vía Rust)
        await DbSyncHelper.actualizarFechaSincronizacion(nuevaFechaISO);

        // 👇 🔓 APAGAMOS EL CANDADO (Damos 2 segundos para que el evento pase ignorado)
        setTimeout(() => {
            setCandadoSincronizacion(false);
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
    let candadoActivo = false;

    try {
        const rutaCarpeta = await invoke<string | null>('obtener_ruta_sync');
        if (!rutaCarpeta) return; 

        syncStatus.update(s => ({ ...s, estado: 'sincronizando', mensaje: 'Sincronizando carpeta...' }));

        const llave = await obtenerOCrearLlave();
        const paqueteCifrado = await invoke<string>('exportar_db_binaria_encriptada', {
            llaveBase64: llave
        });

        setCandadoSincronizacion(true);
        candadoActivo = true;
        await PuenteAlmacenamiento.escribirArchivo(rutaCarpeta, paqueteCifrado);

        // 🔥 NUEVO: Matar el "eco" en el guardado automático
        try {
            const metadatos = await PuenteAlmacenamiento.obtenerUltimaModificacion(rutaCarpeta);
            if (metadatos) {
                await DbSyncHelper.actualizarFechaSincronizacion(metadatos.toISOString());
            }
        } catch (e) {
            console.error("Fallo al actualizar fecha tras auto-sync:", e);
        }

        setTimeout(() => {
            setCandadoSincronizacion(false);
        }, 2000);
        candadoActivo = false;

        syncStatus.set({
            estado: 'al_dia',
            mensaje: '¡Carpeta sincronizada!',
            nubeDispositivo: '',
            nubeFecha: ''
        });

        setTimeout(() => {
            syncStatus.update(s => ({ ...s, estado: 'inactivo', mensaje: '' }));
        }, 3000);

    } catch (error) {
        console.error("❌ [CarpetaSync] Error al sincronizar en la carpeta local:", error);
        if (candadoActivo) setCandadoSincronizacion(false);
        const detalle = error instanceof Error ? error.message : String(error);
        syncStatus.update(s => ({ 
            ...s, 
            estado: 'error', 
            mensaje: `Error en carpeta local: ${detalle}`
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

    radarCarpetaInterval = setInterval(async () => {
        try {
            const rutaCarpeta = await invoke<string | null>('obtener_ruta_sync');
            if (!rutaCarpeta) return;

            const metadatos = await PuenteAlmacenamiento.obtenerUltimaModificacion(rutaCarpeta);
            if (!metadatos) return;

            const tiempoCarpeta = metadatos.getTime();
            const fechaLocalStr = await DbSyncHelper.obtenerFechaUltimaSincronizacion();
            const tiempoLocal = fechaLocalStr ? new Date(fechaLocalStr).getTime() : 0;

            if (tiempoCarpeta > (tiempoLocal + 2000)) {
                if (guardandoMetadatosInternos) return;

                syncStatus.set({
                    estado: 'conflicto',
                    mensaje: 'Hay datos nuevos en la carpeta compartida.',
                    nubeDispositivo: 'Carpeta en la nube',
                    nubeFecha: new Date(tiempoCarpeta).toISOString()
                });

                detenerRadarCarpeta();
            }
        } catch (e) {
            // Silencio total en producción
        }
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
        const esAndroid = /android/i.test(navigator.userAgent);
        let esPaqueteBinario = false;

        // 👉 ¿EL CONFLICTO VINO DE LA CARPETA?
        if (estadoActual.nubeDispositivo === 'Carpeta en la nube') {
            const rutaCarpeta = await invoke<string | null>('obtener_ruta_sync');
            if (!rutaCarpeta) throw new Error("No hay carpeta configurada.");
            
            const paqueteCifrado = await PuenteAlmacenamiento.leerArchivo(rutaCarpeta);
            const llave = await obtenerOCrearLlave();

            esPaqueteBinario = paqueteCifrado.startsWith('RASSEMBLY2:');
            if (esPaqueteBinario) {
                await invoke('importar_db_binaria_encriptada', {
                    paqueteBase64: paqueteCifrado,
                    llaveBase64: llave
                });

                if (esAndroid) {
                    await invoke('aplicar_restauracion_binaria_pendiente');
                }
            } else {
                await invoke('importar_db_encriptada_global', {
                    paqueteBase64: paqueteCifrado,
                    llaveBase64: llave
                });
            }

            const metadatos = await PuenteAlmacenamiento.obtenerUltimaModificacion(rutaCarpeta);
            if (metadatos) {
                await DbSyncHelper.actualizarFechaSincronizacion(metadatos.toISOString());
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
        alert("Fallo al descargar. Revisa tu conexión a internet o el acceso a la carpeta de sincronización.");
        syncStatus.update(s => ({ ...s, estado: 'error', mensaje: 'Error al descargar' }));
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
                rutaCarpeta = await invoke<string | null>('obtener_ruta_sync');
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