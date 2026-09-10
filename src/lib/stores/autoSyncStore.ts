import { writable, get } from 'svelte/store';
import { SyncService } from '$lib/services/syncService';
import { DbSyncHelper } from '$lib/services/dbSyncHelper';
import { sesionApp } from './authStore'; 
import { invoke } from '@tauri-apps/api/core';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { obtenerOCrearLlave } from '$lib/utils/seguridad';

export type SyncState = 'inactivo' | 'esperando' | 'sincronizando' | 'al_dia' | 'conflicto' | 'error';

// --- STORE DETALLADA ---
export const syncStatus = writable({
    estado: 'inactivo' as SyncState, // 🔥 Nace invisible
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
 * Núcleo con Control Optimista y Mensajería Detallada
 */
async function ejecutarProcesoDeSincronizacion() {
    syncStatus.update(s => ({ ...s, estado: 'sincronizando', mensaje: 'Sincronizando...' }));
    
    try {
        // 1. EL RADAR (Chequeo de concurrencia)
        const fechaLocalStr = await DbSyncHelper.obtenerFechaUltimaSincronizacion();
        const estadoNube = await SyncService.chequearEstadoNube();
        const miDispositivo = get(lastDeviceName); // 🔥 NUEVO: Identificamos tu PC

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

        // 4. ÉXITO (Guardamos marca en SQLite local vía Rust)
        await DbSyncHelper.actualizarFechaSincronizacion(nuevaFechaISO);

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
        // 1. Verificamos si hay una carpeta de sincronización configurada
        const rutaCarpeta = await invoke<string | null>('obtener_ruta_sync');
        if (!rutaCarpeta) return; // Si no hay carpeta vinculada, salimos en silencio

        console.log("📁 [CarpetaSync] Verificando carpeta de sincronización...");

        // UI: Informamos que la carpeta local está sincronizando
        syncStatus.update(s => ({ ...s, estado: 'sincronizando', mensaje: 'Sincronizando carpeta...' }));

        // 2. Obtenemos nuestra llave invisible de la bóveda de forma transparente
        const llave = await obtenerOCrearLlave();

        // 3. Invocamos a Rust para exportar y cifrar la base de datos global
        const paqueteCifrado = await invoke<string>('exportar_db_encriptada_global', {
            llaveBase64: llave
        });

        // 4. Construimos la ruta segura (compatible con escritorio y Android)
        const separador = rutaCarpeta.includes('/') ? '/' : '\\';
        const rutaArchivoFinal = `${rutaCarpeta}${separador}sincronizacion_global.rassembly`;

        // 5. Escribimos físicamente el archivo cifrado en el directorio compartido
        await writeTextFile(rutaArchivoFinal, paqueteCifrado);
        console.log("✅ [CarpetaSync] Archivo cifrado actualizado en la carpeta compartida:", rutaArchivoFinal);

        // UI: Éxito visual
        syncStatus.set({
            estado: 'al_dia',
            mensaje: '¡Carpeta sincronizada!',
            nubeDispositivo: '',
            nubeFecha: ''
        });

        // Ocultar mensaje de éxito tras 3 segundos
        setTimeout(() => {
            syncStatus.update(s => ({ ...s, estado: 'inactivo', mensaje: '' }));
        }, 3000);

    } catch (error) {
        console.error("❌ [CarpetaSync] Error al sincronizar en la carpeta local:", error);
        syncStatus.update(s => ({ 
            ...s, 
            estado: 'error', 
            mensaje: 'Error en carpeta local' 
        }));
    }
}

/**
 * Limpia el estado (útil después de una restauración manual)
 */
export function resetearEstadoSincronizacion() {
    syncStatus.set({ estado: 'al_dia', mensaje: '', nubeDispositivo: '', nubeFecha: '' });
}

// Añade esto a tu src/lib/stores/autoSyncStore.ts en RAssembly

let radarTimer: ReturnType<typeof setInterval> | null = null;

export function iniciarRadarNube() {
    const sesion = get(sesionApp);
    if (!sesion.isLoggedIn || radarTimer) return;

    // Revisa la nube cada 30 segundos (ajústalo a tu gusto)
    radarTimer = setInterval(async () => {
        try {
            const estadoNube = await SyncService.chequearEstadoNube();
            const miDispositivo = get(lastDeviceName);

            if (estadoNube && estadoNube.last_synced_at) {
                const fechaLocalStr = await DbSyncHelper.obtenerFechaUltimaSincronizacion();
                const tiempoLocal = fechaLocalStr ? new Date(fechaLocalStr).getTime() : 0;
                const tiempoNube = new Date(estadoNube.last_synced_at).getTime();

                if (tiempoNube > tiempoLocal) {
                    // 🔥 Si fue otro dispositivo -> Lanza el Cartel
                    if (estadoNube.last_device !== miDispositivo) {
                        syncStatus.set({
                            estado: 'conflicto',
                            mensaje: 'Hay datos nuevos en la nube.',
                            nubeDispositivo: estadoNube.last_device || 'Otro dispositivo',
                            nubeFecha: estadoNube.last_synced_at
                        });
                    } else {
                        // 🔥 Si fuiste TÚ mismo, solo iguala las fechas en silencio
                        await DbSyncHelper.actualizarFechaSincronizacion(estadoNube.last_synced_at);
                    }
                }
            }
        } catch (e) {
            console.error("Fallo en el radar de nube:", e);
        }
    }, 30000); 
}

export function detenerRadarNube() {
    if (radarTimer) {
        clearInterval(radarTimer);
        radarTimer = null;
    }
}

// 🔥 NUEVO: Función para el botón del cartel de conflicto
export async function descargarDatos() {
    try {
        syncStatus.update(s => ({ ...s, estado: 'sincronizando', mensaje: 'Descargando...' }));
        
        // 1. Descargar el objeto de la nube
        const respaldoNube = await SyncService.descargarRespaldo(); 
        
        // 2. Aplicar el JSON puro en tu base de datos local
        await DbSyncHelper.aplicarRespaldoNube(respaldoNube.backup_data); 
        
        // 3. Emparejar las fechas para calmar al radar
        if (respaldoNube.last_synced_at) {
            await DbSyncHelper.actualizarFechaSincronizacion(respaldoNube.last_synced_at);
        }
        
        syncStatus.set({ estado: 'al_dia', mensaje: '¡Datos actualizados!', nubeDispositivo: '', nubeFecha: '' });
        
        // Refrescamos la ventana para que la interfaz cargue los nuevos datos
        setTimeout(() => window.location.reload(), 1500);

    } catch (e) {
        console.error("Error al descargar los datos:", e);
        alert("Fallo al descargar. Revisa tu conexión a internet.");
        syncStatus.update(s => ({ ...s, estado: 'error', mensaje: 'Error al descargar' }));
    }
}

// 📡 EL AURICULAR: Escuchamos el grito del embudo (db.ts)
if (typeof window !== 'undefined') {
    window.addEventListener('db_local_cambiada', () => {
        console.log("👂 [SyncStore] ¡Señal recibida de la base de datos!");
        
        // 🔥 ESTE ES EL SECRETO: Despertamos la UI inmediatamente para TODOS los canales
        syncStatus.update(s => ({ ...s, estado: 'esperando', mensaje: 'Cambio detectado, esperando...' }));
        
        // 1. Canal Independiente: Servidor de la Nube
        dispararSincronizacionServidor();

        // 2. Canal Independiente: Carpeta Compartida Local (Drive / OneDrive)
        dispararSincronizacionCarpeta();
    });
}