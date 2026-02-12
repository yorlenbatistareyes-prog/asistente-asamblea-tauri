<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  
  // --- TAURI & STORE ---
  import { invoke } from '@tauri-apps/api/core';
  import { cartasStore } from '$lib/stores/cartas'; 
  
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
    List, ListOrdered, Undo, Redo, Eraser, 
    Link as LinkIcon, Minus, 
    IndentDecrease, IndentIncrease, 
    Plus, ZoomIn, ZoomOut, Clipboard,
    Type, Scissors, Copy, ArrowUpDown,
    ArrowUpFromLine, ArrowDownToLine, ArrowLeftFromLine, ArrowRightToLine,
    ChevronDown, ChevronUp, Braces,
    Check, Loader2, Cloud 
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();
  export let seccionInicial = 'oradores';

  // --- ESTADO ---
  let zoomLevel = 100;
  let tipoActivo = seccionInicial;
  let element: HTMLElement;
  let editor: Editor;       
  let contenidoCargado = "";
  let isSaving = false;

  // Autoguardado
  let autosaveTimer: any;
  let saveStatus: 'saved' | 'saving' | 'unsaved' = 'saved';

  // Variables UI
  let currentFont = 'Arial';
  let currentSize = '11';
  let currentColor = '#000000';
  let currentLineHeight = '1.5';
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let isStrike = false;
  let textAlignLeft = false;
  let textAlignCenter = false;
  let textAlignRight = false;
  let textAlignJustify = false;
  let isBulletList = false;
  let isOrderedList = false;
  
  // Estado Popups
  let isColorPickerOpen = false;
  let isMarkerPickerOpen = false; 
  let colorPickerPos = { top: 0, left: 0 };
  let markerPickerPos = { top: 0, left: 0 };

  // Márgenes
  let marginTop = 2.54;
  let marginBottom = 2.54;
  let marginLeft = 2.54;
  let marginRight = 2.54;

  // --- DATOS DE MARCADORES ---
  let markerGroups = [
      {
          title: "Lista rápida de Marcadores",
          isOpen: true,
          items: [
              { label: "Saludo según sexo", desc: "Ejemplo: Hermano, o Hermana", code: "[[Saludo según sexo]]", value: "Saludo según sexo" },
              { label: "Designación del Circuito", desc: "Ejemplo: HG-06", code: "[[Designación del Circuito]]", value: "Designación del Circuito" }
          ]
      },
      {
          title: "Marcadores de Fechas",
          isOpen: false,
          items: [
              { label: "Fecha Actual Mediana", desc: "Ejemplo: 7 feb 2026", code: "[[Fecha Actual Mediana]]", value: "Fecha Actual Mediana" },
              { label: "Fecha Actual Completa", desc: "Ejemplo: 7 de febrero de 2026", code: "[[Fecha Actual Completa]]", value: "Fecha Actual Completa" }
          ]
      },
      {
          title: "Marcadores de Asignación",
          isOpen: false,
          items: [
              { label: "Hora", desc: "Ejemplo: 10:10 AM", code: "[[Hora]]", value: "Hora" },
              { label: "Duración", desc: "Total de minutos", code: "[[Duración]]", value: "Duración" },
              { label: "Tema", desc: "Título del discurso", code: "[[Tema]]", value: "Tema" },
              { label: "Número de Bosquejo", desc: "Ejemplo: 1", code: "[[Número de Bosquejo]]", value: "Número de Bosquejo" },
              { label: "Tipo de asignación", desc: "Ejemplo: Discurso...", code: "[[Tipo de asignación]]", value: "Tipo de asignación" },
              { label: "Enlace(s) del Bosquejo", desc: "Cualquier enlace", code: "[[Enlace(s) del Bosquejo]]", value: "Enlace(s) del Bosquejo" },
              { label: "Notas", desc: "", code: "[[Notas]]", value: "Notas" }
          ]
      },
      {
          title: "Marcadores de Orador",
          isOpen: false,
          items: [
              { label: "Nombre", desc: "Ejemplo: Roberto", code: "[[Nombre]]", value: "Nombre" },
              { label: "Segundo nombre", desc: "Ejemplo: Adolfo", code: "[[Segundo nombre]]", value: "Segundo nombre" },
              { label: "Apellidos", desc: "Ejemplo: Batista Peña", code: "[[Apellidos]]", value: "Apellidos" }
          ]
      },
      {
          title: "Marcadores de Lugar",
          isOpen: false,
          items: [
              { label: "Nombre del lugar", desc: "Ejemplo: Salón", code: "[[Nombre del lugar]]", value: "Nombre del lugar" },
              { label: "Dirección del lugar", desc: "Ejemplo: Av. Central", code: "[[Dirección]]", value: "Dirección" },
              { label: "Ciudad", desc: "Ejemplo: Holguín", code: "[[Ciudad]]", value: "Ciudad" },
              { label: "Provincia o Estado", desc: "Ejemplo: HG", code: "[[Estado o Provincia]]", value: "Estado o Provincia" }
          ]
      },
      {
          title: "Marcadores de Evento",
          isOpen: false,
          items: [
              { label: "Fecha", desc: "Ejemplo: Fecha de la Asamblea", code: "[[Fecha]]", value: "Fecha" },
              { label: "Tipo de evento", desc: "Ejemplo: CA-br", code: "[[Tipo de Evento]]", value: "Tipo de Evento" },
              { label: "Tema del evento", desc: "Título del evento", code: "[[Tema del Evento]]", value: "Tema del Evento" }
          ]
      },
      {
          title: "Marcadores de Ensayo",
          isOpen: false,
          items: [
              { label: "Información completa de los ensayos", desc: "Info completa", code: "[[Información completa de los ensayos]]", value: "Información completa de los ensayos" },
              { label: "Nota para los ensayos", desc: "", code: "[[Notas para los ensayos]]", value: "Notas para los ensayos" },
              { label: "Lugar de los ensayos", desc: "", code: "[[Lugar de los ensayos]]", value: "Lugar de los ensayos" },
              { label: "Fecha y hora del ensayo", desc: "", code: "[[Fecha y hora del ensayo]]", value: "Fecha y hora del ensayo" },
              { label: "Fecha de ensayos", desc: "", code: "[[Fecha de ensayos]]", value: "Fecha de ensayos" },
              { label: "Hora de ensayos", desc: "", code: "[[Hora de ensayos]]", value: "Hora de ensayos" }
          ]
      },
      {
          title: "Marcadores del Presidente",
          isOpen: false,
          items: [
              { label: "Correo electrónico del Presidente", desc: "Ejemplo: mail@jwpub.org", code: "[[correo electrónico jwpub del Presidente de la asamblea]]", value: "correo electrónico jwpub del Presidente de la asamblea" },
              { label: "Teléfono del Presidente", desc: "", code: "[[Teléfono del Presidente de la asamblea]]", value: "Teléfono del Presidente de la asamblea" }
          ]
      },
      {
          title: "Marcadores de Instrucciones",
          isOpen: false,
          items: [
              { label: "Información de orientaciones", desc: "Plataforma...", code: "[[Información de orientaciones]]", value: "Información de orientaciones" },
              { label: "Instrucciones especiales", desc: "Sucursal", code: "[[Instrucciones Especiales]]", value: "Instrucciones Especiales" }
          ]
      }
  ];

  function toggleMarkerGroup(index: number) {
      markerGroups[index].isOpen = !markerGroups[index].isOpen;
      markerGroups = [...markerGroups]; 
  }

  function insertMarker(value: string) {
      if (editor) {
          editor.chain().focus().run();
          editor.chain().focus().insertContent(`[[${value}]]`).run();
          isMarkerPickerOpen = false;
      }
  }

  // --- COLORES ---
  const themeColors = [
    '#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0',
    '#595959', '#A6A6A6', '#D9D9D9', '#FFFFFF', '#F2F2F2', '#D0CECE', '#B4C6E7', '#8EA9DB', '#5B9BD5', '#2E75B6',
    '#1F4E78', '#376092', '#5B9BD5', '#BDD7EE', '#DEEBF7', '#FCE4D6', '#F8CBAD', '#F4B183', '#ED7D31', '#C65911',
    '#834C11', '#7F6000', '#9CAB7B', '#C6E0B4', '#E2F0D9', '#D7E4BC', '#C5E0B3', '#A9D08E', '#70AD47', '#548235'
  ];
  const standardColors = ['#000000', '#FFFFFF', '#EEECE1', '#1F497D', '#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646'];

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
            parseHTML: (element: any) => element.style.fontSize.replace('px', ''),
            renderHTML: (attributes: any) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}px` };
            },
          },
        },
      }];
    },
    addCommands() {
      return {
        setFontSize: (fontSize: string) => ({ chain }: any) => chain().setMark('textStyle', { fontSize }).run(),
        unsetFontSize: () => ({ chain }: any) => chain().setMark('textStyle', { fontSize: null }).run(),
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
            parseHTML: (element: any) => {
              const styleAttr = element.getAttribute('style') || '';
              const lineHeightMatch = styleAttr.match(/line-height\s*:\s*([^;]+)/i);
              if (lineHeightMatch && lineHeightMatch[1]) return lineHeightMatch[1].trim();
              const computedStyle = window.getComputedStyle(element);
              const computedLH = computedStyle.lineHeight;
              if (computedLH && computedLH !== 'normal') return computedLH;
              return null;
            },
            renderHTML: (attributes: any) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      }];
    },
    addCommands() {
      return {
        setLineHeight: (lineHeight: string) => ({ commands }: any) => {
           return this.options.types.every((type: string) => commands.updateAttributes(type, { lineHeight }));
        },
      };
    },
  });

  // --- CARGA ---
  async function cargarPlantilla() {
    try {
      const respuesta: any = await invoke('obtener_plantilla', { id: tipoActivo });
      if (respuesta && respuesta.cuerpo) {
          contenidoCargado = respuesta.cuerpo;
      } else {
          const storeData = $cartasStore.find(c => c.id === tipoActivo);
          contenidoCargado = storeData ? storeData.html : `<p>Escriba aquí el contenido para ${tipoActivo}...</p>`;
      }
      if (editor) editor.commands.setContent(contenidoCargado);
    } catch (e) {
      console.error(e);
      const storeData = $cartasStore.find(c => c.id === tipoActivo);
      if(editor && storeData) editor.commands.setContent(storeData.html);
    }
  }

  // --- LÓGICA DE GUARDADO ---
  async function actualizar(silencioso = false) {
    if (!editor) return;
    if (!silencioso) isSaving = true;
    if (silencioso) saveStatus = 'saving';

    try {
      const htmlFinal = editor.getHTML();
      await invoke('guardar_plantilla', { id: tipoActivo, contenido: htmlFinal });
      
      cartasStore.update(cartas => {
          const index = cartas.findIndex(c => c.id === tipoActivo);
          if (index !== -1) cartas[index].html = htmlFinal;
          else cartas.push({ id: tipoActivo, html: htmlFinal });
          return cartas;
      });

      if (!silencioso) alert(`✅ Guardado correctamente.`);
      saveStatus = 'saved';
    } catch (e) {
      if(!silencioso) alert("Error: " + e);
      saveStatus = 'unsaved';
    } finally {
      isSaving = false;
    }
  }

  function triggerAutosave() {
      saveStatus = 'unsaved';
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
          actualizar(true);
      }, 2000);
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
      editorProps: {
        handlePaste: (view, event) => {
          setTimeout(() => updateToolbar(), 100);
          return false;
        },
      },
      onUpdate: () => { 
        editor = editor;
        updateToolbar();
        triggerAutosave();
      },
      onTransaction: () => { 
        editor = editor; 
        updateToolbar();
      },
      onSelectionUpdate: () => { updateToolbar(); }
    });
    cargarPlantilla();
    
    document.addEventListener('click', closePopupsIfClickOutside);
    return () => {
      document.removeEventListener('click', closePopupsIfClickOutside);
      if(editor) editor.destroy();
    };
  });

  function getLineHeightFromEditor(): string {
    if (!editor) return '1.5';
    const node = editor.state.selection.$anchor.parent;
    if (node && node.attrs && node.attrs.lineHeight) return node.attrs.lineHeight;
    return '1.5';
  }

  function updateToolbar() {
    if (!editor) return;
    const textStyle = editor.getAttributes('textStyle');
    currentFont = textStyle.fontFamily || 'Arial';
    currentSize = textStyle.fontSize || '11';
    currentColor = textStyle.color || '#000000';
    currentLineHeight = getLineHeightFromEditor();
    isBold = editor.isActive('bold');
    isItalic = editor.isActive('italic');
    isUnderline = editor.isActive('underline');
    isStrike = editor.isActive('strike');
    textAlignLeft = editor.isActive({ textAlign: 'left' });
    textAlignCenter = editor.isActive({ textAlign: 'center' });
    textAlignRight = editor.isActive({ textAlign: 'right' });
    textAlignJustify = editor.isActive({ textAlign: 'justify' });
    isBulletList = editor.isActive('bulletList');
    isOrderedList = editor.isActive('orderedList');
  }

  // --- ACTIONS UI ---
  function copiar() { editor.commands.focus(); document.execCommand('copy'); }
  function cortar() { editor.commands.focus(); document.execCommand('cut'); }
  async function pegar() {
    editor.commands.focus();
    try {
      const items = await navigator.clipboard.read();
      let pegado = false;
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const html = await item.getType('text/html').then(blob => blob.text());
          if (html) {
            editor.commands.insertContent(html);
            pegado = true;
            break;
          }
        }
      }
      if (!pegado) {
        const text = await navigator.clipboard.readText();
        if (text) editor.commands.insertContent(text);
      }
      setTimeout(() => updateToolbar(), 50);
    } catch (err) { 
      const text = await navigator.clipboard.readText();
      if (text) editor.commands.insertContent(text);
      setTimeout(() => updateToolbar(), 50);
    }
  }

  function cambiarFuente(e: Event) { editor.chain().focus().setFontFamily((e.target as HTMLSelectElement).value).run(); }
  function cambiarTamano(e: Event) { editor.chain().focus().setFontSize((e.target as HTMLSelectElement).value).run(); }
  function cambiarInterlineado(e: Event) { editor.chain().focus().setLineHeight((e.target as HTMLSelectElement).value).run(); }
  
  function selectColor(color: string) {
    editor.chain().setColor(color).run();
    currentColor = color;
    isColorPickerOpen = false;
  }
  
  function toggleColorPicker(e: MouseEvent) {
    e.stopPropagation();
    if (isColorPickerOpen) { isColorPickerOpen = false; return; }
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    colorPickerPos = { top: rect.bottom + 8, left: rect.left };
    isColorPickerOpen = true;
    isMarkerPickerOpen = false; 
  }
  
  function toggleMarkerPicker(e: MouseEvent) {
    e.stopPropagation();
    if (isMarkerPickerOpen) { isMarkerPickerOpen = false; return; }
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    markerPickerPos = { top: rect.bottom + 8, left: rect.left };
    isMarkerPickerOpen = true;
    isColorPickerOpen = false; 
  }

  function closePopupsIfClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.color-picker-wrapper')) isColorPickerOpen = false;
    if (!target.closest('.marker-dropdown-wrapper') && !target.closest('.marker-dropdown')) isMarkerPickerOpen = false;
  }

  function setLink() {
    const url = window.prompt('URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }
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
              
              <div class="autosave-indicator">
                  {#if saveStatus === 'saved'}
                      <span class="status-pill saved"><Check size={12} /> Guardado</span>
                  {:else if saveStatus === 'saving'}
                      <span class="status-pill saving"><Loader2 size={12} class="spin" /> Guardando...</span>
                  {:else}
                      <span class="status-pill unsaved"><Cloud size={12} /> Cambios sin guardar</span>
                  {/if}
              </div>

          </div>
      </div>
      <div class="right-section">
          <button class="save-btn" on:click={() => actualizar(false)} disabled={isSaving}>
              <Save size={18} /> <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
      </div>
    </div>

    <div class="ribbon">
      {#if editor}
        <div class="ribbon-group">
            <div class="group-row">
                <button class="ribbon-btn large" on:click={pegar} title="Pegar">
                    <Clipboard size={24} /> <span>Pegar</span>
                </button>
                <div class="group-col small-gap">
                    <button class="ribbon-btn list-item" on:click={cortar} title="Cortar">
                        <Scissors size={14} /> <span>Cortar</span>
                    </button>
                    <button class="ribbon-btn list-item" on:click={copiar} title="Copiar">
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
                    <select class="size-select" on:change={cambiarTamano} bind:value={currentSize} title="Tamaño">
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
                    <button class="ribbon-btn small" on:click={() => editor.chain().focus().unsetAllMarks().run()} title="Borrar Formato"><Eraser size={16}/></button>
                </div>
                <div class="controls-row spacing">
                    <button class="ribbon-btn small" class:active={isBold} on:click={() => editor.chain().focus().toggleBold().run()} title="Negrita"><Bold size={16}/></button>
                    <button class="ribbon-btn small" class:active={isItalic} on:click={() => editor.chain().focus().toggleItalic().run()} title="Cursiva"><Italic size={16}/></button>
                    <button class="ribbon-btn small" class:active={isUnderline} on:click={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado"><UnderlineIcon size={16}/></button>
                    <button class="ribbon-btn small" class:active={isStrike} on:click={() => editor.chain().focus().toggleStrike().run()} title="Tachado"><Strikethrough size={16}/></button>
                    <div class="divider-v"></div>
                    <div class="color-picker-wrapper">
                        <button class="color-picker-btn" on:click={toggleColorPicker} title="Color de Fuente">
                            <Type size={16} color={currentColor}/>
                            <div class="color-bar" style="background-color: {currentColor}"></div>
                        </button>
                        {#if isColorPickerOpen}
                            <div class="color-picker-dropdown" style="top: {colorPickerPos.top}px; left: {colorPickerPos.left}px;">
                                <div class="color-auto-section">
                                    <button class="color-auto-btn" on:click={() => selectColor('#000000')} title="Automático (Negro)">
                                        <div class="color-auto-indicator"><div class="color-auto-square" style="background-color: #000000;"></div><div class="color-auto-text">Automático</div></div>
                                    </button>
                                </div>
                                <div class="color-section">
                                    <div class="color-section-title">Colores de Tema</div>
                                    <div class="color-grid-theme">
                                        {#each themeColors as color}<button class="color-swatch-theme" style="background-color: {color}; border: 1px solid {color === '#FFFFFF' ? '#ccc' : 'transparent'};" class:active={currentColor === color} on:click={() => selectColor(color)} title={color}></button>{/each}
                                    </div>
                                </div>
                                <div class="color-section">
                                    <div class="color-section-title">Colores Estándar</div>
                                    <div class="color-grid-standard">
                                        {#each standardColors as color}<button class="color-swatch-standard" style="background-color: {color}; border: 1px solid {color === '#FFFFFF' ? '#ccc' : 'transparent'};" class:active={currentColor === color} on:click={() => selectColor(color)} title={color}></button>{/each}
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
            <div class="group-label">Fuente</div>
        </div>
        <div class="separator"></div>

        <div class="ribbon-group">
            <div class="group-col full-h">
                <div class="controls-row">
                    <button class="ribbon-btn small" class:active={isBulletList} on:click={() => editor.chain().focus().toggleBulletList().run()} title="Viñetas"><List size={18}/></button>
                    <button class="ribbon-btn small" class:active={isOrderedList} on:click={() => editor.chain().focus().toggleOrderedList().run()} title="Numeración"><ListOrdered size={18}/></button>
                    <div class="divider-v"></div>
                    <button class="ribbon-btn small" on:click={() => editor.chain().focus().liftListItem('listItem').run()} title="Disminuir Sangría"><IndentDecrease size={18}/></button>
                    <button class="ribbon-btn small" on:click={() => editor.chain().focus().sinkListItem('listItem').run()} title="Aumentar Sangría"><IndentIncrease size={18}/></button>
                </div>
                <div class="controls-row spacing">
                    <button class="ribbon-btn small" class:active={textAlignLeft} on:click={() => editor.chain().focus().setTextAlign('left').run()} title="Izquierda"><AlignLeft size={18}/></button>
                    <button class="ribbon-btn small" class:active={textAlignCenter} on:click={() => editor.chain().focus().setTextAlign('center').run()} title="Centrar"><AlignCenter size={18}/></button>
                    <button class="ribbon-btn small" class:active={textAlignRight} on:click={() => editor.chain().focus().setTextAlign('right').run()} title="Derecha"><AlignRight size={18}/></button>
                    <button class="ribbon-btn small" class:active={textAlignJustify} on:click={() => editor.chain().focus().setTextAlign('justify').run()} title="Justificar"><AlignJustify size={18}/></button>
                    <div class="divider-v"></div>
                    <div class="line-height-wrapper" title="Interlineado">
                        <ArrowUpDown size={14} class="icon-lh"/>
                        <select class="line-height-select" on:change={cambiarInterlineado} bind:value={currentLineHeight}>
                            <option value="0.5">0.5</option>
                            <option value="0.75">0.75</option>
                            <option value="0.9">0.9</option>
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
            <div class="group-col full-h margins-group">
                <div class="margin-row">
                    <div class="margin-input" title="Margen Superior (cm)"><ArrowUpFromLine size={12} /><input type="number" step="0.1" bind:value={marginTop} /></div>
                    <div class="margin-input" title="Margen Inferior (cm)"><ArrowDownToLine size={12} /><input type="number" step="0.1" bind:value={marginBottom} /></div>
                </div>
                <div class="margin-row">
                    <div class="margin-input" title="Margen Izquierdo (cm)"><ArrowLeftFromLine size={12} /><input type="number" step="0.1" bind:value={marginLeft} /></div>
                    <div class="margin-input" title="Margen Derecho (cm)"><ArrowRightToLine size={12} /><input type="number" step="0.1" bind:value={marginRight} /></div>
                </div>
            </div>
            <div class="group-label">Márgenes</div>
        </div>
        <div class="separator"></div>

        <div class="ribbon-group">
            <div class="group-row centered">
               <button class="ribbon-btn large" on:click={setLink} class:active={editor.isActive('link')} title="Vínculo"><LinkIcon size={22}/><span>Link</span></button>
               <button class="ribbon-btn large" on:click={() => editor.chain().focus().setHorizontalRule().run()} title="Línea"><Minus size={22}/><span>Línea</span></button>
            </div>
            <div class="group-label">Insertar</div>
        </div>
        <div class="separator"></div>

        <div class="ribbon-group">
             <div class="group-row centered">
                <button class="ribbon-btn large" on:click={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer"><Undo size={22}/><span>Deshacer</span></button>
                <button class="ribbon-btn large" on:click={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer"><Redo size={22}/><span>Rehacer</span></button>
             </div>
             <div class="group-label">Edición</div>
        </div>

        <div class="ribbon-group ml-auto grow-right">
            <div class="group-row centered">
               <div class="marker-dropdown-wrapper">
                   <button class="ribbon-btn large" on:click={toggleMarkerPicker} title="Marcadores de Posición">
                       <Braces size={22}/> <span>Marcadores</span>
                   </button>
                   
                   {#if isMarkerPickerOpen}
                        <div class="marker-dropdown" style="top: {markerPickerPos.top}px; right: 20px;">
                            <div class="marker-header">Insertar Marcador</div>
                            <div class="marker-scroll">
                                {#each markerGroups as group, i}
                                    <div class="marker-group">
                                        <button type="button" class="marker-group-header" on:mousedown|preventDefault={() => toggleMarkerGroup(i)}>
                                            <strong>{group.title}</strong>
                                            {#if group.isOpen}<ChevronUp size={14}/>{:else}<ChevronDown size={14}/>{/if}
                                        </button>
                                        {#if group.isOpen}
                                            <div class="marker-list">
                                                {#each group.items as item}
                                                    <button type="button" class="marker-item" on:mousedown|preventDefault={() => insertMarker(item.value)} title={item.desc}>
                                                        <div class="marker-content-row">
                                                            <span class="m-label">{item.label}</span>
                                                            {#if item.desc}<span class="m-desc">{item.desc}</span>{/if}
                                                        </div>
                                                        <div class="m-code">{item.code}</div>
                                                    </button>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>
                   {/if}
               </div>
            </div>
            <div class="group-label">Correspondencia</div>
        </div>
      {/if}
    </div>

    <div class="workspace">
        <div class="scroll-container">
            <div class="paper-zoom-wrapper" style="zoom: {zoomLevel}%;">
                <div class="paper-sheet" on:click={() => editor?.commands.focus()}>
                    <div class="editor-content" bind:this={element} style="padding: {marginTop}cm {marginRight}cm {marginBottom}cm {marginLeft}cm;"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="status-bar">
        <div class="status-left">Página 1 de 1</div>
        <div class="status-right zoom-controls">
            <button on:click={() => zoomLevel = Math.max(10, zoomLevel - 10)} title="Alejar" class="zoom-btn"><Minus size={14}/></button>
            <input type="range" min="10" max="300" bind:value={zoomLevel} class="zoom-slider" title="Zoom">
            <button on:click={() => zoomLevel = Math.min(300, zoomLevel + 10)} title="Acercar" class="zoom-btn"><Plus size={14}/></button>
            <span class="zoom-text">{zoomLevel}%</span>
        </div>
    </div>

  </main>
</div>

<style>
  /* --- LAYOUT GLOBAL --- */
  .word-layout { display: flex; flex-direction: row; height: 100vh; font-family: 'Segoe UI', sans-serif; background: var(--bg-body); overflow: hidden; color: var(--text-main); }
  
  /* SIDEBAR */
  .sidebar { width: 70px; background: var(--bg-secondary); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; align-items: center; padding-top: 15px; z-index: 100; flex-shrink: 0; }
  .sidebar-top { display: flex; flex-direction: column; align-items: center; margin-bottom: 30px; cursor: pointer; }
  .back-btn { background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 5px; transition: all 0.2s; }
  .back-btn:hover { background: var(--primary); color: white; border-color: var(--primary); }
  .back-label { font-size: 10px; font-weight: 700; color: var(--text-secondary); }
  .sidebar-content { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .icon-indicator { width: 45px; height: 45px; background: var(--primary); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
  .doc-type-label { font-size: 10px; font-weight: 700; color: var(--text-main); text-align: center; writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: 1px; margin-top: 10px; }

  /* MAIN CONTENT */
  main { flex: 1; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

  /* HEADER */
  .app-header { background: var(--primary); color: white; height: 52px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; flex-shrink: 0; }
  .left-section { display: flex; align-items: center; gap: 12px; }
  .header-icon { opacity: 0.9; }
  .doc-info { display: flex; flex-direction: column; justify-content: center; }
  .doc-title { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: white; text-transform: uppercase; }
  .doc-status { font-size: 11px; opacity: 0.8; font-weight: 400; }
  .save-btn { background: var(--bg-card); color: var(--primary); border: none; font-weight: 700; font-size: 13px; padding: 8px 18px; border-radius: 4px; display: flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
  .save-btn:hover { background: var(--hover-bg); }

  /* AUTOGUARDADO INDICADORES */
  .autosave-indicator { display: flex; align-items: center; margin-top: 2px; }
  .status-pill { display: flex; align-items: center; gap: 4px; font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600; transition: all 0.3s ease; }
  .status-pill.saved { color: rgba(255, 255, 255, 0.8); background: rgba(255, 255, 255, 0.1); }
  .status-pill.saving { color: white; background: rgba(255, 255, 255, 0.2); }
  .status-pill.unsaved { color: rgba(255, 255, 255, 0.6); }
  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  /* RIBBON */
  .ribbon { background: var(--bg-body); height: 105px; border-bottom: 1px solid var(--border-color); display: flex; padding: 5px 10px; gap: 5px; flex-shrink: 0; user-select: none; overflow-x: auto; }
  .ribbon-group { display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 0 6px; height: 100%; flex-shrink: 0; }
  .ribbon-group.grow-right { flex-grow: 1; align-items: flex-end; padding-right: 20px; }
  .ribbon-group.ml-auto { margin-left: auto; }
  .group-row { display: flex; align-items: center; gap: 4px; height: 100%; padding-bottom: 16px; }
  .group-row.centered { justify-content: center; }
  .group-col { display: flex; flex-direction: column; gap: 2px; justify-content: center; }
  .group-col.small-gap { gap: 2px; }
  .group-col.full-h { height: 100%; justify-content: flex-start; padding-top: 4px; gap: 4px; padding-bottom: 16px; }
  .controls-row { display: flex; gap: 2px; align-items: center; }
  .controls-row.spacing { gap: 4px; }
  .group-label { font-size: 11px; color: var(--text-secondary); margin-top: -20px; text-align: center; width: 100%; pointer-events: none; }
  .separator { width: 1px; background: var(--border-color); height: 75%; align-self: center; margin: 0 4px; }
  .divider-v { width: 1px; height: 18px; background: var(--border-color); margin: 0 6px; }

  /* BUTTONS */
  .ribbon-btn { border: 1px solid transparent; background: transparent; cursor: pointer; color: var(--text-main); border-radius: 3px; display: flex; align-items: center; justify-content: center; transition: all 0.1s; }
  .ribbon-btn:hover { background: var(--hover-bg); border-color: var(--border-color); color: var(--primary); }
  .ribbon-btn.active { background: var(--bg-secondary); border-color: var(--primary); color: var(--primary); }
  .ribbon-btn:disabled { opacity: 0.5; cursor: default; }
  .ribbon-btn > :global(svg), .ribbon-btn > span { pointer-events: none; }
  .ribbon-btn.large { flex-direction: column; width: 55px; height: 65px; font-size: 11px; gap: 4px; }
  .ribbon-btn.small { width: 28px; height: 28px; }
  .ribbon-btn.list-item { width: 75px; height: 22px; justify-content: flex-start; gap: 6px; font-size: 11px; padding-left: 4px; }

  /* INPUTS */
  select { font-family: 'Segoe UI', sans-serif; border: 1px solid transparent; background: transparent; font-size: 12px; height: 22px; outline: none; cursor: pointer; color: var(--text-main); }
  select:hover { border-color: var(--border-color); background: var(--bg-card); }
  .font-select { width: 120px; border: 1px solid var(--border-color); background: var(--bg-card); height: 24px; padding-left: 4px; }
  .size-select { width: 45px; border: 1px solid var(--border-color); background: var(--bg-card); height: 24px; margin-left: 2px; text-align: center; }
  .line-height-wrapper { display: flex; align-items: center; border: 1px solid transparent; padding-left: 2px; border-radius: 3px; }
  .line-height-wrapper:hover { border-color: var(--border-color); background: var(--bg-secondary); }
  .icon-lh { margin-right: 0px; color: var(--text-secondary); pointer-events: none; }
  .line-height-select { width: 35px; border: none; background: transparent; }
  
  /* COLOR PICKER STYLES */
  .color-picker-wrapper { position: relative; display: inline-block; }
  .color-picker-btn { position: relative; width: 28px; height: 26px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 3px; cursor: pointer; background: transparent; padding: 0; }
  .color-picker-btn:hover { background: var(--hover-bg); border-color: var(--border-color); }
  .color-bar { width: 18px; height: 4px; margin-top: 1px; border-radius: 1px; }
  .color-picker-dropdown { position: fixed; background: var(--bg-card); border: 1px solid var(--border-color); padding: 8px; width: 180px; box-shadow: 0 4px 8px var(--shadow-color); z-index: 10000; font-family: 'Segoe UI', sans-serif; }
  .color-auto-section { padding: 4px 0; border-bottom: 1px solid var(--border-color); margin-bottom: 8px; }
  .color-auto-btn { width: 100%; display: flex; align-items: center; padding: 4px 6px; border: 1px solid transparent; background: transparent; cursor: pointer; font-size: 11px; color: var(--text-main); }
  .color-auto-btn:hover { background-color: var(--hover-bg); border-color: var(--primary); }
  .color-auto-indicator { display: flex; align-items: center; gap: 6px; width: 100%; }
  .color-auto-square { width: 16px; height: 16px; border: 1px solid var(--text-secondary); flex-shrink: 0; }
  .color-section { margin-bottom: 12px; }
  .color-section-title { font-size: 11px; font-weight: 600; color: var(--text-main); margin-bottom: 6px; padding-left: 2px; }
  .color-grid-theme { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; padding: 2px; }
  .color-grid-standard { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; padding: 2px; }
  .color-swatch-theme, .color-swatch-standard { width: 12px; height: 12px; border: 1px solid #b0b0b0; cursor: pointer; padding: 0; margin: 0; position: relative; }
  .color-swatch-theme:hover, .color-swatch-standard:hover { transform: scale(1.15); border-color: var(--primary); z-index: 2; }
  .active { border: 2px solid var(--primary); box-shadow: 0 0 0 1px white inset; }

  /* MARCADORES (DROPDOWN ACORDEÓN) */
  .marker-dropdown-wrapper { position: relative; }
  .marker-dropdown { position: fixed; background: var(--bg-card); border: 1px solid var(--border-color); width: 320px; box-shadow: 0 4px 10px var(--shadow-color); z-index: 10000; font-family: 'Segoe UI', sans-serif; max-height: 500px; overflow-y: hidden; display: flex; flex-direction: column; }
  .marker-header { background: var(--bg-secondary); padding: 8px 12px; font-weight: 700; font-size: 12px; color: var(--text-main); border-bottom: 1px solid var(--border-color); }
  .marker-scroll { overflow-y: auto; flex: 1; }
  .marker-group { border-bottom: 1px solid var(--border-color); }
  .marker-group-header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-card); border: none; cursor: pointer; font-size: 12px; color: var(--text-main); transition: background 0.2s; }
  .marker-group-header:hover { background: var(--hover-bg); }
  .marker-group-header strong { font-weight: 700; color: var(--primary); }
  .marker-list { background: var(--bg-body); padding: 5px 0; }
  .marker-item { display: block; width: 100%; text-align: left; padding: 8px 15px; border: none; background: transparent; font-size: 11px; cursor: pointer; color: var(--text-main); }
  .marker-item:last-child { border-bottom: none; }
  .marker-item:hover { background: var(--hover-bg); color: var(--primary); }
  .marker-content-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
  .m-label { font-size: 11px; font-weight: 600; color: var(--text-main); }
  .m-desc { font-size: 10px; color: var(--text-secondary); font-style: italic; max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .m-code { font-size: 10px; color: var(--primary); font-family: monospace; background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 3px; width: fit-content; }

  /* MÁRGENES */
  .margins-group .margin-row { display: flex; gap: 4px; }
  .margin-input { display: flex; align-items: center; gap: 2px; background: var(--bg-card); border: 1px solid var(--border-color); padding: 0 4px; border-radius: 3px; height: 22px; }
  .margin-input input { width: 35px; border: none; font-size: 11px; outline: none; text-align: center; padding: 0; background: transparent; color: var(--text-main); }
  .margin-input :global(svg) { opacity: 0.6; color: var(--text-secondary); }

  /* WORKSPACE */
  .workspace { flex: 1; background: #5f6368; position: relative; overflow: hidden; }
  .scroll-container { width: 100%; height: 100%; overflow: auto; display: grid; place-items: start center; padding: 40px; box-sizing: border-box; }
  .paper-zoom-wrapper { display: flex; justify-content: center; }
  .paper-sheet { width: 21.59cm; min-height: 27.94cm; background: white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: text; margin-bottom: 20px; }
  
/* 1. Definimos el color BASE en el contenedor principal */
  /* Esto hace que todo el texto sea negro por defecto */
  .editor-content { 
      outline: none; 
      font-size: 16px; 
      line-height: 1.5; 
      color: #000000; 
      min-height: 100%; 
  }

  /* 2. Aseguramos que el editor base sea negro */
  :global(.ProseMirror) { 
      color: #000000; 
  }

  /* 3. REGLA LIMPIA PARA PÁRRAFOS */
  /* Quitamos la propiedad 'color' de aquí. */
  /* Al no forzar color aquí, el párrafo hereda el negro del padre (.editor-content) */
  /* Pero permite que los spans internos tengan sus propios colores */
  :global(.ProseMirror p), 
  :global(.ProseMirror h1), 
  :global(.ProseMirror h2), 
  :global(.ProseMirror h3), 
  :global(.ProseMirror li) { 
      /* color: #000000;  <-- BORRADO: Ya no forzamos esto */
      margin-bottom: 0em; 
      margin-top: 0;
  }

  /* STATUS BAR */
  .status-bar { height: 26px; background: var(--bg-body); border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; padding: 0 15px; font-size: 11px; color: var(--text-secondary); flex-shrink: 0; }
  .zoom-controls { display: flex; align-items: center; gap: 10px; }
  .zoom-btn { background: transparent; border: none; cursor: pointer; color: var(--text-secondary); padding: 2px; display: flex; align-items: center; }
  .zoom-text { min-width: 40px; text-align: center; }

  /* TIPTAP */
  :global(.ProseMirror) { min-height: 100%; outline: none; }
  :global(.ProseMirror p) { margin-bottom: 0em; margin-top: 0; }
  :global(.ProseMirror ul, .ProseMirror ol) { padding-left: 1.5em; }
</style>