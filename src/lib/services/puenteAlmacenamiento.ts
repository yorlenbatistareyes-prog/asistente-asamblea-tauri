import { invoke } from '@tauri-apps/api/core';
import { type } from '@tauri-apps/plugin-os';
import { open, save } from '@tauri-apps/plugin-dialog';

const NOMBRE_ARCHIVO_SYNC = 'sincronizacion_global.rassembly';
const MAX_SYNC_FILE_BYTES = 64 * 1024 * 1024;
const FILE_FILTER = [{ name: 'RAssembly Sync', extensions: ['rassembly'] }];

export class PuenteAlmacenamiento {
    static async esAndroid(): Promise<boolean> {
        return (await type()) === 'android';
    }

    static async seleccionarArchivo(): Promise<string | null> {
        if (await this.esAndroid()) {
            const result = await invoke<{ uri: string }>('plugin:sincronizacion-nativo|pickSyncFile');
            return result.uri;
        }
        const path = await open({ multiple: false, directory: false, filters: FILE_FILTER });
        return typeof path === 'string' ? path : null;
    }

    static async crearArchivo(): Promise<string | null> {
        if (await this.esAndroid()) {
            const result = await invoke<{ uri: string }>('plugin:sincronizacion-nativo|createSyncFile');
            return result.uri;
        }
        return await save({
            defaultPath: NOMBRE_ARCHIVO_SYNC,
            filters: FILE_FILTER
        });
    }

    static async escribirArchivo(
        uriOPath: string,
        contenido: string,
        permitirSobrescritura = false,
        versionCompartidaEsperada?: number,
        huellaCompartidaEsperada?: string,
        codigoVinculacion?: string
    ): Promise<void> {
        if (new TextEncoder().encode(contenido).byteLength > MAX_SYNC_FILE_BYTES) {
            throw new Error('El archivo de sincronización supera el límite de 64 MiB.');
        }
        if (await this.esAndroid()) {
            await invoke('plugin:sincronizacion-nativo|writeSyncFile', {
                uri: uriOPath,
                content: contenido,
                expectedVersion: versionCompartidaEsperada ?? null,
                expectedDigest: huellaCompartidaEsperada ?? null,
                pairingCode: codigoVinculacion
            });
            return;
        }
        await invoke('escribir_archivo_sync', {
            contenido,
            permitirSobrescritura,
            versionCompartidaEsperada: versionCompartidaEsperada ?? null,
            huellaCompartidaEsperada: huellaCompartidaEsperada ?? null
        });
    }

    static async leerArchivo(uriOPath: string): Promise<string> {
        const content = await this.esAndroid()
            ? (await invoke<{ content: string }>('plugin:sincronizacion-nativo|readSyncFile', { uri: uriOPath })).content
            : await invoke<string>('leer_archivo_sync');
        if (new TextEncoder().encode(content).byteLength > MAX_SYNC_FILE_BYTES) {
            throw new Error('El archivo de sincronización supera el límite de 64 MiB.');
        }
        return content;
    }

    static async guardarCodigoSync(pairingCode: string): Promise<void> {
        if (await this.esAndroid()) {
            await invoke('plugin:sincronizacion-nativo|saveSyncKey', { pairingCode });
            return;
        }
        await invoke<string>('guardar_codigo_sync', { codigo: pairingCode });
    }

    static async obtenerCodigoSync(fileId: string): Promise<string | null> {
        if (await this.esAndroid()) {
            const result = await invoke<{ pairingCode?: string }>(
                'plugin:sincronizacion-nativo|getSyncKey',
                { fileId }
            );
            return result.pairingCode ?? null;
        }
        return await invoke<string | null>('obtener_codigo_sync', { fileId });
    }
}
