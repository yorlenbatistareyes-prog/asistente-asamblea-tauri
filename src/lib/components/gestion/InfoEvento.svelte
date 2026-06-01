<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { setResumen, addNota, setNotas, totalAsistencia, totalBautismos, congregacionesReportadas, totalCongregaciones, notasRapidas } from '$lib/stores/gestion';
  import { vistaActual } from '$lib/stores/appStore';
  import { DB } from '$lib/services/db';

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

  
  import CompartirAsamblea from '$lib/components/gestion/CompartirAsamblea.svelte';
  // --- ICONOS ---
  import { 
    Save, Calendar, MapPin, Bookmark, Clock, Info, 
    AlignLeft, Bold, Italic, Underline as UnderIcon, List, 
    AlignCenter, AlignRight, AlignJustify, Eraser, Building, Users, Plus, X, 
    MonitorPlay, FileText, Palette, Link as LinkIcon, ListTodo,
    ListOrdered, Minus, IndentDecrease, IndentIncrease, Edit, Pencil, 
    Map, Flag, FileSpreadsheet, ChevronDown } from 'lucide-svelte';

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
  let lugar = "";
  let idioma = "Español";

  // --- ESTADOS DE ACORDEÓN ---
  let verEnsayosPanel = false;
  let verOrientacionesPanel = false;
  let verTransmisionPanel = false;

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
    lugar: '',
    idioma: 'Español',
    fechaInicio: null as Date | null,
    fechaFin: null as Date | null,
  };

  let tempEnsayos = { ensayoLugar: '', ensayoFecha: '', ensayoHora: '', htmlNotas: '' };
  let tempOrientaciones = { htmlOrientaciones: '', instruccionesEsp: '', jwStreamStudio: false };
 
  // --- FUNCIONES DEL MODAL GENERAL ---
  function abrirModalDetalles() {
    tempGeneral = {
      tema, identificador, lugar, idioma,
      fechaInicio: null, fechaFin: null
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
    lugar = tempGeneral.lugar;
    idioma = tempGeneral.idioma;
    
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

  // --- FORMATEADOR DE RANGO DE FECHAS ---
  function formatearFechaElegante(fechaRango: string): string {
    if (!fechaRango || !fechaRango.includes(' a ')) return fechaRango || 'Sin fecha';
    
    // Separar las dos fechas
    const [inicio, fin] = fechaRango.split(' a ');
    
    // Función auxiliar para convertir "2026-12-04" a "04/12/2026"
    const formatear = (fechaIso: string) => {
      const match = fechaIso.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (!match) return fechaIso;
      
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      
      return `${day}/${month}/${year}`;
    };

    return `${formatear(inicio)} - ${formatear(fin)}`;
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

  // --- VARIABLES PARA EL CONTADOR DE ORADORES ---
  let pendientesCO11 = 0;

  async function contarOradoresPendientes(idAsamblea: number) {
    try {
      const dias = ['Viernes', 'Sábado', 'Domingo'];
      let oradoresUnicos = new Set();
      
      for (const dia of dias) {
        const res = await invoke('obtener_programa_dia', { asambleaId: idAsamblea, dia }) as any[];
        res.forEach(parte => {
          if (parte.nombre_orador && parte.nombre_orador.trim() !== '') {
            // MAGIA: Solo sumamos al contador si el estado NO es 'Confirmado'
            if (parte.estado !== 'Confirmado') {
              oradoresUnicos.add(parte.nombre_orador.trim());
            }
          }
        });
      }
      pendientesCO11 = oradoresUnicos.size;
    } catch (e) {
      console.error("Error al contar oradores:", e);
    }
  }

  // --- CICLO DE VIDA ---
  onMount(async () => {
    try {
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
        lugar = asamblea.lugar || ""; // 👈 Nuevo
        idioma = asamblea.idioma || "Español"; // 👈 Nuevo

        ensayoLugar = asamblea.ensayo_lugar || ""; 
        ensayoFecha = asamblea.ensayo_fecha || "";
        ensayoHora = asamblea.ensayo_hora || "";
        instruccionesEsp = asamblea.instrucciones_esp || "";
        jwStreamStudio = asamblea.jw_stream_studio === true || asamblea.jw_stream_studio === 1;
        
        htmlOrientaciones = asamblea.recorridos_info || "";
        htmlNotas = asamblea.ensayo_notas || "";

        tempEnsayos = { 
            ensayoLugar, 
            ensayoFecha, 
            ensayoHora, 
            htmlNotas 
        };

        tempOrientaciones = { 
            htmlOrientaciones, 
            instruccionesEsp, 
            jwStreamStudio 
        };
        
        await contarOradoresPendientes(asamblea.id);
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

  async function guardar() {
    try {
      // 🔥 USAMOS EL EMBUDO PARA GUARDAR Y AVISAR AL RADAR
      await DB.guardarInfoEvento({
        id: asambleaId, tema, fecha, identificador, lugar, idioma,
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
      <h3>Información de la asamblea</h3>
      <button class="btn-edit-burgundy" on:click={abrirModalDetalles} title="Editar detalles">
        <Pencil size={18} color="white"/>
      </button>
    </div>
    
    <div class="grid-lectura">
      <div class="col-lectura">
        <h4>Datos de la asamblea</h4>
        
        <div class="fila-info">
          <span class="lbl">Tema:</span> 
          <span class="val destacado">{tema || 'Sin tema'}</span>
        </div>
        
        <div class="fila-info-split">
          <div class="bloque-dato">
            <span class="lbl">Número:</span> <span class="val">{identificador || '0000'}</span>
          </div>
          <div class="bloque-dato">
            <span class="lbl">Fecha:</span> <span class="val">{formatearFechaElegante(fecha)}</span>
          </div>
        </div>
      </div>

      <div class="col-lectura col-border">
        <h4>Información de la ubicación</h4>
        
        <div class="fila-info">
          <span class="lbl">Lugar:</span> 
          <span class="val text-multi-line">{lugar || 'Sin ubicación asignada'}</span>
        </div>
        
        <div class="fila-info" style="margin-top: 15px;">
          <span class="lbl">Idioma de la asamblea:</span> 
          <span class="val">{idioma || 'Español'}</span>
        </div>
      </div>
    </div>
  </Panel>

  <Panel padding="20px 30px" clasesExtra="tarjeta-evento">
    <div class="fila-accion">
      <h3 class="titulo-fila">Oradores</h3>
      <div class="grupo-botones">
        <button class="btn-azul" on:click={() => vistaActual.set('vista_programa')}>Programa</button>
        <button class="btn-azul" on:click={() => vistaActual.set('registro_oradores')}>Registro de oradores</button>
        <button class="btn-azul" on:click={() => vistaActual.set('lista_oradores')}>
          Lista de oradores 
          {#if pendientesCO11 > 0}
            <span class="badge-amarillo">{pendientesCO11}</span>
          {/if}
        </button>
      </div>
    </div>

    <div class="divisor-fino"></div>

    <div class="fila-accion">
      <h3 class="titulo-fila">Utilidades</h3>
      <div class="grupo-botones">
        <button class="btn-azul"><FileSpreadsheet size={16} strokeWidth={2.5}/> Importar desde CSV</button>
      </div>
    </div>
  </Panel>

  <div class="grupo-acordeones">

  <Panel padding="0" clasesExtra="tarjeta-acordeon">
    <div class="header-acordeon" on:click={() => verEnsayosPanel = !verEnsayosPanel} role="button" tabindex="0">
      <div class="titulo-acordeon">
        <Clock size={20} color="var(--primary)"/> 
        <h3>Programación de Ensayos</h3>
      </div>
      <ChevronDown size={20} style="transform: rotate({verEnsayosPanel ? 180 : 0}deg); transition: transform 0.3s;" />
    </div>

    {#if verEnsayosPanel}
      <div class="contenido-acordeon animacion-despliegue">
        <div class="acciones-header-panel">
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
            <input id="ensayoLugar" type="text" bind:value={tempEnsayos.ensayoLugar} disabled={!editEnsayos} placeholder="Ej: Salón Principal" />
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
      </div>
    {/if}
  </Panel>

  <Panel padding="0" clasesExtra="tarjeta-acordeon">
    <div class="header-acordeon" on:click={() => verOrientacionesPanel = !verOrientacionesPanel} role="button" tabindex="0">
      <div class="titulo-acordeon">
        <FileText size={20} color="var(--primary)"/> 
        <h3>Orientaciones en Plataforma</h3>
      </div>
      <ChevronDown size={20} style="transform: rotate({verOrientacionesPanel ? 180 : 0}deg); transition: transform 0.3s;" />
    </div>

    {#if verOrientacionesPanel}
      <div class="contenido-acordeon animacion-despliegue">
        <div class="acciones-header-panel">
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
      </div>
    {/if}
  </Panel>

  <Panel padding="0" clasesExtra="tarjeta-acordeon">
    <div class="header-acordeon" on:click={() => verTransmisionPanel = !verTransmisionPanel} role="button" tabindex="0">
      <div class="titulo-acordeon">
        <MonitorPlay size={20} color="var(--primary)"/> 
        <h3>Transmisión</h3>
      </div>
      <ChevronDown size={20} style="transform: rotate({verTransmisionPanel ? 180 : 0}deg); transition: transform 0.3s;" />
    </div>

    {#if verTransmisionPanel}
      <div class="contenido-acordeon animacion-despliegue">
        <div class="acciones-header-panel">
          {#if !editTransmision}
            <button class="btn-edit" on:click={() => editTransmision = true}><Edit size={16}/> Editar</button>
          {:else}
            <div style="display: flex; gap: 8px;">
              <button class="btn-cancel" on:click={() => editTransmision = false}><X size={16}/> Cancelar</button>
              <button class="btn-save" on:click={guardarOrientaciones}><Save size={16}/> Guardar</button>
            </div>
          {/if}
        </div>

        <label class="stream-check-compact">
          <input type="checkbox" bind:checked={tempOrientaciones.jwStreamStudio} disabled={!editTransmision} />
          <div class="label-check">
            <MonitorPlay size={16} />
            <span>Transmitir por <strong>JW Stream Studio</strong></span>
          </div>
        </label>
      </div>
    {/if}
  </Panel>
  </div>

 <div class="columna-lateral-informacion">
    {#if asambleaId}
        <CompartirAsamblea 
            asambleaId={asambleaId} 
            asambleaNombre={tema} 
        />
    {/if}
  </div>

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
                  <label>Lugar de la Asamblea</label>
                  <input type="text" bind:value={tempGeneral.lugar} placeholder="Ej: Salón de Asambleas Holguín" />
              </div>

              <div class="campo mt-10">
                  <label>Idioma</label>
                  <select bind:value={tempGeneral.idioma}>
                      <option>Español</option>
                      <option>LSC</option>
                      <option>Inglés</option>
                      <option>Francés</option>
                  </select>
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

<style>
/* ========================================
   CONTENEDOR Y TARJETAS GENERALES
   ======================================== */
.contenedor { display: flex; flex-direction: column; gap: 20px; padding: 20px; padding-bottom: 40px; background: var(--bg-body); }
:global(.tarjeta-evento) { margin-bottom: 25px !important; display: block; }
.header-card { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid var(--border); padding-bottom: 15px; }
.header-card h3 { margin: 0; display: flex; align-items: center; gap: 10px; font-size: 18px; color: var(--text-main); }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.grid-3 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 15px; }
.mb-15 { margin-bottom: 15px; }

/* ========================================
   VISTA LECTURA (TARJETA 1)
   ======================================== */
.header-card-lectura { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
.header-card-lectura h3 { margin: 0; color: var(--text-main); font-size: 1.3rem; font-weight: 700; }
.btn-edit-burgundy { background: var(--accent-danger); width: 40px; height: 40px; border-radius: 8px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-shadow: var(--shadow-sm); }
.btn-edit-burgundy:hover { background: var(--accent-danger-hover); transform: translateY(-2px); }
.grid-lectura { display: grid; grid-template-columns: 1fr 1.2fr; gap: 40px; }
.col-lectura { display: flex; flex-direction: column; gap: 12px; }
.col-lectura h4 { font-size: 14px; color: var(--text-main); margin: 0 0 10px 0; font-weight: 700; }
.col-border { border-left: 1px solid var(--border); padding-left: 40px; }
.fila-info { margin-bottom: 5px; }
.fila-info-split { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.lbl { color: var(--text-sec); font-size: 13px; font-weight: 600; margin-right: 5px; }
.val { color: var(--text-sec); font-size: 13px; }
.val.destacado { color: var(--text-main); font-weight: 500; font-size: 14px; }
.text-multi-line { line-height: 1.5; }

/* ========================================
   MODAL DE DETALLES
   ======================================== */
.modal-backdrop { 
  position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
  background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; 
  z-index: 9999; backdrop-filter: blur(2px);
}

.modal-detalles-asamblea { 
  background: var(--bg-body); width: 480px; max-width: 90vw; border-radius: 12px; 
  box-shadow: var(--shadow-premium); overflow: hidden; border: 1px solid var(--border); 
  display: flex; flex-direction: column; max-height: 90vh;
}

.modal-body { 
  padding: 20px; display: flex; flex-direction: column; gap: 15px; 
  overflow-y: auto; 
}

.contenedor-calendario-desplegado { 
  position: fixed; 
  top: 50%; left: 50%; transform: translate(-50%, -50%); 
  z-index: 100000; 
  background: var(--bg-card); 
  border: 1px solid var(--border); 
  border-radius: 12px; 
  box-shadow: 0 0 0 100vw rgba(0,0,0,0.3), 0 25px 50px -12px rgba(0,0,0,0.5); 
  animation: popInCalendar 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes popInCalendar {
    0% { opacity: 0; transform: translate(-50%, -45%) scale(0.95); }
    100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

.modal-header { 
  display: flex; justify-content: space-between; align-items: center; 
  padding: 15px 20px; background: var(--accent-danger); border-bottom: 1px solid var(--border); 
  border-radius: 11px 11px 0 0; 
}

.modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: white; display: flex; align-items: center; gap: 8px;}
.btn-close-modal { border: none; background: none; cursor: pointer; color: white; opacity: 0.7;}
.btn-close-modal:hover { opacity: 1;}

.modal-sub { margin: 0 0 10px 0; font-size: 13px; color: var(--text-sec); }
.modal-body-group { border: 1px solid var(--border); border-radius: 8px; padding: 15px; background: var(--bg-card); margin-bottom: 10px;}
.modal-body-group legend { font-size: 13px; font-weight: 700; color: var(--primary); padding: 0 5px; }
.form-grid { display: grid; gap: 10px; }
.grid-1 { grid-template-columns: 1fr; }
.mt-10 { margin-top: 10px; }
label { font-size: 12px; font-weight: 600; color: var(--text-sec); margin-bottom: 4px; display: block; }
input, select { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; color: var(--text-main); box-sizing: border-box; outline: none; transition: 0.2s; background: var(--input-bg);}
input:focus, select:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
input:disabled { background: var(--bg-body); color: var(--text-sec); cursor: not-allowed; opacity: 0.7; }
.input-big { font-weight: 500; color: var(--text-main); }

.modal-footer { 
  padding: 15px 20px; border-top: 1px solid var(--border); background: var(--bg-card); display: flex; justify-content: flex-end; 
  border-radius: 0 0 11px 11px; 
}

.btn-modal-save { background: var(--accent-danger); color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; }
.btn-modal-save:hover { background: var(--accent-danger-hover); }
.animacion-entrada-modal { animation: modalEnter 0.3s ease-out; }
@keyframes modalEnter { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }

/* CALENDARIO RANGO EN MODAL */
.contenedor-calendario-relative { position: relative; width: 100%; }
.campo-falso-input { background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; gap: 8px; cursor: pointer; min-height: 35px; box-sizing: border-box; transition: 0.2s;}
.campo-falso-input:hover { border-color: var(--primary); }
.campo-falso-input span { flex: 1; font-size: 13px; color: var(--text-sec); }
.campo-falso-input.con-fecha span { color: var(--text-main); font-weight: 500; }
.ico-azul { color: var(--primary); }

/* ========================================
   BOTONES Y CHECKBOX
   ======================================== */
.btn-edit, .btn-cancel { background: transparent; border: 1px solid var(--border); padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; gap: 6px; align-items: center; font-weight: 600; font-size: 12px; transition: all 0.2s; }
.btn-edit { color: var(--primary); border-color: var(--primary); }
.btn-edit:hover { background: var(--primary); color: white; }
.btn-cancel { color: var(--accent-danger); border-color: var(--accent-danger);}
.btn-cancel:hover { background: var(--accent-danger); color: white;}
.btn-save { background: var(--primary); color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; display: flex; gap: 8px; font-weight: 600; font-size: 13px; }
.stream-check-compact { display: inline-flex; align-items: center; gap: 10px; padding: 8px 15px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; }

/* ========================================
   EDITOR TIPTAP
   ======================================== */
.editor-block { margin-top: 15px; }
.tiptap-frame { border: 1px solid var(--border); border-radius: 8px; background: var(--input-bg); min-height: 180px; display: flex; flex-direction: column; }
.toolbar { background: var(--bg-card); padding: 10px 12px; border-bottom: 1px solid var(--border); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; border-radius: 8px 8px 0 0;}
.group { display: flex; align-items: center; gap: 2px; background: var(--bg-body); padding: 3px; border-radius: 6px; border: 1px solid var(--border); }
.group.inputs { background: transparent; border: none; padding: 0; gap: 4px; }
.sep { width: 2px; height: 28px; background: var(--border); margin: 0 10px; border-radius: 1px; }
.ml-auto { margin-left: auto; }
.toolbar button { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid transparent; border-radius: 4px; cursor: pointer; color: var(--text-sec); transition: 0.15s ease; }
.toolbar button:hover { background: var(--border); color: var(--text-main); }
.toolbar button.active { background: var(--primary); color: white; border-color: var(--primary); }

.native-select { height: 32px; border: 1px solid var(--border); border-radius: 4px; padding: 0 8px; font-size: 13px; color: var(--text-main); outline: none; cursor: pointer; background: var(--bg-card); transition: 0.15s; }
.native-select:hover, .native-select:focus { border-color: var(--primary); }
.font-family { width: 95px; } .font-size { width: 55px; } .line-height { width: 48px; }

.color-wrapper { position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; border: 1px solid transparent; transition: 0.15s ease; color: var(--text-sec); }
.color-wrapper:hover { background-color: var(--border); color: var(--text-main); }
.color-wrapper input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

.editor-content { padding: 20px; outline: none; flex: 1; font-size: 14px; line-height: 1.6; color: var(--text-main); background: var(--input-bg); border-radius: 0 0 8px 8px;}
:global(.ProseMirror p) { margin-top: 0; margin-bottom: 0.5em; }
:global(.ProseMirror ul, .ProseMirror ol) { padding-left: 1.5rem; margin: 0.5rem 0; }
:global(.ProseMirror a) { color: var(--primary); text-decoration: underline; cursor: pointer; }
:global(.ProseMirror hr) { border: none; border-top: 2px solid var(--border); margin: 1rem 0; }
:global(.ProseMirror:not(.ProseMirror-focused)) { background: var(--bg-body); cursor: not-allowed; opacity: 0.7; }
:global(.ProseMirror.ProseMirror-focused) { background: var(--input-bg); cursor: text; opacity: 1; }

/* Tareas Tiptap */
:global(ul[data-type="taskList"]) { list-style: none; padding: 0; }
:global(ul[data-type="taskList"] li) { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
:global(ul[data-type="taskList"] li > label) { display: flex; align-items: center; user-select: none; margin-right: 4px; }

/* ========================================
   PANEL DE ORADORES Y UTILIDADES
   ======================================== */
.fila-accion { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; gap: 20px; }
.titulo-fila { font-size: 16px; font-weight: 600; color: var(--text-main); margin: 0; }
.grupo-botones { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.btn-azul { background: var(--primary); color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s, transform 0.1s; }
.btn-azul:hover { background: var(--primary-hover); }
.badge-amarillo { background: #fef08a; color: #854d0e; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 700; margin-left: 6px; }
.divisor-fino { height: 1px; background: var(--border); width: 100%; }

/* ========================================
   ACORDEONES PARA PANELES
   ======================================== */
:global(.tarjeta-acordeon) { margin-bottom: 10px !important; display: block; border-radius: 8px; overflow: hidden; box-shadow: var(--shadow-sm); }
.header-acordeon { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; cursor: pointer; background: var(--bg-body); transition: all 0.2s ease; border-left: 4px solid transparent; }
.header-acordeon:hover { background: var(--border); border-left: 4px solid var(--primary); }
.titulo-acordeon { display: flex; align-items: center; gap: 10px; }
.titulo-acordeon h3 { margin: 0; font-size: 16px; color: var(--text-main); font-weight: 600; }
.contenido-acordeon { padding: 0 24px 24px 24px; background: var(--bg-card); border-top: 1px solid var(--border); padding-top: 20px; }
.acciones-header-panel { display: flex; justify-content: flex-end; margin-bottom: 15px; }
.animacion-despliegue { animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1); transform-origin: top; }
@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

/* ========================================
   DISEÑO RESPONSIVO (MÓVILES)
   ======================================== */
@media (max-width: 768px) {
  .contenedor { padding: 15px 10px; }
  
  /* Tarjeta principal en 1 sola columna */
  .grid-lectura { grid-template-columns: 1fr; gap: 20px; }
  .col-border { border-left: none; padding-left: 0; border-top: 1px solid var(--border); padding-top: 20px; }
  
  /* Inputs de Ensayos en 1 sola columna */
  .grid-3 { grid-template-columns: 1fr; gap: 10px; }
  
  /* Fila de acción vertical */
  .fila-accion { flex-direction: column; align-items: flex-start; gap: 15px; }
  .grupo-botones { width: 100%; justify-content: flex-start; }
  .btn-azul { flex-grow: 1; justify-content: center; }
  
  /* Modal de detalles ajustado */
  .modal-detalles-asamblea { width: 95vw; }
  .grid-2 { grid-template-columns: 1fr; gap: 10px; }
  
  /* Ajuste de Toolbar en Editor (Evita que se rompa en pantallas muy chicas) */
  .toolbar { gap: 4px; padding: 8px; }
  .group { flex-wrap: wrap; justify-content: center; }
  .sep { display: none; } /* Ocultar separadores en móvil para ganar espacio */
}
</style>