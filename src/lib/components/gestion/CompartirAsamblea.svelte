<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { ShieldCheck, Lock, Globe } from 'lucide-svelte';

  // Recibe los datos de la asamblea actual desde la vista Información
  export let asambleaId: number;
  export let asambleaNombre: string;

  let claveAcceso = "";
  let procesando = false;

  function generarClave() {
    // Genera una clave aleatoria segura de 8 caracteres
    claveAcceso = Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  async function exportar() {
    if (!claveAcceso) return alert("Por favor, genera una clave de acceso primero.");
    
    procesando = true;
    try {
      // Llama a Rust para empaquetar y encriptar esta asamblea
      await invoke('exportar_asamblea_encriptada', {
        idAsamblea: asambleaId,
        password: claveAcceso,
        nombreAsamblea: asambleaNombre
      });
      alert("¡Archivo .rassembly creado y guardado en tu carpeta compartida!");
    } catch (e) {
      alert("Error al exportar. Asegúrate de haber configurado la carpeta en Datos.\nDetalle: " + e);
    } finally {
      procesando = false;
    }
  }
</script>

<div class="panel-exportar">
    <div class="header-exp">
        <ShieldCheck size={20} color="var(--primary, #2563eb)"/>
        <h3>Compartir Asamblea (Seguro)</h3>
    </div>
    <p class="desc">
        Genera un archivo <strong>.rassembly</strong> en tu carpeta de sincronización. Dale la clave a un auxiliar para que pueda descargarlo en su PC.
    </p>

    <div class="input-clave">
        <Lock size={16} color="#64748b"/>
        <input type="text" bind:value={claveAcceso} placeholder="Haz clic en Generar 👉" readonly />
        <button on:click={generarClave} class="btn-generar">Generar Clave</button>
    </div>

    <button class="btn-accion" on:click={exportar} disabled={procesando}>
        <Globe size={16}/>
        {procesando ? 'Creando archivo...' : 'Exportar a la nube'}
    </button>
</div>

<style>
    .panel-exportar { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header-exp { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
    .header-exp h3 { margin: 0; font-size: 16px; color: #0f172a; font-weight: 700; }
    
    .desc { margin: 0; font-size: 13px; color: #64748b; line-height: 1.5; }
    
    .input-clave { display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px 6px 12px; }
    .input-clave input { border: none; outline: none; flex: 1; font-family: monospace; font-size: 15px; font-weight: bold; color: #2563eb; background: transparent; }
    
    .btn-generar { background: #e2e8f0; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; font-size: 12px; cursor: pointer; color: #475569; transition: 0.2s; }
    .btn-generar:hover { background: #cbd5e1; color: #0f172a; }
    
    .btn-accion { background: #0f172a; color: white; padding: 12px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; border: none; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; margin-top: 5px; }
    .btn-accion:hover:not(:disabled) { background: #000000; transform: translateY(-1px); }
    .btn-accion:disabled { opacity: 0.6; cursor: not-allowed; }
</style>