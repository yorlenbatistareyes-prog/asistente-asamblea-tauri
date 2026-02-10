<script lang="ts">
  import { onMount } from 'svelte';
  import { FileText, Save, Eye, LayoutTemplate, Type, Palette } from 'lucide-svelte';
  // import { invoke } from '@tauri-apps/api/core'; 

  // --- CONFIGURACIÓN ---
  let config = {
    usarEncabezado: true,
    usarPiePagina: true,
    titulo: 'YORLEN BATISTA REYES. CIRCUITO, HG-06',
    contacto: 'Carretera a Mayarí, Km 5 ½. San Rafael. Holguín. Teléfonos: 54891111; 59401476. Email: batistareyyorlen7@jwpub.org',
    piePagina: '© 2026 Presidente de Asamblea Regional. Información confidencial.',
    colorLinea: '#000000' // Nuevo: Color de la línea
  };

  // Simulación de carga
  onMount(() => {
    const guardado = localStorage.getItem('config_membrete');
    if (guardado) {
      config = JSON.parse(guardado);
      // Asegurar compatibilidad si se agrega el campo de color nuevo
      if (!config.colorLinea) config.colorLinea = '#000000';
    }
  });

  function guardarCambios() {
    localStorage.setItem('config_membrete', JSON.stringify(config));
    // await invoke('guardar_config_membrete', { config });
    alert("Configuración guardada correctamente"); // Feedback simple
  }
</script>

