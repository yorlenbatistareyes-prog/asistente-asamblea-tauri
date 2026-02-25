<script lang="ts">
  import { onMount } from 'svelte';
  import { FileText, Save, Eye, LayoutTemplate, Type, Palette, RotateCcw } from 'lucide-svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  

  // --- VALORES INICIALES (POR DEFECTO) ---
const DEFAULT_CONFIG = {
  usarEncabezado: true,
  usarPiePagina: true,
  titulo: 'YORLEN BATISTA REYES. CIRCUITO, HG-06',
  contacto: 'Carretera a Mayarí, Km 5 ½. San Rafael. Holguín.\nTeléfonos: 54891111; 59401476.\nEmail: batistareyyorlen7@jwpub.org',
  piePagina: '© 2026 Presidente de Asamblea Regional. Información confidencial.',
  
  // NUEVOS VALORES DE TAMAÑO
  tamanoTitulo: 24,    // Valor por defecto para el título
  tamanoContacto: 10,  // Valor por defecto para el contacto
  tamanoPiePagina: 8,

  // COLORES
  colorLinea: '#000000',      
  colorTexto: '#000000',      
  colorLineaPie: '#cccccc',   
  colorTextoPie: '#666666'    
};

  // Estado reactivo
  let config = { ...DEFAULT_CONFIG };

  onMount(() => {
    const guardado = localStorage.getItem('config_membrete');
    if (guardado) {
      const datosCargados = JSON.parse(guardado);
      config = { ...config, ...datosCargados };
    }
  });

  function guardarCambios() {
    localStorage.setItem('config_membrete', JSON.stringify(config));
    // await invoke('guardar_config_membrete', { config });
    alert("Configuración guardada correctamente"); 
  }

  function restaurarValores() {
    if (confirm("¿Seguro que quieres borrar tus cambios y volver al diseño original?")) {
      config = { ...DEFAULT_CONFIG };
    }
  }
</script>

<Panel padding="0" clasesExtra="membrete-container">
  
 <div class="header-section">
  <div class="titulo-icono">
    <FileText size={24} class="text-primary"/>
    <div>
      <h3>Diseñador de Membrete</h3>
      <p>Personaliza el estilo visual de tus documentos.</p>
    </div>
  </div>
  
  <div class="acciones-header">
    <button class="btn-reset" on:click={restaurarValores} title="Restaurar valores iniciales">
      <RotateCcw size={18} /> <span>Restaurar</span>
    </button>

    <button class="btn-guardar-main" on:click={guardarCambios}>
      <Save size={18} /> <span>Guardar</span>
    </button>
  </div>
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
          
          <div class="input-wrapper">
            <span class="sub-label">Título Principal</span>
            <input type="text" bind:value={config.titulo} placeholder="Nombre o Título...">
          </div>

          <div class="input-wrapper">
            <div class="label-row">
              <span class="sub-label">Tamaño del Título</span>
              <span class="value-tag">{config.tamanoTitulo}px</span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="50" 
              bind:value={config.tamanoTitulo} 
              class="config-slider"
            >
          </div>

          <div class="input-wrapper">
            <span class="sub-label">Datos de Contacto</span>
            <textarea rows="3" bind:value={config.contacto} placeholder="Dirección..."></textarea>
          </div>

          <div class="input-wrapper">
            <div class="label-row">
              <span class="sub-label">Tamaño de Datos de Contacto</span>
              <span class="value-tag">{config.tamanoContacto}px</span>
            </div>
            <input 
              type="range" 
              min="8" 
              max="20" 
              bind:value={config.tamanoContacto} 
              class="config-slider"
            >
          </div>

          <div class="fila-colores-group">
            <label class="color-picker-btn" title="Color del Texto">
              <span class="color-label"><Type size={14}/> Texto</span>
              <div class="color-preview" style="background-color: {config.colorTexto};"></div>
              <input type="color" bind:value={config.colorTexto}>
            </label>

            <label class="color-picker-btn" title="Color de la Línea">
              <span class="color-label"><Palette size={14}/> Línea</span>
              <div class="color-preview" style="background-color: {config.colorLinea};"></div>
              <input type="color" bind:value={config.colorLinea}>
            </label>
          </div>

        </div>
      {:else}
        <p class="texto-desactivado">Encabezado oculto.</p>
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
      <div class="input-wrapper">
        <span class="sub-label">Texto Legal / Informativo</span>
        <input type="text" bind:value={config.piePagina} class="input-pie">
      </div>
      
      <div class="input-wrapper">
        <div class="label-row">
          <span class="sub-label">Tamaño del Texto</span>
          <span class="value-tag">{config.tamanoPiePagina}px</span>
        </div>
        <input 
          type="range" 
          min="6" 
          max="14" 
          bind:value={config.tamanoPiePagina} 
          class="config-slider"
        >
      </div>

      <div class="fila-colores-group">
         <label class="color-picker-btn" title="Color del Texto">
          <span class="color-label"><Type size={14}/> Texto</span>
          <div class="color-preview" style="background-color: {config.colorTextoPie};"></div>
          <input type="color" bind:value={config.colorTextoPie}>
        </label>

        <label class="color-picker-btn" title="Color de la Línea">
          <span class="color-label"><Palette size={14}/> Línea</span>
          <div class="color-preview" style="background-color: {config.colorLineaPie};"></div>
          <input type="color" bind:value={config.colorLineaPie}>
        </label>
      </div>
    </div>
  {:else}
    <p class="texto-desactivado">Pie de página oculto.</p>
  {/if}
