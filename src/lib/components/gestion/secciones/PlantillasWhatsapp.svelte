<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { save } from '@tauri-apps/plugin-dialog';
  import { writeTextFile } from '@tauri-apps/plugin-fs';
  
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
    Download, Upload,
    Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, IndentDecrease, IndentIncrease, Highlighter, Link as LinkIcon, Unlink, Minus,
    Undo, Redo
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  // --- ESTADO ---
  export let templateIds: string[] | undefined = undefined;
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
  let marcadoresUI = marcadoresWhatsApp.map((grp, index) => ({ ...grp, isOpen: index === 0 }));
  function toggleMarcadorGroup(i: number) {
    marcadoresUI[i].isOpen = !marcadoresUI[i].isOpen;
    marcadoresUI = [...marcadoresUI];
  }

  // --- COMUNICACIÓN CON EL PADRE ---
  function setModoEdicion(estado: boolean) {
    editando = estado;
    dispatch('cambioModo', estado);
  }

  function descripcionPlantilla(id: string): string {
    const descripciones: Record<string, string> = {
      programa_recordatorio: 'La usa el botón de WhatsApp de Programa. Incluye la información del ensayo automáticamente cuando la parte lo requiere.',
      contacto_orador: 'Mensaje de contacto iniciado desde la lista de oradores.',
      registro_orador: 'Mensaje enviado desde el registro de oradores.',
      oficina: 'Texto personalizado para los auxiliares de Oficina.',
      comite: 'Texto personalizado para los integrantes del Comité.',
      departamentos: 'Texto personalizado para los equipos de departamentos.'
    };
    return descripciones[id] || 'Plantilla utilizada por una acción de la aplicación.';
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

  // --- FUNCIONES DE EXPORTAR / IMPORTAR ---
  async function exportarPlantilla(plantilla: PlantillaWhatsApp) {
      try {
          const data = {
              tipo: 'whatsapp',
              id: plantilla.id,
              body: plantilla.body || ''
          };
          
          // 1. Limpiamos el título
          const tituloLimpio = plantilla.title
              .normalize("NFD") 
              .replace(/[\u0300-\u036f]/g, "") 
              .replace(/[^a-zA-Z0-9]/g, "_")   
              .replace(/_+/g, "_");            
          
          // 2. Armamos el nuevo nombre del archivo
          const nombreArchivo = `RAssembly_Plantilla_WhatsApp_${tituloLimpio}.json`;
          
          // 3. Abre la ventana nativa de "Guardar como..."
          const filePath = await save({
              defaultPath: nombreArchivo,
              filters: [{ name: 'Plantilla JSON', extensions: ['json'] }]
          });

          if (filePath) {
              await writeTextFile(filePath, JSON.stringify(data, null, 2));
              alert("Plantilla exportada correctamente.");
          }
      } catch (error) {
          console.error("Error al exportar:", error);
          alert("Hubo un error al exportar la plantilla.");
      }
  }

  async function importarPlantilla(event: Event, idDestino: string) {
      const input = event.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;

      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = async (e) => {
          try {
              const contenido = JSON.parse(e.target?.result as string);
              if (contenido.tipo !== 'whatsapp') {
                  alert("Error: El archivo seleccionado no es una plantilla de WhatsApp válida.");
                  return;
              }
              // Usamos tu función específica de WhatsApp
              await guardarPlantillaWhatsApp(idDestino, contenido.body);
              alert("Plantilla importada con éxito.");
          } catch (error) {
              alert("Error al leer el archivo de la plantilla.");
          } finally {
              input.value = ''; // Reseteamos el input
          }
      };
      reader.readAsText(file);
  }

  // --- CARGA INICIAL: OBTENER TODAS LAS PLANTILLAS DESDE LA BD ---
  onMount(async () => {
    await cargarPlantillasWhatsApp();
  });

  onDestroy(() => {
    if (editor) editor.destroy();
  });

</script>

<!-- ========== MODO LISTA ========== -->
{#if !editando}
  <Panel padding="25px" clasesExtra="panel-plantillas-override">
    <div class="template-card-list">
      {#each $whatsAppTemplates.filter(item => !templateIds || templateIds.includes(item.id)) as plantilla (plantilla.id)}
        <article class="template-card">
          <div class="template-card-copy">
            <h4>{plantilla.title}</h4>
            <p>{descripcionPlantilla(plantilla.id)}</p>
          </div>

          <div class="template-card-actions-group">
            <!-- Input oculto para cargar el archivo -->
            <input type="file" id="import-wa-{plantilla.id}" accept=".json" style="display: none;" on:change={(e) => importarPlantilla(e, plantilla.id)} />
            
            <button class="template-card-icon-btn" title="Importar plantilla" on:click={() => document.getElementById(`import-wa-${plantilla.id}`)?.click()}>
                <Download size={14} />
            </button>
            <button class="template-card-icon-btn" title="Exportar plantilla" on:click={() => exportarPlantilla(plantilla)}>
                <Upload size={14} />
            </button>
            <button class="template-card-edit" on:click={() => abrirEditor(plantilla)}>
                <PenTool size={14} /> Editar
            </button>
          </div>

        </article>
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

/* ==========================================================================
   PLANTILLAS WHATSAPP - PANEL A PANTALLA COMPLETA
   ========================================================================== */

/* Forzar que el panel y su contenido interno ocupen el 100% del ancho */
:global(.panel-plantillas-override) {
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  padding: 0 !important;
  margin: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* También forzar al div interno que el Panel pueda generar */
:global(.panel-plantillas-override) > * {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
}

.template-card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.template-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 76px;
  padding: 15px 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-card);
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.08);
}

.template-card-copy {
  min-width: 0;
}

.template-card-copy h4 {
  margin: 0 0 5px;
  color: var(--text-main);
  font-size: 14px;
}

.template-card-copy p {
  margin: 0;
  color: var(--text-sec);
  font-size: 13px;
  line-height: 1.45;
}

.template-card-edit {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg-card);
  color: var(--text-main);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.template-card-edit:hover {
  border-color: var(--primary);
  color: var(--primary);
}

/* Título de la sección */
.group-label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-sec);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0; /* Sin padding horizontal */
}