<div class="card-config">
  
  <div class="header-section">
    <div class="titulo-icono">
      <FileText size={24} class="text-primary"/>
      <div>
        <h3>Diseñador de Membrete</h3>
        <p>Edita la información y visualiza el resultado en tiempo real.</p>
      </div>
    </div>
    
    <button class="btn-guardar-main" on:click={guardarCambios}>
      <Save size={18} /> <span>Guardar Cambios</span>
    </button>
  </div>

  <div class="cuerpo-config">
    
    <div class="panel-editor">
      
      <div class="editor-bloque">
        <div class="bloque-header">
          <div class="label-con-icono">
             <LayoutTemplate size={18} /> <span>Encabezado</span>
          </div>
          <label class="switch-mini">
            <input type="checkbox" bind:checked={config.usarEncabezado}>
            <span class="slider"></span>
          </label>
        </div>

        {#if config.usarEncabezado}
          <div class="inputs-group">
            <label>
              <span class="sub-label">Título Principal</span>
              <input type="text" bind:value={config.titulo} placeholder="Nombre o Título...">
            </label>
            
            <label>
              <span class="sub-label">Datos de Contacto</span>
              <textarea rows="3" bind:value={config.contacto} placeholder="Dirección, Teléfonos..."></textarea>
            </label>

            <label class="fila-color">
              <span class="sub-label"><Palette size={14}/> Color de Línea</span>
              <input type="color" bind:value={config.colorLinea} class="input-color">
            </label>
          </div>
        {:else}
          <p class="texto-desactivado">El encabezado no se mostrará en los documentos.</p>
        {/if}
      </div>

      <hr class="separador-interno">

      <div class="editor-bloque">
        <div class="bloque-header">
          <div class="label-con-icono">
            <Type size={18} /> <span>Pie de Página</span>
          </div>
          <label class="switch-mini">
            <input type="checkbox" bind:checked={config.usarPiePagina}>
            <span class="slider"></span>
          </label>
        </div>

        {#if config.usarPiePagina}
          <div class="inputs-group">
            <label>
              <span class="sub-label">Texto Legal / Informativo</span>
              <input type="text" bind:value={config.piePagina} class="input-pie">
            </label>
          </div>
        {:else}
          <p class="texto-desactivado">El pie de página está oculto.</p>
        {/if}
      </div>

    </div>

    <div class="area-preview">
      <div class="etiqueta-preview"><Eye size={14}/> Vista Previa Documento</div>
      
      <div class="hoja-papel">
        {#if config.usarEncabezado}
          <div class="membrete-preview">
            <h1 class="p-titulo">{config.titulo}</h1>
            <div class="linea-separadora" style="background-color: {config.colorLinea};"></div>
            <p class="p-contacto">{@html config.contacto.replace(/\n/g, '<br>')}</p>
          </div>
        {:else}
          <div class="espacio-vacio">Encabezado desactivado</div>
        {/if}

        <div class="contenido-ficticio">
          <div class="barra-gris" style="width: 80%"></div>
          <div class="barra-gris" style="width: 95%"></div>
          <div class="barra-gris" style="width: 90%"></div>
          <div class="barra-gris" style="width: 60%"></div>
          <div class="barra-gris" style="width: 85%"></div>
        </div>

        {#if config.usarPiePagina}
          <div class="footer-preview">
            <p>{config.piePagina}</p>
          </div>
        {/if}
      </div>
    </div>

  </div>
</div>

<style>
  /* --- ESTRUCTURA GENERAL --- */
  .card-config {
    background: var(--bg-card); /* Asegúrate de que tu variable sea oscura */
    border-radius: 12px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    margin-top: 20px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  }

  .header-section {
    padding: 20px 30px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.03);
  }

  .titulo-icono { display: flex; gap: 15px; align-items: center; }
  .header-section h3 { margin: 0; font-size: 1.2rem; color: var(--text-main); font-weight: 700; }
  .header-section p { margin: 4px 0 0 0; font-size: 0.9rem; color: var(--text-secondary); }
  .text-primary { color: var(--primary); }

  .btn-guardar-main {
    background: var(--primary);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
  }
  .btn-guardar-main:hover { filter: brightness(1.1); transform: translateY(-1px); }

  .cuerpo-config {
    display: grid;
    grid-template-columns: 1fr 1fr; /* 50% Editor - 50% Preview */
    min-height: 500px;
  }

  /* --- EDITOR (IZQUIERDA) --- */
  .panel-editor {
    padding: 30px;
    display: flex;
    flex-direction: column;
    gap: 25px;
    border-right: 1px solid var(--border-color);
  }

  .editor-bloque {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .bloque-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
  }

  .label-con-icono {
    display: flex; align-items: center; gap: 10px;
    font-weight: 600; color: var(--text-main); font-size: 1rem;
  }

  .inputs-group {
    display: flex; flex-direction: column; gap: 15px;
    animation: fadeIn 0.3s ease-out;
  }

  label { display: flex; flex-direction: column; gap: 8px; }
  .sub-label { font-size: 0.8rem; color: var(--text-secondary); font-weight: 500; }
  
  input[type="text"], textarea {
    padding: 12px;
    background: rgba(0, 0, 0, 0.2); /* Fondo oscuro para inputs */
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-main);
    font-family: inherit;
    font-size: 0.95rem;
    transition: border-color 0.2s;
  }
  
  input[type="text"]:focus, textarea:focus {
    outline: none;
    border-color: var(--primary);
    background: rgba(0, 0, 0, 0.3);
  }

  .texto-desactivado {
    font-style: italic; color: var(--text-secondary); opacity: 0.6; font-size: 0.9rem;
    padding: 10px 0;
  }

  .separador-interno {
    border: 0; border-top: 1px solid var(--border-color); opacity: 0.5;
  }

  /* Color picker */
  .fila-color {
    flex-direction: row; align-items: center; justify-content: space-between;
    background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color);
    width: fit-content; gap: 15px;
  }
  .input-color {
    background: none; border: none; width: 30px; height: 30px; cursor: pointer; padding: 0;
  }

  /* --- SWITCH MINI --- */
  .switch-mini {
    position: relative; display: inline-block; width: 40px; height: 22px;
  }
  .switch-mini input { opacity: 0; width: 0; height: 0; }
  .slider {
    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
    background-color: #4b5563; transition: .4s; border-radius: 34px;
  }
  .slider:before {
    position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px;
    background-color: white; transition: .4s; border-radius: 50%;
  }
  input:checked + .slider { background-color: #22c55e; }
  input:checked + .slider:before { transform: translateX(18px); }


  /* --- PREVIEW (DERECHA) --- */
  .area-preview {
    background: rgba(0,0,0,0.2); /* Fondo ligeramente más oscuro */
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  
  .etiqueta-preview {
    margin-bottom: 15px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;
    color: var(--text-secondary); display: flex; gap: 8px; align-items: center;
  }

  .hoja-papel {
    background: white;
    width: 100%;
    max-width: 380px; /* Un poco más grande */
    aspect-ratio: 210/297;
    padding: 30px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3); /* Sombra más dramática */
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    color: #111;
    font-family: "Times New Roman", serif;
  }

  /* Estilos internos del papel (igual que antes) */
  .membrete-preview { text-align: center; margin-bottom: 25px; }
  .p-titulo { margin: 0; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #000; line-height: 1.2; }
  .linea-separadora { height: 2px; margin: 8px auto 8px auto; width: 100%; }
  .p-contacto { margin: 0; font-size: 8px; color: #444; line-height: 1.4; }

  .contenido-ficticio { flex: 1; padding: 20px 0; opacity: 0.15; }
  .barra-gris { height: 5px; background: #000; margin-bottom: 8px; border-radius: 2px; }

  .footer-preview { text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
  .footer-preview p { margin: 0; font-size: 7px; color: #666; }
  .espacio-vacio { text-align: center; font-size: 10px; color: #ccc; font-style: italic; padding: 20px; border: 1px dashed #ddd; border-radius: 4px; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>