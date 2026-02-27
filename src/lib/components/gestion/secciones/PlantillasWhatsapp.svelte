<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  
  // --- IMPORTACIONES CORRECTAS DESDE NUESTRO ARCHIVO CENTRAL ---
  import { 
    whatsAppTemplates, 
    marcadoresWhatsApp, 
    type PlantillaWhatsApp,
    cargarPlantillasWhatsApp,
    guardarPlantillaWhatsApp 
  } from '$lib/utils/plantillasWhatsApp';
  
  // --- TIP TAP ---
  import Panel from '$lib/components/ui/Panel.svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  import TextAlign from '@tiptap/extension-text-align';
  import Link from '@tiptap/extension-link';
  import { Color } from '@tiptap/extension-color';
  import { TextStyle } from '@tiptap/extension-text-style';
  import Highlight from '@tiptap/extension-highlight';

  // --- ICONOS ---
  import { 
    X, MessageCircle, Bold, Italic, ChevronUp, ChevronDown, PenTool, Check, Loader2, Cloud,
    Upload, Download, RefreshCw, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, IndentDecrease, IndentIncrease, Highlighter, Link as LinkIcon, Unlink, Minus,
    Undo, Redo
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  // --- ESTADO ---
  let editando = false;
  let plantillaActual: PlantillaWhatsApp | null = null;
  let editor: Editor | null = null;
  let element: HTMLElement;
  let saveStatus: 'saved' | 'saving' | 'unsaved' = 'saved';
  let autosaveTimer: any;

  // Estados de la barra de herramientas
  let isBold = false, isItalic = false, isUnderline = false, isStrike = false;
  let isLink = false, isHighlight = false, isBulletList = false, isOrderedList = false;
  let textAlign = 'left';
  let canUndo = false;
  let canRedo = false;

  // --- MARCADORES (usamos los específicos de WhatsApp) ---
  let marcadoresUI = marcadoresWhatsApp.map(grp => ({ ...grp }));
  function toggleMarcadorGroup(i: number) {
    marcadoresUI[i].isOpen = !marcadoresUI[i].isOpen;
    marcadoresUI = [...marcadoresUI];
  }

  // --- COMUNICACIÓN CON EL PADRE ---
  function setModoEdicion(estado: boolean) {
    editando = estado;
    dispatch('cambioModo', estado);
  }

  // --- ABRIR EDITOR ---
  async function abrirEditor(plantilla: PlantillaWhatsApp) {
    plantillaActual = JSON.parse(JSON.stringify(plantilla));
    setModoEdicion(true);
    setTimeout(() => initEditor(), 50);
  }

  // --- INICIALIZAR EDITOR TIP TAP ---
  function initEditor() {
    if (editor) editor.destroy();
    
    editor = new Editor({
      element: element,
      extensions: [
        StarterKit, Underline, TextStyle, Color, Highlight.configure({ multicolor: true }),
        Link.configure({ openOnClick: false }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ],
      content: plantillaActual?.body || '',
      onUpdate: ({ editor }) => {
        if (plantillaActual) {
          plantillaActual.body = editor.getHTML();
          actualizarToolbar();
          triggerAutosave();
        }
      },
      onSelectionUpdate: () => actualizarToolbar(),
      onTransaction: () => actualizarToolbar()
    });
    actualizarToolbar();
  }

  // --- ACTUALIZAR BARRA DE HERRAMIENTAS ---
  function actualizarToolbar() {
    if (!editor) return;
    isBold = editor.isActive('bold');
    isItalic = editor.isActive('italic');
    isUnderline = editor.isActive('underline');
    isStrike = editor.isActive('strike');
    isLink = editor.isActive('link');
    isHighlight = editor.isActive('highlight');
    isBulletList = editor.isActive('bulletList');
    isOrderedList = editor.isActive('orderedList');
    
    if (editor.isActive({ textAlign: 'left' })) textAlign = 'left';
    else if (editor.isActive({ textAlign: 'center' })) textAlign = 'center';
    else if (editor.isActive({ textAlign: 'right' })) textAlign = 'right';
    else if (editor.isActive({ textAlign: 'justify' })) textAlign = 'justify';
    else textAlign = 'left';

    canUndo = editor.can().undo();
    canRedo = editor.can().redo();
  }

  // --- FUNCIONES DE LA BARRA DE HERRAMIENTAS ---
  const toggleB = () => editor?.chain().focus().toggleBold().run();
  const toggleI = () => editor?.chain().focus().toggleItalic().run();
  const toggleU = () => editor?.chain().focus().toggleUnderline().run();
  const toggleStrike = () => editor?.chain().focus().toggleStrike().run();
  const setAlign = (a: string) => editor?.chain().focus().setTextAlign(a).run();
  const setList = (t: 'bullet'|'ordered') => t === 'bullet' 
    ? editor?.chain().focus().toggleBulletList().run() 
    : editor?.chain().focus().toggleOrderedList().run();
  const indent = (d: 'in'|'out') => d === 'in' 
    ? editor?.chain().focus().sinkListItem('listItem').run() 
    : editor?.chain().focus().liftListItem('listItem').run();
  const setLink = () => { const url = prompt('URL:'); if(url) editor?.chain().focus().setLink({ href: url }).run(); };
  const unsetLink = () => editor?.chain().focus().unsetLink().run();
  const setHighlight = () => editor?.chain().focus().toggleHighlight().run();
  const setTextColor = () => { const c = prompt('Color (hex):', '#000000'); if(c) editor?.chain().focus().setColor(c).run(); };
  const addLine = () => editor?.chain().focus().setHorizontalRule().run();
  const undo = () => editor?.chain().focus().undo().run();
  const redo = () => editor?.chain().focus().redo().run();

  // --- INSERTAR MARCADOR EN EL EDITOR ---
  const insertarMarcador = (code: string) => {
    if (editor) editor.chain().focus().insertContent(` ${code} `).run();
  };

  // --- GUARDAR PLANTILLA ---
  async function guardar(cerrarAlTerminar = false) {
    if (!plantillaActual) return;
    saveStatus = 'saving';
    try {
      await guardarPlantillaWhatsApp(plantillaActual.id, plantillaActual.body);
      saveStatus = 'saved';
      if (cerrarAlTerminar) cerrarEditor();
    } catch (e) {
      console.error(e);
      saveStatus = 'unsaved';
    }
  }

  function triggerAutosave() {
    saveStatus = 'unsaved';
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => guardar(false), 1500);
  }

  function cerrarEditor() {
    if (editor) { editor.destroy(); editor = null; }
    clearTimeout(autosaveTimer);
    plantillaActual = null;
    setModoEdicion(false);
  }

  // --- CARGA INICIAL: OBTENER TODAS LAS PLANTILLAS DESDE LA BD ---
  onMount(async () => {
    await cargarPlantillasWhatsApp();
  });

  onDestroy(() => {
    if (editor) editor.destroy();
  });

  // --- FUNCIÓN PARA ALTERNAR ACORDEÓN ---
  function toggleAccordion(id: string) {
    whatsAppTemplates.update(items =>
      items.map(p => (p.id === id ? { ...p, isOpen: !p.isOpen } : p))
    );
  }
</script>

<!-- ========== MODO LISTA ========== -->
{#if !editando}
  <Panel padding="25px" clasesExtra="panel-plantillas-override">
    <label class="group-label">Plantillas de Mensajes Rápidos (WhatsApp)</label>
    <div class="accordion-list">
      {#each $whatsAppTemplates as plantilla (plantilla.id)}
        <div class="accordion-item">
          <button class="accordion-header" on:click={() => toggleAccordion(plantilla.id)}>
            <div class="acc-title">
              <MessageCircle size={16} />
              <span>{plantilla.title}</span>
            </div>
            {#if plantilla.isOpen}
              <ChevronUp size={16} />
            {:else}
              <ChevronDown size={16} />
            {/if}
          </button>
          
          {#if plantilla.isOpen}
            <div class="accordion-body-template">
              <div class="preview-group">
                <label>Vista previa del mensaje</label>
                <div class="preview-textarea">
                  {@html plantilla.body || '<span style="color: var(--text-secondary); font-style: italic;">(Sin contenido...)</span>'}
                </div>
              </div>
              <div class="template-actions">
                <button class="btn-template-action left" on:click={() => abrirEditor(plantilla)}>
                  <PenTool size={14} /> Editar
                </button>
                <div class="group-center">
                  <button class="btn-template-action" title="Exportar plantilla">
                    <Upload size={14} /> Exportar
                  </button>
                  <button class="btn-template-action" title="Importar plantilla">
                    <Download size={14} /> Importar
                  </button>
                </div>
                <button class="btn-template-action right" title="Restablecer a valores predeterminados">
                  <RefreshCw size={14} /> Restablecer
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </Panel>

<!-- ========== MODO EDICIÓN ========== -->
{:else if plantillaActual}
  <div class="editor-layout-wrapper">
    <div class="editor-main">
      <div class="editor-header-bar">
        <div class="title-wrap">
          <MessageCircle size={18} />
          <span>Editando WhatsApp: {plantillaActual.title}</span>
        </div>
        <div class="autosave-indicator">
          {#if saveStatus === 'saved'}
            <span class="status-pill saved"><Check size={12} /> Guardado</span>
          {:else if saveStatus === 'saving'}
            <span class="status-pill saving"><Loader2 size={12} class="spin" /> Guardando...</span>
          {:else}
            <span class="status-pill unsaved"><Cloud size={12} /> Sin guardar</span>
          {/if}
        </div>
        <button class="btn-close-header" on:click={cerrarEditor} title="Cerrar editor">
          <X size={18} />
        </button>
      </div>

      <div class="editor-form">
        <label>Mensaje (puedes usar los marcadores del panel derecho)</label>
        
        <!-- Barra de herramientas -->
        <div class="toolbar-ribbon">
          <button class="tool-btn" class:active={isBold} on:click={toggleB} title="Negrita"><Bold size={16} /></button>
          <button class="tool-btn" class:active={isItalic} on:click={toggleI} title="Cursiva"><Italic size={16} /></button>
          <button class="tool-btn" class:active={isUnderline} on:click={toggleU} title="Subrayado"><UnderlineIcon size={16} /></button>
          <button class="tool-btn" class:active={isStrike} on:click={toggleStrike} title="Tachado"><span style="text-decoration: line-through;">S</span></button>
          <div class="sep"></div>
          
          <button class="tool-btn" class:active={textAlign === 'left'} on:click={() => setAlign('left')}><AlignLeft size={16} /></button>
          <button class="tool-btn" class:active={textAlign === 'center'} on:click={() => setAlign('center')}><AlignCenter size={16} /></button>
          <button class="tool-btn" class:active={textAlign === 'right'} on:click={() => setAlign('right')}><AlignRight size={16} /></button>
          <button class="tool-btn" class:active={textAlign === 'justify'} on:click={() => setAlign('justify')}><AlignJustify size={16} /></button>
          <div class="sep"></div>

          <button class="tool-btn" class:active={isBulletList} on:click={() => setList('bullet')}><List size={16} /></button>
          <button class="tool-btn" class:active={isOrderedList} on:click={() => setList('ordered')}><ListOrdered size={16} /></button>
          <div class="sep"></div>

          <button class="tool-btn" on:click={() => indent('out')}><IndentDecrease size={16} /></button>
          <button class="tool-btn" on:click={() => indent('in')}><IndentIncrease size={16} /></button>
          <div class="sep"></div>

          <button class="tool-btn" on:click={setTextColor} title="Color de texto">
            <span style="border-bottom: 2px solid red; font-weight: bold;">A</span>
          </button>
          <button class="tool-btn" class:active={isHighlight} on:click={setHighlight} title="Resaltar"><Highlighter size={16} /></button>
          <div class="sep"></div>

          <button class="tool-btn" class:active={isLink} on:click={setLink} title="Insertar enlace"><LinkIcon size={16} /></button>
          <button class="tool-btn" on:click={unsetLink} title="Quitar enlace"><Unlink size={16} /></button>
          <button class="tool-btn" on:click={addLine} title="Línea horizontal"><Minus size={16} /></button>
          <div class="sep"></div>

          <button class="tool-btn" on:click={undo} disabled={!canUndo} title="Deshacer"><Undo size={16} /></button>
          <button class="tool-btn" on:click={redo} disabled={!canRedo} title="Rehacer"><Redo size={16} /></button>
        </div>

        <!-- Editor TipTap -->
        <div class="editor-container" bind:this={element}></div>
      </div>

      <div class="editor-footer-actions">
        <button class="btn-cancel" on:click={cerrarEditor}>Cancelar</button>
        <button class="btn-guardar-editor" on:click={() => guardar(true)}>Guardar y Cerrar</button>
      </div>
    </div>

    <!-- Panel lateral de marcadores -->
    <div class="editor-sidebar">
      <div class="sidebar-title">Marcadores de posición</div>
      <div class="markers-list">
        {#each marcadoresUI as group, i}
          <div class="marker-group">
            <button class="marker-group-btn" on:click={() => toggleMarcadorGroup(i)}>
              <span>{group.category}</span>
              {#if group.isOpen}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
            </button>
            {#if group.isOpen}
              <div class="marker-content">
                {#each group.items as item}
                  <button class="marker-pill" on:click={() => insertarMarcador(item.code)} title={item.label}>
                    <div class="marker-content-row">
                      <span class="m-label">{item.label}</span>
                    </div>
                    {#if item.desc}
                      <div class="marker-row-desc">{item.desc}</div>
                    {/if}
                    <div class="m-code">{item.code}</div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
 /* --- ESTILOS GENERALES (LISTA) --- */
  :global(.panel-plantillas-override) {
    display: flex !important;
    flex-direction: column !important;
    margin-bottom: 30px !important;
  }

  .group-label { display: block; font-size: 13px; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  
  /* --- ACORDEÓN MEJORADO --- */
  .accordion-list { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 10px; background: var(--bg-card); }
  .accordion-item { border-bottom: 1px solid var(--border); }
  .accordion-item:last-child { border-bottom: none; }
  
  .accordion-header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: transparent; border: none; cursor: pointer; color: var(--text-main); font-weight: 600; font-size: 14px; transition: background 0.2s; }
  .accordion-header:hover { background: var(--hover-bg); color: var(--primary); }
  
  .acc-title { display: flex; align-items: center; gap: 12px; }
  .accordion-body-template { padding: 25px; background: var(--bg-body); border-top: 1px solid var(--border); }
  
  .preview-group { margin-bottom: 20px; }
  .preview-group label { display: block; font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; }
  
  .preview-textarea {
    display: block; width: 100%; box-sizing: border-box; padding: 20px;
    max-height: 300px; overflow-y: auto; overflow-x: hidden;
    background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px;
    color: var(--text-main); font-size: 14px; line-height: 1.6;
    white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere;
  }

  .preview-textarea :global(*) { max-width: 100% !important; white-space: pre-wrap !important; word-wrap: break-word !important; overflow-wrap: anywhere !important; }
  
 /* --- BOTONES DE PLANTILLA UNIFICADOS AL TEMA --- */
  .btn-template-action { 
    background: #475569; /* Gris pizarra sólido para Exportar/Importar */
    color: white; 
    border: none; 
    padding: 8px 16px; 
    border-radius: 6px; 
    cursor: pointer; 
    display: flex; gap: 8px; align-items: center; 
    font-size: 13px; font-weight: 600; transition: all 0.2s; 
  }
  .btn-template-action:hover { 
    background: #334155; 
    transform: translateY(-1px); 
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); 
  }
  
  /* Botón Editar (Izquierda) */
  .btn-template-action.left { background: var(--primary); }
  .btn-template-action.left:hover { background: #2563eb; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }

  /* Botón Restablecer (Derecha) */
  .btn-template-action.right { background: #ef4444; }
  .btn-template-action.right:hover { background: #dc2626; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }

  .group-center { display: flex; gap: 10px; }
  .template-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; flex-wrap: wrap; gap: 10px; }
  
  /* --- ESTILOS DEL EDITOR --- */
  .editor-layout-wrapper { display: grid; grid-template-columns: 1fr 280px; gap: 20px; height: 600px; margin-bottom: 40px; }
  .editor-main { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow-premium); }
  
  .editor-header-bar { padding: 15px 20px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  .title-wrap { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--text-main); font-size: 15px; }
  .autosave-indicator { margin-left: 15px; }
  .status-pill { font-size: 11px; padding: 4px 10px; border-radius: 12px; display: flex; gap: 5px; align-items: center; font-weight: 600; }
  .status-pill.saved { background: rgba(16, 185, 129, 0.15); color: #10b981; }
  .status-pill.saving { background: rgba(234, 88, 12, 0.15); color: #ea580c; }
  .status-pill.unsaved { background: rgba(148, 163, 184, 0.15); color: var(--text-secondary); }
  .btn-close-header { background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 4px; border-radius: 6px; display: flex; align-items: center; transition: all 0.2s; }
  .btn-close-header:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

  .editor-form { padding: 20px; flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-body); }
  .editor-form label { display: block; font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; }

  /* Barra de herramientas */
  .toolbar-ribbon { display: flex; gap: 4px; padding: 10px; background: var(--bg-card); border: 1px solid var(--border); border-bottom: none; border-radius: 8px 8px 0 0; flex-wrap: wrap; align-items: center; }
  .tool-btn { background: transparent; border: 1px solid transparent; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; color: var(--text-secondary); cursor: pointer; transition: all 0.2s; }
  .tool-btn:hover { background: var(--hover-bg); color: var(--text-main); border-color: var(--border); }
  .tool-btn.active { background: rgba(59, 130, 246, 0.15); color: var(--primary); border-color: rgba(59, 130, 246, 0.3); }
  .tool-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .sep { width: 1px; height: 20px; background: var(--border); margin: 0 6px; }

  /* Editor TipTap */
  .editor-container { flex: 1; border: 1px solid var(--border); background: var(--input-bg); color: var(--text-main); border-radius: 0 0 8px 8px; overflow-y: auto; padding: 20px; cursor: text; font-size: 15px; line-height: 1.6; }
  :global(.ProseMirror) { height: 100%; outline: none; }
  :global(.ProseMirror p) { margin-top: 0; margin-bottom: 1em; }
  :global(.ProseMirror ul, .ProseMirror ol) { padding-left: 1.5em; margin: 0.5em 0; }

  .editor-footer-actions { padding: 15px 20px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; background: var(--bg-secondary); }
  .btn-cancel { background: transparent; color: var(--text-main); border: 1px solid var(--border); padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .btn-cancel:hover { background: var(--hover-bg); }
  .btn-guardar-editor { background: var(--primary); color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .btn-guardar-editor:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }

  /* Panel lateral de marcadores */
  .editor-sidebar { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow-premium); }
  .sidebar-title { padding: 15px 20px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); font-weight: 700; color: var(--text-main); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
  .markers-list { overflow-y: auto; flex: 1; }
  .marker-group { border-bottom: 1px solid var(--border); }
  .marker-group-btn { width: 100%; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; background: transparent; border: none; color: var(--text-main); cursor: pointer; font-size: 13px; font-weight: 600; transition: background 0.2s; }
  .marker-group-btn:hover { background: var(--hover-bg); color: var(--primary); }
  
  .marker-content { background: var(--bg-body); padding: 8px 0; }
  .marker-pill { display: block; width: 100%; padding: 12px 20px; text-align: left; background: transparent; border: none; border-bottom: 1px solid var(--border); cursor: pointer; color: var(--text-secondary); transition: all 0.2s; }
  .marker-pill:last-child { border-bottom: none; }
  .marker-pill:hover { background: var(--hover-bg); color: var(--primary); padding-left: 24px; }
  
  .marker-content-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
  .m-label { font-size: 13px; font-weight: 600; color: var(--text-main); }
  .marker-row-desc { font-size: 11px; color: var(--text-secondary); font-style: italic; margin-bottom: 6px; line-height: 1.4; }
  .m-code { font-size: 11px; font-family: 'Courier New', Courier, monospace; color: var(--primary); background: rgba(59, 130, 246, 0.1); padding: 4px 8px; border-radius: 4px; width: fit-content; font-weight: 600; }

  /* =========================================================
   DISEÑO RESPONSIVO (PLANTILLAS WHATSAPP: WINDOWS + ANDROID)
   ========================================================= */

@media (max-width: 1024px) {
    /* 1. CAMBIO DE GRID A FLEX VERTICAL */
    .editor-layout-wrapper {
        display: flex;
        flex-direction: column;
        height: auto;
        min-height: auto;
    }

    .editor-sidebar {
        width: 100%;
        max-height: 350px; /* Un poco más bajo que el de correos */
        order: 2; /* Marcadores abajo */
    }

    .editor-main {
        width: 100% !important;
        max-width: 100vw !important; /* Prohibido salirse del ancho del visor */
        overflow-x: hidden !important; /* Candado extra */
        order: 1; /* Editor arriba */
    }
}

@media (max-width: 768px) {
    /* 2. OPTIMIZACIÓN DE LA LISTA DE ACORDEONES */
    .accordion-body-template {
        padding: 15px;
    }

    .template-actions {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
    }

    .group-center {
        flex-direction: column;
        gap: 10px;
    }

    .btn-template-action {
        width: 100%;
        height: 48px;
        justify-content: center;
    }

    /* 3. TOOLBAR DESLIZABLE (Para no tapar el mensaje) */
    .toolbar-ribbon {
        flex-wrap: nowrap;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        padding-bottom: 12px;
    }

    .tool-btn {
        min-width: 42px;
        min-height: 42px;
        flex-shrink: 0;
    }

    /* 4. ÁREA DEL EDITOR */
    .editor-form {
        padding: 15px;
    }

    .editor-container {
        min-height: 250px;
        font-size: 16px; /* Letra clara para WhatsApp */
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important; /* El padding no suma ancho */
        word-wrap: break-word !important; /* Rompe palabras largas */
        overflow-wrap: anywhere !important; /* Rompe enlaces larguísimos */
    }

    /* 5. ACCIONES DEL EDITOR (PIE DE PÁGINA) */
    .editor-footer-actions {
        flex-direction: column-reverse;
        gap: 10px;
        padding: 15px;
    }

    .btn-guardar-editor, .btn-cancel {
        width: 100%;
        height: 48px;
    }

    /* 6. MARCADORES (Píldoras táctiles) */
    .marker-pill {
        padding: 16px 20px; /* Más área de toque para el dedo */
    }

    /* Blindaje para el contenido que vive dentro de TipTap */
:global(.ProseMirror) {
    width: 100% !important;
    max-width: 100% !important;
    white-space: pre-wrap !important; /* Respeta saltos pero ajusta al ancho */
    word-break: break-word !important;
}

/* Evitar que el Asunto de correo también lo rompa */
.input-subject {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
}
}

</style>