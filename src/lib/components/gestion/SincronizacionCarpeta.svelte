<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'; 
  import { Cloud, FolderSync, CheckCircle, AlertCircle, Info } from 'lucide-svelte';
  import Panel from '$lib/components/ui/Panel.svelte'; 

  import { DB } from '$lib/services/db';
  import { obtenerOCrearLlave } from '$lib/utils/seguridad';
  
  // 🔥 IMPORTAMOS EL ESTADO GLOBAL DE LA BARRA SUPERIOR
  import { syncStatus } from '$lib/stores/autoSyncStore';

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
      await DB.guardarRutaSync(null);
    }
  }
  
  // 🔄 FUNCIÓN DEFINITIVA DE SINCRONIZACIÓN GLOBAL ENCRIPTADA
  async function sincronizarAhora() {
    if (!rutaCarpeta) return;
    try {
      guardando = true;
      
      // 1. ENCENDEMOS EL ESTADO VISUAL ARRIBA AL EMPEZAR
      syncStatus.set({ estado: 'sincronizando', mensaje: 'Guardando manual...', nubeDispositivo: '', nubeFecha: '' });

      // 🔥 PAUSA ARTIFICIAL DE 1 SEGUNDO PARA QUE SE PUEDA LEER EL MENSAJE
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const llave = await obtenerOCrearLlave();

      const paqueteCifrado = await invoke<string>('exportar_db_encriptada_global', {
        llaveBase64: llave
      });

      const separador = rutaCarpeta.includes('/') ? '/' : '\\';
      const rutaArchivoFinal = `${rutaCarpeta}${separador}sincronizacion_global.rassembly`;

      await writeTextFile(rutaArchivoFinal, paqueteCifrado);

      console.log("📦 Archivo cifrado guardado en:", rutaArchivoFinal);
      
      // 🔥 2. CAMBIAMOS EL ESTADO A ÉXITO EN LA BARRA SUPERIOR (Sin alertas invasivas)
      syncStatus.set({ estado: 'al_dia', mensaje: '¡Carpeta sincronizada!', nubeDispositivo: '', nubeFecha: '' });

      // 🔥 3. OCULTAMOS EL MENSAJE TRAS 3 SEGUNDOS
      setTimeout(() => {
          syncStatus.set({ estado: 'inactivo', mensaje: '', nubeDispositivo: '', nubeFecha: '' });
      }, 3000);

    } catch (error) {
      console.error("Error al sincronizar y guardar:", error);
      
      // 🔥 4. MOSTRAMOS EL ERROR EN LA BARRA SUPERIOR
      syncStatus.set({ estado: 'error', mensaje: 'Error al guardar', nubeDispositivo: '', nubeFecha: '' });
      setTimeout(() => {
          syncStatus.set({ estado: 'inactivo', mensaje: '', nubeDispositivo: '', nubeFecha: '' });
      }, 4000);
    } finally {
      guardando = false;
    }
  }

  async function importarSincronizacion() {
    if (!rutaCarpeta) return;
    if (!confirm("⚠️ ¿Restaurar datos desde la nube? Esto sobrescribirá la base de datos actual con la versión más reciente del equipo principal.")) return;
    
    try {
      guardando = true;
      const separador = rutaCarpeta.includes('/') ? '/' : '\\';
      const rutaArchivoFinal = `${rutaCarpeta}${separador}sincronizacion_global.rassembly`;

      const paqueteCifrado = await readTextFile(rutaArchivoFinal);
      const llave = await obtenerOCrearLlave();

      await invoke('importar_db_encriptada_global', {
        paqueteBase64: paqueteCifrado,
        llaveBase64: llave
      });

      alert("¡Base de datos restaurada correctamente desde la nube!");
      // Forzamos recargar la ventana para reflejar todos los datos
      window.location.reload();
    } catch (error) {
      console.error("Error al importar la sincronización:", error);
      alert("Hubo un error al leer o restaurar el archivo de sincronización.");
    } finally {
      guardando = false;
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

        <div class="acciones-sync">

             <button class="btn-sync-moderno btn-sync-primario" on:click={sincronizarAhora} disabled={!rutaCarpeta || guardando}>
                 {guardando ? 'Sincronizando...' : '🔄 Sincronizar Ahora'}
             </button>

             <button class="btn-sync-moderno btn-sync-outline" on:click={importarSincronizacion} disabled={!rutaCarpeta || guardando}>
                 📥 Restaurar Manual
             </button>
             
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

  /* Contenedor de los botones */
  .acciones-sync {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      align-items: center;
  }

  /* Estilo base para los botones modernos de sincronización */
  .btn-sync-moderno {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
      outline: none;
  }

  .btn-sync-moderno:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
  }

  /* Botón Primario (Sincronizar Ahora) - Estilo sólido elegante */
  .btn-sync-primario {
      background: #4f46e5; /* O el color primario de tu paleta (ej. var(--primary, #4f46e5)) */
      color: #ffffff;
      box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
  }

  .btn-sync-primario:hover:not(:disabled) {
      background: #4338ca;
      transform: translateY(-1px);
      box-shadow: 0 4px 6px rgba(79, 70, 229, 0.3);
  }

  /* Botón de Contorno (Restaurar Manual) - Limpio y sutil */
  .btn-sync-outline {
      background: transparent;
      color: #475569;
      border-color: #cbd5e1;
  }

  .btn-sync-outline:hover:not(:disabled) {
      background: #f1f5f9;
      color: #0f172a;
      border-color: #94a3b8;
      transform: translateY(-1px);
  }

  /* Responsive específico para este bloque */
  @media (max-width: 600px) {
      .title-with-badge { flex-direction: column; align-items: center; gap: 5px; }
      .folder-input-group { flex-direction: column; gap: 10px; }
      .folder-path { width: 100%; box-sizing: border-box; }
      .btn-sync { width: 100%; }
  }
</style>