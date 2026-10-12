<script lang="ts">
    import { invoke } from '@tauri-apps/api/core';
    import { save, open, confirm, message } from '@tauri-apps/plugin-dialog';
    import { relaunch } from '@tauri-apps/plugin-process';
    import { Upload, Download, Trash2, Cloud, Info, Check } from 'lucide-svelte';
    import Panel from '$lib/components/ui/Panel.svelte';

    import Sincronizacion from '$lib/components/Sincronizacion.svelte';
    import { lastDeviceName } from '$lib/stores/autoSyncStore';
    
    let respaldando = false;
    let mostrarRestauracionCompleta = false;
    type RespaldoPendiente = {
        ruta: string;
        nombreArchivo: string;
        dispositivoOrigen: string;
        fecha: string | null;
    };
    let respaldoPendiente: RespaldoPendiente | null = null;
    let restaurando = false;
    
    // --- 1. RESPALDAR DATOS (Exportar) ---
    async function respaldarDatos() {
        if (respaldando) return;
        respaldando = true;
        try {
            const ahora = new Date();
            const fechaRespaldo = [
                ahora.getFullYear(),
                String(ahora.getMonth() + 1).padStart(2, '0'),
                String(ahora.getDate()).padStart(2, '0')
            ].join('-');
            const nombreDispositivo = ($lastDeviceName || 'Dispositivo')
                .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
                .trim()
                .replace(/[. ]+$/g, '') || 'Dispositivo';
            const ruta = await save({
                filters: [{ name: 'Respaldo RAssembly', extensions: ['rassembly'] }],
                defaultPath: `Respaldo_Asamblea_${nombreDispositivo}_${fechaRespaldo}.rassembly`,
            });

            if (!ruta) return; // Usuario canceló

            if (ruta.startsWith('content://')) {
                const contenidoBase64 = await invoke<string>('exportar_base_datos_base64');
                await invoke('plugin:sincronizacion-nativo|guardarContenidoBase64', {
                    uriDestino: ruta,
                    contenidoBase64
                });
            } else {
                await invoke('exportar_base_datos', { rutaDestino: ruta });
            }
            await message('Copia de seguridad guardada con éxito.', { title: 'Éxito', kind: 'info' });
        } catch (error) {
            await message(`Error al respaldar: ${error}`, { title: 'Error', kind: 'error' });
        } finally {
            respaldando = false;
        }
    }

    // --- 2. RESTAURAR DATOS (Importar) ---
    async function restaurarDatos() {
        try {
            const ruta = await open({
                multiple: false,
                directory: false,
                filters: [{ name: 'Respaldos RAssembly y SQLite', extensions: ['rassembly', 'sqlite', 'db'] }]
            });

            if (!ruta) return;

            const nombreArchivo = ruta.startsWith('content://')
                ? (await invoke<{ nombreArchivo: string }>(
                    'plugin:sincronizacion-nativo|obtenerNombreArchivo',
                    { uriArchivo: ruta }
                )).nombreArchivo
                : ruta.split(/[\\/]/).pop() || 'Respaldo seleccionado';
            const nombreSinExtension = nombreArchivo.replace(/\.(rassembly|sqlite|db)$/i, '');
            const formatoRespaldo = nombreSinExtension.match(/^Respaldo_Asamblea_(.+)_(\d{4}-\d{2}-\d{2})$/i);
            const fecha = formatoRespaldo?.[2] ?? null;
            const dispositivoOrigen = formatoRespaldo?.[1] ?? 'Dispositivo no identificado';

            respaldoPendiente = { ruta, nombreArchivo, dispositivoOrigen, fecha };

        } catch (error) {
            // Extractor de errores reales
            let detalle = error;
            if (error instanceof Error) {
                detalle = error.message;
            } else if (typeof error === 'object') {
                detalle = JSON.stringify(error, null, 2);
            }
            await message(`Error detallado:\n${detalle}`, { title: 'Error', kind: 'error' });
        }
    }

    function cancelarRestauracion() {
        if (!restaurando) respaldoPendiente = null;
    }

    async function confirmarRestauracion() {
        if (!respaldoPendiente || restaurando) return;
        restaurando = true;

        try {
            if (respaldoPendiente.ruta.startsWith('content://')) {
                const { contenidoBase64 } = await invoke<{ contenidoBase64: string }>(
                    'plugin:sincronizacion-nativo|leerContenidoBase64',
                    { uriArchivo: respaldoPendiente.ruta }
                );
                await invoke('importar_base_datos_base64', { contenidoBase64 });
                await invoke('aplicar_restauracion_binaria_pendiente');
            } else {
                await invoke('importar_base_datos', { rutaOrigen: respaldoPendiente.ruta });
            }

            respaldoPendiente = null;
            mostrarRestauracionCompleta = true;
        } catch (error) {
            let detalle = error;
            if (error instanceof Error) {
                detalle = error.message;
            } else if (typeof error === 'object') {
                detalle = JSON.stringify(error, null, 2);
            }
            await message(`Error detallado:\n${detalle}`, { title: 'Error', kind: 'error' });
        } finally {
            restaurando = false;
        }
    }

    async function cerrarAvisoRestauracion() {
        mostrarRestauracionCompleta = false;
        localStorage.clear();
        document.body.style.cursor = 'wait';

        try {
            if (!/android/i.test(navigator.userAgent)) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            if (/android/i.test(navigator.userAgent)) {
                window.location.reload();
            } else {
                await relaunch();
            }
        } catch (error) {
            document.body.style.cursor = '';
            await message(`No se pudo reiniciar la aplicación: ${error}`, { title: 'Error', kind: 'error' });
        }
    }

    // --- 3. LIMPIAR TODO (Eliminar) ---
    async function limpiarBaseDatos() {
        const confirmacion1 = await confirm(
            '¿Estás seguro de que quieres BORRAR TODOS LOS DATOS?\nEsto eliminará Asambleas, Personas, Congregaciones y Programas.\n\nEsta acción no se puede deshacer.',
            { title: 'PELIGRO - Borrar Todo', kind: 'error' }
        );

        if (!confirmacion1) return;

        const confirmacion2 = await confirm(
            'Última advertencia: Se van a eliminar todos los registros permanentemente.',
            { title: 'Confirmar Eliminación', kind: 'error' }
        );

        if (!confirmacion2) return;

        try {
            await invoke('limpiar_datos');
            await message('La base de datos ha sido vaciada correctamente.', { title: 'Limpieza Completada' });
            window.location.reload(); // Recargamos para limpiar la pantalla
        } catch (error) {
            await message(`Error al limpiar: ${error}`, { title: 'Error', kind: 'error' });
        }
    }
