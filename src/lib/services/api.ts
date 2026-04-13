// src/lib/services/api.ts

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { dispararSincronizacionLocal } from '$lib/stores/autoSyncStore';

/**
 * Wrapper global para interceptar llamadas a Rust.
 * Dispara la sincronización automáticamente si detecta cambios en la BD.
 */
export async function invokeApp<T>(comando: string, args?: any): Promise<T> {
    // 1. Ejecutamos la petición original a Rust de forma transparente
    const resultado = await tauriInvoke<T>(comando, args);

    // 2. Lista de palabras que indican que estás escribiendo/borrando en SQLite
    // (Asegúrate de que coincidan con los nombres de tus funciones pub fn en lib.rs/database.rs)
    const palabrasClave = ['crear_', 'editar_', 'actualizar_', 'eliminar_', 'guardar_', 'borrar_', 'insertar_'];
    
    const esModificacion = palabrasClave.some(palabra => comando.toLowerCase().includes(palabra));

    // 3. Si la base de datos cambió, despertamos a la barra de sincronización
    if (esModificacion) {
        console.log(`📡 [AutoSync] Sincronización automática disparada por: ${comando}`);
        dispararSincronizacionLocal();
    }

    // 4. Devolvemos el resultado al componente Svelte para que siga su flujo normal
    return resultado;
}