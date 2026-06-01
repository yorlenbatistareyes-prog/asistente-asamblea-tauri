<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import { Cloud, FolderSync, CheckCircle, AlertCircle, Info } from 'lucide-svelte';
  import Panel from '$lib/components/ui/Panel.svelte'; // 👈 Importamos Panel

  import { DB } from '$lib/services/db';

  let rutaCarpeta: string | null = null;
  let guardando = false;

  onMount(async () => {
    try {
      rutaCarpeta = await invoke('obtener_ruta_sync');
    } catch (e) {
      console.log("Aún no hay ruta configurada.");
    }
  });

  async function seleccionarCarpeta() {
    try {
      const seleccion = await open({
        directory: true,
        multiple: false,
        title: "Selecciona tu carpeta de Google Drive / OneDrive"
      });

      if (seleccion) {
        guardando = true;
        rutaCarpeta = seleccion as string;
        // 🔥 USAMOS EL EMBUDO
        await DB.guardarRutaSync(rutaCarpeta);
        guardando = false;
      }
    } catch (e) {
      console.error(e);
      guardando = false;
    }
  }

 async function desvincular() {
    if (confirm("¿Desvincular esta carpeta? La app dejará de sincronizar aquí.")) {
      rutaCarpeta = null;
      // 🔥 USAMOS EL EMBUDO
      await DB.guardarRutaSync(null);
    }
  }
  
</script>

<Panel padding="20px" clasesExtra="cloud-panel sync-folder-panel">
    <div class="cloud-header">
        <div class="data-icon-wrapper purple"><FolderSync size={24} /></div>
        <div class="data-content">
            <div class="title-with-badge">
                <h3>Carpeta de Sincronización</h3>
                {#if rutaCarpeta}
                    <span class="badge connected"><CheckCircle size={12}/> Vinculado</span>
                {:else}
                    <span class="badge disconnected"><AlertCircle size={12}/> Sin vincular</span>
                {/if}
            </div>
            <p>Directorio raíz para compartir asambleas con el equipo.</p>
        </div>
    </div>

    <div class="cloud-component-wrapper">
        <div class="folder-input-group">
            <div class="folder-path" class:vacio={!rutaCarpeta}>
                <span class="path-text">{rutaCarpeta || 'Ninguna carpeta seleccionada...'}</span>
            </div>
            
            {#if !rutaCarpeta}
                <button class="btn-data-action primary btn-sync" on:click={seleccionarCarpeta} disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Elegir Carpeta'}
                </button>
            {:else}
                <button class="btn-data-action danger-outline btn-sync" on:click={desvincular}>
                    Desvincular
                </button>
            {/if}
        </div>
        
        <div class="aviso">
            <Info size={14}/> Esta carpeta servirá como puente seguro (Drive/OneDrive) entre tus dispositivos.
        </div>
    </div>
</Panel>

<style>
  /* Nota: Las clases .cloud-panel, .cloud-header, .data-icon-wrapper, .purple, 
    .data-content y .btn-data-action las hereda globalmente desde Datos.svelte.
    Aquí solo ponemos los estilos específicos de este componente. 
  */

  /* PON ESTO (Con :global y !important para forzarlo) */
  :global(.sync-folder-panel) {
      margin-bottom: 20px !important;
      max-width: 800px !important;
      width: 100% !important;
  }

  .title-with-badge {
      display: flex;
      align-items: center;
      gap: 12px;
  }

  .badge { display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .connected { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
  .disconnected { background: rgba(100, 116, 139, 0.1); color: #64748b; border: 1px solid rgba(100, 116, 139, 0.2); }

  .folder-input-group { 
      display: flex; 
      gap: 15px; 
      margin-bottom: 12px; 
      align-items: center;
  }
  
  .folder-path { 
      flex: 1; 
      display: flex; 
      align-items: center; 
      padding: 12px 15px; 
      background: var(--input-bg, #f8fafc); 
      border: 1px solid var(--border-color, #e2e8f0); 
      border-radius: 8px; 
      font-family: monospace; 
      font-size: 13px; 
      overflow: hidden; 
  }
  .path-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main); }
  .folder-path.vacio .path-text { color: var(--text-muted, #94a3b8); }

  /* Adaptación de los botones al estilo de Datos.svelte */
  .btn-sync { padding: 12px 24px; white-space: nowrap; }
  
  .danger-outline { 
      background: transparent; 
      color: #ef4444; 
      border: 1px solid #fecaca; 
  }
  .danger-outline:hover { 
      background: #fee2e2; 
      transform: translateY(-1px);
  }

  .aviso { 
      display: flex; 
      gap: 8px; 
      align-items: center; 
      font-size: 12.5px; 
      color: var(--text-secondary, #64748b); 
      background: rgba(100, 116, 139, 0.05);
      padding: 10px 15px;
      border-radius: 6px;
  }

  /* Responsive específico para este bloque */
  @media (max-width: 600px) {
      .title-with-badge { flex-direction: column; align-items: center; gap: 5px; }
      .folder-input-group { flex-direction: column; gap: 10px; }
      .folder-path { width: 100%; box-sizing: border-box; }
      .btn-sync { width: 100%; }
  }
</style>