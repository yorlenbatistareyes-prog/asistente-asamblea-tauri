import { invoke } from '@tauri-apps/api/core';
import { type } from '@tauri-apps/plugin-os';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, stat } from '@tauri-apps/plugin-fs';

export const NOMBRE_ARCHIVO_SYNC = 'sincronizacion_global.rassembly';

export class PuenteAlmacenamiento {
    static async esAndroid(): Promise<boolean> {
        try {
            const sistemaOperativo = await type();
            return sistemaOperativo === 'android';
        } catch {
            return false;
        }
    }

    static async seleccionarCarpeta(): Promise<string | null> {
        if (await this.esAndroid()) {
            try {
                const uri = await invoke<string>('plugin:PluginSincronizacionNativo|pickDirectory');
                return uri || null;
            } catch (e) {
                console.error('Error al elegir carpeta en Android:', e);
                return null;
            }
        }

        const seleccion = await open({ directory: true, multiple: false });
        return (seleccion as string | null) ?? null;
    }

    static obtenerRutaArchivoSync(rutaOCarpeta: string): string | null {
        if (!rutaOCarpeta) return null;
        if (rutaOCarpeta.startsWith('content://')) return null;

        const separador = rutaOCarpeta.includes('/') ? '/' : '\\';
        return `${rutaOCarpeta}${separador}${NOMBRE_ARCHIVO_SYNC}`;
    }

    static async escribirArchivo(rutaOCarpeta: string, contenido: string): Promise<void> {
        if (await this.esAndroid()) {
            await invoke('plugin:PluginSincronizacionNativo|writeSyncFile', {
                uriCarpeta: rutaOCarpeta,
                archivo: NOMBRE_ARCHIVO_SYNC,
                contenido
            });
            return;
        }

        const rutaArchivoFinal = this.obtenerRutaArchivoSync(rutaOCarpeta);
        if (!rutaArchivoFinal) throw new Error('No hay una ruta de carpeta válida para escribir el archivo de sincronización.');
        await writeTextFile(rutaArchivoFinal, contenido);
    }

    static async leerArchivo(rutaOCarpeta: string): Promise<string> {
        if (await this.esAndroid()) {
            return await invoke<string>('plugin:PluginSincronizacionNativo|readSyncFile', {
                uriCarpeta: rutaOCarpeta,
                archivo: NOMBRE_ARCHIVO_SYNC
            });
        }

        const rutaArchivoFinal = this.obtenerRutaArchivoSync(rutaOCarpeta);
        if (!rutaArchivoFinal) throw new Error('No hay una ruta de carpeta válida para leer el archivo de sincronización.');
        return await readTextFile(rutaArchivoFinal);
    }

    static async obtenerUltimaModificacion(rutaOCarpeta: string): Promise<Date | null> {
        if (await this.esAndroid()) {
            try {
                const meta = await invoke<{ mtime?: string | number } | null>('plugin:PluginSincronizacionNativo|validateDirectory', {
                    uriCarpeta: rutaOCarpeta,
                    archivo: NOMBRE_ARCHIVO_SYNC
                });

                if (!meta?.mtime) return null;
                return new Date(meta.mtime);
            } catch {
                return null;
            }
        }

        const rutaArchivoFinal = this.obtenerRutaArchivoSync(rutaOCarpeta);
        if (!rutaArchivoFinal) return null;

        try {
            const metadatos = await stat(rutaArchivoFinal);
            return metadatos.mtime ? new Date(metadatos.mtime) : null;
        } catch {
            return null;
        }
    }
}
