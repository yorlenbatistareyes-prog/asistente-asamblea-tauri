<script lang="ts">
    import { invoke } from '@tauri-apps/api/core';
    import { save, open, confirm, message } from '@tauri-apps/plugin-dialog';
    import { relaunch } from '@tauri-apps/plugin-process';
    import { Upload, Download, Trash2 } from 'lucide-svelte';

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

               // Esperamos 1.5 segundos para que Rust cierre bien la conexión
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
    
    <div class="data-card">
        <div class="data-icon-wrapper blue"><Upload size={24} /></div>
        <div class="data-content">
            <h3>Respaldar Datos</h3>
            <p>Guardar copia de seguridad en un archivo.</p>
        </div>
        <button class="btn-data-action primary" on:click={respaldarDatos}>Respaldar</button>
    </div>

    <div class="data-card">
        <div class="data-icon-wrapper green"><Download size={24} /></div>
        <div class="data-content">
            <h3>Restaurar Datos</h3>
            <p>Cargar copia de seguridad desde un archivo.</p>
        </div>
        <button class="btn-data-action secondary" on:click={restaurarDatos}>Restaurar</button>
    </div>

    <div class="data-card danger-zone">
        <div class="data-icon-wrapper red"><Trash2 size={24} /></div>
        <div class="data-content">
            <h3>Limpiar Todo</h3>
            <p>Borrar toda la base de datos permanentemente.</p>
        </div>
        <button class="btn-data-action danger" on:click={limpiarBaseDatos}>Eliminar</button>
    </div>

</div>

<style>
    .data-management-container {
        display: flex;
        flex-direction: column;
        gap: 15px;
        max-width: 800px; /* Para que no se estiren demasiado */
    }

    .data-card {
        display: flex;
        align-items: center;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        padding: 20px;
        border-radius: 12px;
        gap: 20px;
        transition: transform 0.2s, box-shadow 0.2s;
    }

    .data-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px var(--shadow-color);
        border-color: var(--primary);
    }

    /* Zona de peligro visualmente distinta */
    .danger-zone {
        border-color: rgba(239, 68, 68, 0.3);
        background: rgba(239, 68, 68, 0.03);
    }
    .danger-zone:hover {
        border-color: #ef4444;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);
    }

    .data-icon-wrapper {
        width: 50px;
        height: 50px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
    .green { background: rgba(16, 185, 129, 0.1); color: #10b981; }
    .red { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

    .data-content {
        flex: 1;
    }

    .data-content h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: var(--text-main);
    }

    .data-content p {
        margin: 4px 0 0;
        font-size: 13px;
        color: var(--text-secondary);
    }

    .btn-data-action {
        padding: 10px 20px;
        border-radius: 8px;
        border: none;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
        transition: opacity 0.2s;
    }

    .btn-data-action:hover { opacity: 0.9; }

    .primary { background: var(--primary); color: white; }
    .secondary { background: var(--bg-secondary); color: var(--text-main); border: 1px solid var(--border-color); }
    .danger { background: #ef4444; color: white; }

    /* Responsive */
    @media (max-width: 600px) {
        .data-card {
            flex-direction: column;
            text-align: center;
            align-items: center;
        }
        .btn-data-action {
            width: 100%;
        }
    }
</style>