<script lang="ts">
  import { onMount } from 'svelte';
  import { Settings, Edit, FileText, ToggleLeft, ToggleRight, X, Save, Eye } from 'lucide-svelte';
  // import { invoke } from '@tauri-apps/api/core'; // Descomenta cuando conectes el backend

  // --- CONFIGURACIÓN POR DEFECTO ---
  let config = {
    usarEncabezado: true,
    usarPiePagina: true,
    titulo: 'ASAMBLEA REGIONAL DE LOS TESTIGOS DE JEHOVÁ',
    subtitulo: 'Sección de Alojamiento y Programa',
    contacto: 'Carretera Central Km 5 ½. Holguín.\nTel: 24-462211 • Email: asamblea@jwpub.org',
    piePagina: '© 2026 Comité de Asamblea Regional. Información confidencial.'
  };

  let mostrarModal = false;
  let configEditando = { ...config }; // Copia temporal para editar

  // Simulación de carga (Aquí conectarás con Rust luego)
  onMount(() => {
    const guardado = localStorage.getItem('config_membrete');
    if (guardado) {
      config = JSON.parse(guardado);
    }
  });

  function guardarCambios() {
    config = { ...configEditando };
    localStorage.setItem('config_membrete', JSON.stringify(config)); // Guardado temporal
    // await invoke('guardar_config_membrete', { config }); // Guardado real en Rust
    mostrarModal = false;
  }

  function abrirEditor() {
    configEditando = { ...config };
    mostrarModal = true;
  }
</script>

