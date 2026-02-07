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
    List, ListOrdered, Undo, Redo, Eraser, 
    Link as LinkIcon, Minus, 
    IndentDecrease, IndentIncrease, 
    Plus, ZoomIn, ZoomOut, Clipboard,
    Type, Scissors, Copy, ArrowUpDown,
    ArrowUpFromLine, ArrowDownToLine, ArrowLeftFromLine, ArrowRightToLine
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();
  export let seccionInicial = 'oradores';

  // --- ESTADO ---
  let zoomLevel = 100;
  let tipoActivo = seccionInicial;
  let element: HTMLElement;
  let editor: Editor;       
  let contenidoCargado = "";

  // Variables UI (Fuentes)
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
  
  // Estado Color Picker
  let isColorPickerOpen = false;
  let colorPickerPos = { top: 0, left: 0 };

  // Variables UI (Márgenes en cm)
  let marginTop = 2.54;
  let marginBottom = 2.54;
  let marginLeft = 2.54;
  let marginRight = 2.54;

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
            parseHTML: element => {
              const styleAttr = element.getAttribute('style') || '';
              const lineHeightMatch = styleAttr.match(/line-height\s*:\s*([^;]+)/i);
              if (lineHeightMatch && lineHeightMatch[1]) return lineHeightMatch[1].trim();
              const computedStyle = window.getComputedStyle(element);
              const computedLH = computedStyle.lineHeight;
              if (computedLH && computedLH !== 'normal') return computedLH;
              return null;
            },
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
      editorProps: {
        handlePaste: (view, event) => {
          setTimeout(() => updateToolbar(), 100);
          return false;
        },
      },
      onUpdate: () => { 
        editor = editor;
        updateToolbar();
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
    };
  });

  function getLineHeightFromEditor(): string {
    if (!editor) return '1.5';
    const node = editor.state.selection.$anchor.parent;
    if (node && node.attrs && node.attrs.lineHeight) return node.attrs.lineHeight;
    const paragraph = editor.getAttributes('paragraph');
    if (paragraph && paragraph.lineHeight) return paragraph.lineHeight;
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

  // --- PORTAPAPELES (CORREGIDO: Sin .run() extra) ---
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
            // CORRECCIÓN: insertContent ejecuta el comando, no devuelve un chainable si se llama directo desde commands
            editor.commands.insertContent(html);
            pegado = true;
            break;
          }
        }
      }
      if (!pegado) {
        const text = await navigator.clipboard.readText();
        if (text) {
          editor.commands.insertContent(text);
        }
      }
      setTimeout(() => updateToolbar(), 50);
    } catch (err) { 
      try {
        const text = await navigator.clipboard.readText();
        if (text) editor.commands.insertContent(text);
        setTimeout(() => updateToolbar(), 50);
      } catch (e2) {
        alert("Usa Ctrl+V para pegar.");
      }
    }
  }

  // --- ACCIONES UI ---
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
  }
  
  // --- MARCADORES (SELECTOR NATIVO) ---
  function addMarker(e: Event) {
    const target = e.target as HTMLSelectElement;
    if (target.value && editor) {
      editor.chain().focus().insertContent(`{{${target.value}}}`).run();
      target.value = ""; // Reset del select
    }
  }

  function closePopupsIfClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.color-picker-wrapper')) isColorPickerOpen = false;
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
               <div class="insert-marker-container">
                   <label>Marcadores de Posición:</label>
                   <select on:change={addMarker} title="Insertar variable">
                       <option value="" disabled selected>Seleccionar...</option>
                       
                       <optgroup label="Fecha y General">
                           <option value="FechaActualMediana">Fecha Actual Mediana (6 feb 2026)</option>
                           <option value="FechaActualCompleta">Fecha Actual Completa (6 de febrero de 2026)</option>
                           <option value="DesignacionCircuito">Designación Circuito (ej. SL-01)</option>
                       </optgroup>

                       <optgroup label="Asignación y Programa">
                           <option value="Hora">Hora (Ej: 10:10 AM)</option>
                           <option value="Duracion">Duración (Total minutos)</option>
                           <option value="Tema">Tema</option>
                           <option value="NumeroBosquejo">Número de Bosquejo (1)</option>
                           <option value="TipoAsignacion">Tipo de asignación (Ej: Oración)</option>
                           <option value="Instrucciones">Instrucciones (Ej: De la Sucursal)</option>
                           <option value="EnlaceBosquejo">Enlace del Bosquejo</option>
                       </optgroup>

                       <optgroup label="Orador / Persona">
                           <option value="SaludoSexo">Saludo (Hermano/a)</option>
                           <option value="Nombre">Nombre (Ej: Roberto)</option>
                           <option value="SegundoNombre">Segundo nombre (Ej: Adolfo)</option>
                           <option value="Apellido">Apellido (Ej: Batista)</option>
                       </optgroup>

                       <optgroup label="Evento y Lugar">
                           <option value="Fecha">Fecha de Asamblea</option>
                           <option value="TipoEvento">Tipo de Evento (CA-br...)</option>
                           <option value="TemaEvento">Tema del Evento</option>
                           <option value="Notas">Notas</option>
                           <option value="InfoRecorrido">Información Recorrido</option>
                           <option value="InstruccionesEsp">Instrucciones Especiales</option>
                           <option value="NombreLugar">Nombre del lugar</option>
                           <option value="NombreLugarAlt">Nombre Lugar Alternativo</option>
                           <option value="Direccion">Dirección</option>
                           <option value="Ciudad">Ciudad</option>
                           <option value="EstadoProvincia">Estado o Provincia</option>
                       </optgroup>

                       <optgroup label="Ensayos">
                           <option value="EnvolturaEnsayo">Envoltura condicional ensayo (&lt;%...%&gt;)</option>
                           <option value="InfoCompletaEnsayos">Información completa de los ensayos</option>
                           <option value="InfoCombinadaEnsayos">Información combinada de los ensayos</option>
                           <option value="NotasEnsayos">Notas para los ensayos</option>
                           <option value="LugarEnsayos">Lugar de los ensayos</option>
                           <option value="FechaHoraEnsayo">Fecha y hora del ensayo</option>
                           <option value="FechaEnsayos">Fecha de ensayos</option>
                           <option value="HoraEnsayos">Hora de ensayos</option>
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
            <div class="paper-zoom-wrapper" style="zoom: {zoomLevel}%;">
                <div class="paper-sheet">
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
  .word-layout { display: flex; flex-direction: row; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f3f3f3; overflow: hidden; }

  /* SIDEBAR */
  .sidebar { width: 70px; background: #e1e1e1; border-right: 1px solid #c0c0c0; display: flex; flex-direction: column; align-items: center; padding-top: 15px; z-index: 100; flex-shrink: 0; }
  .sidebar-top { display: flex; flex-direction: column; align-items: center; margin-bottom: 30px; cursor: pointer; }
  .back-btn { background: white; border: 1px solid #ccc; color: #333; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 5px; transition: all 0.2s; }
  .back-btn:hover { background: #2b579a; color: white; border-color: #2b579a; }
  .back-label { font-size: 10px; font-weight: 700; color: #555; }
  .sidebar-content { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .icon-indicator { width: 45px; height: 45px; background: #2b579a; color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
  .doc-type-label { font-size: 10px; font-weight: 700; color: #333; text-align: center; writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: 1px; margin-top: 10px; }

  /* MAIN CONTENT */
  main { flex: 1; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

  /* HEADER */
  .app-header { background: #2b579a; color: white; height: 52px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; flex-shrink: 0; }
  .left-section { display: flex; align-items: center; gap: 12px; }
  .header-icon { opacity: 0.9; }
  .doc-info { display: flex; flex-direction: column; justify-content: center; }
  .doc-title { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: white; text-transform: uppercase; }
  .doc-status { font-size: 11px; opacity: 0.8; font-weight: 400; }
  .save-btn { background: white; color: #2b579a; border: none; font-weight: 700; font-size: 13px; padding: 8px 18px; border-radius: 4px; display: flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
  .save-btn:hover { background: #f0f0f0; }

  /* RIBBON */
  .ribbon { background: #f3f3f3; height: 105px; border-bottom: 1px solid #d1d1d1; display: flex; padding: 5px 10px; gap: 5px; flex-shrink: 0; user-select: none; overflow-x: auto; }
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
  .group-label { font-size: 11px; color: #666; margin-top: -20px; text-align: center; width: 100%; pointer-events: none; }
  .separator { width: 1px; background: #d1d1d1; height: 75%; align-self: center; margin: 0 4px; }
  .divider-v { width: 1px; height: 18px; background: #ccc; margin: 0 6px; }

  /* BUTTONS */
  .ribbon-btn { border: 1px solid transparent; background: transparent; cursor: pointer; color: #333; border-radius: 3px; display: flex; align-items: center; justify-content: center; transition: all 0.1s; }
  .ribbon-btn:hover { background: #dbeafe; border-color: #bfdbfe; color: #1e40af; }
  .ribbon-btn.active { background: #cce8ff; border-color: #99d1ff; color: #005a9e; }
  .ribbon-btn:disabled { opacity: 0.5; cursor: default; }
  .ribbon-btn > :global(svg), .ribbon-btn > span { pointer-events: none; }
  .ribbon-btn.large { flex-direction: column; width: 55px; height: 65px; font-size: 11px; gap: 4px; }
  .ribbon-btn.small { width: 28px; height: 28px; }
  .ribbon-btn.list-item { width: 75px; height: 22px; justify-content: flex-start; gap: 6px; font-size: 11px; padding-left: 4px; }

  /* INPUTS */
  select { font-family: 'Segoe UI', sans-serif; border: 1px solid transparent; background: transparent; font-size: 12px; height: 22px; outline: none; cursor: pointer; }
  select:hover { border-color: #ccc; background: white; }
  .font-select { width: 120px; border: 1px solid #ccc; background: white; height: 24px; padding-left: 4px; }
  .size-select { width: 45px; border: 1px solid #ccc; background: white; height: 24px; margin-left: 2px; text-align: center; }
  .line-height-wrapper { display: flex; align-items: center; border: 1px solid transparent; padding-left: 2px; border-radius: 3px; }
  .line-height-wrapper:hover { border-color: #ccc; background: #e1e1e1; }
  .icon-lh { margin-right: 0px; color: #475569; pointer-events: none; }
  .line-height-select { width: 35px; border: none; background: transparent; }
  
  /* COLOR PICKER STYLES */
  .color-picker-wrapper { position: relative; display: inline-block; }
  .color-picker-btn { position: relative; width: 28px; height: 26px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 3px; cursor: pointer; background: transparent; padding: 0; }
  .color-picker-btn:hover { background: #dbeafe; border-color: #bfdbfe; }
  .color-bar { width: 18px; height: 4px; margin-top: 1px; border-radius: 1px; }
  .color-picker-dropdown { position: fixed; background: white; border: 1px solid #b0b0b0; padding: 8px; width: 180px; box-shadow: 0 4px 8px rgba(0,0,0,0.15); z-index: 10000; font-family: 'Segoe UI', sans-serif; }
  .color-auto-section { padding: 4px 0; border-bottom: 1px solid #e0e0e0; margin-bottom: 8px; }
  .color-auto-btn { width: 100%; display: flex; align-items: center; padding: 4px 6px; border: 1px solid transparent; background: transparent; cursor: pointer; font-size: 11px; color: #333; }
  .color-auto-btn:hover { background-color: #e6f2ff; border-color: #99d1ff; }
  .color-auto-indicator { display: flex; align-items: center; gap: 6px; width: 100%; }
  .color-auto-square { width: 16px; height: 16px; border: 1px solid #8c8c8c; flex-shrink: 0; }
  .color-section { margin-bottom: 12px; }
  .color-section-title { font-size: 11px; font-weight: 600; color: #333; margin-bottom: 6px; padding-left: 2px; }
  .color-grid-theme { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; padding: 2px; }
  .color-grid-standard { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; padding: 2px; }
  .color-swatch-theme, .color-swatch-standard { width: 12px; height: 12px; border: 1px solid #b0b0b0; cursor: pointer; padding: 0; margin: 0; position: relative; }
  .color-swatch-theme:hover, .color-swatch-standard:hover { transform: scale(1.15); border-color: #2b579a; z-index: 2; }
  .active { border: 2px solid #2b579a; box-shadow: 0 0 0 1px white inset; }

  /* MÁRGENES */
  .margins-group .margin-row { display: flex; gap: 4px; }
  .margin-input { display: flex; align-items: center; gap: 2px; background: white; border: 1px solid #ccc; padding: 0 4px; border-radius: 3px; height: 22px; }
  .margin-input input { width: 35px; border: none; font-size: 11px; outline: none; text-align: center; padding: 0; }
  .margin-input :global(svg) { opacity: 0.6; }

  /* MARCADORES (SELECTOR NATIVO) */
  .insert-marker-container { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
  .insert-marker-container label { font-size: 11px; color: #2b579a; font-weight: 700; margin-left: 2px; }
  .insert-marker-container select { height: 30px; border: 1px solid #2b579a; background: white; width: 220px; padding-left: 8px; border-radius: 4px; font-weight: 600; color: #333; font-size: 11px; }

  /* WORKSPACE */
  .workspace { flex: 1; background: #5f6368; position: relative; overflow: hidden; }
  .scroll-container { width: 100%; height: 100%; overflow: auto; display: grid; place-items: start center; padding: 40px; box-sizing: border-box; }
  .paper-zoom-wrapper { display: flex; justify-content: center; }
  .paper-sheet { width: 21.59cm; min-height: 27.94cm; background: white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: text; margin-bottom: 20px; }
  .editor-content { outline: none; font-size: 16px; line-height: 1.5; color: black; min-height: 100%; }

  /* STATUS BAR */
  .status-bar { height: 26px; background: #f3f3f3; border-top: 1px solid #d1d1d1; display: flex; justify-content: space-between; align-items: center; padding: 0 15px; font-size: 11px; color: #555; flex-shrink: 0; }
  .zoom-controls { display: flex; align-items: center; gap: 10px; }
  .zoom-btn { background: transparent; border: none; cursor: pointer; color: #555; padding: 2px; display: flex; align-items: center; }
  .zoom-btn:hover { background: #e1e1e1; border-radius: 3px; color: #000; }
  .zoom-slider-container { width: 100px; display: flex; align-items: center; }
  .zoom-slider { width: 100%; cursor: pointer; height: 4px; }
  .zoom-text { min-width: 40px; text-align: center; }

  /* TIPTAP */
  :global(.ProseMirror) { min-height: 100%; outline: none; }
  :global(.ProseMirror p) { margin-bottom: 0em; margin-top: 0; }
  :global(.ProseMirror ul, .ProseMirror ol) { padding-left: 1.5em; }
</style>