</script>

<div class="data-management-container">

    <div class="section-divider">
        <span class="divider-text">Sincronización Automática en la Nube</span>
    </div>

    <Panel padding="20px" clasesExtra="cloud-panel">
        <div class="cloud-header">
            <div class="data-icon-wrapper purple"><Cloud size={24} /></div>
            <div class="data-content">
                <h3>Cuenta de Sincronización</h3>
                <p>Mantén tus asambleas seguras y actualizadas en la nube.</p>
            </div>
        </div>
        
        <div class="cloud-component-wrapper">
            <Sincronizacion />
        </div>
    </Panel>

    <div class="section-divider mt-4">
        <span class="divider-text">Respaldos Locales (Solo este dispositivo)</span>
    </div>

    <Panel padding="20px" clasesExtra="data-card-override">
        <div class="data-icon-wrapper blue"><Upload size={24} /></div>
        <div class="data-content">
            <h3>Respaldar Datos</h3>
            <p>Guardar copia de seguridad en un archivo.</p>
        </div>
        <button class="btn-data-action primary" on:click={respaldarDatos} disabled={respaldando}>
            {respaldando ? 'Guardando...' : 'Respaldar'}
        </button>
    </Panel>

    <Panel padding="20px" clasesExtra="data-card-override">
        <div class="data-icon-wrapper green"><Download size={24} /></div>
        <div class="data-content">
            <h3>Restaurar Datos</h3>
            <p>Cargar copia de seguridad desde un archivo.</p>
        </div>
        <button class="btn-data-action secondary" on:click={restaurarDatos}>Restaurar</button>
    </Panel>

    <Panel padding="20px" clasesExtra="data-card-override danger-zone">
        <div class="data-icon-wrapper red"><Trash2 size={24} /></div>
        <div class="data-content">
            <h3>Limpiar Todo</h3>
            <p>Borrar toda la base de datos permanentemente.</p>
        </div>
        <button class="btn-data-action danger" on:click={limpiarBaseDatos}>Eliminar</button>
    </Panel>

</div>

