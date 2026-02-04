<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  // --- TIPTAP CORE & EXTENSIONES ---
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
  
  // --- EXTENSIONES (Checklist) ---
  import TaskList from '@tiptap/extension-task-list';
  import TaskItem from '@tiptap/extension-task-item';

  // --- ICONOS ---
  import { 
    Save, Mic, UserCheck, MessageSquare, ArrowLeft, FileText,
    Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Palette, List, ListOrdered, Undo, Redo, Eraser, 
    Link as LinkIcon, Minus, 
    ListTodo, IndentDecrease, IndentIncrease
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();
  export let seccionInicial = 'oradores';

  // --- EXTENSIÓN PERSONALIZADA: TAMAÑO DE FUENTE ---
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

  // --- EXTENSIÓN CORREGIDA: INTERLINEADO ---
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
        // CORRECCIÓN AQUÍ: Añadimos (type: string) para solucionar el error ts(7006)
        setLineHeight: (lineHeight: string) => ({ commands }) => {
           return this.options.types.every((type: string) => commands.updateAttributes(type, { lineHeight }));
        },
      };
    },
  });

  // --- VARIABLES ---
  let tipoActivo = seccionInicial;
  let element: HTMLElement;
  let editor: Editor;       
  let cargando = false;
  let contenidoCargado = "";

  // --- CARGAR DATOS ---
  async function cargarPlantilla() {
    cargando = true;
    try {
      const respuesta = await invoke('obtener_plantilla', { id: tipoActivo }) as string;
      contenidoCargado = respuesta || `<p>Escriba aquí el modelo de carta para <strong>${tipoActivo.toUpperCase()}</strong>...</p>`;
      if (editor) editor.commands.setContent(contenidoCargado);
    } catch (e) {
      console.error("Error cargando:", e);
      if(editor) editor.commands.setContent("<p style='color:red'>Error al conectar con la base de datos.</p>");
    } finally {
      cargando = false;
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
        Placeholder.configure({ placeholder: 'Escriba el contenido de la carta...' }),
        TaskList,
        TaskItem.configure({ nested: true }),
      ],
      content: '', 
      onTransaction: () => { editor = editor; },
    });
    cargarPlantilla();
  });

  onDestroy(() => { if (editor) editor.destroy(); });

  // --- GUARDAR ---
  async function actualizar() {
    if (!editor) return;
    try {
      const htmlFinal = editor.getHTML();
      await invoke('guardar_plantilla', { id: tipoActivo, contenido: htmlFinal });
      alert(`✅ Plantilla de ${tipoActivo.toUpperCase()} guardada correctamente.`);
    } catch (e) {
      alert("Error al guardar: " + e);
    }
  }

  // --- FUNCIONES AUXILIARES ---
  function cambiarFuente(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target.value) editor.chain().focus().setFontFamily(target.value).run();
  }

  function cambiarTamano(event: Event) {
    const target = event.target as HTMLSelectElement;
    const val = target.value;
    if (val) {
      // @ts-ignore
      editor.chain().focus().setFontSize(val).run();
    }
  }

  function cambiarInterlineado(event: Event) {
    const target = event.target as HTMLSelectElement;
    const val = target.value;
    if (val && editor) {
       // @ts-ignore
       editor.chain().focus().setLineHeight(val).run();
    }
  }

  function cambiarColor(event: Event) {
    const target = event.target as HTMLInputElement;
    editor.chain().focus().setColor(target.value).run();
  }
  
  function addMarker(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target.value && editor) {
      editor.chain().focus().insertContent(`{{${target.value}}}`).run();
      target.value = ""; 
    }
  }
  
  function setLink() {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  function indentar() {
    if (editor.isActive('taskList')) {
        editor.chain().focus().sinkListItem('taskItem').run();
    } else {
        editor.chain().focus().sinkListItem('listItem').run();
    }
  }

  function desindentar() {
    if (editor.isActive('taskList')) {
        editor.chain().focus().liftListItem('taskItem').run();
    } else {
        editor.chain().focus().liftListItem('listItem').run();
    }
  }
</script>

<div class="layout">
  
  <aside class="sidebar">
    <button class="btn-volver" on:click={() => dispatch('close')}>
      <ArrowLeft size={18} /> Volver
    </button>
    <div class="menu-info">
      <div class="label-menu">EDITANDO:</div>
      <div class="icon-box">
        {#if tipoActivo === 'oradores'} <Mic size={32} /> {/if}
        {#if tipoActivo === 'presidentes'} <UserCheck size={32} /> {/if}
        {#if tipoActivo === 'oraciones'} <MessageSquare size={32} /> {/if}
      </div>
      <span class="titulo-seccion">{tipoActivo.toUpperCase()}</span>
    </div>
  </aside>

  <main>
    <header>
      <div class="titulo-header">
        <FileText size={20}/>
        <h2>Editor de Cartas</h2>
      </div>
      <button class="btn-save" on:click={actualizar} data-tooltip="Guardar en Base de Datos">
        <Save size={16} /> Guardar Cambios
      </button>
    </header>

    <div class="info-texto">
      <h3>
        {#if tipoActivo === 'oradores'} Carta de Asignación para Discursantes {/if}
        {#if tipoActivo === 'presidentes'} Carta de Asignación para Presidentes {/if}
        {#if tipoActivo === 'oraciones'} Carta de Asignación para Oraciones {/if}
      </h3>
      <p>Modifique el modelo base a continuación. Las etiquetas emergentes le indicarán la función de cada botón.</p>
    </div>

    <div class="workspace">
      <div class="editor-container">
        
        {#if editor}
          <div class="toolbar">
              <div class="group">
                  <button on:click={() => editor.chain().focus().setTextAlign('left').run()} class:active={editor.isActive({ textAlign: 'left' })} data-tooltip="Alinear Izquierda">
                    <AlignLeft size={16}/>
                  </button>
                  <button on:click={() => editor.chain().focus().setTextAlign('center').run()} class:active={editor.isActive({ textAlign: 'center' })} data-tooltip="Centrar">
                    <AlignCenter size={16}/>
                  </button>
                  <button on:click={() => editor.chain().focus().setTextAlign('right').run()} class:active={editor.isActive({ textAlign: 'right' })} data-tooltip="Alinear Derecha">
                    <AlignRight size={16}/>
                  </button>
                  <button on:click={() => editor.chain().focus().setTextAlign('justify').run()} class:active={editor.isActive({ textAlign: 'justify' })} data-tooltip="Justificar">
                    <AlignJustify size={16}/>
                  </button>
              </div>
              <div class="separator"></div>

              <div class="group inputs">
                  <select class="native-select font-family" on:change={cambiarFuente} title="Fuente">
                      <option value="" selected>Fuente</option>
                      <option value="serif">Serif</option>
                      <option value="monospace">Monospace</option>
                      <option value="cursive">Cursive</option>
                  </select>
                  <select class="native-select font-size" on:change={cambiarTamano} title="Tamaño de Letra">
                      <option value="" disabled selected>Tamaño</option>
                      <option value="8">8</option>
                      <option value="10">10</option>
                      <option value="12">12</option>
                      <option value="14">14</option>
                      <option value="16">16</option>
                      <option value="18">18</option>
                      <option value="20">20</option>
                      <option value="24">24</option>
                      <option value="30">30</option>
                      <option value="36">36</option>
                  </select>
              </div>
              <div class="separator"></div>

              <div class="group">
                  <button on:click={() => editor.chain().focus().toggleBold().run()} class:active={editor.isActive('bold')} data-tooltip="Negrita (Ctrl+B)">
                    <Bold size={16} strokeWidth={2.5}/>
                  </button>
                  <button on:click={() => editor.chain().focus().toggleItalic().run()} class:active={editor.isActive('italic')} data-tooltip="Cursiva (Ctrl+I)">
                    <Italic size={16}/>
                  </button>
                  <button on:click={() => editor.chain().focus().toggleUnderline().run()} class:active={editor.isActive('underline')} data-tooltip="Subrayado (Ctrl+U)">
                    <UnderlineIcon size={16}/>
                  </button>
                  <button on:click={() => editor.chain().focus().toggleStrike().run()} class:active={editor.isActive('strike')} data-tooltip="Tachado">
                    <Strikethrough size={16}/>
                  </button>
              </div>
              <div class="separator"></div>

              <div class="group">
                <button on:click={() => editor.chain().focus().setHorizontalRule().run()} data-tooltip="Línea Horizontal">
                    <Minus size={16} />
                </button>
                <button on:click={setLink} class:active={editor.isActive('link')} data-tooltip="Insertar Enlace">
                    <LinkIcon size={16} />
                </button>
                <div class="color-wrapper" data-tooltip="Color del Texto">
                    <input type="color" on:input={cambiarColor} value={editor.getAttributes('textStyle').color || '#000000'} />
                    <Palette size={16} />
                </div>
                <button on:click={() => editor.chain().focus().unsetAllMarks().run()} data-tooltip="Borrar Formato">
                    <Eraser size={16} />
                </button>
               </div>
               <div class="separator"></div>

              <div class="group">
                  <select class="native-select line-height" on:change={cambiarInterlineado} title="Interlineado">
                     <option value="" disabled selected>↕</option>
                     <option value="1.0">1.0</option>
                     <option value="1.15">1.15</option>
                     <option value="1.5">1.5</option>
                     <option value="2.0">2.0</option>
                     <option value="2.5">2.5</option>
                     <option value="3.0">3.0</option>
                  </select>

                  <button on:click={() => editor.chain().focus().toggleBulletList().run()} class:active={editor.isActive('bulletList')} data-tooltip="Lista Puntos">
                    <List size={16}/>
                  </button>
                  <button on:click={() => editor.chain().focus().toggleOrderedList().run()} class:active={editor.isActive('orderedList')} data-tooltip="Lista Números">
                    <ListOrdered size={16}/>
                  </button>
                  <button on:click={() => editor.chain().focus().toggleTaskList().run()} class:active={editor.isActive('taskList')} data-tooltip="Lista de Tareas">
                    <ListTodo size={16}/>
                  </button>
                  
                  <button on:click={desindentar} data-tooltip="Disminuir Sangría" disabled={!(editor.can().liftListItem('listItem') || editor.can().liftListItem('taskItem'))}>
                    <IndentDecrease size={16}/>
                  </button>
                  <button on:click={indentar} data-tooltip="Aumentar Sangría" disabled={!(editor.can().sinkListItem('listItem') || editor.can().sinkListItem('taskItem'))}>
                    <IndentIncrease size={16}/>
                  </button>
              </div>
              <div class="separator"></div>

              <div class="group">
                <button on:click={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} data-tooltip="Deshacer">
                    <Undo size={16}/>
                  </button>
                  <button on:click={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} data-tooltip="Rehacer">
                    <Redo size={16}/>
                  </button>
              </div>

              <div class="group ml-auto">
                  <select on:change={addMarker} class="marker-select" title="Insertar variable automática">
                      <option value="" disabled selected>+ Insertar Dato Automático</option>
                      <optgroup label="General y Fecha">
                        <option value="FechaActualMediana">Fecha Actual Mediana (3 feb 2026)</option>
                        <option value="FechaActualCompleta">Fecha Actual Completa (3 de febrero...)</option>
                      </optgroup>
                      <optgroup label="Datos de la Persona">
                        <option value="SaludoSexo">Saludo según sexo</option>
                        <option value="Nombre">Nombre</option>
                        <option value="SegundoNombre">Segundo nombre</option>
                        <option value="Apellido">Apellido</option>
                        <option value="Apodo">Apodo</option>
                        <option value="Sufijo">Sufijo</option>
                      </optgroup>
                      <optgroup label="Asignación y Programa">
                        <option value="Tema">Tema</option>
                        <option value="Hora">Hora</option>
                        <option value="Duracion">Duración</option>
                        <option value="NumeroBosquejo">Número de Bosquejo</option>
                        <option value="TipoAsignacion">Tipo de asignación</option>
                        <option value="InstruccionesDemostraciones">Instrucciones (Demos/Entrevistas)</option>
                        <option value="EnlaceBosquejo">Enlace(s) del Bosquejo</option>
                      </optgroup>
                      <optgroup label="Evento y Circuito">
                        <option value="DesignacionCircuito">Designación del Circuito</option>
                        <option value="SeccionCircuito">Sección del circuito</option>
                        <option value="TipoEvento">Tipo de Evento</option>
                        <option value="TemaEvento">Tema del Evento</option>
                        <option value="FechaAsamblea">Fecha de Asamblea</option>
                      </optgroup>
                      <optgroup label="Ubicación y Lugar">
                        <option value="NombreLugar">Nombre del lugar</option>
                        <option value="Direccion">Dirección</option>
                        <option value="Ciudad">Ciudad</option>
                        <option value="EstadoProvincia">Estado o Provincia</option>
                        <option value="CodigoPostal">Código postal</option>
                        <option value="TelefonoPrincipal">Núm. de Teléfono Principal</option>
                        <option value="UbicacionGeografica">Ubicación Geográfica del Lugar</option>
                        <option value="InfoRecorrido">Información del Recorrido</option>
                      </optgroup>
                      <optgroup label="Ensayos">
                        <option value="EnvolturaEnsayo">Envoltura condicional de ensayo</option>
                        <option value="InfoCompletaEnsayos">Información completa de los ensayos</option>
                        <option value="NotasEnsayos">Notas para los ensayos</option>
                        <option value="LugarEnsayos">Lugar de los ensayos</option>
                        <option value="FechaHoraEnsayo">Fecha y hora del ensayo</option>
                        <option value="FechaEnsayos">Fecha de ensayos</option>
                        <option value="HoraEnsayos">Hora de ensayos</option>
                      </optgroup>
                      <optgroup label="Otros">
                        <option value="Notas">Notas</option>
                        <option value="InstruccionesEspeciales">Instrucciones Especiales</option>
                      </optgroup>
                  </select>
              </div>
          </div>
        {/if}

        <div class="editor-content" bind:this={element}></div>
      
      </div>
    </div>
  </main>
</div>

<style>
  /* LAYOUT */
  .layout { display: grid; grid-template-columns: 240px 1fr; height: 100vh; background: #f3f4f6; font-family: 'Segoe UI', sans-serif; }
  
  /* SIDEBAR */
  .sidebar { background: white; padding: 20px; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; align-items: center; }
  .btn-volver { align-self: flex-start; background: white; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; gap: 5px; color: #64748b; margin-bottom: 40px; transition: all 0.2s; }
  .btn-volver:hover { background: #f1f5f9; color: black; }
  
  .menu-info { text-align: center; }
  .label-menu { font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; margin-bottom: 15px; }
  .icon-box { width: 70px; height: 70px; background: #eff6ff; color: #2563eb; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
  .titulo-seccion { font-weight: 800; color: #334155; font-size: 14px; letter-spacing: 1px; }

  /* MAIN */
  main { display: flex; flex-direction: column; height: 100%; }
  
  header { background: #1e293b; color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; }
  .titulo-header { display: flex; align-items: center; gap: 10px; }
  h2 { margin: 0; font-size: 18px; font-weight: 600; }
  
  .btn-save { background: #2563eb; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; display: flex; gap: 8px; font-weight: 600; transition: background 0.2s; }
  .btn-save:hover { background: #1d4ed8; }

  .info-texto { background: white; padding: 20px 40px; border-bottom: 1px solid #e2e8f0; }
  .info-texto h3 { margin: 0 0 5px 0; font-size: 20px; color: #1e293b; font-weight: 700; }
  .info-texto p { margin: 0; font-size: 14px; color: #64748b; }

  .workspace { flex: 1; padding: 30px; overflow-y: auto; display: flex; justify-content: center; }

  /* EDITOR CONTAINER */
  .editor-container { width: 100%; max-width: 950px; background: white; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; overflow: visible; height: fit-content; min-height: 600px; }

  /* TOOLBAR */
  .toolbar { display: flex; align-items: center; background: #f8fafc; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; gap: 6px; flex-wrap: wrap; position: sticky; top: 0; z-index: 50; }
  .group { display: flex; align-items: center; gap: 2px; }
  .separator { width: 1px; height: 24px; background: #cbd5e1; margin: 0 6px; }
  .ml-auto { margin-left: auto; }

  .toolbar button { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid transparent; border-radius: 4px; color: #475569; cursor: pointer; transition: all 0.2s; position: relative; }
  .toolbar button:hover { background-color: #e2e8f0; color: #0f172a; }
  .toolbar button.active { background-color: #dbeafe; color: #1e40af; border-color: #93c5fd; }
  .toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }

  /* INPUTS */
  .native-select { height: 30px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 0 4px; font-size: 13px; color: #334155; outline: none; cursor: pointer; background: white; }
  .font-family { width: 100px; } .font-size { width: 60px; } .line-height { width: 45px; }
  
  .marker-select { height: 30px; border: 1px solid #bfdbfe; background: #eff6ff; color: #2563eb; font-weight: 600; border-radius: 4px; padding: 0 10px; outline: none; cursor: pointer; font-size: 13px; min-width: 200px; max-width: 250px; }
  
  .color-wrapper { position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; }
  .color-wrapper:hover { background-color: #e2e8f0; }
  .color-wrapper input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

  .editor-content { flex: 1; padding: 40px 50px; outline: none; font-size: 16px; line-height: 1.6; color: #1e293b; min-height: 500px; cursor: text; }

  /* TOOLTIPS CSS */
  [data-tooltip]:hover::after {
    content: attr(data-tooltip);
    position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%);
    background-color: #1e293b; color: white; padding: 5px 8px; border-radius: 4px;
    font-size: 11px; white-space: nowrap; z-index: 1000; pointer-events: none;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2); font-weight: 500;
  }
  
  [data-tooltip]:hover::before {
    content: ''; position: absolute; bottom: 95%; left: 50%; transform: translateX(-50%);
    border-width: 5px; border-style: solid; border-color: #1e293b transparent transparent transparent;
    pointer-events: none;
  }

  /* ESTILOS TIPTAP */
  :global(.ProseMirror) { outline: none; min-height: 100%; }
  :global(.ProseMirror p) { margin-bottom: 0.8em; }
  :global(.ProseMirror blockquote) { border-left: 3px solid #cbd5e1; padding-left: 1rem; color: #64748b; font-style: italic; }
  :global(.ProseMirror ul, .ProseMirror ol) { padding-left: 1.5rem; }
  :global(.ProseMirror a) { color: #2563eb; text-decoration: underline; cursor: pointer; }
  :global(.ProseMirror hr) { border: none; border-top: 2px solid #cbd5e1; margin: 2rem 0; }
  :global(.ProseMirror p.is-editor-empty:first-child::before) { color: #94a3b8; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
  /* ESTILOS CHECKLIST */
  :global(ul[data-type="taskList"]) { list-style: none; padding: 0; }
  :global(ul[data-type="taskList"] li) { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
  :global(ul[data-type="taskList"] li > label) { display: flex; align-items: center; user-select: none; margin-right: 4px; }
  :global(ul[data-type="taskList"] li > div) { flex: 1; }
  :global(ul[data-type="taskList"] input[type="checkbox"]) { width: 16px; height: 16px; cursor: pointer; }
</style>
