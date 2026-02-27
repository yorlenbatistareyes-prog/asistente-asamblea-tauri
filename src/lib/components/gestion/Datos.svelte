<script lang="ts">
    import { invoke } from '@tauri-apps/api/core';
    import { save, open, confirm, message } from '@tauri-apps/plugin-dialog';
    import { relaunch } from '@tauri-apps/plugin-process';
    import { Upload, Download, Trash2 } from 'lucide-svelte';
    import Panel from '$lib/components/ui/Panel.svelte';

    // --- 1. RESPALDAR DATOS (Exportar) ---
    async function respaldarDatos() {
        try {
            const ruta = await save({
                filters: [{ name: 'Respaldo SQLite', extensions: ['sqlite'] }],
                defaultPath: 'Respaldo_Asamblea.sqlite',
            });

            if (!ruta) return; // Usuario canceló

            await invoke('exportar_base_datos', { rutaDestino: ruta });
            await message('Copia de seguridad guardada con éxito.', { title: 'Éxito', kind: 'info' });
        } catch (error) {
            await message(`Error al respaldar: ${error}`, { title: 'Error', kind: 'error' });
        }
    }

    // --- 2. RESTAURAR DATOS (Importar) ---
    async function restaurarDatos() {
        const confirmado = await confirm(
            'Al restaurar un respaldo, se reemplazarán todos los datos actuales y la aplicación se reiniciará. ¿Deseas continuar?',
            { title: 'Restaurar Base de Datos', kind: 'warning' }
        );

        if (!confirmado) return;

        try {
            const ruta = await open({
                multiple: false,
                directory: false,
                filters: [{ name: 'Base de Datos SQLite', extensions: ['sqlite', 'db'] }]
            });

            if (!ruta) return;
               await invoke('importar_base_datos', { rutaOrigen: ruta });
               await message('Datos restaurados correctamente. La aplicación se reiniciará ahora.', { title: 'Éxito' });
               localStorage.clear();

               // Opcional: Cambiar el cursor a "esperando"
               document.body.style.cursor = 'wait';

               // Esperamos 5 segundos (es seguro) para que Rust cierre bien la conexión
               await new Promise(resolve => setTimeout(resolve, 5000));

               await relaunch(); // Reinicia la app

        } catch (error) {
            await message(`Error al restaurar: ${error}`, { title: 'Error', kind: 'error' });
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
    
    <Panel padding="20px" clasesExtra="data-card-override">
        <div class="data-icon-wrapper blue"><Upload size={24} /></div>
        <div class="data-content">
            <h3>Respaldar Datos</h3>
            <p>Guardar copia de seguridad en un archivo.</p>
        </div>
        <button class="btn-data-action primary" on:click={respaldarDatos}>Respaldar</button>
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

    .primary { background: var(--primary); color: white; }
    .primary:hover { opacity: 0.9; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }

    .secondary { background: #475569; color: white; }
    .secondary:hover { background: #334155; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }

    .danger { background: #ef4444; color: white; }
    .danger:hover { background: #dc2626; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }

    /* Responsive */
    @media (max-width: 600px) {
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
</style>