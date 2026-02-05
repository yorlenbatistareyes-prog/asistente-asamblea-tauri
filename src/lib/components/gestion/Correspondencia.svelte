<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  // --- TIPTAP ---
  import { Editor, Extension } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  import TextAlign from '@tiptap/extension-text-align';
  import Subscript from '@tiptap/extension-subscript';
  import Superscript from '@tiptap/extension-superscript';
  import { TextStyle } from '@tiptap/extension-text-style';
  import { Color } from '@tiptap/extension-color';
  import Link from '@tiptap/extension-link';
  import Placeholder from '@tiptap/extension-placeholder';
  import FontFamily from '@tiptap/extension-font-family';
  import TaskList from '@tiptap/extension-task-list';
  import TaskItem from '@tiptap/extension-task-item';

  // --- ICONOS ---
  import { 
    Save, Mic, UserCheck, MessageSquare, ArrowLeft, FileText,
    Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Palette, List, ListOrdered, Undo, Redo, Eraser, 
    Link as LinkIcon, Minus, 
    IndentDecrease, IndentIncrease, 
    Plus, ZoomIn, ZoomOut, ChevronDown, Clipboard,
    Type, Scissors, Copy, Trash2, ArrowUpDown
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();
  export let seccionInicial = 'oradores';

  // --- ESTADO ---
  let zoomLevel = 100;
  let tipoActivo = seccionInicial;
  let element: HTMLElement;
  let editor: Editor;       
  let contenidoCargado = "";

  // Variables UI
  let currentFont = 'Arial';
  let currentSize = '11';
  let currentColor = '#000000';

  // --- EXTENSIONES ---
  const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() { return { types: ['textStyle'] }; },
    addGlobalAttributes() {
      return [{
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize.replace('px', ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}px` };
            },
          },
        },
      }];
    },
    addCommands() {
      return {
        setFontSize: (fontSize) => ({ chain }) => chain().setMark('textStyle', { fontSize }).run(),
        unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).run(),
      };
    },
  });

  const LineHeight = Extension.create({
    name: 'lineHeight',
    addOptions() { return { types: ['paragraph', 'heading'] }; },
    addGlobalAttributes() {
      return [{
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: element => element.style.lineHeight,
            renderHTML: attributes => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      }];
    },
    addCommands() {
      return {
        setLineHeight: (lineHeight: string) => ({ commands }) => {
           return this.options.types.every((type: string) => commands.updateAttributes(type, { lineHeight }));
        },
      };
    },
  });

  // --- CARGA ---
  async function cargarPlantilla() {
    try {
      const respuesta = await invoke('obtener_plantilla', { id: tipoActivo }) as string;
      contenidoCargado = respuesta || `<p>Estimado hermano:</p><p>Nos complace informarle...</p>`;
      if (editor) editor.commands.setContent(contenidoCargado);
    } catch (e) {
      if(editor) editor.commands.setContent("<p style='color:red'>Error de conexión.</p>");
    }
  }

  // --- INICIALIZAR EDITOR ---
  onMount(() => {
    editor = new Editor({
      element: element,
      extensions: [
        StarterKit, Underline, Subscript, Superscript, TextStyle, Color, FontFamily, FontSize, LineHeight,
        Link.configure({ openOnClick: false }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder: '' }),
        TaskList,
        TaskItem.configure({ nested: true }),
      ],
      content: '', 
      onTransaction: () => { 
        editor = editor; 
        updateToolbar();
      },
      onSelectionUpdate: () => { updateToolbar(); }
    });
    cargarPlantilla();
  });

  function updateToolbar() {
    if (!editor) return;
    const textStyle = editor.getAttributes('textStyle');
    currentFont = textStyle.fontFamily || 'Arial';
    currentSize = textStyle.fontSize || '11';
    currentColor = textStyle.color || '#000000';
  }

  onDestroy(() => { if (editor) editor.destroy(); });

  async function actualizar() {
    if (!editor) return;
    try {
      const htmlFinal = editor.getHTML();
      await invoke('guardar_plantilla', { id: tipoActivo, contenido: htmlFinal });
      alert(`✅ Guardado correctamente.`);
    } catch (e) {
      alert("Error: " + e);
    }
  }

  // --- ACCIONES ---
  function cambiarFuente(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    editor.chain().focus().setFontFamily(val).run();
  }
  function cambiarTamano(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    editor.chain().focus().setFontSize(val).run();
  }
  function cambiarInterlineado(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    editor.chain().focus().setLineHeight(val).run();
  }
  function cambiarColor(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    editor.chain().focus().setColor(val).run();
    currentColor = val;
  }
  function addMarker(e: Event) {
    const target = e.target as HTMLSelectElement;
    if (target.value && editor) {
      editor.chain().focus().insertContent(`{{${target.value}}}`).run();
      target.value = ""; 
    }
  }
  function setLink() {
    const url = window.prompt('URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }
  
  // --- ZOOM ---
  function zoomIn() { if (zoomLevel < 300) zoomLevel += 10; }
  function zoomOut() { if (zoomLevel > 50) zoomLevel -= 10; }
  
</script>

<div class="word-layout">
  
  <aside class="sidebar">
    <div class="sidebar-top">
        <button class="back-btn" on:click={() => dispatch('close')} title="Salir del Editor">
            <ArrowLeft size={24} />
        </button>
        <span class="back-label">Volver</span>
    </div>
    
    <div class="sidebar-content">
        <div class="icon-indicator">
            {#if tipoActivo === 'oradores'} <Mic size={32} /> {/if}
            {#if tipoActivo === 'presidentes'} <UserCheck size={32} /> {/if}
            {#if tipoActivo === 'oraciones'} <MessageSquare size={32} /> {/if}
        </div>
        <div class="doc-type-label">{tipoActivo.toUpperCase()}</div>
    </div>
  </aside>

  <main>
    
    <div class="app-header">
      <div class="left-section">
          <FileText size={24} class="header-icon"/>
          <div class="doc-info">
              <span class="doc-title">PLANTILLA: {tipoActivo.toUpperCase()}</span>
              <span class="doc-status">Guardado en este PC</span>
          </div>
      </div>
      <div class="right-section">
          <button class="save-btn" on:click={actualizar}>
              <Save size={18} /> <span>Guardar Cambios</span>
          </button>
      </div>
    </div>

    <div class="ribbon">
      {#if editor}
        <div class="ribbon-group">
            <div class="group-row">
                <button class="ribbon-btn large" disabled title="Pegar (Ctrl+V)">
                    <Clipboard size={24} />
                    <span>Pegar</span>
                </button>
                <div class="group-col small-gap">
                    <button class="ribbon-btn list-item" disabled title="Cortar (Ctrl+X)">
                        <Scissors size={14} /> <span>Cortar</span>
                    </button>
                    <button class="ribbon-btn list-item" disabled title="Copiar (Ctrl+C)">
                        <Copy size={14} /> <span>Copiar</span>
                    </button>
                </div>
            </div>
            <div class="group-label">Portapapeles</div>
        </div>
        <div class="separator"></div>

        <div class="ribbon-group">
            <div class="group-col full-h">
                <div class="controls-row">
                    <select class="font-select" on:change={cambiarFuente} bind:value={currentFont} title="Fuente">
                        <option value="Arial">Arial</option>
                        <option value="Calibri">Calibri</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Georgia">Georgia</option>
                    </select>
                    <select class="size-select" on:change={cambiarTamano} bind:value={currentSize} title="Tamaño de Fuente">
                        <option value="10">10</option>
                        <option value="11">11</option>
                        <option value="12">12</option>
                        <option value="14">14</option>
                        <option value="16">16</option>
                        <option value="18">18</option>
                        <option value="20">20</option>
                        <option value="24">24</option>
                        <option value="30">30</option>
                    </select>
                    <div class="divider-v"></div>
                    <button class="ribbon-btn small" on:click={() => editor.chain().focus().unsetAllMarks().run()} title="Borrar Formato (Limpiar estilo)"><Eraser size={16}/></button>
                </div>
                <div class="controls-row spacing">
                    <button class="ribbon-btn small" class:active={editor.isActive('bold')} on:click={() => editor.chain().focus().toggleBold().run()} title="Negrita (Ctrl+B)"><Bold size={16}/></button>
                    <button class="ribbon-btn small" class:active={editor.isActive('italic')} on:click={() => editor.chain().focus().toggleItalic().run()} title="Cursiva (Ctrl+I)"><Italic size={16}/></button>
                    <button class="ribbon-btn small" class:active={editor.isActive('underline')} on:click={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado (Ctrl+U)"><UnderlineIcon size={16}/></button>
                    <button class="ribbon-btn small" class:active={editor.isActive('strike')} on:click={() => editor.chain().focus().toggleStrike().run()} title="Tachado"><Strikethrough size={16}/></button>
                    <div class="divider-v"></div>
                    <div class="color-picker-btn" title="Color de Fuente">
                        <Type size={16} color={currentColor}/>
                        <div class="color-bar" style="background-color: {currentColor}"></div>
                        <input type="color" on:input={cambiarColor} value={currentColor} title="Cambiar color">
                    </div>
                </div>
            </div>
            <div class="group-label">Fuente</div>
        </div>
        <div class="separator"></div>

        <div class="ribbon-group">
            <div class="group-col full-h">
                <div class="controls-row">
                    <button class="ribbon-btn small" class:active={editor.isActive('bulletList')} on:click={() => editor.chain().focus().toggleBulletList().run()} title="Viñetas"><List size={18}/></button>
                    <button class="ribbon-btn small" class:active={editor.isActive('orderedList')} on:click={() => editor.chain().focus().toggleOrderedList().run()} title="Numeración"><ListOrdered size={18}/></button>
                    <div class="divider-v"></div>
                    <button class="ribbon-btn small" on:click={() => editor.chain().focus().liftListItem('listItem').run()} title="Disminuir Sangría"><IndentDecrease size={18}/></button>
                    <button class="ribbon-btn small" on:click={() => editor.chain().focus().sinkListItem('listItem').run()} title="Aumentar Sangría"><IndentIncrease size={18}/></button>
                </div>
                <div class="controls-row spacing">
                    <button class="ribbon-btn small" class:active={editor.isActive({ textAlign: 'left' })} on:click={() => editor.chain().focus().setTextAlign('left').run()} title="Alinear Izquierda"><AlignLeft size={18}/></button>
                    <button class="ribbon-btn small" class:active={editor.isActive({ textAlign: 'center' })} on:click={() => editor.chain().focus().setTextAlign('center').run()} title="Centrar"><AlignCenter size={18}/></button>
                    <button class="ribbon-btn small" class:active={editor.isActive({ textAlign: 'right' })} on:click={() => editor.chain().focus().setTextAlign('right').run()} title="Alinear Derecha"><AlignRight size={18}/></button>
                    <button class="ribbon-btn small" class:active={editor.isActive({ textAlign: 'justify' })} on:click={() => editor.chain().focus().setTextAlign('justify').run()} title="Justificar"><AlignJustify size={18}/></button>
                    <div class="divider-v"></div>
                    
                    <div class="line-height-wrapper" title="Interlineado">
                        <ArrowUpDown size={14} class="icon-lh"/>
                        <select class="line-height-select" on:change={cambiarInterlineado}>
                            <option value="1.0">1.0</option>
                            <option value="1.15">1.15</option>
                            <option value="1.5">1.5</option>
                            <option value="2.0">2.0</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="group-label">Párrafo</div>
        </div>
        <div class="separator"></div>

        <div class="ribbon-group">
            <div class="group-row centered">
               <button class="ribbon-btn large" on:click={setLink} class:active={editor.isActive('link')} title="Insertar Vínculo">
                   <LinkIcon size={22}/>
                   <span>Vínculo</span>
               </button>
               <button class="ribbon-btn large" on:click={() => editor.chain().focus().setHorizontalRule().run()} title="Insertar Línea Horizontal">
                   <Minus size={22}/>
                   <span>Línea</span>
               </button>
            </div>
            <div class="group-label">Insertar</div>
        </div>
        <div class="separator"></div>

        <div class="ribbon-group">
             <div class="group-row centered">
                <button class="ribbon-btn large" on:click={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer (Ctrl+Z)">
                    <Undo size={22}/>
                    <span>Deshacer</span>
                </button>
                <button class="ribbon-btn large" on:click={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer (Ctrl+Y)">
                    <Redo size={22}/>
                    <span>Rehacer</span>
                </button>
             </div>
             <div class="group-label">Edición</div>
        </div>

        <div class="ribbon-group ml-auto grow-right">
            <div class="group-row centered">
               <div class="insert-marker-container">
                   <label>Marcadores de Posición:</label>
                   <select on:change={addMarker} title="Insertar variable">
                       <option value="" disabled selected>Seleccionar campo...</option>
                       <optgroup label="General y Fecha">
                           <option value="FechaActualMediana">Fecha Actual Mediana</option>
                           <option value="FechaActualCompleta">Fecha Actual Completa</option>
                       </optgroup>
                       <optgroup label="Datos de la Persona">
                           <option value="SaludoSexo">Saludo (Estimado/a)</option>
                           <option value="Nombre">Nombre</option>
                           <option value="SegundoNombre">Segundo Nombre</option>
                           <option value="Apellido">Apellido</option>
                           <option value="Apodo">Apodo</option>
                           <option value="Sufijo">Sufijo</option>
                       </optgroup>
                       <optgroup label="Asignación y Programa">
                           <option value="Tema">Tema</option>
                           <option value="Hora">Hora</option>
                           <option value="Duracion">Duración</option>
                           <option value="NumeroBosquejo">Número Bosquejo</option>
                           <option value="TipoAsignacion">Tipo Asignación</option>
                           <option value="InstruccionesDemostraciones">Instr. Demos</option>
                           <option value="EnlaceBosquejo">Enlace Bosquejo</option>
                       </optgroup>
                       <optgroup label="Evento y Circuito">
                           <option value="DesignacionCircuito">Designación Circuito</option>
                           <option value="SeccionCircuito">Sección Circuito</option>
                           <option value="TipoEvento">Tipo Evento</option>
                           <option value="TemaEvento">Tema Evento</option>
                           <option value="FechaAsamblea">Fecha Asamblea</option>
                       </optgroup>
                       <optgroup label="Ubicación y Lugar">
                           <option value="NombreLugar">Nombre Lugar</option>
                           <option value="Direccion">Dirección</option>
                           <option value="Ciudad">Ciudad</option>
                           <option value="EstadoProvincia">Estado</option>
                           <option value="CodigoPostal">C.P.</option>
                           <option value="TelefonoPrincipal">Teléfono</option>
                           <option value="UbicacionGeografica">GPS</option>
                           <option value="InfoRecorrido">Recorrido</option>
                       </optgroup>
                       <optgroup label="Ensayos">
                           <option value="EnvolturaEnsayo">Bloque Ensayo</option>
                           <option value="InfoCompletaEnsayos">Info Completa</option>
                           <option value="LugarEnsayos">Lugar</option>
                           <option value="FechaHoraEnsayo">Fecha/Hora</option>
                           <option value="NotasEnsayos">Notas Ensayo</option>
                       </optgroup>
                       <optgroup label="Otros">
                           <option value="Notas">Notas</option>
                           <option value="InstruccionesEspeciales">Instrucciones</option>
                       </optgroup>
                   </select>
               </div>
            </div>
            <div class="group-label">Correspondencia</div>
        </div>
      {/if}
    </div>

    <div class="workspace">
        <div class="scroll-container">
            <div class="paper-container" style="zoom: {zoomLevel}%;">
                <div class="paper-sheet">
                    <div class="editor-content" bind:this={element}></div>
                </div>
            </div>
        </div>
    </div>

    <div class="status-bar">
        <div class="status-left">Página 1 de 1</div>
        <div class="status-right">
            <button on:click={() => zoomLevel = Math.max(10, zoomLevel - 10)}><Minus size={12}/></button>
            <div class="zoom-slider-container">
               <input type="range" min="10" max="250" bind:value={zoomLevel} class="zoom-slider">
            </div>
            <button on:click={() => zoomLevel = Math.min(250, zoomLevel + 10)}><Plus size={12}/></button>
            <span class="zoom-text">{zoomLevel}%</span>
        </div>
    </div>

  </main>
</div>

<style>
  /* --- LAYOUT GLOBAL --- */
  .word-layout {
      display: flex;
      flex-direction: row; 
      height: 100vh;
      font-family: 'Segoe UI', sans-serif;
      background: #f3f3f3;
      overflow: hidden;
  }

  /* --- 1. SIDEBAR IZQUIERDA --- */
  .sidebar {
      width: 70px;
      background: #e1e1e1; 
      border-right: 1px solid #c0c0c0;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 15px;
      z-index: 100;
      flex-shrink: 0;
  }

  .sidebar-top {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 30px;
      cursor: pointer;
  }
  
  .back-btn {
      background: white;
      border: 1px solid #ccc;
      color: #333;
      width: 40px; height: 40px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 5px;
      transition: all 0.2s;
  }
  .back-btn:hover { background: #2b579a; color: white; border-color: #2b579a; }
  .back-label { font-size: 10px; font-weight: 700; color: #555; }

  .sidebar-content {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
  }
  .icon-indicator {
      width: 45px; height: 45px;
      background: #2b579a;
      color: white;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
  }
  .doc-type-label {
      font-size: 10px; font-weight: 700; color: #333;
      text-align: center; writing-mode: vertical-rl; transform: rotate(180deg);
      letter-spacing: 1px; margin-top: 10px;
  }

  /* --- MAIN CONTENT --- */
  main {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
  }

  /* HEADER AZUL */
  .app-header {
      background: #2b579a; /* Azul Word */
      color: white;
      height: 52px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 20px;
      flex-shrink: 0;
  }
  .left-section { display: flex; align-items: center; gap: 12px; }
  .header-icon { opacity: 0.9; }
  
  .doc-info { display: flex; flex-direction: column; justify-content: center; }
  .doc-title { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: white; text-transform: uppercase; }
  .doc-status { font-size: 11px; opacity: 0.8; font-weight: 400; }

  .save-btn {
      background: white; color: #2b579a; border: none; font-weight: 700; font-size: 13px;
      padding: 8px 18px; border-radius: 4px; display: flex; align-items: center; gap: 8px; cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  .save-btn:hover { background: #f0f0f0; }

  /* --- 2. RIBBON (CINTA) --- */
  .ribbon {
      background: #f3f3f3;
      height: 100px;
      border-bottom: 1px solid #d1d1d1;
      display: flex;
      padding: 5px 10px;
      gap: 5px;
      flex-shrink: 0;
      user-select: none;
      overflow-x: auto;
  }
  
  .ribbon-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 0 6px;
      height: 100%;
  }
  .ribbon-group.grow-right { flex-grow: 1; align-items: flex-end; padding-right: 20px; }
  .ribbon-group.ml-auto { margin-left: auto; }

  .group-row { display: flex; align-items: center; gap: 4px; height: 100%; padding-bottom: 16px; }
  .group-row.centered { justify-content: center; }
  
  .group-col { display: flex; flex-direction: column; gap: 2px; justify-content: center; }
  .group-col.small-gap { gap: 2px; }
  .group-col.full-h { height: 100%; justify-content: flex-start; padding-top: 4px; gap: 4px; padding-bottom: 16px; }
  
  .controls-row { display: flex; gap: 2px; align-items: center; }
  .controls-row.spacing { gap: 4px; }

  .group-label {
      font-size: 11px; color: #666; margin-top: -20px; text-align: center; width: 100%; pointer-events: none;
  }

  .separator { width: 1px; background: #d1d1d1; height: 75%; align-self: center; margin: 0 4px; }
  .divider-v { width: 1px; height: 18px; background: #ccc; margin: 0 6px; }

  /* BOTONES RIBBON */
  .ribbon-btn {
      border: 1px solid transparent; background: transparent; cursor: pointer; color: #333;
      border-radius: 3px; display: flex; align-items: center; justify-content: center; transition: all 0.1s;
  }
  .ribbon-btn:hover { background: #dbeafe; border-color: #bfdbfe; color: #1e40af; }
  .ribbon-btn.active { background: #cce8ff; border-color: #99d1ff; color: #005a9e; }
  .ribbon-btn:disabled { opacity: 0.5; cursor: default; }

  /* FIX CRÍTICO: Desactivar eventos de ratón en iconos y texto dentro de botones para que el tooltip (title) del botón siempre funcione */
  .ribbon-btn > :global(svg), 
  .ribbon-btn > span {
      pointer-events: none;
  }

  .ribbon-btn.large { flex-direction: column; width: 55px; height: 65px; font-size: 11px; gap: 4px; }
  .ribbon-btn.small { width: 28px; height: 28px; }
  
  /* ESTILO LISTA PARA CORTAR/COPIAR */
  .ribbon-btn.list-item {
      width: 75px; height: 22px; 
      justify-content: flex-start; 
      gap: 6px; 
      font-size: 11px; 
      padding-left: 4px;
  }

  /* INPUTS */
  select { font-family: 'Segoe UI', sans-serif; border: 1px solid transparent; background: transparent; font-size: 12px; height: 22px; outline: none; cursor: pointer; }
  select:hover { border-color: #ccc; background: white; }
  
  .font-select { width: 120px; border: 1px solid #ccc; background: white; height: 24px; padding-left: 4px; }
  .size-select { width: 45px; border: 1px solid #ccc; background: white; height: 24px; margin-left: 2px; text-align: center; }
  
  .line-height-wrapper { display: flex; align-items: center; border: 1px solid transparent; padding-left: 2px; border-radius: 3px; }
  .line-height-wrapper:hover { border-color: #ccc; background: #e1e1e1; }
  .icon-lh { margin-right: 0px; color: #475569; }
  .line-height-select { width: 35px; border: none; background: transparent; }

  .color-picker-btn {
      position: relative; width: 28px; height: 26px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 3px; cursor: pointer;
  }
  .color-picker-btn:hover { background: #dbeafe; border-color: #bfdbfe; }
  .color-bar { width: 18px; height: 4px; margin-top: 1px; }
  .color-picker-btn input { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; }

  /* CAJA DE MARCADORES (EXTREMO DERECHO) */
  .insert-marker-container { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
  .insert-marker-container label { font-size: 11px; color: #2b579a; font-weight: 700; margin-left: 2px; }
  .insert-marker-container select { 
      height: 30px; border: 1px solid #2b579a; background: white; width: 190px; padding-left: 8px; border-radius: 4px; font-weight: 600; color: #333;
  }

  /* --- 3. WORKSPACE (MESA GRIS) --- */
  .workspace {
      flex: 1;
      background: #5f6368; /* Gris oscuro Word */
      position: relative;
      overflow: hidden; /* El contenedor externo NO hace scroll */
  }

  .scroll-container {
      width: 100%;
      height: 100%;
      overflow: auto; /* ESTE SI HACE SCROLL */
      display: flex;
      justify-content: center; /* Centrar horizontalmente */
      padding: 40px;
  }

  /* PAPER CONTAINER CON ZOOM */
  .paper-container {
      /* La propiedad ZOOM hace la magia */
      display: flex;
      justify-content: center;
  }

  .paper-sheet {
      width: 816px; /* Ancho Carta estándar */
      min-height: 1056px; /* Alto Carta estándar */
      background: white;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      cursor: text;
      margin-bottom: 50px;
  }

  .editor-content {
      padding: 96px; /* 1 pulgada margen */
      outline: none;
      font-size: 16px; 
      line-height: 1.5;
      color: black;
      min-height: 100%;
  }

  /* --- 4. BARRA DE ESTADO --- */
  .status-bar {
      height: 24px;
      background: #f3f3f3;
      border-top: 1px solid #d1d1d1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 15px;
      font-size: 11px;
      color: #555;
      flex-shrink: 0;
  }
  .status-right { display: flex; align-items: center; gap: 10px; }
  .status-right button { background: none; border: none; cursor: pointer; color: #555; display: flex; align-items: center; }
  .status-right button:hover { color: #000; }
  .zoom-slider-container { display: flex; align-items: center; width: 100px; }
  .zoom-slider { width: 100%; cursor: pointer; }
  .zoom-text { width: 35px; text-align: center; }

  /* TIPTAP */
  :global(.ProseMirror) { min-height: 100%; outline: none; }
  :global(.ProseMirror p) { margin-bottom: 0em; margin-top: 0; }
  :global(.ProseMirror ul, .ProseMirror ol) { padding-left: 1.5em; }
</style>