<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import { Cloud, FolderSync, CheckCircle, AlertCircle, Info } from 'lucide-svelte';

  let rutaCarpeta: string | null = null;
  let guardando = false;

  onMount(async () => {
    try {
      // Pedimos a Rust la ruta guardada
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
        // Guardamos la ruta en la base de datos o config global
        await invoke('guardar_ruta_sync', { ruta: rutaCarpeta });
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
      await invoke('guardar_ruta_sync', { ruta: null });
    }
  }
</script>

<div class="sync-card">
  <div class="sync-header">
    <div class="sync-title">
      <div class="icon-box"><Cloud size={24} color="var(--primary)"/></div>
      <div>
        <h3>Carpeta de Sincronización</h3>
        <p>Directorio raíz para compartir asambleas (Drive/OneDrive).</p>
      </div>
    </div>
    <div class="sync-status">
      {#if rutaCarpeta}
        <span class="badge connected"><CheckCircle size={14}/> Vinculado</span>
      {:else}
        <span class="badge disconnected"><AlertCircle size={14}/> Sin vincular</span>
      {/if}
    </div>
  </div>

  <div class="sync-body">
    <div class="folder-input-group">
      <div class="folder-path" class:vacio={!rutaCarpeta}>
        <FolderSync size={18} color="var(--text-secondary)"/>
        <span>{rutaCarpeta || 'Ninguna carpeta seleccionada...'}</span>
      </div>
      {#if !rutaCarpeta}
        <button class="btn-seleccionar" on:click={seleccionarCarpeta} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Elegir Carpeta'}
        </button>
      {:else}
        <button class="btn-desvincular" on:click={desvincular}>Desvincular</button>
      {/if}
    </div>
    <div class="aviso">
      <Info size={14}/> Esta carpeta servirá como puente seguro entre tus dispositivos y los hermanos colaboradores.
    </div>
  </div>
</div>

<style>
  .sync-card { background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; margin-bottom: 20px; }
  .sync-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--border, #e2e8f0); background: #f8fafc; }
  .sync-title { display: flex; gap: 15px; align-items: center; }
  .icon-box { width: 40px; height: 40px; background: #eff6ff; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
  .sync-title h3 { margin: 0; font-size: 16px; color: var(--text-main, #0f172a); }
  .sync-title p { margin: 4px 0 0 0; font-size: 13px; color: var(--text-secondary, #64748b); }
  .badge { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .connected { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
  .disconnected { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
  .sync-body { padding: 20px; }
  .folder-input-group { display: flex; gap: 10px; margin-bottom: 15px; }
  .folder-path { flex: 1; display: flex; align-items: center; gap: 10px; padding: 10px 15px; background: #f8fafc; border: 1px solid var(--border, #e2e8f0); border-radius: 8px; font-family: monospace; font-size: 13px; overflow: hidden; }
  .folder-path span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .folder-path.vacio { color: #94a3b8; }
  .btn-seleccionar { background: var(--primary, #2563eb); color: white; border: none; padding: 0 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap; }
  .btn-seleccionar:hover { filter: brightness(0.9); }
  .btn-desvincular { background: white; color: #ef4444; border: 1px solid #fecaca; padding: 0 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; }
  .btn-desvincular:hover { background: #fee2e2; }
  .aviso { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--text-secondary, #64748b); }
</style>