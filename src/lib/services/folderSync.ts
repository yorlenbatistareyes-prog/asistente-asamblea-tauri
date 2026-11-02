import { invoke } from '@tauri-apps/api/core';
import { PuenteAlmacenamiento } from '$lib/services/puenteAlmacenamiento';

export interface SyncFileInfo {
    format_version: number;
    file_id: string;
    version: number;
    digest: string;
}

export interface SyncResult extends SyncFileInfo {
    changed: boolean;
}

interface SyncCheckpoint {
    version: number;
    digest: string;
}

export class SyncConflictError extends Error {
    constructor(
        public readonly remoteVersion: number,
        public readonly localVersion: number,
        public readonly contentChanged = false
    ) {
        super(contentChanged
            ? `El contenido compartido cambió sin avanzar la versión v${remoteVersion}.`
            : `El archivo compartido está en v${remoteVersion} y este dispositivo conoce v${localVersion}.`);
        this.name = 'SyncConflictError';
    }
}

export class SyncLinkRequiredError extends Error {
    constructor(public readonly fileInfo: SyncFileInfo) {
        super('Este archivo tiene otra identidad o todavía no está vinculado. Introduce el código de seguridad para continuar.');
        this.name = 'SyncLinkRequiredError';
    }
}

async function readFile(file: string): Promise<{ content: string; info: SyncFileInfo }> {
    const content = await PuenteAlmacenamiento.leerArchivo(file);
    if (!content.trim()) {
        throw new Error('El archivo de sincronización está vacío. Crea un archivo nuevo o selecciona uno válido.');
    }
    const info = await invoke<SyncFileInfo>('inspeccionar_archivo_sync', { archivo: content });
    return { content, info };
}

async function writeFile(
    file: string,
    content: string,
    allowOverwrite: boolean,
    local: SyncCheckpoint,
    shared: SyncFileInfo,
    pairingCode: string
): Promise<void> {
    try {
        await PuenteAlmacenamiento.escribirArchivo(
            file,
            content,
            allowOverwrite,
            shared.version,
            shared.digest,
            pairingCode
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('SYNC_CONFLICT:')) {
            const latest = await readFile(file);
            throw new SyncConflictError(
                latest.info.version,
                local.version,
                latest.info.version === local.version && latest.info.digest !== local.digest
            );
        }
        throw error;
    }
}

export const FolderSync = {
    async inspect(file: string): Promise<SyncFileInfo> {
        const { content, info } = await readFile(file);
        const pairingCode = await PuenteAlmacenamiento.obtenerCodigoSync(info.file_id);
        if (!pairingCode) throw new SyncLinkRequiredError(info);
        await invoke('autenticar_codigo_sync', { archivo: content, codigo: pairingCode });
        return info;
    },

    async link(file: string, pairingCode: string): Promise<SyncFileInfo> {
        const { content } = await readFile(file);
        const info = await invoke<SyncFileInfo>('autenticar_codigo_sync', {
            archivo: content,
            codigo: pairingCode.trim()
        });
        await PuenteAlmacenamiento.guardarCodigoSync(pairingCode.trim());
        return info;
    },

    async create(file: string): Promise<{ info: SyncFileInfo; pairingCode: string }> {
        const identity = await invoke<{ file_id: string; pairing_code: string }>('nuevo_codigo_sync');
        await PuenteAlmacenamiento.guardarCodigoSync(identity.pairing_code);
        const content = await invoke<string>('exportar_snapshot_sync', {
            fileId: identity.file_id,
            version: 1,
            codigo: identity.pairing_code
        });
        const info = await invoke<SyncFileInfo>('inspeccionar_archivo_sync', {
            archivo: content
        });
        await PuenteAlmacenamiento.escribirArchivo(file, content, false, undefined, undefined, identity.pairing_code);
        await invoke('guardar_checkpoint_sync', {
            fileId: identity.file_id,
            version: 1,
            digest: info.digest
        });
        return {
            info,
            pairingCode: identity.pairing_code
        };
    },

    async sync(file: string, allowOverwrite = false): Promise<SyncResult> {
        const { content, info } = await readFile(file);
        const pairingCode = await PuenteAlmacenamiento.obtenerCodigoSync(info.file_id);
        if (!pairingCode) throw new SyncLinkRequiredError(info);
        await invoke('autenticar_codigo_sync', { archivo: content, codigo: pairingCode });

        const local = await invoke<SyncCheckpoint>('obtener_checkpoint_sync', { fileId: info.file_id });
        if (!allowOverwrite && (
            local.version !== info.version ||
            (local.digest !== '' && local.digest !== info.digest)
        )) {
            throw new SyncConflictError(
                info.version,
                local.version,
                local.version === info.version && local.digest !== info.digest
            );
        }

        const latest = await readFile(file);
        if (latest.info.file_id !== info.file_id) {
            throw new SyncLinkRequiredError(latest.info);
        }
        if (latest.info.version !== info.version || latest.info.digest !== info.digest) {
            throw new SyncConflictError(
                latest.info.version,
                local.version,
                latest.info.version === info.version && latest.info.digest !== info.digest
            );
        }

        const nextVersion = Math.max(local.version, latest.info.version) + 1;
        const nextContent = await invoke<string | null>('preparar_snapshot_si_cambio_sync', {
            fileId: info.file_id,
            version: nextVersion,
            codigo: pairingCode,
            archivoCompartido: latest.content
        });
        if (nextContent === null) {
            return { ...latest.info, changed: false };
        }
        await writeFile(file, nextContent, allowOverwrite, local, latest.info, pairingCode);
        const written = await readFile(file);
        const expected = await invoke<SyncFileInfo>('inspeccionar_archivo_sync', {
            archivo: nextContent
        });
        if (written.info.digest !== expected.digest) {
            throw new SyncConflictError(written.info.version, local.version, true);
        }
        await invoke('guardar_checkpoint_sync', {
            fileId: info.file_id,
            version: nextVersion,
            digest: expected.digest
        });
        return { ...expected, changed: true };
    },

    async restore(file: string): Promise<SyncFileInfo> {
        const { content, info } = await readFile(file);
        const pairingCode = await PuenteAlmacenamiento.obtenerCodigoSync(info.file_id);
        if (!pairingCode) throw new SyncLinkRequiredError(info);
        return await invoke<SyncFileInfo>('importar_snapshot_sync', {
            archivo: content,
            codigo: pairingCode
        });
    }
};
