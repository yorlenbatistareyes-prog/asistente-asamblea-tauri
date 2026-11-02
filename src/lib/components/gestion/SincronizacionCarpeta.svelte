<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { FolderSync, CheckCircle, AlertCircle, Info, Copy, Check } from 'lucide-svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  import { PuenteAlmacenamiento } from '$lib/services/puenteAlmacenamiento';
  import {
    FolderSync as FolderSyncService,
    SyncConflictError,
    SyncLinkRequiredError,
    type SyncFileInfo
  } from '$lib/services/folderSync';
  import {
    guardandoMetadatosInternos,
    setCandadoSincronizacion,
    syncStatus
  } from '$lib/stores/autoSyncStore';

  let rutaArchivo: string | null = null;
  let guardando = false;
  let estadoArchivo: 'inactivo' | 'esperando' | 'sincronizando' | 'al_dia' | 'conflicto' | 'vinculacion' | 'error' = 'inactivo';
  let mensaje = '';
  let infoArchivo: SyncFileInfo | null = null;
  let codigoVinculacion = '';
  let codigoNuevo = '';
  let codigoCopiado = false;
  let errorCopia = '';
  let versionLocal = 0;

  function normalizarCodigoVinculacion(valor: string) {
    return valor.replace(/[\s-]+/g, '').trim();
  }

  function formatearCodigoVinculacion(valor: string) {
    const limpio = normalizarCodigoVinculacion(valor);
    return limpio.match(/.{1,8}/g)?.join(' ') || limpio;
  }

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(normalizarCodigoVinculacion(codigoNuevo));
      codigoCopiado = true;
      errorCopia = '';
    } catch (error) {
      codigoCopiado = false;
      errorCopia = error instanceof Error
        ? `No se pudo copiar el código: ${error.message}`
        : 'No se pudo copiar el código. Selecciónalo y cópialo manualmente.';
    }
  }

  onMount(async () => {
    try {
      rutaArchivo = await invoke<string | null>('obtener_archivo_sync');
      if (rutaArchivo) await revisarArchivo();
    } catch (error) {
      mostrarError(error);
    }
  });

  async function guardarRuta(path: string) {
    await invoke('guardar_archivo_sync', { archivo: path });
    rutaArchivo = path;
    codigoNuevo = '';
    codigoVinculacion = '';
    await revisarArchivo();
  }

  async function seleccionarArchivo() {
    guardando = true;
    try {
      const path = await PuenteAlmacenamiento.seleccionarArchivo();
      if (path) await guardarRuta(path);
    } catch (error) {
      mostrarError(error);
    } finally {
      guardando = false;
    }
  }

  async function crearArchivo() {
    guardando = true;
    try {
      const path = await PuenteAlmacenamiento.crearArchivo();
      if (!path) return;
      await invoke('guardar_archivo_sync', { archivo: path });
      rutaArchivo = path;
      const created = await FolderSyncService.create(path);
      infoArchivo = created.info;
      codigoNuevo = created.pairingCode;
      codigoCopiado = false;
      errorCopia = '';
      versionLocal = created.info.version;
      estadoArchivo = 'al_dia';
      mensaje = 'Archivo creado y primera versión cifrada guardada (v1). Transfiere el código por un canal seguro.';
    } catch (error) {
      mostrarError(error);
    } finally {
      guardando = false;
    }
  }

  async function revisarArchivo() {
    if (!rutaArchivo) return;
    estadoArchivo = 'esperando';
    mensaje = 'Comprobando archivo y vínculo...';
    try {
      infoArchivo = await FolderSyncService.inspect(rutaArchivo);
      const local = await invoke<{ version: number; digest: string }>('obtener_checkpoint_sync', {
        fileId: infoArchivo.file_id
      });
      versionLocal = local.version;
      if (versionLocal !== infoArchivo.version || local.digest !== infoArchivo.digest) {
        mostrarError(new SyncConflictError(
          infoArchivo.version,
          versionLocal,
          versionLocal === infoArchivo.version && local.digest !== infoArchivo.digest
        ));
      } else {
        estadoArchivo = 'al_dia';
        mensaje = `Archivo vinculado y actualizado (v${infoArchivo.version}).`;
      }
    } catch (error) {
      if (error instanceof SyncLinkRequiredError) {
        infoArchivo = error.fileInfo;
        const local = await invoke<{ version: number; digest: string }>('obtener_checkpoint_sync', {
          fileId: error.fileInfo.file_id
        });
        versionLocal = local.version;
        estadoArchivo = 'vinculacion';
        mensaje = error.message;
      } else {
        mostrarError(error);
      }
    }
  }

  async function vincularArchivo() {
    const codigoNormalizado = normalizarCodigoVinculacion(codigoVinculacion);
    if (!rutaArchivo || !codigoNormalizado) return;
    guardando = true;
    try {
      infoArchivo = await FolderSyncService.link(rutaArchivo, codigoNormalizado);
      codigoVinculacion = '';
      await revisarArchivo();
    } catch (error) {
      mostrarError(error);
    } finally {
      guardando = false;
    }
  }

  async function sincronizarAhora() {
    if (!rutaArchivo) return;
    guardando = true;
    estadoArchivo = 'sincronizando';
    syncStatus.set({ estado: 'sincronizando', mensaje: 'Sincronizando archivo compartido...', nubeDispositivo: '', nubeFecha: '' });
    try {
      const resultado = await FolderSyncService.sync(rutaArchivo);
      infoArchivo = resultado;
      versionLocal = infoArchivo.version;
      estadoArchivo = 'al_dia';
      mensaje = resultado.changed
        ? `Sincronización completada (v${infoArchivo.version}).`
        : `No hay cambios locales. El archivo compartido permanece en v${infoArchivo.version}.`;
      codigoNuevo = '';
      syncStatus.set({ estado: 'al_dia', mensaje: 'Archivo sincronizado', nubeDispositivo: '', nubeFecha: '' });
    } catch (error) {
      mostrarError(error);
    } finally {
      guardando = false;
    }
  }

  async function restaurarArchivo() {
    if (!rutaArchivo) return;
    if (!confirm('¿Restaurar la base de datos desde el archivo compartido? Se reemplazarán los datos locales.')) return;
    guardando = true;
    const candadoYaActivo = guardandoMetadatosInternos;
    try {
      setCandadoSincronizacion(true);
      try {
        infoArchivo = await FolderSyncService.restore(rutaArchivo);
      } finally {
        setCandadoSincronizacion(candadoYaActivo);
      }
      versionLocal = infoArchivo.version;
      alert(`Restauración completada desde la versión ${infoArchivo.version}.`);
      window.location.reload();
    } catch (error) {
      mostrarError(error);
    } finally {
      guardando = false;
    }
  }

  async function sobrescribirArchivo() {
    if (!rutaArchivo) return;
    if (!confirm('El archivo compartido será reemplazado por una nueva versión de la base local. ¿Confirmas la sobrescritura?')) return;
    guardando = true;
    estadoArchivo = 'sincronizando';
    try {
      const resultado = await FolderSyncService.sync(rutaArchivo, true);
      infoArchivo = resultado;
      versionLocal = infoArchivo.version;
      estadoArchivo = 'al_dia';
      mensaje = resultado.changed
        ? `Sobrescritura confirmada. Archivo actualizado a v${infoArchivo.version}.`
        : `No había cambios locales; el archivo compartido permanece en v${infoArchivo.version}.`;
      syncStatus.set({ estado: 'al_dia', mensaje: 'Archivo sobrescrito con confirmación', nubeDispositivo: '', nubeFecha: '' });
    } catch (error) {
      mostrarError(error);
    } finally {
      guardando = false;
    }
  }

  async function desvincular() {
<<<<<<< HEAD
    if (confirm("¿Desvincular esta carpeta? La app dejará de sincronizar aquí.")) {
      rutaCarpeta = null;
      await DB.guardarRutaSync(null);
    }
  }
  
  // 🔄 FUNCIÓN DEFINITIVA DE SINCRONIZACIÓN GLOBAL ENCRIPTADA
  async function sincronizarAhora() {
    if (!rutaCarpeta) return;
    let candadoActivo = false;
    try {
      guardando = true;
      
      // 1. ENCENDEMOS EL ESTADO VISUAL ARRIBA AL EMPEZAR
      syncStatus.set({ estado: 'sincronizando', mensaje: 'Guardando manual...', nubeDispositivo: '', nubeFecha: '' });

      // 🔥 PAUSA ARTIFICIAL DE 1 SEGUNDO PARA QUE SE PUEDA LEER EL MENSAJE
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const llave = await obtenerOCrearLlave();

      const paqueteCifrado = await invoke<string>('exportar_db_binaria_encriptada', {
        llaveBase64: llave
      });

      setCandadoSincronizacion(true);
      candadoActivo = true;
      await PuenteAlmacenamiento.escribirArchivo(rutaCarpeta, paqueteCifrado);
      
      // 🔥 ESTO FALTABA: Leer la fecha recién guardada para matar el eco
      try {
          const metadatos = await PuenteAlmacenamiento.obtenerUltimaModificacion(rutaCarpeta);
          if (metadatos) {
              await DbSyncHelper.actualizarFechaSincronizacion(metadatos.toISOString());
          }
      } catch (e) {
          console.error("Fallo al actualizar fecha tras escribir:", e);
      }
      
      // 🔥 QUITAMOS EL CANDADO DESPUÉS DE 2 SEGUNDOS
      setTimeout(() => {
          setCandadoSincronizacion(false);
      }, 2000);
      candadoActivo = false;

      console.log("📦 Archivo cifrado guardado correctamente.");
      
      // 🔥 2. CAMBIAMOS EL ESTADO A ÉXITO EN LA BARRA SUPERIOR
      syncStatus.set({ estado: 'al_dia', mensaje: '¡Carpeta sincronizada!', nubeDispositivo: '', nubeFecha: '' });

      // 🔥 3. OCULTAMOS EL MENSAJE TRAS 3 SEGUNDOS
      setTimeout(() => {
          syncStatus.set({ estado: 'inactivo', mensaje: '', nubeDispositivo: '', nubeFecha: '' });
      }, 3000);

    } catch (error) {
      console.error("Error al sincronizar y guardar:", error);
      if (candadoActivo) setCandadoSincronizacion(false);
      const detalle = error instanceof Error ? error.message : String(error);
      
      syncStatus.set({ estado: 'error', mensaje: `Error al guardar: ${detalle}`, nubeDispositivo: '', nubeFecha: '' });
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
      const paqueteCifrado = await PuenteAlmacenamiento.leerArchivo(rutaCarpeta);
      const llave = await obtenerOCrearLlave();

      if (paqueteCifrado.startsWith('RASSEMBLY2:')) {
        await invoke('importar_db_binaria_encriptada', {
          paqueteBase64: paqueteCifrado,
          llaveBase64: llave
        });
      } else {
        await invoke('importar_db_encriptada_global', {
          paqueteBase64: paqueteCifrado,
          llaveBase64: llave
        });
      }

      try {
          const metadatos = await PuenteAlmacenamiento.obtenerUltimaModificacion(rutaCarpeta);
          if (metadatos) {
              const fechaNube = metadatos.toISOString();
              await DbSyncHelper.actualizarFechaSincronizacion(fechaNube);
          }
      } catch (e) {
          console.error("Fallo al actualizar fecha tras importar:", e);
      }

      alert("✅ Datos restaurados. La aplicación se reiniciará para aplicar los cambios.");
      document.body.style.cursor = 'wait';

      // La restauración binaria se instala al arrancar, sin emitir un evento de guardado.
      await relaunch();
      
    } catch (error) {
      console.error("Error al importar la sincronización:", error);
      alert(`Hubo un error al leer o restaurar el archivo de sincronización: ${error}`);
    } finally {
      guardando = false;
    }
}

