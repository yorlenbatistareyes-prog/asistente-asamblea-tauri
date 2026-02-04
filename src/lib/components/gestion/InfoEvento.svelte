<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  // --- TIPTAP Y EXTENSIONES ---
  import { Editor, Extension } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  import TextAlign from '@tiptap/extension-text-align';
  import { TextStyle } from '@tiptap/extension-text-style';
  import { Color } from '@tiptap/extension-color';
  import Link from '@tiptap/extension-link';
  import TaskList from '@tiptap/extension-task-list';
  import TaskItem from '@tiptap/extension-task-item';
  import FontFamily from '@tiptap/extension-font-family';
  import Placeholder from '@tiptap/extension-placeholder';

  // --- ICONOS ---
  import { 
    Save, Calendar, MapPin, Bookmark, Clock, Info, 
    AlignLeft, Bold, Italic, Underline as UnderIcon, List, 
    AlignCenter, AlignRight, AlignJustify, Eraser, Building, Users, Plus, X, 
    MonitorPlay, FileText, Palette, Link as LinkIcon, ListTodo,
    ListOrdered, Undo, Redo, Minus, IndentDecrease, IndentIncrease
  } from 'lucide-svelte';

  // --- EXTENSIONES PERSONALIZADAS (Igual que en Correspondencia) ---
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

  // --- VARIABLES DE EVENTO ---
  let asambleaId: number | null = null;
  let tema = "";
  let fecha = "";
  
  // --- LÓGICA DE SALONES ---
  let locales: any[] = [];
  let idLocal: number | null = null; 
  let localDetalle: any = null;      

  // --- VARIABLES DE ENSAYOS ---
  let ensayoLugar = "";
  let ensayoFecha = "";
  let ensayoHora = "";
  let jwStreamStudio = false;
  let instruccionesEsp = ""; 

  // --- MODAL CREAR SALÓN ---
  let mostrarModalSalon = false;
  let nuevoSalon = { nombre: "", direccion: "", capacidad: 0 };

  // --- TIPTAP INSTANCIAS ---
  let elementOrientaciones: HTMLElement;
  let elementNotas: HTMLElement;
  let editorOrientaciones: Editor;
  let editorNotas: Editor;
  let htmlOrientaciones = "";
  let htmlNotas = "";

  // --- HELPERS PARA EDITOR ---
  const ejecutar = (editor: Editor, cb: (chain: any) => any) => {
    if (editor) cb(editor.chain().focus()).run();
  };

  function setLink(editor: Editor) {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  function cambiarColor(editor: Editor, event: Event) {
    const target = event.target as HTMLInputElement;
    editor.chain().focus().setColor(target.value).run();
  }

  function cambiarFuente(editor: Editor, event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target.value) editor.chain().focus().setFontFamily(target.value).run();
  }

  function cambiarTamano(editor: Editor, event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target.value) {
        // @ts-ignore
        editor.chain().focus().setFontSize(target.value).run();
    }
  }

  function cambiarInterlineado(editor: Editor, event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target.value) {
        // @ts-ignore
        editor.chain().focus().setLineHeight(target.value).run();
    }
  }

  function indentar(editor: Editor) {
    if (editor.isActive('taskList')) { editor.chain().focus().sinkListItem('taskItem').run(); } 
    else { editor.chain().focus().sinkListItem('listItem').run(); }
  }

  function desindentar(editor: Editor) {
    if (editor.isActive('taskList')) { editor.chain().focus().liftListItem('taskItem').run(); } 
    else { editor.chain().focus().liftListItem('listItem').run(); }
  }

  // --- CICLO DE VIDA ---
  onMount(async () => {
    try {
      await cargarLocales();
      const asamblea = await invoke('obtener_asamblea_activa') as any;
      
      if (asamblea) {
        asambleaId = asamblea.id;
        tema = asamblea.tema || "";
        fecha = asamblea.fecha || "";
        idLocal = asamblea.local_id || null;
        ensayoLugar = asamblea.ensayo_lugar || "";
        ensayoFecha = asamblea.ensayo_fecha || "";
        ensayoHora = asamblea.ensayo_hora || "";
        instruccionesEsp = asamblea.instrucciones_esp || "";
        jwStreamStudio = asamblea.jw_stream_studio === 1;
        htmlOrientaciones = asamblea.recorridos_info || "";
        htmlNotas = asamblea.ensayo_notas || "";
      }
      initEditors();
    } catch (error) { console.error(error); }
  });

  async function cargarLocales() {
      locales = await invoke('obtener_locales') as any[];
  }

  $: if (idLocal && locales.length > 0) {
      localDetalle = locales.find(l => l.id === idLocal);
  } else {
      localDetalle = null;
  }

  function quitarSeleccion() {
    idLocal = null; 
  }

  function initEditors() {
      const extensionesComunes = [
        StarterKit, Underline, TextStyle, Color, FontFamily, FontSize, LineHeight,
        TaskList, TaskItem.configure({ nested: true }),
        Link.configure({ openOnClick: false }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder: 'Escriba aquí...' })
      ];

      editorOrientaciones = new Editor({
        element: elementOrientaciones,
        extensions: extensionesComunes,
        content: htmlOrientaciones, 
        onUpdate: ({ editor }) => { htmlOrientaciones = editor.getHTML(); },
        onTransaction: () => { editorOrientaciones = editorOrientaciones; }
      });

      editorNotas = new Editor({
        element: elementNotas,
        extensions: extensionesComunes,
        content: htmlNotas,
        onUpdate: ({ editor }) => { htmlNotas = editor.getHTML(); },
        onTransaction: () => { editorNotas = editorNotas; }
      });
  }

  onDestroy(() => {
    editorOrientaciones?.destroy();
    editorNotas?.destroy();
  });

  async function guardarNuevoSalon() {
      if(!nuevoSalon.nombre) return alert("Falta el nombre");
      try {
          await invoke('crear_local', { ...nuevoSalon });
          await cargarLocales();
          const recienCreado = locales.find(l => l.nombre === nuevoSalon.nombre);
          if (recienCreado) idLocal = recienCreado.id;
          nuevoSalon = { nombre: "", direccion: "", capacidad: 0 };
          mostrarModalSalon = false;
      } catch(e) { alert(e); }
  }

  async function guardar() {
    try {
      await invoke('guardar_info_evento', {
        id: asambleaId, tema, fecha, localId: idLocal,
        ensayoLugar, ensayoFecha, ensayoHora, ensayoNotas: htmlNotas,
        recorridosInfo: htmlOrientaciones, instruccionesEsp, esJwStream: jwStreamStudio
      });
      alert("✅ Configuración guardada correctamente");
    } catch (e) { alert("❌ Error al guardar: " + e); }
  }
