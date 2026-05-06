<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import { DownloadCloud, Lock, X } from 'lucide-svelte';

  let claveAcceso = "";
  let procesando = false;
  let mostrarModal = false;

  async function seleccionarYRestaurar() {
      if (!claveAcceso) return alert("Ingresa la clave que te dio el presidente.");
      
      try {
          const file = await open({
              multiple: false,
              filters: [{ name: 'Asamblea Compartida', extensions: ['rassembly'] }]
          });

          if (file) {
              procesando = true;
              await invoke('importar_asamblea_encriptada', { 
                  password: claveAcceso, 
                  rutaArchivo: file 
              });
              
              alert("¡Asamblea descargada e integrada con éxito!");
              mostrarModal = false;
              window.location.reload(); 
          }
      } catch (e) {
          alert("Error al importar. Verifica que la clave sea correcta.\nDetalle: " + e);
      } finally {
          procesando = false;
      }
  }

  function cerrarModal() {
      mostrarModal = false;
      claveAcceso = "";
  }
</script>

<button class="btn-importar" on:click={() => mostrarModal = true}>
    <DownloadCloud size={16}/>
    Importar
</button>

{#if mostrarModal}
    <div class="modal-backdrop" on:click|self={cerrarModal}>
        <div class="modal-importar">
            <div class="modal-header">
                <h3><DownloadCloud size={18}/> Importar Asamblea</h3>
                <button class="btn-close" on:click={cerrarModal}><X size={18}/></button>
            </div>
            
            <div class="modal-body">
                <p>Ingresa la clave de seguridad para desencriptar el archivo <strong>.rassembly</strong> que vas a seleccionar:</p>
                <div class="input-clave">
                    <Lock size={16} color="#64748b"/>
                    <input type="text" bind:value={claveAcceso} placeholder="Ej: A8F9X2B..." />
                </div>
            </div>

            <div class="modal-footer">
                <button class="btn-cancelar" on:click={cerrarModal} disabled={procesando}>Cancelar</button>
                <button class="btn-confirmar" on:click={seleccionarYRestaurar} disabled={procesando}>
                    {procesando ? 'Procesando...' : 'Seleccionar Archivo'}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    /* Botón compacto para poner al lado de "Añadir Asamblea" */
    .btn-importar { background: white; color: var(--c-text-mut, #475569); border: 1px solid var(--c-border, #cbd5e1); padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; height: 38px; }
    .btn-importar:hover { background: #f8fafc; border-color: #94a3b8; color: #0f172a; }

    /* Fondo oscuro del modal */
    .modal-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.4); display: flex; justify-content: center; align-items: center; z-index: 9999; backdrop-filter: blur(2px); }
    
    /* Caja del modal */
    .modal-importar { background: white; border-radius: 12px; width: 400px; max-width: 90vw; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.2s ease-out; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .modal-header { padding: 15px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
    .modal-header h3 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px; color: #0f172a; }
    .btn-close { background: none; border: none; color: #64748b; cursor: pointer; display: flex; padding: 4px; border-radius: 4px; transition: 0.2s; }
    .btn-close:hover { background: #e2e8f0; color: #ef4444; }

    .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .modal-body p { margin: 0; font-size: 13px; color: #475569; line-height: 1.5; }
    
    .input-clave { display: flex; align-items: center; gap: 10px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; }
    .input-clave input { border: none; outline: none; flex: 1; font-family: monospace; font-size: 16px; color: #0f172a; text-transform: uppercase; font-weight: bold; }
    .input-clave input:focus { color: #2563eb; }
    
    .modal-footer { padding: 15px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; background: #f8fafc; }
    .btn-cancelar { background: transparent; border: 1px solid transparent; color: #64748b; font-weight: 600; cursor: pointer; font-size: 13px; padding: 8px 16px; border-radius: 6px; }
    .btn-cancelar:hover { background: #e2e8f0; }
    .btn-confirmar { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; transition: 0.2s; }
    .btn-confirmar:hover:not(:disabled) { background: #1d4ed8; }
    .btn-confirmar:disabled { opacity: 0.6; cursor: not-allowed; }
</style>