=======
    if (!confirm('¿Dejar de usar este archivo en este dispositivo? El archivo compartido no se eliminará.')) return;
    try {
      await invoke('guardar_archivo_sync', { archivo: null });
      rutaArchivo = null;
      infoArchivo = null;
      codigoNuevo = '';
      codigoVinculacion = '';
      estadoArchivo = 'inactivo';
      mensaje = '';
    } catch (error) {
      mostrarError(error);
    }
  }

  function mostrarError(error: unknown) {
    if (error instanceof SyncConflictError) {
      estadoArchivo = 'conflicto';
      mensaje = `${error.message} Restaura la versión compartida o confirma una sobrescritura.`;
      syncStatus.set({
        estado: 'conflicto',
        mensaje: error.message,
        nubeDispositivo: 'Archivo compartido',
        nubeFecha: ''
      });
      return;
    }
    if (error instanceof SyncLinkRequiredError) {
      infoArchivo = error.fileInfo;
      estadoArchivo = 'vinculacion';
      mensaje = error.message;
      return;
    }
    const text = error instanceof Error ? error.message : String(error);
    estadoArchivo = 'error';
    mensaje = text || 'No se pudo completar la operación de sincronización.';
    syncStatus.set({ estado: 'error', mensaje: 'Error en archivo compartido', nubeDispositivo: '', nubeFecha: '' });
  }