<div class="card-config">
  <div class="header-section">
    <div class="titulo-icono">
      <FileText size={24} class="text-primary"/>
      <div>
        <h3>Membrete y Pie de Página</h3>
        <p>Personaliza el encabezado de las cartas y documentos PDF.</p>
      </div>
    </div>
    
    <button class="btn-editar" on:click={abrirEditor}>
      <Edit size={16} /> <span>Editar Texto</span>
    </button>
  </div>

  <div class="cuerpo-config">
    
    <div class="controles">
      <div class="control-item">
        <button class="toggle-btn" on:click={() => config.usarEncabezado = !config.usarEncabezado}>
          {#if config.usarEncabezado}
            <ToggleRight size={32} color="#22c55e" /> {:else}
            <ToggleLeft size={32} color="#9ca3af" /> {/if}
        </button>
        <div class="info-toggle">
          <strong>Mostrar Encabezado</strong>
          <span>Incluye el título y logo en la parte superior.</span>
        </div>
      </div>

      <div class="control-item">
        <button class="toggle-btn" on:click={() => config.usarPiePagina = !config.usarPiePagina}>
          {#if config.usarPiePagina}
            <ToggleRight size={32} color="#22c55e" />
          {:else}
            <ToggleLeft size={32} color="#9ca3af" />
          {/if}
        </button>
        <div class="info-toggle">
          <strong>Mostrar Pie de Página</strong>
          <span>Añade la nota legal al final de la hoja.</span>
        </div>
      </div>
    </div>

    <div class="area-preview">
      <div class="etiqueta-preview"><Eye size={14}/> Vista Previa Documento</div>
      
      <div class="hoja-papel">
        {#if config.usarEncabezado}
          <div class="membrete-preview">
            <h1 class="p-titulo">{config.titulo}</h1>
            <h2 class="p-subtitulo">{config.subtitulo}</h2>
            <div class="linea-separadora"></div>
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

{#if mostrarModal}
  <div class="modal-backdrop" on:click|self={() => mostrarModal = false}>
    <div class="modal-contenido">
      <div class="modal-header">
        <h3>Editar Membrete</h3>
        <button on:click={() => mostrarModal = false}><X size={20}/></button>
      </div>

      <div class="modal-body">
        <label>
          <span>Título Principal</span>
          <input type="text" bind:value={configEditando.titulo} placeholder="Ej. ASAMBLEA REGIONAL...">
        </label>

        <label>
          <span>Subtítulo / Departamento</span>
          <input type="text" bind:value={configEditando.subtitulo} placeholder="Ej. Sección de Alojamiento...">
        </label>

        <label>
          <span>Datos de Contacto (Dirección, Teléfono)</span>
          <textarea rows="3" bind:value={configEditando.contacto}></textarea>
        </label>

        <hr>

        <label>
          <span>Texto del Pie de Página</span>
          <input type="text" bind:value={configEditando.piePagina} class="input-pie">
        </label>
      </div>

      <div class="modal-footer">
        <button class="btn-cancelar" on:click={() => mostrarModal = false}>Cancelar</button>
        <button class="btn-guardar" on:click={guardarCambios}>
          <Save size={18}/> Guardar Cambios
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* --- CONTENEDOR PRINCIPAL --- */
  .card-config {
    background: var(--bg-card);
    border-radius: 12px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    margin-top: 20px;
  }

  .header-section {
    padding: 20px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-body);
  }

  .titulo-icono { display: flex; gap: 12px; align-items: center; }
  .header-section h3 { margin: 0; font-size: 1.1rem; color: var(--text-main); }
  .header-section p { margin: 2px 0 0 0; font-size: 0.85rem; color: var(--text-secondary); }
  .text-primary { color: var(--primary); }

  .btn-editar {
    background: var(--primary);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: filter 0.2s;
  }
  .btn-editar:hover { filter: brightness(1.1); }

  .cuerpo-config {
    padding: 20px;
    display: grid;
    grid-template-columns: 1fr 1fr; /* Dividir en 2 columnas: Controles | Preview */
    gap: 30px;
  }

  /* --- CONTROLES --- */
  .controles { display: flex; flex-direction: column; gap: 20px; justify-content: center; }
  .control-item { display: flex; gap: 15px; align-items: flex-start; }
  .toggle-btn { background: none; border: none; cursor: pointer; padding: 0; }
  .info-toggle { display: flex; flex-direction: column; }
  .info-toggle strong { font-size: 0.95rem; color: var(--text-main); }
  .info-toggle span { font-size: 0.8rem; color: var(--text-secondary); }

  /* --- PREVIEW (HOJA DE PAPEL) --- */
  .area-preview {
    background: var(--bg-body);
    padding: 20px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 1px solid var(--border-color);
  }
  .etiqueta-preview {
    margin-bottom: 10px; font-size: 0.75rem; text-transform: uppercase; 
    color: var(--text-secondary); display: flex; gap: 6px; align-items: center;
  }

  .hoja-papel {
    background: white; /* Siempre blanco para simular papel */
    width: 100%;
    max-width: 320px; /* Tamaño carta a escala pequeña */
    aspect-ratio: 210/297; /* Proporción A4 */
    padding: 20px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    color: #333; /* Texto negro siempre en papel */
    font-family: "Times New Roman", serif;
    position: relative;
  }

  .membrete-preview { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
  .p-titulo { margin: 0; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .p-subtitulo { margin: 2px 0; font-size: 8px; text-transform: uppercase; color: #555; }
  .p-contacto { margin: 4px 0 0 0; font-size: 6px; color: #666; }

  .contenido-ficticio { flex: 1; padding: 10px 0; opacity: 0.2; }
  .barra-gris { height: 4px; background: #000; margin-bottom: 6px; border-radius: 2px; }

  .footer-preview { text-align: center; border-top: 1px solid #ccc; padding-top: 8px; }
  .footer-preview p { margin: 0; font-size: 5px; color: #888; }
  .espacio-vacio { text-align: center; font-size: 9px; color: #ccc; font-style: italic; padding: 10px; }

  /* --- MODAL --- */
  .modal-backdrop {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); z-index: 2000;
    display: flex; justify-content: center; align-items: center;
  }
  .modal-contenido {
    background: var(--bg-card); width: 500px; max-width: 90%;
    border-radius: 12px; border: 1px solid var(--border-color);
    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
  }
  .modal-header {
    padding: 15px 20px; border-bottom: 1px solid var(--border-color);
    display: flex; justify-content: space-between; align-items: center;
  }
  .modal-header h3 { margin: 0; color: var(--text-main); }
  .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 15px; }
  
  label { display: flex; flex-direction: column; gap: 6px; }
  label span { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); }
  
  input, textarea {
    padding: 10px;
    border: 1px solid var(--border-color);
    background: var(--bg-input);
    color: var(--text-main);
    border-radius: 6px;
    font-family: inherit;
  }
  input:focus, textarea:focus { outline: 2px solid var(--primary); border-color: transparent; }

  .modal-footer {
    padding: 15px 20px; border-top: 1px solid var(--border-color);
    display: flex; justify-content: flex-end; gap: 10px; background: var(--bg-body);
    border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;
  }
  .btn-cancelar { background: transparent; border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 16px; border-radius: 6px; cursor: pointer; }
  .btn-guardar { background: var(--primary); color: white; border: none; padding: 8px 20px; border-radius: 6px; display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; }
</style>