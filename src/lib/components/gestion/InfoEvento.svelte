<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { setResumen, addNota, setNotas, totalAsistencia, totalBautismos, congregacionesReportadas, totalCongregaciones, notasRapidas } from '$lib/stores/gestion';
  
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

  import Panel from '$lib/components/ui/Panel.svelte';
  import CalendarioRango from '$lib/components/ui/CalendarioRango.svelte';

  // --- ICONOS ---
  import { 
    Save, Calendar, MapPin, Bookmark, Clock, Info, 
    AlignLeft, Bold, Italic, Underline as UnderIcon, List, 
    AlignCenter, AlignRight, AlignJustify, Eraser, Building, Users, Plus, X, 
    MonitorPlay, FileText, Palette, Link as LinkIcon, ListTodo,
    ListOrdered, Minus, IndentDecrease, IndentIncrease, Edit, Pencil, Map, Flag
  } from 'lucide-svelte';

  // --- EXTENSIONES PERSONALIZADAS (TIPTAP) ---
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

  // --- VARIABLES DE EVENTO (GENERALES) ---
  let asambleaId: number | null = null;
  let tema = "";
  let fecha = "";
  let identificador = "";

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

  // --- MODALES Y ESTADOS DE EDICIÓN ---
  let mostrarModalSalon = false;
  let nuevoSalon = { nombre: "", direccion: "", capacidad: 0 };
  
  let mostrarModalDetalles = false; 
  let editandoFechaRango = false;

  let editEnsayos = false;
  let editOrientaciones = false;
  let editTransmision = false;

  // --- TIPTAP INSTANCIAS ---
  let elementOrientaciones: HTMLElement;
  let elementNotas: HTMLElement;
  let editorOrientaciones: Editor;
  let editorNotas: Editor;
  let htmlOrientaciones = "";
  let htmlNotas = "";

  // --- DATOS TEMPORALES ---
  let tempGeneral = {
    tema: '',
    identificador: '',
    idLocal: null as number | null,
    fechaInicio: null as Date | null,
    fechaFin: null as Date | null,
  };

  let tempEnsayos = { ensayoLugar: '', ensayoFecha: '', ensayoHora: '', htmlNotas: '' };
  let tempOrientaciones = { htmlOrientaciones: '', instruccionesEsp: '', jwStreamStudio: false };

  // Reactividad para el detalle del salón
  $: if (idLocal && locales.length > 0) {
      const encontrado = locales.find(l => l.id == idLocal);
      if (encontrado) localDetalle = encontrado;
  } else if (!idLocal) {
      localDetalle = null;
  }

  // --- FUNCIONES DEL MODAL GENERAL ---
  function abrirModalDetalles() {
    tempGeneral = {
      tema,
      identificador,
      idLocal,
      fechaInicio: null,
      fechaFin: null
    };
    if (fecha && fecha.includes(' a ')) {
        const [f1, f2] = fecha.split(' a ');
        tempGeneral.fechaInicio = new Date(f1);
        tempGeneral.fechaFin = new Date(f2);
    }
    mostrarModalDetalles = true;
  }

  function cerrarModalDetalles() {
    mostrarModalDetalles = false;
    editandoFechaRango = false;
  }

  async function guardarModalDetalles() {
    tema = tempGeneral.tema;
    identificador = tempGeneral.identificador;
    idLocal = tempGeneral.idLocal;
    
    if (tempGeneral.fechaInicio && tempGeneral.fechaFin) {
        const f1 = tempGeneral.fechaInicio.toISOString().split('T')[0];
        const f2 = tempGeneral.fechaFin.toISOString().split('T')[0];
        fecha = `${f1} a ${f2}`;
    }

    await guardar();
    mostrarModalDetalles = false;
  }

  function formatearRangoSimple(inicio: Date | null, fin: Date | null): string {
    if (!inicio || !fin) return fecha || "Seleccionar fechas...";
    const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${inicio.toLocaleDateString('es-ES', opciones)} - ${fin.toLocaleDateString('es-ES', opciones)}, ${inicio.getFullYear()}`;
  }

  function toggleCalendario() {
      if (mostrarModalDetalles) {
          editandoFechaRango = !editandoFechaRango;
      }
  }

  // --- HELPERS PARA EDITOR TIPTAP ---
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

  // --- ENSAYOS ---
  function iniciarEdicionEnsayos() {
    tempEnsayos = { ensayoLugar, ensayoFecha, ensayoHora, htmlNotas };
    if (editorNotas) {
      editorNotas.setEditable(true);
      editorNotas.commands.setContent(htmlNotas);
    }
    editEnsayos = true;
  }

  function cancelarEdicionEnsayos() {
    if (editorNotas) {
      editorNotas.setEditable(false);
      editorNotas.commands.setContent(htmlNotas);
    }
    editEnsayos = false;
  }

  async function guardarEnsayos() {
    ensayoLugar = tempEnsayos.ensayoLugar;
    ensayoFecha = tempEnsayos.ensayoFecha;
    ensayoHora = tempEnsayos.ensayoHora;
    htmlNotas = tempEnsayos.htmlNotas;
    await guardar();
    if (editorNotas) editorNotas.setEditable(false);
    editEnsayos = false;
  }

  // --- ORIENTACIONES ---
  function iniciarEdicionOrientaciones() {
    tempOrientaciones = { htmlOrientaciones, instruccionesEsp, jwStreamStudio };
    if (editorOrientaciones) {
      editorOrientaciones.setEditable(true);
      editorOrientaciones.commands.setContent(htmlOrientaciones);
    }
    editOrientaciones = true;
  }

  function cancelarEdicionOrientaciones() {
    if (editorOrientaciones) {
      editorOrientaciones.setEditable(false);
      editorOrientaciones.commands.setContent(htmlOrientaciones);
    }
    editOrientaciones = false;
  }

  async function guardarOrientaciones() {
    htmlOrientaciones = tempOrientaciones.htmlOrientaciones;
    instruccionesEsp = tempOrientaciones.instruccionesEsp;
    jwStreamStudio = tempOrientaciones.jwStreamStudio;
    await guardar();
    if (editorOrientaciones) editorOrientaciones.setEditable(false);
    editOrientaciones = false;
  }

  // --- CICLO DE VIDA ---
  onMount(async () => {
    try {
      locales = await invoke('obtener_locales') as any[];
      const dataGuardada = localStorage.getItem('asambleaActiva');
      let asamblea = null;
      
      if (dataGuardada) {
          const asambleaSeleccionada = JSON.parse(dataGuardada);
          asamblea = await invoke('obtener_asamblea_por_id', { id: asambleaSeleccionada.id }) as any;
      }
      
      if (asamblea) {
        asambleaId = asamblea.id;
        tema = asamblea.tema || "";
        fecha = asamblea.fecha || "";
        identificador = asamblea.identificador || "";
        idLocal = asamblea.local_id || null;

        ensayoLugar = asamblea.ensayo_lugar || ""; 
        ensayoFecha = asamblea.ensayo_fecha || "";
        ensayoHora = asamblea.ensayo_hora || "";
        instruccionesEsp = asamblea.instrucciones_esp || "";
        jwStreamStudio = asamblea.jw_stream_studio === true || asamblea.jw_stream_studio === 1;
        
        htmlOrientaciones = asamblea.recorridos_info || "";
        htmlNotas = asamblea.ensayo_notas || "";
      }

      initEditors();
    } catch (error) { 
        console.error("Error al cargar InfoEvento:", error); 
    }
  });

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
      editable: false,
      onUpdate: ({ editor }) => { if (editOrientaciones) tempOrientaciones.htmlOrientaciones = editor.getHTML(); },
      onTransaction: () => { editorOrientaciones = editorOrientaciones; }
    });

    editorNotas = new Editor({
      element: elementNotas,
      extensions: extensionesComunes,
      content: htmlNotas,
      editable: false,
      onUpdate: ({ editor }) => { if (editEnsayos) tempEnsayos.htmlNotas = editor.getHTML(); },
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
          locales = await invoke('obtener_locales') as any[];
          const recienCreado = locales.find(l => l.nombre === nuevoSalon.nombre);
          if (recienCreado) {
              tempGeneral.idLocal = recienCreado.id;
          }
          nuevoSalon = { nombre: "", direccion: "", capacidad: 0 };
          mostrarModalSalon = false;
      } catch(e) { alert(e); }
  }

  async function guardar() {
    try {
      await invoke('guardar_info_evento', {
        id: asambleaId, tema, fecha, identificador, localId: idLocal,
        ensayoLugar, ensayoFecha, ensayoHora, ensayoNotas: htmlNotas,
        recorridosInfo: htmlOrientaciones, instruccionesEsp, esJwStream: jwStreamStudio
      });
      alert("✅ Configuración guardada correctamente");
    } catch (e) { alert("❌ Error al guardar: " + e); }
  }
</script>

<div class="contenedor">
  
  <Panel padding="30px" clasesExtra="tarjeta-evento">
    <div class="header-card-lectura">
      <h3>Detalles de la asamblea</h3>
      <button class="btn-edit-burgundy" on:click={abrirModalDetalles} title="Editar detalles">
        <Pencil size={18} color="white"/>
      </button>
    </div>
    
    <div class="grid-lectura">
      <div class="col-lectura">
        <h4>Información de la asamblea</h4>
        
        <div class="fila-info">
          <span class="lbl">Tema:</span> 
          <span class="val destacado">{tema || 'Sin tema'}</span>
        </div>
        
        <div class="fila-info-split">
          <div class="bloque-dato">
            <span class="lbl">Número:</span> <span class="val">{identificador || '0000'}</span>
          </div>
          <div class="bloque-dato">
            <span class="lbl">Fecha:</span> <span class="val">{fecha || 'Sin fecha'}</span>
          </div>
        </div>
      </div>

      <div class="col-lectura col-border">
        <h4>Información del lugar</h4>
        
        <div class="fila-info">
          <span class="lbl">Ubicación:</span> 
          <span class="val">{localDetalle?.ciudad || 'Holguín'}, Cuba</span>
        </div>
        
        <div class="fila-info-split">
          <div class="bloque-dato">
            <span class="lbl">Nombre:</span> 
            <span class="val">{localDetalle?.nombre || 'San Rafael'}</span>
          </div>
          <div class="bloque-dato dir-block">
            <span class="lbl">Dirección:</span> 
            <span class="val text-multi-line">{localDetalle?.direccion || 'Carretera a Mayarí'}</span>
          </div>
        </div>
      </div>
    </div>
  </Panel>

  <Panel padding="30px" clasesExtra="tarjeta-evento">
    <div class="header-card">
      <h3><Clock size={20} color="var(--primary)"/> Programación de Ensayos</h3>
      {#if !editEnsayos}
        <button class="btn-edit" on:click={iniciarEdicionEnsayos}><Edit size={16}/> Editar</button>
      {:else}
        <div style="display: flex; gap: 8px;">
          <button class="btn-cancel" on:click={cancelarEdicionEnsayos}><X size={16}/> Cancelar</button>
          <button class="btn-save" on:click={guardarEnsayos}><Save size={16}/> Guardar</button>
        </div>
      {/if}
    </div>

    <div class="grid-3 mb-15">
      <div class="campo">
        <label for="ensayoLugar">Lugar de Ensayo</label>
        <select id="ensayoLugar" bind:value={tempEnsayos.ensayoLugar} disabled={!editEnsayos}>
          <option value="">-- Seleccionar Lugar --</option>
          {#each locales as l}
            <option value={l.nombre}>{l.nombre}</option>
          {/each}
        </select>
      </div>
      <div class="campo">
        <label for="ensayoFecha">Fecha de Ensayo</label>
        <input id="ensayoFecha" type="date" bind:value={tempEnsayos.ensayoFecha} disabled={!editEnsayos} />
      </div>
      <div class="campo">
        <label for="ensayoHora">Hora</label>
        <input id="ensayoHora" type="time" bind:value={tempEnsayos.ensayoHora} disabled={!editEnsayos} />
      </div>
    </div>

    <div class="editor-block">
      <label><Info size={14}/> Notas e Información para Ensayos</label>
      <div class="tiptap-frame">
        {#if editorNotas && editEnsayos}
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
  </Panel>

  <Panel padding="30px" clasesExtra="tarjeta-evento">
    <div class="header-card">
      <h3><FileText size={20} color="var(--primary)"/> Orientaciones en Plataforma</h3>
      {#if !editOrientaciones}
        <button class="btn-edit" on:click={iniciarEdicionOrientaciones}><Edit size={16}/> Editar</button>
      {:else}
        <div style="display: flex; gap: 8px;">
          <button class="btn-cancel" on:click={cancelarEdicionOrientaciones}><X size={16}/> Cancelar</button>
          <button class="btn-save" on:click={guardarOrientaciones}><Save size={16}/> Guardar</button>
        </div>
      {/if}
    </div>

    <div class="editor-block">
      <div class="tiptap-frame">
        {#if editorOrientaciones && editOrientaciones}
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
  </Panel>

  <Panel padding="30px" clasesExtra="tarjeta-evento">
    <div class="header-card">
      <h3><MonitorPlay size={20} color="var(--primary)"/> Transmisión</h3>
      <div class="acciones-header"> 
        {#if !editTransmision}
          <button class="btn-edit" on:click={() => editTransmision = true}><Edit size={16}/> Editar</button>
        {:else}
          <div style="display: flex; gap: 8px;">
            <button class="btn-cancel" on:click={() => editTransmision = false}><X size={16}/> Cancelar</button>
            <button class="btn-save" on:click={guardarOrientaciones}><Save size={16}/> Guardar</button>
          </div>
        {/if}
      </div>
    </div>

    <label class="stream-check-compact">
      <input type="checkbox" bind:checked={tempOrientaciones.jwStreamStudio} disabled={!editTransmision} />
      <div class="label-check">
        <MonitorPlay size={16} />
        <span>Transmitir por <strong>JW Stream Studio</strong></span>
      </div>
    </label>
  </Panel>

</div> {#if mostrarModalDetalles}
<div class="modal-backdrop" on:click|self={cerrarModalDetalles}>
  <div class="modal-detalles-asamblea animacion-entrada-modal">
    
    <div class="modal-header">
      <h3><Bookmark size={18} color="white"/> Editar asamblea</h3>
      <button class="btn-close-modal" on:click={cerrarModalDetalles}><X size={20}/></button>
    </div>
    
    <div class="modal-body">
      <p class="modal-sub">Hacer cambios a esta asamblea</p>

      <fieldset class="modal-body-group">
          <legend>Información básica</legend>
          <div class="form-grid grid-1 mt-10">
              <div class="campo">
                  <label for="identificadorModal">Número de asamblea</label>
                  <input id="identificadorModal" type="text" bind:value={tempGeneral.identificador} placeholder="Ej: Holguín 7" />
              </div>

              <div class="form-grid grid-2 mt-10">
                  <div class="campo">
                      <label for="temaModal">Tema</label>
                      <input id="temaModal" type="text" bind:value={tempGeneral.tema} class="input-big" placeholder="Felices para siempre"/>
                  </div>
                  
                  <div class="campo">
                      <label><Calendar size={14}/> Fecha de inicio</label>
                      <div class="contenedor-calendario-relative">
                          {#if editandoFechaRango}
                              <div class="contenedor-calendario-desplegado">
                                  <CalendarioRango 
                                      bind:fechaInicio={tempGeneral.fechaInicio} 
                                      bind:fechaFin={tempGeneral.fechaFin}
                                      on:seleccionar={toggleCalendario} 
                                      on:cancelar={() => editandoFechaRango = false}
                                  />
                              </div>
                          {:else}
                              <div class="campo-falso-input {tempGeneral.fechaInicio ? 'con-fecha' : ''}" on:click={toggleCalendario} role="button" tabindex="0">
                                  <Calendar size={16} class="ico-azul"/>
                                  <span>{formatearRangoSimple(tempGeneral.fechaInicio, tempGeneral.fechaFin)}</span>
                              </div>
                          {/if}
                      </div>
                  </div>
              </div>
          </div>
      </fieldset>

      <fieldset class="modal-body-group">
          <legend>Detalles de la ubicación</legend>
          <div class="form-grid grid-1 mt-10">
              <div class="campo">
                  <label>Lugar de Asamblea (Ciudad)</label>
                  <div class="selector-salon">
                      <select bind:value={tempGeneral.idLocal}>
                          <option value={null}>-- Seleccionar Salón --</option>
                          {#each locales as l}
                            <option value={l.id}>{l.nombre} ({l.ciudad || 'Sin ciudad'})</option>
                          {/each}
                      </select>
                      <button class="btn-plus" on:click={() => mostrarModalSalon = true} title="Nuevo Salón"><Plus size={14}/></button>
                  </div>
              </div>

              <div class="campo mt-10">
                  <label>Dirección del lugar</label>
                  <input type="text" value={localDetalle?.direccion || ''} disabled placeholder="Se actualizará al seleccionar un salón"/>
              </div>
          </div>
      </fieldset>
    </div>

    <div class="modal-footer">
      <button class="btn-modal-save" on:click={guardarModalDetalles}>Guardar <Save size={16} style="margin-left:5px;"/></button>
    </div>
  </div>
</div>
{/if}

{#if mostrarModalSalon}
<div class="modal-backdrop">
    <Panel padding="25px" clasesExtra="modal-ancho">
        <div class="modal-header-salon">
            <h3>Nuevo Salón</h3><button on:click={() => mostrarModalSalon = false}><X size={18}/></button>
        </div>
        <div class="modal-body-salon">
            <label>Nombre</label><input type="text" bind:value={nuevoSalon.nombre}/>
            <label>Dirección</label><input type="text" bind:value={nuevoSalon.direccion}/>
            <label>Capacidad</label><input type="number" bind:value={nuevoSalon.capacidad}/>
            <button class="btn-create" on:click={guardarNuevoSalon}>Crear y Asignar</button>
        </div>
    </Panel>
</div>
{/if}

<style>
/* ========================================
   CONTENEDOR Y TARJETAS GENERALES
   ======================================== */
.contenedor { display: flex; flex-direction: column; gap: 20px; padding: 20px; padding-bottom: 40px; background: #f8fafc; }
:global(.tarjeta-evento) { margin-bottom: 25px !important; display: block; }
.header-card { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px; }
.header-card h3 { margin: 0; display: flex; align-items: center; gap: 10px; font-size: 18px; color: var(--text-main); }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.grid-3 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 15px; }
.mb-15 { margin-bottom: 15px; }

/* ========================================
   VISTA LECTURA (TARJETA 1)
   ======================================== */
.header-card-lectura { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid var(--border-color); padding-bottom: 15px; }
.header-card-lectura h3 { margin: 0; color: #1e293b; font-size: 1.3rem; font-weight: 700; }
.btn-edit-burgundy { background: #5c182d; width: 40px; height: 40px; border-radius: 8px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.btn-edit-burgundy:hover { background: #4a1324; transform: translateY(-2px); }
.grid-lectura { display: grid; grid-template-columns: 1fr 1.2fr; gap: 40px; }
.col-lectura { display: flex; flex-direction: column; gap: 12px; }
.col-lectura h4 { font-size: 14px; color: #0f172a; margin: 0 0 10px 0; font-weight: 700; }
.col-border { border-left: 1px solid #e2e8f0; padding-left: 40px; }
.fila-info { margin-bottom: 5px; }
.fila-info-split { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.lbl { color: #475569; font-size: 13px; font-weight: 600; margin-right: 5px; }
.val { color: #64748b; font-size: 13px; }
.val.destacado { color: #475569; font-weight: 500; font-size: 14px; }
.dir-block { display: flex; flex-direction: column; }
.dir-block .lbl { margin-bottom: 2px; }
.text-multi-line { line-height: 1.5; }

/* ========================================
   MODAL DE DETALLES
   ======================================== */
/* 1. RESTAURAMOS EL MODAL AL CENTRO PERFECTO */
.modal-backdrop { 
  position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
  background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; 
  z-index: 9999; backdrop-filter: blur(2px);
}

.modal-detalles-asamblea { 
  background: #f8fafc; width: 480px; max-width: 90vw; border-radius: 12px; 
  box-shadow: 0 15px 30px rgba(0,0,0,0.2); overflow: hidden; border: 1px solid #e2e8f0; 
  display: flex; flex-direction: column; max-height: 90vh; /* Permite que no exceda la pantalla */
}

.modal-body { 
  padding: 20px; display: flex; flex-direction: column; gap: 15px; 
  overflow-y: auto; /* Devolvemos el scroll interno por si lo abres en un móvil */
}

/* 2. EL TRUCO DE MAGIA: EL CALENDARIO FLOTANTE Y CENTRADO */
.contenedor-calendario-desplegado { 
  position: fixed; /* Saca al calendario de su caja */
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%); /* Lo centra matemáticamente en la pantalla */
  z-index: 100000; /* Asegura que flote sobre ABSOLUTAMENTE TODO */
  background: white; 
  border: 1px solid #e2e8f0; 
  border-radius: 12px; 
  /* Una sombra inmensa para que parezca que está muy por encima del modal */
  box-shadow: 0 0 0 100vw rgba(0,0,0,0.3), 0 25px 50px -12px rgba(0,0,0,0.5); 
  animation: popInCalendar 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes popInCalendar {
    0% { opacity: 0; transform: translate(-50%, -45%) scale(0.95); }
    100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

/* 3. Como quitamos el overflow, devolvemos los bordes redondos al header y footer */
.modal-header { 
  display: flex; justify-content: space-between; align-items: center; 
  padding: 15px 20px; background: #4F1C28; border-bottom: 1px solid #e2e8f0; 
  border-radius: 11px 11px 0 0; /* Bordes redondos arriba */
}

.modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: white; display: flex; align-items: center; gap: 8px;}
.btn-close-modal { border: none; background: none; cursor: pointer; color: white; opacity: 0.7;}
.btn-close-modal:hover { opacity: 1;}

.modal-sub { margin: 0 0 10px 0; font-size: 13px; color: #64748b; }
.modal-body-group { border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; background: white; margin-bottom: 10px;}
.modal-body-group legend { font-size: 13px; font-weight: 700; color: var(--primary); padding: 0 5px; }
.form-grid { display: grid; gap: 10px; }
.grid-1 { grid-template-columns: 1fr; }
.mt-10 { margin-top: 10px; }
label { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px; display: block; }
input, select { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; color: #1e293b; box-sizing: border-box; outline: none; transition: 0.2s; background: #fdfdfd;}
input:focus, select:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
input:disabled { background: #f5f5f5; color: #888; border-color: #ddd; cursor: not-allowed; }
.input-big { font-weight: 500; color: #444; }

.modal-footer { 
  padding: 15px 20px; border-top: 1px solid #e2e8f0; background: white; display: flex; justify-content: flex-end; 
  border-radius: 0 0 11px 11px; /* Bordes redondos abajo */
}

.btn-modal-save { background: #4F1C28; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; }
.btn-modal-save:hover { background: #3a151d; }
.animacion-entrada-modal { animation: modalEnter 0.3s ease-out; }
@keyframes modalEnter { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }

/* CALENDARIO RANGO EN MODAL */
.contenedor-calendario-relative { position: relative; width: 100%; }
.campo-falso-input { background: white; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; gap: 8px; cursor: pointer; min-height: 35px; box-sizing: border-box; transition: 0.2s;}
.campo-falso-input:hover { border-color: var(--primary); }
.campo-falso-input span { flex: 1; font-size: 13px; color: #475569; }
.campo-falso-input.con-fecha span { color: var(--text-main); font-weight: 500; }
.ico-azul { color: var(--primary); }



@keyframes fadeInCalendar { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

/* ========================================
   MODAL CREAR SALON
   ======================================== */
.modal-header-salon { display: flex; justify-content: space-between; margin-bottom: 20px; }
.modal-header-salon h3 { margin: 0; font-size: 18px; color: var(--text-main); }
.modal-header-salon button { border: none; background: none; cursor: pointer; color: var(--text-secondary); }
.modal-body { 
  padding: 20px; display: flex; flex-direction: column; gap: 15px; 
  overflow: visible; /* CRUCIAL: Permite que el calendario pase de largo sin cortarse */
}

/* ========================================
   BOTONES Y CHECKBOX
   ======================================== */
.selector-salon { display: flex; gap: 5px; }
.btn-plus { background: white; border: 1px solid #cbd5e1; border-radius: 6px; width: 35px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #475569; transition: 0.2s;}
.btn-plus:hover { background: #f1f5f9; color: var(--primary); }
.btn-edit, .btn-cancel { background: transparent; border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; gap: 6px; align-items: center; font-weight: 600; font-size: 12px; transition: all 0.2s; }
.btn-edit { color: var(--primary); border-color: var(--primary); }
.btn-edit:hover { background: var(--primary); color: white; }
.btn-cancel { color: #ef4444; border-color: #ef4444;}
.btn-cancel:hover { background: #ef4444; color: white;}
.btn-save { background: var(--primary); color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; display: flex; gap: 8px; font-weight: 600; font-size: 13px; }
.btn-create { background: var(--primary); color: white; padding: 10px; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px; font-weight: 600; }
.stream-check-compact { display: inline-flex; align-items: center; gap: 10px; padding: 8px 15px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 20px; }
.stream-check-compact input { width: 16px; height: 16px; appearance: auto !important; -webkit-appearance: checkbox !important; }

/* ========================================
   EDITOR TIPTAP (RESTAURADO COMPLETO)
   ======================================== */
.editor-block { margin-top: 15px; }
.tiptap-frame { border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; min-height: 180px; display: flex; flex-direction: column; }
.toolbar { background: var(--bg-body); padding: 10px 12px; border-bottom: 1px solid var(--border-color); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; border-radius: 8px 8px 0 0;}
.group { display: flex; align-items: center; gap: 2px; background: var(--bg-card); padding: 3px; border-radius: 6px; border: 1px solid var(--border-color); }
.group.inputs { background: transparent; border: none; padding: 0; gap: 4px; }
.sep { width: 2px; height: 28px; background: var(--border-color); margin: 0 10px; border-radius: 1px; }
.ml-auto { margin-left: auto; }
.toolbar button { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid transparent; border-radius: 4px; cursor: pointer; color: var(--text-secondary); transition: 0.15s ease; }
.toolbar button:hover { background: var(--hover-bg); color: var(--text-main); border-color: var(--border-color); }
.toolbar button.active { background: var(--primary); color: white; border-color: var(--primary); }

.native-select { height: 32px; border: 1px solid var(--border-color); border-radius: 4px; padding: 0 8px; font-size: 13px; color: var(--text-main); outline: none; cursor: pointer; background: var(--bg-card); transition: 0.15s; }
.native-select:hover, .native-select:focus { border-color: var(--primary); }
.font-family { width: 95px; } .font-size { width: 55px; } .line-height { width: 48px; }

.color-wrapper { position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; border: 1px solid transparent; transition: 0.15s ease; }
.color-wrapper:hover { background-color: var(--hover-bg); border-color: var(--border-color); }
.color-wrapper input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

.editor-content { padding: 20px; outline: none; flex: 1; font-size: 14px; line-height: 1.6; color: var(--text-main); background: var(--bg-card); border-radius: 0 0 8px 8px;}
:global(.ProseMirror p) { margin-top: 0; margin-bottom: 0.5em; }
:global(.ProseMirror ul, .ProseMirror ol) { padding-left: 1.5rem; margin: 0.5rem 0; }
:global(.ProseMirror a) { color: var(--primary); text-decoration: underline; cursor: pointer; }
:global(.ProseMirror hr) { border: none; border-top: 2px solid var(--border-color); margin: 1rem 0; }
:global(.ProseMirror:not(.ProseMirror-focused)) { background: var(--bg-secondary); cursor: not-allowed; opacity: 0.7; }
:global(.ProseMirror.ProseMirror-focused) { background: var(--bg-card); cursor: text; opacity: 1; }

/* Tareas Tiptap */
:global(ul[data-type="taskList"]) { list-style: none; padding: 0; }
:global(ul[data-type="taskList"] li) { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
:global(ul[data-type="taskList"] li > label) { display: flex; align-items: center; user-select: none; margin-right: 4px; }
:global(ul[data-type="taskList"] input[type="checkbox"]) { width: 16px; height: 16px; cursor: pointer; margin: 0; }

/* Tooltips */
.toolbar button[data-tooltip], .color-wrapper[data-tooltip] { position: relative; }
.toolbar button[data-tooltip]:hover::after, .color-wrapper[data-tooltip]:hover::after { content: attr(data-tooltip); position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); background-color: #1a1a1a; color: white; padding: 6px 10px; border-radius: 6px; font-size: 11px; white-space: nowrap; z-index: 99999; pointer-events: none; }
.toolbar button[data-tooltip]:hover::before, .color-wrapper[data-tooltip]:hover::before { content: ''; position: absolute; bottom: calc(100% + 2px); left: 50%; transform: translateX(-50%); border-width: 6px; border-style: solid; border-color: #1a1a1a transparent transparent transparent; pointer-events: none; z-index: 99999; }
</style>