>>>>>>> main
</script>

<Panel padding="20px" clasesExtra="cloud-panel sync-folder-panel">
  <div class="cloud-header">
    <div class="data-icon-wrapper purple"><FolderSync size={24} /></div>
    <div class="data-content">
      <div class="title-with-badge">
        <h3>Sincronización por archivo</h3>
        {#if estadoArchivo === 'al_dia'}
          <span class="badge connected"><CheckCircle size={12} /> Vinculado</span>
        {:else if rutaArchivo}
          <span class="badge disconnected"><AlertCircle size={12} /> {estadoArchivo === 'vinculacion' ? 'Vinculación requerida' : estadoArchivo}</span>
        {:else}
          <span class="badge disconnected"><AlertCircle size={12} /> Sin archivo</span>
        {/if}
      </div>
      <p>Usa un archivo compartido por Google Drive o OneDrive. El archivo y el código deben vincularse en cada dispositivo.</p>
    </div>
  </div>

  <div class="cloud-component-wrapper">
    <div class="folder-input-group">
      <div class="folder-path" class:vacio={!rutaArchivo}>
        <span class="path-text">{rutaArchivo || 'Ningún archivo seleccionado...'}</span>
      </div>
      <button class="btn-data-action primary btn-sync" on:click={seleccionarArchivo} disabled={guardando}>
        Seleccionar existente
      </button>
      <button class="btn-data-action primary btn-sync" on:click={crearArchivo} disabled={guardando}>
        Crear archivo
      </button>
      {#if rutaArchivo}
        <button class="btn-data-action danger-outline btn-sync" on:click={desvincular} disabled={guardando}>
          Desvincular
        </button>
      {/if}
    </div>

    <div class="aviso">
      <Info size={14} /> La identidad, versión y contenido se autentican junto con el cifrado. No se sobrescribe una versión diferente sin confirmación.
    </div>

    {#if mensaje}
      <p class="sync-message state-{estadoArchivo}" role="status">{mensaje}</p>
    {/if}

    {#if estadoArchivo === 'vinculacion'}
      <div class="pairing">
        <label for="pairing-code">Código de seguridad transferido desde el dispositivo vinculado</label>
        <input
          id="pairing-code"
          value={codigoVinculacion}
          on:input={(event) => (codigoVinculacion = normalizarCodigoVinculacion(event.currentTarget.value))}
          autocomplete="off"
          spellcheck="false"
          placeholder="RASM1:..."
        />
        <button class="btn-sync-moderno btn-sync-primario" on:click={vincularArchivo} disabled={guardando || !normalizarCodigoVinculacion(codigoVinculacion)}>
          Vincular este archivo
        </button>
      </div>
    {/if}

    {#if codigoNuevo}
      <div class="pairing">
        <strong>Código de vinculación (guárdalo y compártelo fuera de la aplicación)</strong>
        <div class="pairing-code-card">
          <textarea readonly rows="3" on:focus={(event) => event.currentTarget.select()}>{formatearCodigoVinculacion(codigoNuevo)}</textarea>
          <button
            type="button"
            class="btn-sync-moderno btn-copy-code"
            on:click={copiarCodigo}
            aria-label={codigoCopiado ? 'Código copiado' : 'Copiar código de vinculación'}
          >
            {#if codigoCopiado}
              <Check size={16} /> Copiado
            {:else}
              <Copy size={16} /> Copiar código
            {/if}
          </button>
        </div>
        {#if errorCopia}
          <span class="copy-error" role="status">{errorCopia}</span>
        {:else if codigoCopiado}
          <span class="copy-success" role="status">Código copiado al portapapeles.</span>
        {/if}
      </div>
    {/if}

    {#if rutaArchivo && estadoArchivo !== 'vinculacion'}
      <div class="acciones-sync">
        <button class="btn-sync-moderno btn-sync-primario" on:click={sincronizarAhora} disabled={guardando || estadoArchivo === 'conflicto'}>
          {guardando ? 'Sincronizando...' : 'Sincronizar ahora'}
        </button>
        <button class="btn-sync-moderno btn-sync-outline" on:click={revisarArchivo} disabled={guardando}>
          Comprobar archivo
        </button>
        {#if estadoArchivo === 'conflicto'}
          <button class="btn-sync-moderno btn-sync-outline" on:click={restaurarArchivo} disabled={guardando}>
            Restaurar versión compartida
          </button>
          <button class="btn-sync-moderno btn-sync-danger" on:click={sobrescribirArchivo} disabled={guardando}>
            Confirmar sobrescritura
          </button>
        {/if}
      </div>
    {/if}
  </div>
</Panel>

<style>
  :global(.sync-folder-panel) {
    margin-bottom: 20px !important;
    max-width: 800px !important;
    width: 100% !important;
  }

  .title-with-badge { display: flex; align-items: center; gap: 12px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .connected { background: rgba(16, 185, 129, 0.12); color: #0f9f75; border: 1px solid rgba(16, 185, 129, 0.22); }
  .disconnected { background: rgba(148, 163, 184, 0.12); color: #54657d; border: 1px solid rgba(148, 163, 184, 0.2); }
  .folder-input-group { display: flex; gap: 10px; margin: 16px 0 12px; align-items: center; flex-wrap: wrap; }
  .folder-path {
    flex: 1; min-width: 240px;
    display: flex; align-items: center;
    padding: 12px 14px;
    background: rgba(148, 163, 184, 0.04);
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 12px;
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
    min-height: 46px;
    overflow: hidden;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
  }
  .path-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main); }
  .folder-path.vacio .path-text { color: var(--text-muted, #94a3b8); }
  .btn-sync {
    padding: 11px 16px; white-space: nowrap;
    border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.3);
    background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
    color: #3730a3;
    font-weight: 700; transition: all 0.2s ease;
    box-shadow: 0 4px 10px rgba(79, 70, 229, 0.08);
  }
  .btn-sync:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 7px 16px rgba(79, 70, 229, 0.16);
  }
  .danger-outline {
    background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
    color: #be123c;
    border-color: rgba(244, 63, 94, 0.22);
  }
  .aviso {
    display: flex; gap: 8px; align-items: center;
    font-size: 12.5px; color: var(--text-secondary, #64748b);
    background: rgba(59, 130, 246, 0.04);
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(59, 130, 246, 0.1);
  }
  .sync-message { margin: 12px 0; font-size: 13px; color: var(--text-main); }
  .state-error { color: #dc2626; }
  .state-conflicto { color: #b45309; }
  .pairing {
    display: flex; flex-direction: column; gap: 8px;
    margin-top: 16px; padding-top: 14px;
    border-top: 1px solid rgba(148, 163, 184, 0.18);
  }
  .pairing label,
  .pairing strong {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main);
  }
  .pairing input, .pairing textarea {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid rgba(148, 163, 184, 0.28);
    background: rgba(255, 255, 255, 0.42);
    color: var(--text-main);
    border-radius: 10px;
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
    line-height: 1.5;
    box-shadow: inset 0 1px 1px rgba(15, 23, 42, 0.04);
  }
  .pairing textarea { resize: vertical; min-height: 72px; }
  .pairing-code-card {
    display: flex;
    align-items: stretch;
    gap: 10px;
    padding: 8px;
    border: 1px solid rgba(99, 102, 241, 0.16);
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(238, 242, 255, 0.55), rgba(250, 245, 255, 0.72));
  }
  .pairing-code-card textarea {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }
  .btn-copy-code {
    align-self: center;
    flex: 0 0 auto;
    background: linear-gradient(135deg, #0f9f8f 0%, #0e7490 100%);
    color: #fff;
    box-shadow: 0 7px 15px rgba(14, 116, 144, 0.2);
  }
  .btn-copy-code:hover { box-shadow: 0 9px 18px rgba(14, 116, 144, 0.28); }
  .copy-success { color: #0f9f75; font-size: 12px; }
  .copy-error { color: #dc2626; font-size: 12px; }
  .acciones-sync { margin-top: 18px; display: flex; justify-content: flex-end; gap: 10px; align-items: center; flex-wrap: wrap; }
  .btn-sync-moderno {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 11px 18px; border-radius: 10px; font-size: 13px; font-weight: 700;
    cursor: pointer; border: 1px solid transparent; transition: all 0.2s ease;
  }
  .btn-sync-moderno:hover:not(:disabled) { transform: translateY(-1px); }
  .btn-sync-moderno:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-sync-primario {
    background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
    color: #fff;
    box-shadow: 0 10px 18px rgba(79, 70, 229, 0.22);
  }
  .btn-sync-outline {
    background: linear-gradient(135deg, #ffffff 0%, #eef2ff 100%);
    color: #4338ca;
    border-color: rgba(99, 102, 241, 0.2);
    box-shadow: 0 5px 12px rgba(79, 70, 229, 0.08);
  }
  .btn-sync-danger {
    background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
    color: #fff;
    box-shadow: 0 8px 16px rgba(185, 28, 28, 0.2);
  }
  @media (max-width: 560px) {
    .pairing-code-card { flex-direction: column; }
    .btn-copy-code { width: 100%; }
  }
</style>