/* Acordeón: ocupa todo el ancho sin restricciones */
.accordion-list {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 10px;
  background: var(--bg-card);
  width: 100%;
}

.accordion-item {
  border-bottom: 1px solid var(--border);
}
.accordion-item:last-child {
  border-bottom: none;
}

.accordion-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-main);
  font-weight: 600;
  font-size: 14px;
  transition: background 0.2s;
}
.accordion-header:hover {
  background: var(--hover-bg);
  color: var(--primary);
}

.acc-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.accordion-body-template {
  padding: 25px;
  background: var(--bg-body);
  border-top: 1px solid var(--border);
}

.preview-group {
  margin-bottom: 20px;
}
.preview-group label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-sec);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.preview-textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 20px;
  max-height: 300px;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-main);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
.preview-textarea :global(*) {
  max-width: 100% !important;
  white-space: pre-wrap !important;
  word-wrap: break-word !important;
  overflow-wrap: anywhere !important;
}

/* --- BOTONES DE PLANTILLA --- */
.template-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  flex-wrap: wrap;
  gap: 10px;
}
.group-center {
  display: flex;
  gap: 10px;
}
.btn-template-action {
  background: var(--bg-secondary);
  color: var(--text-main);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-template-action:hover {
  background: var(--hover-bg);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
.btn-template-action.left {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}
.btn-template-action.left:hover {
  background: var(--primary-hover);
  box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);
}
.btn-template-action.right {
  background: var(--accent-danger);
  border-color: var(--accent-danger);
  color: white;
}
.btn-template-action.right:hover {
  background: var(--accent-danger-hover);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

/* --- EDITOR (MODO EDICIÓN) --- */
.editor-layout-wrapper {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
  height: 600px;
  margin-bottom: 40px;
}
.editor-main {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-premium);
}
.editor-header-bar {
  padding: 15px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  color: var(--text-main);
  font-size: 15px;
}
.autosave-indicator {
  margin-left: 15px;
}
.status-pill {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 12px;
  display: flex;
  gap: 5px;
  align-items: center;
  font-weight: 600;
}
.status-pill.saved {
  background: rgba(16, 185, 129, 0.15);
  color: var(--accent-success);
}
.status-pill.saving {
  background: rgba(234, 88, 12, 0.15);
  color: #ea580c;
}
.status-pill.unsaved {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-sec);
}
.btn-close-header {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-sec);
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}
.btn-close-header:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--accent-danger);
}

.editor-form {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-body);
}
.editor-form label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-sec);
  margin-bottom: 10px;
  text-transform: uppercase;
}

