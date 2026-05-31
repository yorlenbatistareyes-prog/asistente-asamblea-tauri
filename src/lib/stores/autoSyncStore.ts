import { writable, get } from 'svelte/store';
import { SyncService } from '$lib/services/syncService';
import { DbSyncHelper } from '$lib/services/dbSyncHelper';
import { sesionApp } from './authStore'; 

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

let debounceTimer: ReturnType<typeof setTimeout>;

/**
 * Se llama desde db.ts en cada cambio.
 */
export function dispararSincronizacionLocal() {
    const sesion = get(sesionApp);
    
    // Si el sistema piensa que no hay sesión, nos avisa en rojo y aborta
    if (!sesion.isLoggedIn) {
        console.warn("🔒 [SyncStore] Bloqueado: El sistema cree que NO has iniciado sesión con Gmail.");
        return;
    }

    // UI: Avisamos que detectamos el cambio y estamos esperando 5s
    console.log("⏳ [SyncStore] Iniciando temporizador de 5 segundos...");
    syncStatus.update(s => ({ ...s, estado: 'esperando', mensaje: 'Cambio detectado, esperando...' }));
    
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
        await ejecutarProcesoDeSincronizacion();
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

        if (estadoNube && estadoNube.last_synced_at) {
            const tiempoLocal = fechaLocalStr ? new Date(fechaLocalStr).getTime() : 0;
            const tiempoNube = new Date(estadoNube.last_synced_at).getTime();

            // CHOQUE: Si la nube es más nueva, abortamos para proteger datos
            if (tiempoNube > tiempoLocal) {
                console.warn("⚠️ CONFLICTO DETECTADO");
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
            if (estadoNube && estadoNube.last_synced_at) {
                const fechaLocalStr = await DbSyncHelper.obtenerFechaUltimaSincronizacion();
                const tiempoLocal = fechaLocalStr ? new Date(fechaLocalStr).getTime() : 0;
                const tiempoNube = new Date(estadoNube.last_synced_at).getTime();

                if (tiempoNube > tiempoLocal) {
                    // ¡Encontramos datos nuevos! Activamos el modal
                    syncStatus.set({
                        estado: 'conflicto',
                        mensaje: 'Hay datos nuevos en la nube.',
                        nubeDispositivo: estadoNube.last_device || 'Otro dispositivo',
                        nubeFecha: estadoNube.last_synced_at
                    });
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

// 📡 EL AURICULAR: Escuchamos el grito del embudo (db.ts)
if (typeof window !== 'undefined') {
    window.addEventListener('db_local_cambiada', () => {
        console.log("👂 [SyncStore] ¡Señal recibida de la base de datos! Iniciando sincronización...");
        dispararSincronizacionLocal();
    });
}