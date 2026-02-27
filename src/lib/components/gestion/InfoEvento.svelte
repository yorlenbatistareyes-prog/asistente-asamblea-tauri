<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { setResumen, addNota, setNotas, totalAsistencia, totalBautismos, congregacionesReportadas, totalCongregaciones, notasRapidas } from '$lib/stores/gestion';
  import { setResumenValue } from '$lib/stores/gestion';
  
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
    ListOrdered, Minus, IndentDecrease, IndentIncrease, Edit
  } from 'lucide-svelte';

  // --- EXTENSIONES PERSONALIZADAS ---
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
  let identificador = "";

  let editandoFechaRango = false;

  function formatearRangoSimple(inicio: Date | null, fin: Date | null): string {
    if (!inicio || !fin) return fecha || "Seleccionar fechas...";
    const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${inicio.toLocaleDateString('es-ES', opciones)} - ${fin.toLocaleDateString('es-ES', opciones)}, ${inicio.getFullYear()}`;
  }

  function manejarSeleccionFinal() {
    editandoFechaRango = false;
  }
  
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

  // Estados de edición
let editGeneral = false;
let editEnsayos = false;
let editOrientaciones = false;
let editTransmision = false;

// Datos temporales para cada sección
let tempGeneral = {
  tema: '',
  fecha: '', // Mantén la original para no romper nada
  fechaInicio: null as Date | null, // Nueva
  fechaFin: null as Date | null,    // Nueva
  idLocal: null as number | null,
};

let tempEnsayos = {
  ensayoLugar: '',
  ensayoFecha: '',
  ensayoHora: '',
  htmlNotas: '',
};
let tempOrientaciones = {
  htmlOrientaciones: '',
  instruccionesEsp: '',
  jwStreamStudio: false,
};

// Reactividad para mostrar el detalle del salón en modo edición
$: if (tempGeneral.idLocal && locales.length > 0) {
    const encontrado = locales.find(l => l.id == tempGeneral.idLocal);
    if (encontrado) localDetalle = encontrado;
} else if (!tempGeneral.idLocal) {
    localDetalle = null;
}
  
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

  function iniciarEdicionGeneral() {
  tempGeneral = {
    tema,
    fecha,
    idLocal,
    fechaInicio: null, // Campo requerido por el nuevo tipo
    fechaFin: null,    // Campo requerido por el nuevo tipo
  };
  editGeneral = true;
  editEnsayos = false;
  editOrientaciones = false;
}

function cancelarEdicionGeneral() {
  editGeneral = false;
}

async function guardarGeneral() {
  tema = tempGeneral.tema;
  idLocal = tempGeneral.idLocal;
  
  // ✅ Si el usuario seleccionó un rango nuevo, actualizamos el string 'fecha'
  if (tempGeneral.fechaInicio && tempGeneral.fechaFin) {
      const f1 = tempGeneral.fechaInicio.toISOString().split('T')[0];
      const f2 = tempGeneral.fechaFin.toISOString().split('T')[0];
      fecha = `${f1} a ${f2}`;
  }

  await guardar();
  editGeneral = false;
}

// ENSAYOS - Funciones actualizadas
function iniciarEdicionEnsayos() {
  tempEnsayos = {
    ensayoLugar,
    ensayoFecha,
    ensayoHora,
    htmlNotas,
  };
  
  // Activar edición del editor
  if (editorNotas) {
    editorNotas.setEditable(true);
    editorNotas.commands.setContent(htmlNotas); // Cargar contenido actual
  }
  
  editEnsayos = true;
  editGeneral = false;
  editOrientaciones = false;
}

function cancelarEdicionEnsayos() {
  // Desactivar edición y restaurar contenido original
  if (editorNotas) {
    editorNotas.setEditable(false);
    editorNotas.commands.setContent(htmlNotas); // Restaurar contenido
  }
  editEnsayos = false;
}

async function guardarEnsayos() {
  ensayoLugar = tempEnsayos.ensayoLugar;
  ensayoFecha = tempEnsayos.ensayoFecha;
  ensayoHora = tempEnsayos.ensayoHora;
  htmlNotas = tempEnsayos.htmlNotas;
  
  await guardar();
  
  // Desactivar edición
  if (editorNotas) {
    editorNotas.setEditable(false);
  }
  
  editEnsayos = false;
}

// ORIENTACIONES - Funciones actualizadas
function iniciarEdicionOrientaciones() {
  tempOrientaciones = {
    htmlOrientaciones,
    instruccionesEsp,
    jwStreamStudio,
  };
  
  // Activar edición del editor
  if (editorOrientaciones) {
    editorOrientaciones.setEditable(true);
    editorOrientaciones.commands.setContent(htmlOrientaciones); // Cargar contenido actual
  }
  
  editOrientaciones = true;
  editGeneral = false;
  editEnsayos = false;
}

function cancelarEdicionOrientaciones() {
  // Desactivar edición y restaurar contenido original
  if (editorOrientaciones) {
    editorOrientaciones.setEditable(false);
    editorOrientaciones.commands.setContent(htmlOrientaciones); // Restaurar contenido
  }
  editOrientaciones = false;
}

async function guardarOrientaciones() {
  htmlOrientaciones = tempOrientaciones.htmlOrientaciones;
  instruccionesEsp = tempOrientaciones.instruccionesEsp;
  jwStreamStudio = tempOrientaciones.jwStreamStudio;
  
  await guardar();
  
  // Desactivar edición
  if (editorOrientaciones) {
    editorOrientaciones.setEditable(false);
  }
  
  editOrientaciones = false;
}

//// --- CICLO DE VIDA ---
  onMount(async () => {
    try {
      // 1. Obtener datos de la base de datos (locales)
      locales = await invoke('obtener_locales') as any[];
      
      // 2. ¡LA CLAVE! Leer de la memoria en cuál asamblea hicimos clic
      const dataGuardada = localStorage.getItem('asambleaActiva');
      let asamblea = null;
      
      if (dataGuardada) {
          const asambleaSeleccionada = JSON.parse(dataGuardada);
          // Le pedimos a Rust exactamente ESA asamblea por su ID, no la última
          asamblea = await invoke('obtener_asamblea_por_id', { id: asambleaSeleccionada.id }) as any;
      }
      
      // 3. Si se encontró la asamblea, llenar las variables
      if (asamblea) {
        asambleaId = asamblea.id;
        tema = asamblea.tema || "";
        fecha = asamblea.fecha || "";
        identificador = asamblea.identificador || "";
        
        // Lógica del Salón
        if (asamblea.local_id) {
            idLocal = asamblea.local_id;
            localDetalle = locales.find(l => l.id == idLocal);
        } else {
            idLocal = null;
            localDetalle = null;
        }

        // Lógica de Ensayos
        ensayoLugar = asamblea.ensayo_lugar || ""; 
        ensayoFecha = asamblea.ensayo_fecha || "";
        ensayoHora = asamblea.ensayo_hora || "";
        instruccionesEsp = asamblea.instrucciones_esp || "";
        jwStreamStudio = asamblea.jw_stream_studio === true || asamblea.jw_stream_studio === 1;
        
        // Contenido de los Editores
        htmlOrientaciones = asamblea.recorridos_info || "";
        htmlNotas = asamblea.ensayo_notas || "";
      }

      // Inicializar datos temporales
tempGeneral = { 
  tema, 
  fecha, 
  idLocal, 
  fechaInicio: null, 
  fechaFin: null 
};
tempEnsayos = { ensayoLugar, ensayoFecha, ensayoHora, htmlNotas };
tempOrientaciones = { htmlOrientaciones, instruccionesEsp, jwStreamStudio };
      
      // 4. Iniciar los editores (TipTap)
      initEditors();

    } catch (error) { 
        console.error("Error al cargar InfoEvento:", error); 
    }
  });
  
 $: if (idLocal && locales.length > 0) {
      const encontrado = locales.find(l => l.id == idLocal);
      if (encontrado) localDetalle = encontrado;
  } else if (!idLocal) {
      localDetalle = null;
  }

  function quitarSeleccion() {
  if (editGeneral) {
    tempGeneral.idLocal = null;
  } else {
    // Si no está en edición, no debería poder quitarse, pero por si acaso:
    idLocal = null;
    localDetalle = null;
  }
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
    editable: false, // ← IMPORTANTE: Bloqueado por defecto
    onUpdate: ({ editor }) => { 
      if (editOrientaciones) { // Solo actualiza si estamos editando
        tempOrientaciones.htmlOrientaciones = editor.getHTML(); 
      }
    },
    onTransaction: () => { editorOrientaciones = editorOrientaciones; }
  });

  editorNotas = new Editor({
    element: elementNotas,
    extensions: extensionesComunes,
    content: htmlNotas,
    editable: false, // ← IMPORTANTE: Bloqueado por defecto
    onUpdate: ({ editor }) => { 
      if (editEnsayos) { // Solo actualiza si estamos editando
        tempEnsayos.htmlNotas = editor.getHTML(); 
      }
    },
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
              idLocal = recienCreado.id;
              localDetalle = recienCreado;
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

<div>
  
  <!-- TARJETA 1: Información General -->
  <Panel padding="30px" clasesExtra="tarjeta-evento">
    <div class="header-card">
      <h3><Bookmark size={20} color="var(--primary)"/> Detalles de la Asamblea</h3>
      {#if !editGeneral}
        <button class="btn-edit" on:click={iniciarEdicionGeneral}><Edit size={16}/> Editar</button>
      {:else}
        <div style="display: flex; gap: 8px;">
          <button class="btn-cancel" on:click={cancelarEdicionGeneral}><X size={16}/> Cancelar</button>
          <button class="btn-save" on:click={guardarGeneral}><Save size={16}/> Guardar</button>
        </div>
      {/if}
    </div>
    
    <div class="formulario grid-2">
      <div class="campo">
        <label><Bookmark size={14}/> Identificador</label>
        <input type="text" bind:value={identificador} class="input-id" readonly />
      </div>
      <div class="campo full">
        <label for="tema">Tema</label>
        <input id="tema" type="text" bind:value={tempGeneral.tema} disabled={!editGeneral} class="input-big"/>
      </div>

      <div class="campo">
        <label><Calendar size={14}/> Fecha de la Asamblea</label>
        
        {#if !editGeneral}
          <div class="input-lectura">{fecha || 'Sin fecha asignada'}</div>
        {:else}
          <div style="display: flex; flex-direction: column; gap: 8px;">
            {#if editandoFechaRango}
                <div class="contenedor-calendario-desplegado">
                    <CalendarioRango 
                        bind:fechaInicio={tempGeneral.fechaInicio} 
                        bind:fechaFin={tempGeneral.fechaFin}
                        on:seleccionar={manejarSeleccionFinal}
                        on:cancelar={() => editandoFechaRango = false}
                    />
                </div>
            {:else}
                <div class="campo-falso-input" on:click={() => editandoFechaRango = true} role="button" tabindex="0">
                    <Calendar size={16} class="ico-azul"/>
                    <span>{formatearRangoSimple(tempGeneral.fechaInicio, tempGeneral.fechaFin)}</span>
                </div>
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="campo">
        <label><MapPin size={14}/> Salón de Asambleas</label>
        {#if localDetalle}
          <div class="salon-info-card">
            <button class="btn-close-card" on:click={quitarSeleccion} disabled={!editGeneral} title="Cambiar Salón">
              <X size={16} />
            </button>
            <div class="icon-building"><Building size={24}/></div>
            <div class="info-text">
              <span class="l-nombre">{localDetalle.nombre}</span>
              <span class="l-dir">{localDetalle.direccion || 'Sin dirección registrada'}</span>
            </div>
            <div class="info-cap">
              <Users size={16}/>
              <span>{localDetalle.capacidad || 0}</span>
              <small>asientos</small>
            </div>
          </div>
        {:else}
          <div class="selector-salon">
            <select bind:value={tempGeneral.idLocal} disabled={!editGeneral}>
              <option value={null}>-- Seleccionar Salón --</option>
              {#each locales as l}
                <option value={l.id}>{l.nombre}</option>
              {/each}
            </select>
            <button class="btn-plus" on:click={() => mostrarModalSalon = true} disabled={!editGeneral} data-tooltip="Nuevo Salón">
              <Plus size={16}/>
            </button>
          </div>
        {/if}
      </div>
   </Panel>
  </div>

  <!-- TARJETA 2: Programación de Ensayos -->
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
</Panel>

<!-- TARJETA 3: Orientaciones en Plataforma -->
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
</Panel>

<!-- TARJETA 4: Transmisión -->
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

{#if mostrarModalSalon}
    <div class="modal-backdrop">
        <Panel padding="25px" clasesExtra="modal-ancho">
            <div class="modal-header"><h3>Nuevo Salón</h3><button on:click={() => mostrarModalSalon = false}><X size={18}/></button></div>
            <div class="modal-body">
                <label for="nuevoSalonNombre">Nombre</label><input id="nuevoSalonNombre" type="text" bind:value={nuevoSalon.nombre} placeholder="Ej: Salón Cotorro"/>
                <label for="nuevoSalonDireccion">Dirección</label><input id="nuevoSalonDireccion" type="text" bind:value={nuevoSalon.direccion} placeholder="Calle..."/>
                <label for="nuevoSalonCapacidad">Capacidad</label><input id="nuevoSalonCapacidad" type="number" bind:value={nuevoSalon.capacidad}/>
                <button class="btn-create" on:click={guardarNuevoSalon}>Crear y Asignar</button>
            </div>
        </Panel>
    </div>
{/if}

<style>
/* ========================================
   CONTENEDOR Y TARJETAS
   ======================================== */
.contenedor { 
  display: flex; 
  flex-direction: column; 
  gap: 20px; 
  padding: 20px;
  padding-bottom: 40px; 
  background: #f1f5f9;
}

/* Usamos :global porque la clase se aplica a nuestro componente Panel */
:global(.tarjeta-evento) {
    margin-bottom: 25px !important; /* Esto las separa una de otra */
    display: block;
}

.card-config:last-child {
  margin-bottom: 0;
}

.header-card { 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  margin-bottom: 25px; 
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 20px;
}

.header-card h3 { 
  margin: 0; 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  font-size: 18px; 
  color: var(--text-main); 
}

/* ========================================
   GRIDS Y UTILIDADES
   ======================================== */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.grid-3 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 15px; }
.full { grid-column: span 2; }
.mb-15 { margin-bottom: 15px; }

/* ========================================
   FORMULARIOS
   ======================================== */
label { 
  display: flex; 
  gap: 8px; 
  font-size: 12px; 
  font-weight: 700; 
  color: var(--text-secondary); 
  margin-bottom: 6px; 
  text-transform: uppercase; 
}

input, select { 
    padding: 10px 12px; 
    border: 1px solid var(--border); /* Usamos la variable global de borde fino */
    border-radius: 8px; /* Un poco más redondeado para que sea moderno */
    width: 100%; 
    box-sizing: border-box; 
    font-size: 14px; 
    color: var(--text-main); 
    background: var(--bg-body); /* Fondo gris sutil en modo claro, oscuro en modo noche */
    transition: all 0.2s ease; 
}

/* Efecto cuando pasas el ratón o haces clic */
input:hover, select:hover {
    border-color: var(--primary);
}

input:focus, select:focus { 
    border-color: var(--primary); 
    background: var(--bg-card); /* Se pone blanco puro al escribir */
    outline: none; 
    box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1); /* Brillo azul muy suave */
}

/* Cuando están desactivados (modo lectura) */
input:disabled, select:disabled {
    background: var(--bg-secondary);
    border-color: var(--border);
    color: var(--text-sec);
    cursor: not-allowed;
    opacity: 0.8;
}

.input-big { 
  font-size: 16px; 
  font-weight: 600; 
}

.input-id {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px dashed var(--border-color);
  cursor: not-allowed;
  font-weight: 600;
}

/* ========================================
   SELECTOR DE SALÓN
   ======================================== */
.selector-salon { display: flex; gap: 8px; }

.btn-plus { 
  background: var(--bg-secondary); 
  border: 1px solid var(--border-color); 
  border-radius: 6px; 
  width: 42px; 
  cursor: pointer; 
  color: var(--primary); 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  transition: background 0.2s; 
}

.btn-plus:hover { background: var(--hover-bg); }
.btn-plus:disabled { opacity: 0.5; cursor: not-allowed; }

.salon-info-card { 
  position: relative; 
  background: var(--bg-body); 
  border: 1px solid var(--border-color); 
  border-radius: 8px; 
  padding: 15px; 
  display: flex; 
  align-items: center; 
  gap: 15px; 
}

.btn-close-card { 
  position: absolute; 
  top: -10px; 
  right: -10px; 
  background: #ef4444; 
  color: white; 
  border: 2px solid var(--bg-card); 
  width: 24px; 
  height: 24px; 
  border-radius: 50%; 
  cursor: pointer; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
}

.btn-close-card:disabled { 
  opacity: 0.5; 
  cursor: not-allowed; 
}

.icon-building { 
  background: var(--bg-card); 
  padding: 10px; 
  border-radius: 8px; 
  color: var(--primary); 
  border: 1px solid var(--border-color); 
}

.info-text { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
}

.l-nombre { 
  font-weight: 700; 
  color: var(--text-main); 
  font-size: 15px; 
}

.l-dir { 
  font-size: 13px; 
  color: var(--text-secondary); 
}

.info-cap { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  background: var(--bg-card); 
  padding: 5px 12px; 
  border-radius: 6px; 
  border: 1px solid var(--border-color); 
  color: var(--text-main); 
}

.info-cap span { font-weight: 800; font-size: 16px; }
.info-cap small { 
  font-size: 9px; 
  color: var(--text-secondary); 
  text-transform: uppercase; 
}

/* ========================================
   EDITORES TIPTAP
   ======================================== */
.tiptap-frame { 
  border: 1px solid #cbd5e1; /* <--- Igualamos el borde de la tarjeta */
  border-radius: 8px; 
  background: #ffffff; 
  min-height: 180px; 
  display: flex; 
  flex-direction: column; 
  overflow: visible;
  position: relative; 
  z-index: 10; 
}

.toolbar { 
  background: var(--bg-body);
  padding: 10px 12px; 
  border-bottom: 3px solid var(--border-color);
  display: flex; 
  gap: 6px; 
  align-items: center; 
  flex-wrap: wrap; 
  box-shadow: inset 0 -2px 4px rgba(0,0,0,0.05);
  border-radius: 8px 8px 0 0;
  min-height: 50px;
}

.group { 
  display: flex; 
  align-items: center; 
  gap: 2px; 
  background: var(--bg-card);
  padding: 3px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.group.inputs {
  background: transparent;
  border: none;
  padding: 0;
  gap: 4px;
}

.sep { 
  width: 2px;
  height: 28px; 
  background: var(--border-color); 
  margin: 0 10px;
  border-radius: 1px;
}

.ml-auto { margin-left: auto; }

.toolbar button { 
  width: 34px; 
  height: 34px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  background: transparent; 
  border: 1px solid transparent; 
  border-radius: 5px; 
  cursor: pointer; 
  color: var(--text-secondary); 
  position: relative;
  transition: all 0.15s ease;
}

.toolbar button:hover { 
  background: var(--hover-bg); 
  color: var(--text-main); 
  border-color: var(--border-color);
}

.toolbar button.active { 
  background: var(--primary);
  color: white; 
  border-color: var(--primary); 
}

.native-select { 
  height: 34px;
  border: 1px solid var(--border-color); 
  border-radius: 5px; 
  padding: 0 8px; 
  font-size: 13px; 
  color: var(--text-main);
  outline: none; 
  cursor: pointer; 
  background: var(--bg-card);
  font-weight: 500;
  transition: all 0.15s ease;
}

.native-select:hover {
  border-color: var(--primary);
  background: var(--hover-bg);
}

.font-family { width: 95px; }
.font-size { width: 55px; }
.line-height { width: 48px; }

.color-wrapper { 
  position: relative; 
  width: 34px; 
  height: 34px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  cursor: pointer; 
  border-radius: 5px;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.color-wrapper:hover { 
  background-color: var(--hover-bg); 
  border-color: var(--border-color);
}

.color-wrapper input { 
  position: absolute; 
  top: 0; 
  left: 0; 
  width: 100%; 
  height: 100%; 
  opacity: 0; 
  cursor: pointer; 
}

.editor-content { 
  padding: 20px; 
  flex: 1; 
  outline: none; 
  font-size: 14px; 
  line-height: 1.6;
  color: var(--text-main);
  background: var(--bg-card);
  min-height: 200px;
  border-radius: 0 0 8px 8px;
}

:global(.ProseMirror:not(.ProseMirror-focused)) {
  background: var(--bg-secondary);
  cursor: not-allowed;
  opacity: 0.7;
}

:global(.ProseMirror.ProseMirror-focused) {
  background: var(--bg-card);
  cursor: text;
  opacity: 1;
}

/* ========================================
   TOOLTIPS
   ======================================== */
.toolbar button[data-tooltip],
.color-wrapper[data-tooltip] {
  position: relative;
}

.toolbar button[data-tooltip]:hover::after,
.color-wrapper[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute; 
  bottom: calc(100% + 8px);
  left: 50%; 
  transform: translateX(-50%);
  background-color: #1a1a1a;
  color: white; 
  padding: 6px 10px; 
  border-radius: 6px;
  font-size: 11px; 
  white-space: nowrap; 
  z-index: 99999;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3); 
  font-weight: 600;
  line-height: 1;
}

.toolbar button[data-tooltip]:hover::before,
.color-wrapper[data-tooltip]:hover::before {
  content: ''; 
  position: absolute; 
  bottom: calc(100% + 2px);
  left: 50%; 
  transform: translateX(-50%);
  border-width: 6px; 
  border-style: solid; 
  border-color: #1a1a1a transparent transparent transparent;
  pointer-events: none;
  z-index: 99999;
}

/* ========================================
   CHECKBOX
   ======================================== */
.stream-check-compact { 
  display: inline-flex; 
  align-items: center; 
  gap: 10px; 
  padding: 8px 15px; 
  background: var(--bg-secondary); 
  border: 1px solid var(--border-color); 
  border-radius: 20px; 
  cursor: pointer; 
  transition: all 0.2s; 
  width: fit-content; 
}

.stream-check-compact:hover { 
  background: var(--hover-bg); 
  border-color: var(--primary); 
}

.label-check { 
  display: flex; 
  align-items: center; 
  gap: 8px; 
  font-size: 13px; 
  color: var(--primary); 
  text-transform: none; 
  font-weight: 500; 
}



.stream-check-compact input { 
  width: 16px; 
  height: 16px; 
  margin: 0; 
  cursor: pointer;
}

.stream-check-compact input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* ========================================
   BOTONES
   ======================================== */
.btn-edit, .btn-cancel {
  background: transparent;
  border: 1px solid var(--border-color);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  gap: 6px;
  align-items: center;
  font-weight: 600;
  font-size: 12px;
  transition: all 0.2s;
}

.btn-edit { 
  color: var(--primary); 
  border-color: var(--primary); 
}

.btn-edit:hover { 
  background: var(--primary); 
  color: white; 
}

.btn-cancel { 
  color: #ef4444; 
  border-color: #ef4444; 
}

.btn-cancel:hover { 
  background: #ef4444; 
  color: white; 
}

.btn-save { 
  background: var(--primary); 
  color: white; 
  border: none; 
  padding: 8px 20px; 
  border-radius: 6px; 
  cursor: pointer; 
  display: flex; 
  gap: 8px; 
  font-weight: 600; 
  font-size: 13px; 
  transition: background 0.2s; 
}

.btn-save:hover { opacity: 0.9; }

/* ========================================
   MODAL
   ======================================== */
.modal-backdrop { 
  position: fixed; 
  top: 0; 
  left: 0; 
  width: 100%; 
  height: 100%; 
  background: rgba(0,0,0,0.5); 
  display: flex; 
  justify-content: center; 
  align-items: center; 
  z-index: 10000; 
}

.modal { 
  background: var(--bg-card); 
  width: 350px; 
  padding: 25px; 
  border-radius: 12px; 
  box-shadow: 0 10px 25px rgba(0,0,0,0.3); 
  border: 1px solid var(--border-color); 
}

.modal-header { 
  display: flex; 
  justify-content: space-between; 
  margin-bottom: 20px; 
}

.modal-header h3 { 
  margin: 0; 
  font-size: 18px; 
  color: var(--text-main); 
}

.modal-header button { 
  border: none; 
  background: none; 
  cursor: pointer; 
  color: var(--text-secondary); 
}

.modal-body { 
  display: flex; 
  flex-direction: column; 
  gap: 12px; 
}

.btn-create { 
  background: var(--primary); 
  color: white; 
  padding: 10px; 
  border: none; 
  border-radius: 6px; 
  cursor: pointer; 
  margin-top: 10px; 
  font-weight: 600; 
}

/* ========================================
   ESTILOS TIPTAP INTERNOS
   ======================================== */
:global(.ProseMirror) { 
  outline: none; 
  min-height: 100px; 
  color: var(--text-main); 
}

:global(.ProseMirror p) { 
  margin-bottom: 0.5em; 
  margin-top: 0; 
}

:global(.ProseMirror ul, .ProseMirror ol) { 
  padding-left: 1.5rem; 
  margin: 0.5rem 0; 
}

:global(.ProseMirror a) { 
  color: var(--primary); 
  text-decoration: underline; 
  cursor: pointer; 
}

:global(.ProseMirror hr) { 
  border: none; 
  border-top: 2px solid var(--border-color); 
  margin: 1rem 0; 
}

:global(.ProseMirror p.is-editor-empty:first-child::before) { 
  color: var(--text-secondary); 
  content: attr(data-placeholder); 
  float: left; 
  height: 0; 
  pointer-events: none; 
}

:global(ul[data-type="taskList"]) { 
  list-style: none; 
  padding: 0; 
}

:global(ul[data-type="taskList"] li) { 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  margin-bottom: 5px; 
}

:global(ul[data-type="taskList"] li > label) { 
  display: flex; 
  align-items: center; 
  user-select: none; 
  margin-right: 4px; 
}

:global(ul[data-type="taskList"] li > div) { 
  flex: 1; 
}

:global(ul[data-type="taskList"] input[type="checkbox"]) { 
  width: 16px; 
  height: 16px; 
  cursor: pointer; 
  margin: 0; 
}

.card-config:hover {
  transform: translateY(-2px); /* Efecto hover sutil */
  box-shadow: 
    0 6px 8px rgba(0, 0, 0, 0.09),
    0 12px 20px rgba(0, 0, 0, 0.07);
}

/* Sobrescrituras para modo oscuro */
:global(html.dark-theme) .contenedor {
  background: var(--bg-body);
}

:global(html.dark-theme) .card-config {
  background: var(--bg-card);
  border-color: var(--border-color);
}

:global(html.dark-theme) .tiptap-frame {
  background: var(--bg-card);
  border-color: var(--border-color);
}

:global(html.dark-theme) .card-config:hover {
  box-shadow: 0 6px 8px var(--shadow-color), 0 12px 20px var(--shadow-color);
}

/* --- ESTILOS DEL SELECTOR DE FECHA (INFO EVENTO) --- */

    /* Estado de solo lectura (cuando no estás editando) */
    .input-lectura {
        padding: 10px 12px;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 8px;
        font-size: 14px;
        color: var(--text-main);
        font-weight: 500;
        min-height: 42px;
        display: flex;
        align-items: center;
        box-sizing: border-box;
    }

    /* El campo que parece un input y abre el calendario */
    .campo-falso-input {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 10px 15px;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        min-height: 42px;
        transition: all 0.2s ease;
        box-sizing: border-box;
    }

    .campo-falso-input:hover {
        border-color: var(--primary);
        background: var(--bg-body);
    }

    /* Estilo para el texto dentro del selector */
    .campo-falso-input span {
        flex: 1;
        font-size: 14px;
        color: var(--text-main);
        font-weight: 500;
    }

    /* Color gris cuando no hay nada seleccionado */
    .campo-falso-input .placeholder {
        color: var(--text-sec);
        font-weight: 400;
    }

    /* Icono del calendario en azul */
    .ico-azul { 
        color: var(--primary); 
        opacity: 0.9;
    }

    /* Contenedor animado para el CalendarioRango */
    .contenedor-calendario-desplegado {
        margin-top: 5px;
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
        animation: fadeInCalendar 0.25s ease-out;
        /* Asegura que flote visualmente sobre otros elementos si es necesario */
        position: relative; 
        z-index: 50;
        box-shadow: var(--shadow-sm);
    }

    @keyframes fadeInCalendar {
        from { 
            opacity: 0; 
            transform: translateY(-8px); 
        }
        to { 
            opacity: 1; 
            transform: translateY(0); 
        }
    }
</style>