{#if respaldoPendiente}
    <div class="restauracion-confirmacion-backdrop" role="presentation" on:click|self={cancelarRestauracion}>
        <div class="restauracion-confirmacion-modal" role="dialog" aria-modal="true" aria-labelledby="restauracion-confirmacion-titulo" tabindex="-1">
            <h2 id="restauracion-confirmacion-titulo">Restaurar copia de seguridad</h2>
            <p>Esta acción reemplazará la base de datos de este dispositivo por el contenido de la copia seleccionada.</p>

            <div class="restauracion-origenes">
                <div class="restauracion-origen">
                    <strong title={respaldoPendiente.dispositivoOrigen}>{respaldoPendiente.dispositivoOrigen}</strong>
                    <span title={respaldoPendiente.nombreArchivo}>{respaldoPendiente.nombreArchivo}</span>
                    <span>{respaldoPendiente.fecha ? `Fecha del respaldo: ${respaldoPendiente.fecha}` : 'Fecha no disponible'}</span>
                </div>
                <span class="restauracion-flecha" aria-hidden="true">→</span>
                <div class="restauracion-origen">
                    <strong>{$lastDeviceName}</strong>
                    <span>Este dispositivo</span>
                </div>
            </div>

            <div class="restauracion-confirmacion-botones">
                <button class="restauracion-boton" on:click={confirmarRestauracion} disabled={restaurando}>
                    {restaurando ? 'Restaurando...' : 'Restaurar'}
                </button>
                <button class="restauracion-boton" on:click={cancelarRestauracion} disabled={restaurando}>Cancelar</button>
            </div>
        </div>
    </div>
{/if}

{#if mostrarRestauracionCompleta}
    <div class="restauracion-exito-backdrop" role="presentation">
        <div class="restauracion-exito-modal" role="dialog" aria-modal="true" aria-labelledby="restauracion-exito-titulo" tabindex="-1">
            <h2 id="restauracion-exito-titulo">Se ha restaurado correctamente</h2>
            <Check size={100} class="restauracion-exito-check" aria-hidden="true" />
            <button class="restauracion-exito-cerrar" on:click={cerrarAvisoRestauracion}>Cerrar</button>
        </div>
    </div>
{/if}

<style>.data-management-container {
        display: flex;
        flex-direction: column;
        gap: 20px; /* Un poco más de espacio para que respiren los paneles */
        max-width: 800px;
    }

    /* --- TARJETAS (Heredando el Panel) --- */
    :global(.data-card-override) {
        display: flex !important;
        align-items: center !important;
        gap: 20px !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        /* Sombra base visible para que parezcan paneles reales */
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.05) !important;
    }

    :global(.data-card-override:hover) {
        transform: translateY(-4px) !important;
        /* Sombra fuerte de elevación */
        box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.15), 0 6px 12px -2px rgba(0, 0, 0, 0.1) !important;
        border-color: var(--primary) !important;
    }

    /* Zona de peligro visualmente distinta */
    :global(.danger-zone) {
        border-color: rgba(239, 68, 68, 0.4) !important;
        background: rgba(239, 68, 68, 0.03) !important;
    }
    :global(.danger-zone:hover) {
        border-color: #ef4444 !important;
        box-shadow: 0 12px 24px -4px rgba(239, 68, 68, 0.2), 0 6px 12px -2px rgba(239, 68, 68, 0.1) !important;
    }

    /* --- ÍCONOS Y CONTENIDO --- */
    .data-icon-wrapper {
        width: 55px;
        height: 55px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    .green { background: rgba(16, 185, 129, 0.15); color: #10b981; }
    .red { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

    .data-content { flex: 1; }
    .data-content h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main); }
    .data-content p { margin: 4px 0 0; font-size: 13px; color: var(--text-secondary); line-height: 1.4; }

    /* --- BOTONES DE ACCIÓN --- */
    .btn-data-action {
        padding: 10px 24px;
        border-radius: 8px;
        border: none;
        font-weight: 600;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
    }

    .btn-data-action:hover { transform: translateY(-1px); }

    .restauracion-confirmacion-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(2px);
    }

    .restauracion-confirmacion-modal {
        width: min(540px, 100%);
        padding: 24px;
        border-radius: 10px;
        background: var(--bg-card, #fff);
        color: var(--text-main, #222);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3);
    }

    .restauracion-confirmacion-modal h2 {
        margin: 0 0 14px;
        font-size: 1.25rem;
        font-weight: 600;
    }

    .restauracion-confirmacion-modal > p {
        margin: 0 0 20px;
        color: var(--text-secondary);
        line-height: 1.5;
    }

    .restauracion-origenes {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        margin: 20px 0 24px;
    }

    .restauracion-origen {
        display: flex;
        min-width: 0;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        text-align: center;
    }

    .restauracion-origen strong,
    .restauracion-origen span {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .restauracion-origen span {
        color: var(--text-secondary);
        font-size: 0.85rem;
    }

    .restauracion-flecha {
        color: var(--text-main);
        font-size: 1.7rem;
    }

    .restauracion-confirmacion-botones {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
    }

    .restauracion-boton {
        min-height: 42px;
        padding: 9px 14px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg-card);
        color: var(--text-main);
        font: inherit;
        cursor: pointer;
    }

    .restauracion-boton:disabled {
        opacity: 0.6;
        cursor: wait;
    }

    .restauracion-exito-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(2px);
    }

    .restauracion-exito-modal {
        display: flex;
        width: min(360px, 100%);
        flex-direction: column;
        align-items: center;
        gap: 22px;
        padding: 28px 24px;
        border-radius: 10px;
        background: var(--bg-card, #fff);
        color: var(--text-main, #222);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3);
        text-align: center;
    }

    .restauracion-exito-modal h2 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 500;
    }

    .restauracion-exito-check {
        color: #65439a;
        stroke-width: 2.6;
    }

    .restauracion-exito-cerrar {
        width: min(180px, 100%);
        min-height: 42px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg-app);
        color: var(--text-main);
        font: inherit;
        cursor: pointer;
    }

    @media (max-width: 480px) {
        .restauracion-confirmacion-modal { padding: 20px 16px; }
        .restauracion-origenes { gap: 7px; }
        .restauracion-origen { font-size: 0.88rem; }
        .restauracion-confirmacion-botones { grid-template-columns: 1fr; }
    }

    .primary { background: var(--primary); color: white; }
    .primary:hover { opacity: 0.9; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }

    .secondary { background: #475569; color: white; }
    .secondary:hover { background: #334155; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }

    .danger { background: #ef4444; color: white; }
    .danger:hover { background: #dc2626; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }

    /* Responsive */
    @media (max-width: 600px) {
        .cloud-header { flex-direction: column; text-align: center; }
        :global(.data-card-override) {
            flex-direction: column !important;
            text-align: center !important;
            align-items: center !important;
        }
        .btn-data-action { width: 100%; }
    }

    /* =========================================================
   DISEÑO RESPONSIVO (GESTIÓN DE DATOS: WINDOWS + ANDROID)
   ========================================================= */

@media (max-width: 768px) {
    /* 1. MÁRGENES DEL CONTENEDOR */
    .data-management-container {
        padding: 10px;
        max-width: 100%;
        gap: 15px;
    }

    /* 2. TRANSFORMACIÓN DE LAS TARJETAS (Heredando el Panel) */
    :global(.data-card-override) {
        flex-direction: column !important; /* Icono arriba, texto medio, botón abajo */
        text-align: center !important;
        align-items: center !important;
        padding: 25px 20px !important;
        gap: 15px !important;
    }

    /* 3. AJUSTES DE CONTENIDO */
    .data-icon-wrapper {
        width: 65px; /* Iconos un poco más grandes para que luzcan */
        height: 65px;
        margin-bottom: 5px;
    }

    .data-content h3 {
        font-size: 18px; /* Título más destacado */
    }

    .data-content p {
        font-size: 14px;
        margin-bottom: 10px;
    }

    /* 4. BOTONES DE ACCIÓN "FINGER-FRIENDLY" */
    .btn-data-action {
        width: 100%; /* Botón gordo que ocupa todo el ancho */
        height: 50px;
        font-size: 16px;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 10px;
    }

    /* 5. SEPARACIÓN EXTRA PARA LA ZONA DE PELIGRO */
    :global(.danger-zone) {
        margin-top: 20px;
        border-top: 2px dashed #ef4444 !important; /* Un aviso visual extra */
    }
}

/* --- ESTILOS NUEVOS PARA LA NUBE --- */
    .section-divider {
        display: flex;
        align-items: center;
        text-align: center;
        margin-top: 10px;
        margin-bottom: 5px;
    }
    .section-divider::before,
    .section-divider::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
    }
    .section-divider:not(:empty)::before { margin-right: 15px; }
    .section-divider:not(:empty)::after { margin-left: 15px; }
    .divider-text {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text-muted, #64748b);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .mt-4 { margin-top: 30px; }

    :global(.cloud-panel) {
        display: flex;
        flex-direction: column;
        gap: 20px;
        border: 1px solid rgba(139, 92, 246, 0.3) !important;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.05) !important;
    }
    .cloud-header {
        display: flex;
        align-items: center;
        gap: 15px;
        padding-bottom: 15px;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
    }
    .cloud-component-wrapper { width: 100%; }
    .purple { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }

.info-card-metodos {
        background: var(--bg-card, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);
        margin-top: 5px;
    }

    .info-card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
        color: var(--primary, #3b82f6);
    }

    .info-card-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        color: var(--text-main, #111827);
    }

    .info-card-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .item-metodo {
        font-size: 13px;
        color: var(--text-secondary, #4b5563);
        line-height: 1.4;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .badge-nube { color: #8b5cf6; font-weight: 700; font-size: 12px; }
    .badge-drive { color: #3b82f6; font-weight: 700; font-size: 12px; }
    .badge-manual { color: #10b981; font-weight: 700; font-size: 12px; }

</style>