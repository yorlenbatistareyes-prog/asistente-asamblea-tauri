<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { ShieldCheck, Lock, Globe, Mail, Plus, X } from 'lucide-svelte';

  // Recibe los datos de la asamblea actual desde la vista Información
  export let asambleaId: number;
  export let asambleaNombre: string;

  let claveAcceso = "";
  let inputEmail = ""; // Lo que el usuario está escribiendo
  let listaCorreos: string[] = []; // La lista de todos los correos añadidos
  let procesando = false;

  function generarClave() {
    // Genera una clave aleatoria segura de 8 caracteres
    claveAcceso = Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  function agregarEmail() {
    const email = inputEmail.trim().toLowerCase();
    // Verifica que haya texto y que no esté ya en la lista
    if (email && !listaCorreos.includes(email)) {
      listaCorreos = [...listaCorreos, email];
      inputEmail = ""; // Limpiamos el input
    }
  }

  function eliminarEmail(index: number) {
    listaCorreos = listaCorreos.filter((_, i) => i !== index);
  }

  async function exportar() {
    if (!claveAcceso) return alert("Por favor, genera una clave de acceso primero.");
    if (listaCorreos.length === 0) return alert("Añade al menos un correo en la lista de autorizados.");
    
    procesando = true;
    try {
      // Llama a Rust para empaquetar y encriptar esta asamblea
      await invoke('exportar_asamblea_encriptada', {
        idAsamblea: asambleaId,
        password: claveAcceso,
        nombreAsamblea: asambleaNombre,
        emailDestino: listaCorreos // 👈 Enviamos toda la lista
      });
      alert(`¡Archivo .rassembly creado y sellado para ${listaCorreos.length} auxiliar(es)!`);
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
        Genera un archivo <strong>.rassembly</strong> en tu carpeta de sincronización. Dale la clave a tus auxiliares para que puedan descargarlo.
    </p>

    <div class="input-clave">
        <Lock size={16} color="#64748b"/>
        <input type="text" bind:value={claveAcceso} placeholder="Haz clic en Generar 👉" readonly />
        <button on:click={generarClave} class="btn-generar">Generar Clave</button>
    </div>

    <div class="export-box">
        <label class="label-email">
            <Mail size={14} /> Correos Autorizados (Presidente y Auxiliares):
        </label>
        
        <div class="input-group">
            <input 
                type="email" 
                bind:value={inputEmail} 
                placeholder="ejemplo@correo.com" 
                class="input-email"
                on:keydown={(e) => e.key === 'Enter' && agregarEmail()}
            />
            <button class="btn-add" on:click={agregarEmail} title="Añadir correo">
                <Plus size={18}/>
            </button>
        </div>

        {#if listaCorreos.length > 0}
            <div class="tags-container">
                {#each listaCorreos as email, i}
                    <div class="tag">
                        <span>{email}</span>
                        <button class="btn-remove-tag" on:click={() => eliminarEmail(i)}>
                            <X size={12}/>
                        </button>
                    </div>
                {/each}
            </div>
        {/if}
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

    /* ESTILOS NUEVOS PARA MULTI-EMAIL */
    .export-box { display: flex; flex-direction: column; gap: 8px; margin-top: 5px; }
    .label-email { font-size: 12px; color: #475569; font-weight: 600; display: flex; align-items: center; gap: 6px; }
    
    .input-group { display: flex; gap: 8px; }
    .input-email { 
        flex: 1; padding: 8px 12px; border-radius: 6px; 
        border: 1px solid #cbd5e1; background: #f8fafc;
        font-size: 14px; outline: none; transition: border 0.2s;
    }
    .input-email:focus { border-color: #2563eb; }
    
    .btn-add { background: #2563eb; color: white; border: none; padding: 0 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
    .btn-add:hover { background: #1d4ed8; }

    .tags-container { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 4px; max-height: 90px; overflow-y: auto; }
    .tag { 
        background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; 
        padding: 4px 8px; border-radius: 100px; font-size: 12px; font-weight: 500;
        display: flex; align-items: center; gap: 6px;
    }
    .btn-remove-tag { border: none; background: transparent; cursor: pointer; color: #1e40af; padding: 2px; display: flex; align-items: center; border-radius: 50%; transition: 0.2s; }
    .btn-remove-tag:hover { background: #dbeafe; color: #1e3a8a; }
</style>