/* Barra de herramientas */
.toolbar-ribbon {
  display: flex;
  gap: 4px;
  padding: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  flex-wrap: wrap;
  align-items: center;
}
.tool-btn {
  background: transparent;
  border: 1px solid transparent;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-sec);
  cursor: pointer;
  transition: all 0.2s;
}
.tool-btn:hover {
  background: var(--hover-bg);
  color: var(--text-main);
  border-color: var(--border);
}
.tool-btn.active {
  background: rgba(var(--primary-rgb), 0.15);
  color: var(--primary);
  border-color: rgba(var(--primary-rgb), 0.3);
}
.tool-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 6px;
}

/* Editor TipTap */
.editor-container {
  flex: 1;
  border: 1px solid var(--border);
  background: var(--input-bg);
  color: var(--text-main);
  border-radius: 0 0 8px 8px;
  overflow-y: auto;
  padding: 20px;
  cursor: text;
  font-size: 15px;
  line-height: 1.6;
}
:global(.ProseMirror) {
  height: 100%;
  outline: none;
}
:global(.ProseMirror p) {
  margin-top: 0;
  margin-bottom: 1em;
}
:global(.ProseMirror ul),
:global(.ProseMirror ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.editor-footer-actions {
  padding: 15px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  background: var(--bg-secondary);
}
.btn-cancel {
  background: transparent;
  color: var(--text-main);
  border: 1px solid var(--border);
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-cancel:hover {
  background: var(--hover-bg);
}
.btn-guardar-editor {
  background: var(--primary);
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-guardar-editor:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);
}

/* Panel lateral de marcadores */
.editor-sidebar {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-premium);
}
.sidebar-title {
  padding: 15px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  font-weight: 700;
  color: var(--text-main);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.markers-list {
  overflow-y: auto;
  flex: 1;
}
.marker-group {
  border-bottom: 1px solid var(--border);
}
.marker-group-btn {
  width: 100%;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  border: none;
  color: var(--text-main);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.2s;
}
.marker-group-btn:hover {
  background: var(--hover-bg);
  color: var(--primary);
}
.marker-content {
  background: var(--bg-body);
  padding: 8px 0;
}
.marker-pill {
  display: block;
  width: 100%;
  padding: 12px 20px;
  text-align: left;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  color: var(--text-sec);
  transition: all 0.2s;
}
.marker-pill:last-child {
  border-bottom: none;
}
.marker-pill:hover {
  background: var(--hover-bg);
  color: var(--primary);
  padding-left: 24px;
}
.marker-content-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}
.m-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}
.marker-row-desc {
  font-size: 11px;
  color: var(--text-sec);
  font-style: italic;
  margin-bottom: 6px;
  line-height: 1.4;
}
.m-code {
  font-size: 11px;
  font-family: 'Courier New', Courier, monospace;
  color: var(--primary);
  background: rgba(var(--primary-rgb), 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  width: fit-content;
  font-weight: 600;
}

/* =========================================================
   DISEÑO RESPONSIVO
   ========================================================= */
@media (max-width: 1024px) {
  .editor-layout-wrapper {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: auto;
  }
  .editor-sidebar {
    width: 100%;
    max-height: 350px;
    order: 2;
  }
  .editor-main {
    width: 100%;
    order: 1;
  }
}

@media (max-width: 768px) {
  .template-card {
    gap: 12px;
    padding: 13px;
  }
  .template-card-copy p {
    font-size: 12px;
  }
  .template-card-edit {
    padding: 0 9px;
  }
  .accordion-body-template {
    padding: 15px;
  }
  .template-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .group-center {
    flex-direction: column;
  }
  .btn-template-action {
    width: 100%;
    height: 48px;
    justify-content: center;
  }
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
  .editor-form {
    padding: 15px;
  }
  .editor-container {
    min-height: 250px;
    font-size: 16px;
  }
  .editor-footer-actions {
    flex-direction: column-reverse;
    gap: 10px;
    padding: 15px;
  }
  .btn-guardar-editor,
  .btn-cancel {
    width: 100%;
    height: 48px;
  }
  .marker-pill {
    padding: 16px 20px;
  }
  :global(.ProseMirror) {
    width: 100% !important;
    max-width: 100% !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
  }
}

.template-card-actions-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.template-card-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg-card);
  color: var(--text-sec);
  cursor: pointer;
  transition: all 0.2s;
}

.template-card-icon-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--hover-bg);
}
</style>