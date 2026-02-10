<script lang="ts">
  import { onMount } from 'svelte';
  import { FileText, Save, Eye, LayoutTemplate, Type, Palette, RotateCcw } from 'lucide-svelte';
  // import { invoke } from '@tauri-apps/api/core'; 

  // --- VALORES INICIALES (POR DEFECTO) ---
  const DEFAULT_CONFIG = {
    usarEncabezado: true,
    usarPiePagina: true,
    titulo: 'YORLEN BATISTA REYES. CIRCUITO, HG-06',
    contacto: 'Carretera a Mayarí, Km 5 ½. San Rafael. Holguín.\nTeléfonos: 54891111; 59401476.\nEmail: batistareyyorlen7@jwpub.org',
    piePagina: '© 2026 Presidente de Asamblea Regional. Información confidencial.',
    // COLORES
    colorLinea: '#000000',      
    colorTexto: '#000000',      
    colorLineaPie: '#cccccc',   
    colorTextoPie: '#666666'    
  };

  // Estado reactivo (comienza con los valores por defecto)
  let config = { ...DEFAULT_CONFIG };

  onMount(() => {
    const guardado = localStorage.getItem('config_membrete');
    if (guardado) {
      const datosCargados = JSON.parse(guardado);
      // Fusionamos para asegurar que no se rompa si faltan campos nuevos
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
      // Opcional: Si quieres que también se guarde el reset automáticamente en localStorage:
      // localStorage.setItem('config_membrete', JSON.stringify(config));
    }
  }
</script>

<div class="card-config">
  
  <div class="header-section">
    <div class="titulo-icono">
      <FileText size={24} class="text-primary"/>
      <div>
        <h3>Diseñador de Membrete</h3>
        <p>Personaliza el estilo para que coincida con tu aplicación.</p>
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
            <label>
              <span class="sub-label">Título Principal</span>
              <input type="text" bind:value={config.titulo} placeholder="Nombre o Título...">
            </label>
            
            <label>
              <span class="sub-label">Datos de Contacto</span>
              <textarea rows="3" bind:value={config.contacto} placeholder="Dirección..."></textarea>
            </label>

            <div class="fila-colores-group">
              <label class="fila-color">
                <span class="sub-label"><Palette size={14}/> Texto</span>
                <input type="color" bind:value={config.colorTexto} class="input-color">
              </label>
              <label class="fila-color">
                <span class="sub-label"><Palette size={14}/> Línea</span>
                <input type="color" bind:value={config.colorLinea} class="input-color">
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
            <label>
              <span class="sub-label">Texto Legal / Informativo</span>
              <input type="text" bind:value={config.piePagina} class="input-pie">
            </label>
            
            <div class="fila-colores-group">
              <label class="fila-color">
                <span class="sub-label"><Palette size={14}/> Texto</span>
                <input type="color" bind:value={config.colorTextoPie} class="input-color">
              </label>
              <label class="fila-color">
                <span class="sub-label"><Palette size={14}/> Línea</span>
                <input type="color" bind:value={config.colorLineaPie} class="input-color">
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
            
            <h1 class="p-titulo" style="color: {config.colorTexto};">{config.titulo}</h1>
            
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
</div>

<style>
  /* --- ESTRUCTURA --- */
  .card-config {
    background: var(--bg-card);
    border-radius: 12px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    margin-top: 20px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  }

  .header-section {
    padding: 15px 25px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.03);
  }

  .titulo-icono { display: flex; gap: 12px; align-items: center; }
  .header-section h3 { margin: 0; font-size: 1.1rem; color: var(--text-main); font-weight: 700; }
  .header-section p { margin: 2px 0 0 0; font-size: 0.85rem; color: var(--text-secondary); }
  .text-primary { color: var(--primary); }

  .acciones-header { display: flex; gap: 10px; }

  /* BOTÓN RESTAURAR */
  .btn-reset {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    display: flex; align-items: center; gap: 8px;
    transition: all 0.2s;
  }
  .btn-reset:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-main);
    border-color: var(--text-secondary);
  }

  /* BOTÓN GUARDAR */
  .btn-guardar-main {
    background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 6px;
    font-size: 0.9rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;
    transition: all 0.2s;
  }
  .btn-guardar-main:hover { filter: brightness(1.1); transform: translateY(-1px); }

  .cuerpo-config {
    display: grid; grid-template-columns: 1fr 1fr; min-height: 450px;
  }

  /* --- EDITOR --- */
  .panel-editor {
    padding: 25px; display: flex; flex-direction: column; gap: 20px; border-right: 1px solid var(--border-color);
  }
  .editor-bloque { display: flex; flex-direction: column; gap: 12px; }
  .bloque-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
  .label-con-icono { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--text-main); font-size: 0.95rem; }

  .inputs-group { display: flex; flex-direction: column; gap: 12px; animation: fadeIn 0.3s ease-out; }

  label { display: flex; flex-direction: column; gap: 6px; }
  .sub-label { font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; }
  
  input[type="text"], textarea {
    padding: 10px; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border-color);
    border-radius: 6px; color: var(--text-main); font-family: inherit; font-size: 0.9rem;
    transition: border-color 0.2s;
  }
  input[type="text"]:focus, textarea:focus { outline: none; border-color: var(--primary); background: rgba(0, 0, 0, 0.3); }

  .fila-colores-group { display: flex; gap: 10px; }
  .fila-color {
    flex-direction: row; align-items: center; justify-content: space-between; flex: 1;
    background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color);
  }
  .input-color { background: none; border: none; width: 24px; height: 24px; cursor: pointer; padding: 0; }

  .texto-desactivado { font-style: italic; color: var(--text-secondary); opacity: 0.6; font-size: 0.85rem; padding: 5px 0; }
  .separador-interno { border: 0; border-top: 1px solid var(--border-color); opacity: 0.3; }

  /* Switch Mini */
  .switch-mini { position: relative; display: inline-block; width: 36px; height: 20px; }
  .switch-mini input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #4b5563; transition: .4s; border-radius: 34px; }
  .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
  input:checked + .slider { background-color: #22c55e; }
  input:checked + .slider:before { transform: translateX(16px); }

  /* --- PREVIEW --- */
  .area-preview {
    background: rgba(0,0,0,0.2); padding: 30px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .etiqueta-preview { margin-bottom: 12px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); display: flex; gap: 6px; align-items: center; }

  .hoja-papel {
    background: white; width: 100%; max-width: 340px; aspect-ratio: 210/297;
    padding: 25px; /* Compacto */
    box-shadow: 0 8px 25px rgba(0,0,0,0.25);
    display: flex; flex-direction: column; justify-content: space-between;
    
    /* Fuente del Sistema para consistencia */
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #111;
  }

  .membrete-preview { 
    text-align: center; 
    margin-bottom: 15px; 
  }

  .p-titulo { 
    margin: 0 0 4px 0; 
    font-size: 11px;   
    font-weight: 700; 
    text-transform: uppercase; 
    letter-spacing: 0.3px; 
    line-height: 1.2; 
  }

  .p-contacto { 
    margin: 0 auto 6px auto; 
    font-size: 7px;          
    line-height: 1.4; 
    width: 90%; 
    text-align: center; 
  }

  .linea-separadora { 
    height: 1px; 
    margin: 0 auto; 
    width: 100%; 
    opacity: 0.8;
  }

  .contenido-ficticio { flex: 1; padding: 15px 0; opacity: 0.1; }
  .barra-gris { height: 4px; background: #000; margin-bottom: 6px; border-radius: 2px; }

  .footer-preview { 
    text-align: center; 
    border-top: 1px solid #ddd; 
    padding-top: 8px; 
    transition: border-color 0.3s;
  }
  .footer-preview p { margin: 0; font-size: 6.5px; }

  .espacio-vacio { text-align: center; font-size: 10px; color: #ccc; padding: 15px; border: 1px dashed #ddd; border-radius: 4px; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>