</div>

    </div>

    <div class="area-preview">
      <div class="etiqueta-preview"><Eye size={14}/> Vista Previa (A4)</div>
      
      <div class="hoja-papel"> 
        {#if config.usarEncabezado}
          <div class="membrete-preview">
            <h1 class="p-titulo" 
                style="color: {config.colorTexto}; font-size: {config.tamanoTitulo}px; font-weight: 800;">
              {config.titulo}
            </h1>
            <p class="p-contacto" style="color: {config.colorTexto}; opacity: 0.85;">
              {@html config.contacto.replace(/\n/g, '<br>')}
            </p>
            <div class="linea-separadora" style="background-color: {config.colorLinea};"></div>
          </div>
        {:else}
          <div class="espacio-vacio">Sin Encabezado</div>
        {/if}

        <div class="contenido-ficticio">
          <div class="barra-gris" style="width: 80%"></div>
          <div class="barra-gris" style="width: 95%"></div>
          <div class="barra-gris" style="width: 90%"></div>
          <div class="barra-gris" style="width: 60%"></div>
          <div class="barra-gris" style="width: 85%"></div>
        </div>

        {#if config.usarPiePagina}
          <div class="footer-preview" style="border-top-color: {config.colorLineaPie};">
            <p style="color: {config.colorTextoPie};">{config.piePagina}</p>
          </div>
        {/if}
      </div>
    </div>

  </div>
</Panel>

<style>
 /* --- ESTRUCTURA PRINCIPAL --- */
  :global(.membrete-container) {
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    margin-top: 20px;
  }

  .header-section {
    padding: 15px 25px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-card);
  }

  .titulo-icono { display: flex; gap: 12px; align-items: center; }
  .header-section h3 { margin: 0; font-size: 1.1rem; color: var(--text-main); font-weight: 700; }
  .header-section p { margin: 2px 0 0 0; font-size: 0.85rem; color: var(--text-secondary); }

  .acciones-header { display: flex; gap: 10px; }

  /* --- BOTONES --- */
  .btn-reset {
    background: transparent; border: 1px solid var(--border); color: #ef4444;
    padding: 8px 14px; border-radius: 6px; font-size: 0.9rem; font-weight: 600;
    cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;
  }
  .btn-reset:hover { background: rgba(239, 68, 68, 0.1); border-color: #ef4444; }

  .btn-guardar-main {
    background: var(--primary); color: white; border: none;
    padding: 8px 16px; border-radius: 6px; font-size: 0.9rem; font-weight: 600;
    cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;
  }
  .btn-guardar-main:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }

  .cuerpo-config { display: grid; grid-template-columns: 1fr 1fr; min-height: 450px; background: var(--bg-card); }

  /* --- EDITOR --- */
  .panel-editor {
    padding: 25px; display: flex; flex-direction: column; gap: 25px;
    border-right: 1px solid var(--border);
    background: transparent;
  }
  .editor-bloque { display: flex; flex-direction: column; gap: 15px; }
  .bloque-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
  .label-con-icono { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--text-main); font-size: 0.95rem; }

  /* --- INPUTS Y FORMULARIOS --- */
  .inputs-group { display: flex; flex-direction: column; gap: 15px; animation: fadeIn 0.3s ease-out; }
  .input-wrapper { display: flex; flex-direction: column; gap: 6px; width: 100%; }
  
  .label-row { display: flex; justify-content: space-between; align-items: center; }
  .sub-label { font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .value-tag { background: var(--hover-bg); padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; color: var(--primary); }

  input[type="text"], textarea {
    padding: 12px;
    background: var(--input-bg); 
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-main);
    font-family: inherit; font-size: 0.95rem;
    transition: all 0.2s ease;
    width: 100%; box-sizing: border-box;
  }
  input[type="text"]:focus, textarea:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--bg-card);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }
  
  .config-slider { width: 100%; accent-color: var(--primary); cursor: pointer; }

  /* --- SELECTORES DE COLOR --- */
  .fila-colores-group { display: flex; gap: 12px; margin-top: 5px; }
  
  .color-picker-btn {
    flex: 1; display: flex; align-items: center; gap: 10px;
    padding: 8px 12px;
    background: var(--bg-body);
    border: 1px solid var(--border);
    border-radius: 8px; cursor: pointer;
    transition: all 0.2s; position: relative;
  }
  .color-picker-btn:hover { background: var(--hover-bg); border-color: var(--primary); }
  
  .color-label { font-size: 0.8rem; color: var(--text-main); font-weight: 600; display: flex; gap: 6px; align-items: center; flex: 1; }
  
  .color-preview {
    width: 24px; height: 24px; border-radius: 50%;
    border: 2px solid var(--bg-card); box-shadow: 0 0 0 1px var(--border);
  }
  
  .color-picker-btn input[type="color"] {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;
  }

  /* --- OTROS --- */
  .texto-desactivado { font-style: italic; color: var(--text-secondary); opacity: 0.8; font-size: 0.85rem; padding: 10px; background: var(--bg-body); border-radius: 6px; text-align: center; border: 1px dashed var(--border); }
  .separador-interno { border: 0; border-top: 1px solid var(--border); opacity: 0.6; margin: 10px 0; }

  /* Switch Mini */
  .switch-mini { position: relative; display: inline-block; width: 36px; height: 20px; }
  .switch-mini input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border); transition: .4s; border-radius: 34px; }
  .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
  input:checked + .slider { background-color: var(--primary); }
  input:checked + .slider:before { transform: translateX(16px); }

  /* --- PREVIEW (HOJA DE PAPEL) --- */
  .area-preview {
    background: var(--bg-body); padding: 30px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .etiqueta-preview { margin-bottom: 12px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); display: flex; gap: 6px; align-items: center; font-weight: 600; }

  /* MANTENEMOS ESTO BLANCO SIEMPRE, ES PAPEL FÍSICO */
  .hoja-papel {
    background: #ffffff !important; 
    width: 100%; max-width: 340px; aspect-ratio: 210/297;
    padding: 25px; 
    box-shadow: 0 10px 30px rgba(0,0,0,0.15); 
    display: flex; flex-direction: column; justify-content: space-between;
    font-family: system-ui, -apple-system, sans-serif; color: #111827 !important;
  }

  .membrete-preview { text-align: center; margin-bottom: 15px; }
  .p-titulo { margin: 0 0 4px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.2; }
  .p-contacto { margin: 0 auto 6px auto; font-size: 7px; line-height: 1.4; width: 90%; text-align: center; }
  .linea-separadora { height: 1.5px; margin: 0 auto; width: 100%; opacity: 0.8; }

  .contenido-ficticio { flex: 1; padding: 15px 0; opacity: 0.1; }
  .barra-gris { height: 4px; background: #000; margin-bottom: 6px; border-radius: 2px; }

  .footer-preview { text-align: center; border-top: 1px solid #e5e7eb; padding-top: 8px; transition: border-color 0.3s; }
  .footer-preview p { margin: 0; font-size: 6.5px; }

  .espacio-vacio { text-align: center; font-size: 10px; color: #9ca3af; padding: 15px; border: 1px dashed #d1d5db; border-radius: 4px; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

</style>