</script>

<div class="contenedor">
  
  <div class="card-config">
    <div class="header-card">
      <h3><Bookmark size={20} color="#2563eb"/> Información General</h3>
      <button class="btn-save" on:click={guardar} data-tooltip="Guardar cambios"><Save size={18}/> Guardar Todo</button>
    </div>
    
    <div class="formulario grid-2 border-bottom pb-20">
      <div class="campo full"><label>Tema de la Asamblea</label><input type="text" bind:value={tema} class="input-big"/></div>
      <div class="campo"><label><Calendar size={14}/> Fecha</label><input type="text" bind:value={fecha} /></div>
      
      <div class="campo">
        <label><MapPin size={14}/> Salón de Asambleas</label>
        <div class="selector-salon">
            <select bind:value={idLocal}>
                <option value={null}>-- Seleccionar Salón --</option>
                {#each locales as l}<option value={l.id}>{l.nombre}</option>{/each}
            </select>
            <button class="btn-plus" on:click={() => mostrarModalSalon = true} data-tooltip="Nuevo Salón"><Plus size={16}/></button>
        </div>
      </div>
    </div>

    {#if localDetalle}
        <div class="salon-info-card">
            <button class="btn-close-card" on:click={quitarSeleccion} title="Quitar este salón"><X size={16} /></button>
            <div class="icon-building"><Building size={24}/></div>
            <div class="info-text">
                <span class="l-nombre">{localDetalle.nombre}</span>
                <span class="l-dir">{localDetalle.direccion || 'Sin dirección registrada'}</span>
            </div>
            <div class="info-cap">
                <Users size={16}/><span>{localDetalle.capacidad || 0}</span><small>asientos</small>
            </div>
        </div>
    {/if}

    <div class="seccion-titulo mt-30">
        <Clock size={18} color="#059669"/> 
        <h4>Programación de Ensayos</h4>
    </div>

    <div class="grid-3 mb-15">
      <div class="campo">
        <label>Lugar de Ensayo</label>
        <input type="text" bind:value={ensayoLugar} placeholder="Ej: Mismo Salón" />
      </div>
      <div class="campo">
        <label>Fecha de Ensayo</label>
        <input type="date" bind:value={ensayoFecha} />
      </div>
      <div class="campo">
        <label>Hora</label>
        <input type="time" bind:value={ensayoHora} />
      </div>
    </div>

    <div class="editor-block">
      <label><Info size={14}/> Notas e Información para Ensayos</label>
      <div class="tiptap-frame">
        {#if editorNotas}
          <div class="toolbar">
             <div class="group">
                <button on:click={() => ejecutar(editorNotas, c => c.setTextAlign('left'))} data-tooltip="Izquierda"><AlignLeft size={14}/></button>
                <button on:click={() => ejecutar(editorNotas, c => c.setTextAlign('center'))} data-tooltip="Centro"><AlignCenter size={14}/></button>
                <button on:click={() => ejecutar(editorNotas, c => c.setTextAlign('right'))} data-tooltip="Derecha"><AlignRight size={14}/></button>
                <button on:click={() => ejecutar(editorNotas, c => c.setTextAlign('justify'))} data-tooltip="Justificar"><AlignJustify size={14}/></button>
             </div>
             <div class="sep"></div>

             <div class="group inputs">
                <select class="native-select font-family" on:change={(e) => cambiarFuente(editorNotas, e)} title="Fuente">
                    <option value="" selected>Fuente</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                    <option value="cursive">Cursive</option>
                </select>
                <select class="native-select font-size" on:change={(e) => cambiarTamano(editorNotas, e)} title="Tamaño">
                    <option value="" disabled selected>Tm.</option>
                    <option value="12">12</option><option value="14">14</option><option value="16">16</option>
                    <option value="18">18</option><option value="20">20</option><option value="24">24</option>
                </select>
             </div>
             <div class="sep"></div>

             <div class="group">
                <button on:click={() => ejecutar(editorNotas, c => c.toggleBold())} class:active={editorNotas.isActive('bold')} data-tooltip="Negrita"><Bold size={14}/></button>
                <button on:click={() => ejecutar(editorNotas, c => c.toggleItalic())} class:active={editorNotas.isActive('italic')} data-tooltip="Cursiva"><Italic size={14}/></button>
                <button on:click={() => ejecutar(editorNotas, c => c.toggleUnderline())} class:active={editorNotas.isActive('underline')} data-tooltip="Subrayado"><UnderIcon size={14}/></button>
             </div>
             <div class="sep"></div>

             <div class="group">
                <button on:click={() => setLink(editorNotas)} class:active={editorNotas.isActive('link')} data-tooltip="Enlace"><LinkIcon size={14}/></button>
                <div class="color-wrapper" data-tooltip="Color">
                    <input type="color" on:input={(e) => cambiarColor(editorNotas, e)} value={editorNotas.getAttributes('textStyle').color || '#000000'} />
                    <Palette size={14} />
                </div>
             </div>
             <div class="sep"></div>

             <div class="group">
                <select class="native-select line-height" on:change={(e) => cambiarInterlineado(editorNotas, e)} title="Interlineado">
                    <option value="" disabled selected>↕</option>
                    <option value="1.0">1.0</option><option value="1.5">1.5</option><option value="2.0">2.0</option>
                </select>
                <button on:click={() => ejecutar(editorNotas, c => c.toggleBulletList())} class:active={editorNotas.isActive('bulletList')} data-tooltip="Puntos"><List size={14}/></button>
                <button on:click={() => ejecutar(editorNotas, c => c.toggleOrderedList())} class:active={editorNotas.isActive('orderedList')} data-tooltip="Números"><ListOrdered size={14}/></button>
                <button on:click={() => ejecutar(editorNotas, c => c.toggleTaskList())} class:active={editorNotas.isActive('taskList')} data-tooltip="Tareas"><ListTodo size={14}/></button>
                <button on:click={() => desindentar(editorNotas)} data-tooltip="Disminuir"><IndentDecrease size={14}/></button>
                <button on:click={() => indentar(editorNotas)} data-tooltip="Aumentar"><IndentIncrease size={14}/></button>
             </div>

             <div class="ml-auto group">
                <button on:click={() => ejecutar(editorNotas, c => c.setHorizontalRule())} data-tooltip="Línea"><Minus size={14}/></button>
                <button on:click={() => ejecutar(editorNotas, c => c.unsetAllMarks())} data-tooltip="Limpiar"><Eraser size={14}/></button>
             </div>
          </div>
        {/if}
        <div bind:this={elementNotas} class="editor-content"></div>
      </div>
    </div>

    <div class="seccion-titulo mt-30">
        <FileText size={18} color="#d97706"/> 
        <h4>Orientaciones en Plataforma</h4>
    </div>

    <div class="editor-block">
      <label>Información sobre orientaciones</label>
      <div class="tiptap-frame">
        {#if editorOrientaciones}
          <div class="toolbar">
             <div class="group">
                <button on:click={() => ejecutar(editorOrientaciones, c => c.setTextAlign('left'))} data-tooltip="Izquierda"><AlignLeft size={14}/></button>
                <button on:click={() => ejecutar(editorOrientaciones, c => c.setTextAlign('center'))} data-tooltip="Centro"><AlignCenter size={14}/></button>
                <button on:click={() => ejecutar(editorOrientaciones, c => c.setTextAlign('right'))} data-tooltip="Derecha"><AlignRight size={14}/></button>
                <button on:click={() => ejecutar(editorOrientaciones, c => c.setTextAlign('justify'))} data-tooltip="Justificar"><AlignJustify size={14}/></button>
             </div>
             <div class="sep"></div>

             <div class="group inputs">
                <select class="native-select font-family" on:change={(e) => cambiarFuente(editorOrientaciones, e)} title="Fuente">
                    <option value="" selected>Fuente</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                    <option value="cursive">Cursive</option>
                </select>
                <select class="native-select font-size" on:change={(e) => cambiarTamano(editorOrientaciones, e)} title="Tamaño">
                    <option value="" disabled selected>Tm.</option>
                    <option value="12">12</option><option value="14">14</option><option value="16">16</option>
                    <option value="18">18</option><option value="20">20</option><option value="24">24</option>
                </select>
             </div>
             <div class="sep"></div>

             <div class="group">
                <button on:click={() => ejecutar(editorOrientaciones, c => c.toggleBold())} class:active={editorOrientaciones.isActive('bold')} data-tooltip="Negrita"><Bold size={14}/></button>
                <button on:click={() => ejecutar(editorOrientaciones, c => c.toggleItalic())} class:active={editorOrientaciones.isActive('italic')} data-tooltip="Cursiva"><Italic size={14}/></button>
                <button on:click={() => ejecutar(editorOrientaciones, c => c.toggleUnderline())} class:active={editorOrientaciones.isActive('underline')} data-tooltip="Subrayado"><UnderIcon size={14}/></button>
             </div>
             <div class="sep"></div>

             <div class="group">
                <button on:click={() => setLink(editorOrientaciones)} class:active={editorOrientaciones.isActive('link')} data-tooltip="Enlace"><LinkIcon size={14}/></button>
                <div class="color-wrapper" data-tooltip="Color">
                    <input type="color" on:input={(e) => cambiarColor(editorOrientaciones, e)} value={editorOrientaciones.getAttributes('textStyle').color || '#000000'} />
                    <Palette size={14} />
                </div>
             </div>
             <div class="sep"></div>

             <div class="group">
                <select class="native-select line-height" on:change={(e) => cambiarInterlineado(editorOrientaciones, e)} title="Interlineado">
                    <option value="" disabled selected>↕</option>
                    <option value="1.0">1.0</option><option value="1.5">1.5</option><option value="2.0">2.0</option>
                </select>
                <button on:click={() => ejecutar(editorOrientaciones, c => c.toggleBulletList())} class:active={editorOrientaciones.isActive('bulletList')} data-tooltip="Puntos"><List size={14}/></button>
                <button on:click={() => ejecutar(editorOrientaciones, c => c.toggleOrderedList())} class:active={editorOrientaciones.isActive('orderedList')} data-tooltip="Números"><ListOrdered size={14}/></button>
                <button on:click={() => ejecutar(editorOrientaciones, c => c.toggleTaskList())} class:active={editorOrientaciones.isActive('taskList')} data-tooltip="Tareas"><ListTodo size={14}/></button>
                <button on:click={() => desindentar(editorOrientaciones)} data-tooltip="Disminuir"><IndentDecrease size={14}/></button>
                <button on:click={() => indentar(editorOrientaciones)} data-tooltip="Aumentar"><IndentIncrease size={14}/></button>
             </div>

             <div class="ml-auto group">
                <button on:click={() => ejecutar(editorOrientaciones, c => c.setHorizontalRule())} data-tooltip="Línea"><Minus size={14}/></button>
                <button on:click={() => ejecutar(editorOrientaciones, c => c.unsetAllMarks())} data-tooltip="Limpiar"><Eraser size={14}/></button>
             </div>
          </div>
        {/if}
        <div bind:this={elementOrientaciones} class="editor-content"></div>
      </div>
    </div>

    <div class="footer-options mt-30">
        <label class="stream-check-compact">
            <input type="checkbox" bind:checked={jwStreamStudio} />
            <div class="label-check">
                <MonitorPlay size={16} />
                <span>Transmitir por <strong>JW Stream Studio</strong></span>
            </div>
        </label>
    </div>

  </div>
</div>

{#if mostrarModalSalon}
    <div class="modal-backdrop">
        <div class="modal">
            <div class="modal-header"><h3>Nuevo Salón</h3><button on:click={() => mostrarModalSalon = false}><X size={18}/></button></div>
            <div class="modal-body">
                <label>Nombre</label><input type="text" bind:value={nuevoSalon.nombre} placeholder="Ej: Salón Cotorro"/>
                <label>Dirección</label><input type="text" bind:value={nuevoSalon.direccion} placeholder="Calle..."/>
                <label>Capacidad</label><input type="number" bind:value={nuevoSalon.capacidad}/>
                <button class="btn-create" on:click={guardarNuevoSalon}>Crear y Asignar</button>
            </div>
        </div>
    </div>
{/if}

<style>
  .contenedor { display: flex; flex-direction: column; gap: 20px; padding-bottom: 40px; }
  .card-config { background: white; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
  
  .header-card { display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px; }
  .header-card h3 { margin: 0; display: flex; align-items: center; gap: 10px; font-size: 18px; color: #1e293b; }

  .seccion-titulo { display: flex; align-items: center; gap: 8px; margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
  .seccion-titulo h4 { margin: 0; font-size: 15px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 15px; }
  .full { grid-column: span 2; }
  .mt-30 { margin-top: 30px; }
  .mb-15 { margin-bottom: 15px; }
  .pb-20 { padding-bottom: 20px; }
  .border-bottom { border-bottom: 1px solid #e2e8f0; }
  
  label { display: flex; gap: 8px; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase; }
  input, select { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%; box-sizing: border-box; font-size: 14px; color: #334155; transition: border 0.2s; }
  input:focus, select:focus { border-color: #2563eb; outline: none; }
  .input-big { font-size: 16px; font-weight: 600; color: #0f172a; }

  .selector-salon { display: flex; gap: 8px; }
  .btn-plus { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; width: 42px; cursor: pointer; color: #2563eb; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
  .btn-plus:hover { background: #dbeafe; }

  /* TARJETA SALON */
  .salon-info-card { position: relative; margin-top: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; display: flex; align-items: center; gap: 15px; }
  .btn-close-card { position: absolute; top: -10px; right: -10px; background: #ef4444; color: white; border: 2px solid white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  .icon-building { background: white; padding: 10px; border-radius: 8px; color: #2563eb; border: 1px solid #e2e8f0; }
  .info-text { flex: 1; display: flex; flex-direction: column; }
  .l-nombre { font-weight: 700; color: #1e293b; font-size: 15px; }
  .l-dir { font-size: 13px; color: #64748b; }
  .info-cap { display: flex; flex-direction: column; align-items: center; background: white; padding: 5px 12px; border-radius: 6px; border: 1px solid #e2e8f0; color: #0f172a; }
  .info-cap span { font-weight: 800; font-size: 16px; }
  .info-cap small { font-size: 9px; color: #94a3b8; text-transform: uppercase; }

  /* EDITORES TIPTAP MEJORADOS */
  .tiptap-frame { border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; min-height: 180px; display: flex; flex-direction: column; overflow: visible; /* IMPORTANTE: Para que se vean los tooltips */ position: relative; z-index: 10; }
  
  .toolbar { background: #f8fafc; padding: 5px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 2px; align-items: center; flex-wrap: wrap; border-radius: 8px 8px 0 0; }
  
  .group { display: flex; align-items: center; gap: 1px; }
  .sep { width: 1px; height: 18px; background: #cbd5e1; margin: 0 6px; }
  .ml-auto { margin-left: auto; }

  .toolbar button { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid transparent; border-radius: 3px; cursor: pointer; color: #475569; position: relative; }
  .toolbar button:hover { background: #e2e8f0; color: #0f172a; }
  .toolbar button.active { background: #dbeafe; color: #1e40af; border-color: #bfdbfe; }

  .native-select { height: 26px; border: 1px solid #cbd5e1; border-radius: 3px; padding: 0 2px; font-size: 12px; color: #334155; outline: none; cursor: pointer; background: white; }
  .font-family { width: 80px; } .font-size { width: 45px; } .line-height { width: 40px; }

  .color-wrapper { position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 3px; }
  .color-wrapper:hover { background-color: #e2e8f0; }
  .color-wrapper input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

  .editor-content { padding: 20px; flex: 1; outline: none; font-size: 14px; line-height: 1.5; border-radius: 0 0 8px 8px; }

  /* TOOLTIPS VISIBLES (Z-INDEX ALTO) */
  [data-tooltip]:hover::after {
    content: attr(data-tooltip);
    position: absolute; 
    bottom: 115%; /* Un poco más arriba para que no choque */
    left: 50%; 
    transform: translateX(-50%);
    background-color: #1e293b; 
    color: white; 
    padding: 4px 8px; 
    border-radius: 4px;
    font-size: 11px; 
    white-space: nowrap; 
    z-index: 9999; /* Z-INDEX MUY ALTO */
    pointer-events: none;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3); 
    font-weight: 500;
  }
  
  [data-tooltip]:hover::before {
    content: ''; 
    position: absolute; 
    bottom: 100%; 
    left: 50%; 
    transform: translateX(-50%);
    border-width: 5px; 
    border-style: solid; 
    border-color: #1e293b transparent transparent transparent;
    pointer-events: none;
    z-index: 9999;
  }

  /* CHECKBOX COMPACTO */
  .stream-check-compact { display: inline-flex; align-items: center; gap: 10px; padding: 8px 15px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 20px; cursor: pointer; transition: all 0.2s; width: fit-content; }
  .stream-check-compact:hover { background: #dbeafe; border-color: #93c5fd; }
  .label-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1e40af; text-transform: none; font-weight: 500; }
  .stream-check-compact input { width: 16px; height: 16px; margin: 0; }

  .btn-save { background: #2563eb; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; display: flex; gap: 8px; font-weight: 600; font-size: 13px; transition: background 0.2s; }
  .btn-save:hover { background: #1d4ed8; }

  /* MODAL */
  .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 10000; }
  .modal { background: white; width: 350px; padding: 25px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
  .modal-header { display: flex; justify-content: space-between; margin-bottom: 20px; } .modal-header h3 { margin: 0; font-size: 18px; } .modal-header button { border: none; background: none; cursor: pointer; color: #64748b; }
  .modal-body { display: flex; flex-direction: column; gap: 12px; }
  .btn-create { background: #0f172a; color: white; padding: 10px; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px; font-weight: 600; }

  /* ESTILOS TIPTAP INTERNOS */
  :global(.ProseMirror) { outline: none; min-height: 100px; }
  :global(.ProseMirror p) { margin-bottom: 0.5em; margin-top: 0; }
  :global(.ProseMirror ul, .ProseMirror ol) { padding-left: 1.5rem; margin: 0.5rem 0; }
  :global(.ProseMirror a) { color: #2563eb; text-decoration: underline; cursor: pointer; }
  :global(.ProseMirror hr) { border: none; border-top: 2px solid #cbd5e1; margin: 1rem 0; }
  :global(.ProseMirror p.is-editor-empty:first-child::before) { color: #94a3b8; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
  
  :global(ul[data-type="taskList"]) { list-style: none; padding: 0; }
  :global(ul[data-type="taskList"] li) { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
  :global(ul[data-type="taskList"] li > label) { display: flex; align-items: center; user-select: none; margin-right: 4px; }
  :global(ul[data-type="taskList"] li > div) { flex: 1; }
  :global(ul[data-type="taskList"] input[type="checkbox"]) { width: 16px; height: 16px; cursor: pointer; margin: 0; }
</style>