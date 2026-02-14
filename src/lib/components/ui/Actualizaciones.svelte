<script lang="ts">
  import { RefreshCw } from 'lucide-svelte';
  import { invoke } from '@tauri-apps/api/core';

  let buscando = false;
  let mensaje = '';
  let tipoMensaje: 'exito' | 'error' | 'info' = 'info';
  let mostrarMensaje = false;

  async function buscarActualizaciones() {
    buscando = true;
    mostrarMensaje = false;
    
    try {
      // Por ahora, esta función es un placeholder
      // Cuando configures el servidor, aquí irá la lógica real de Tauri Updater
      const resultado = await invoke('check_for_updates');
      
      mensaje = 'Ya tienes la versión más reciente';
      tipoMensaje = 'exito';
      mostrarMensaje = true;
    } catch (error: any) {
      // Es normal que falle mientras no tengas el servidor configurado
      if (error.includes('No updates available') || error.includes('network')) {
        mensaje = 'Sin conexión al servidor de actualizaciones (aún no configurado)';
        tipoMensaje = 'info';
      } else {
        mensaje = `Error: ${error}`;
        tipoMensaje = 'error';
      }
      mostrarMensaje = true;
    } finally {
      buscando = false;
      // Ocultar mensaje después de 4 segundos
      setTimeout(() => {
        mostrarMensaje = false;
      }, 4000);
    }
  }
</script>

<div class="contenedor-actualizaciones">
  <button 
    on:click={buscarActualizaciones}
    disabled={buscando}
    class="btn-actualizar"
    title="Buscar actualizaciones"
  >
    <span class:rotando={buscando}>
      <RefreshCw size={14} />
    </span>
    <span>{buscando ? 'Buscando...' : 'Actualizar'}</span>
  </button>

  {#if mostrarMensaje}
    <div class="mensaje" class:error={tipoMensaje === 'error'} class:exito={tipoMensaje === 'exito'} class:info={tipoMensaje === 'info'}>
      {mensaje}
    </div>
  {/if}
</div>

<style>
  .contenedor-actualizaciones {
    position: relative;
  }

  .btn-actualizar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background-color: var(--primary, #0078d4);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .btn-actualizar:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 120, 212, 0.3);
  }

  .btn-actualizar:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-actualizar .rotando {
    display: inline-flex;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .mensaje {
    position: absolute;
    top: 100%;
    margin-top: 6px;
    padding: 10px 12px;
    border-radius: 4px;
    font-size: 13px;
    white-space: nowrap;
    z-index: 10;
    animation: slideDown 0.2s ease;
  }

  .mensaje.exito {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .mensaje.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  .mensaje.info {
    background-color: #d1ecf1;
    color: #0c5460;
    border: 1px solid #bee5eb;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 600px) {
    .btn-actualizar span {
      display: none;
    }

    .mensaje {
      right: 0;
      left: auto;
      white-space: normal;
      max-width: 200px;
    }
  }
</style>
