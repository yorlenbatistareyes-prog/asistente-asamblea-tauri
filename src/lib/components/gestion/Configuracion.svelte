<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  // --- STORE IMPORTS ---
  import { emailTemplates, whatsappTemplates, marcadoresGlobales, type PlantillaEmail, type PlantillaWhatsApp } from '$lib/stores/plantillas';
  
  // --- DATA IMPORTS (NUEVO) ---
  // Importamos el contenido estático de ayuda
  import { guiaUsuario } from '$lib/data/ayuda';

  // --- TIPTAP IMPORTS ---
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
    ArrowLeft, Sliders, Mail, Shield, X,
    Database, CircleHelp, Download, Upload, Trash2, HelpCircle, 
    ChevronDown, ChevronUp, MessageCircle, FileText, RefreshCw, PenTool,
    Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, 
    Link as LinkIcon, Unlink, RemoveFormatting, List, ListOrdered, 
    IndentDecrease, IndentIncrease, Type, Baseline, Highlighter, 
    Minus, Pilcrow, Eye, Code, Undo, Redo, Copy, Clipboard, FileCode, Check
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  // --- INTERFACES LOCALES ---
  interface MensajesState {
      comite: boolean;
      programa: boolean;
      audiovideo: boolean;
      oradores: boolean;
      oficina: boolean;
      presidentes: boolean;
      oraciones: boolean;
  }

  // --- ESTADO GENERAL ---
  let configSeccion = 'general'; 
  
  // --- ESTADO EDICIÓN PLANTILLA ---
  let editandoPlantilla = false;
  let plantillaActual: PlantillaEmail | null = null;
  let editor: Editor | null = null; 
  let showSourceCode = false; 

  // Referencia al Input de Asunto
  let subjectInput: HTMLInputElement;
  let activeField: 'subject' | 'body' = 'body'; 

  // --- MARCADORES ---
  let marcadoresUI = marcadoresGlobales.map(grp => ({ ...grp }));

  function toggleMarcadorGroup(index: number) {
      marcadoresUI[index].isOpen = !marcadoresUI[index].isOpen;
      marcadoresUI = [...marcadoresUI]; 
  }

  // --- VARIABLES REACTIVAS DEL EDITOR ---
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let isStrike = false;
  let isLink = false;
  let isHighlight = false;
  let isBulletList = false;
  let isOrderedList = false;
  let isCodeBlock = false;
  let textAlign = 'left';

  // Acción para inicializar el editor
  function setupEditor(node: HTMLElement) {
      editor = new Editor({
          element: node,
          extensions: [
              StarterKit,
              Underline,
              TextStyle,
              Color,
              Highlight.configure({ multicolor: true }),
              Link.configure({ openOnClick: false }),
              TextAlign.configure({ types: ['heading', 'paragraph'] }),
          ],
          content: plantillaActual?.body || '',
          onUpdate: ({ editor }) => {
              if (plantillaActual) plantillaActual.body = editor.getHTML();
              updateToolbar();
          },
          onFocus: () => {
              activeField = 'body'; 
          },
          onTransaction: () => { updateToolbar(); },
          onSelectionUpdate: () => { updateToolbar(); }
      });
      updateToolbar();
      return {
          destroy() { editor?.destroy(); editor = null; }
      };
  }

  function updateToolbar() {
      if (!editor) return;
      isBold = editor.isActive('bold');
      isItalic = editor.isActive('italic');
      isUnderline = editor.isActive('underline');
      isStrike = editor.isActive('strike');
      isLink = editor.isActive('link');
      isHighlight = editor.isActive('highlight');
      isBulletList = editor.isActive('bulletList');
      isOrderedList = editor.isActive('orderedList');
      isCodeBlock = editor.isActive('codeBlock');
      
      if (editor.isActive({ textAlign: 'left' })) textAlign = 'left';
      else if (editor.isActive({ textAlign: 'center' })) textAlign = 'center';
      else if (editor.isActive({ textAlign: 'right' })) textAlign = 'right';
      else if (editor.isActive({ textAlign: 'justify' })) textAlign = 'justify';
      else textAlign = 'left';
  }

  // --- FUNCIONES DEL EDITOR ---
  const toggleBold = () => editor?.chain().focus().toggleBold().run();
  const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
  const toggleUnderline = () => editor?.chain().focus().toggleUnderline().run();
  const toggleStrike = () => editor?.chain().focus().toggleStrike().run(); 
  const unsetAllMarks = () => editor?.chain().focus().unsetAllMarks().run();
  
  const setAlign = (align: string) => editor?.chain().focus().setTextAlign(align).run();
  
  const toggleBulletList = () => editor?.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor?.chain().focus().toggleOrderedList().run();
  
  const indent = () => editor?.chain().focus().sinkListItem('listItem').run(); 
  const outdent = () => editor?.chain().focus().liftListItem('listItem').run();

  const setTextColor = () => {
      const color = prompt('Color (hex o nombre):', '#000000');
      if (color) editor?.chain().focus().setColor(color).run();
  };
  const toggleHighlight = () => editor?.chain().focus().toggleHighlight().run();

  const setLink = () => {
      const previousUrl = editor?.getAttributes('link').href;
      const url = window.prompt('URL', previousUrl);
      if (url === null) return;
      if (url === '') { editor?.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };
  const unsetLink = () => editor?.chain().focus().unsetLink().run();
  const addHorizontalRule = () => editor?.chain().focus().setHorizontalRule().run();

  const toggleCodeBlock = () => editor?.chain().focus().toggleCodeBlock().run();
  const undo = () => editor?.chain().focus().undo().run();
  const redo = () => editor?.chain().focus().redo().run();
  
  const copyContent = () => {
      if(editor) navigator.clipboard.writeText(editor.getText());
      alert("Texto copiado al portapapeles");
  };
  
  async function pasteContent() {
      try {
        const text = await navigator.clipboard.readText();
        if(editor) editor.chain().focus().insertContent(text).run();
      } catch (err) {
        console.error('Error al pegar:', err);
      }
  }

  const toggleSourceView = () => { showSourceCode = !showSourceCode; };


  // --- LÓGICA GENERAL ---
  function togglePlantilla(id: string) {
      emailTemplates.update(items => items.map(p => p.id === id ? { ...p, isOpen: !p.isOpen } : p));
  }

  function editarPlantilla(plantilla: PlantillaEmail) {
      plantillaActual = { ...plantilla }; 
      editandoPlantilla = true;
      showSourceCode = false;
      activeField = 'body'; 
  }

  function guardarPlantillaEditada() {
      if (!plantillaActual) return;
      emailTemplates.update(items => {
          const index = items.findIndex(p => p.id === plantillaActual?.id);
          if (index !== -1 && plantillaActual) {
              items[index] = { ...plantillaActual, isOpen: false }; 
          }
          return items;
      });
      editandoPlantilla = false;
      plantillaActual = null;
      alert("Plantilla guardada correctamente.");
  }

  function cancelarEdicionPlantilla() { 
      editandoPlantilla = false; 
      plantillaActual = null; 
  }

  // --- LÓGICA DE INSERCIÓN INTELIGENTE ---
  function insertarMarcador(code: string) {
      if (activeField === 'subject' && plantillaActual && subjectInput) {
          const start = subjectInput.selectionStart || 0;
          const end = subjectInput.selectionEnd || 0;
          const text = plantillaActual.subject;
          
          const newText = text.substring(0, start) + ` ${code} ` + text.substring(end);
          plantillaActual.subject = newText;
          
          setTimeout(() => {
              if (subjectInput) {
                  subjectInput.focus();
                  const newPos = start + code.length + 2; 
                  subjectInput.setSelectionRange(newPos, newPos);
              }
          }, 0);

      } else {
          if (editor && !showSourceCode) { 
              editor.chain().focus().insertContent(` ${code} `).run(); 
          } else if (plantillaActual) { 
              plantillaActual.body += ` ${code}`; 
          }
      }
  }

  // --- WHATSAPP ---
  let mensajesOpen: MensajesState = { 
      comite: false, programa: false, audiovideo: false, oradores: false, 
      oficina: false, presidentes: false, oraciones: false 
  };
  
  function toggleMensaje(key: keyof MensajesState) { 
      mensajesOpen[key] = !mensajesOpen[key]; 
  }
  
  function toggleWhatsapp(id: string) {
      whatsappTemplates.update(items => items.map(w => w.id === id ? { ...w, isOpen: !w.isOpen } : w));
  }

  // --- AYUDA (CONECTADA AL ARCHIVO EXTERNO) ---
  // Inicializamos el estado local (abierto/cerrado) basándonos en los datos importados
  let ayudaItems = guiaUsuario.map(item => ({ ...item, isOpen: false }));
  
  function toggleAyuda(index: number) { 
      if (ayudaItems[index]) {
          ayudaItems[index].isOpen = !ayudaItems[index].isOpen;
          ayudaItems = [...ayudaItems]; // Reactividad
      }
  }

  // --- CONFIGURACIÓN & USUARIO ---
  let config = {
      accionPdf: "abrir", idioma: "es",
      email_asignaciones: true, email_general_clase: true, email_recordatorios_clase: true, email_conclusion_clase: true, email_foto_clase: true, email_emergencia: false,
      usar_cliente_sistema: false, no_precompletar: false,
      msgComite: "", msgPrograma: "", msgAudioVideo: "", msgOradores: "", msgOficina: "", msgPresidentes: "", msgOraciones: ""
  };
  
  $: {
      $whatsappTemplates.forEach(t => {
          switch(t.id) {
              case 'comite': config.msgComite = t.content; break;
              case 'programa': config.msgPrograma = t.content; break;
              case 'audiovideo': config.msgAudioVideo = t.content; break;
              case 'oradores': config.msgOradores = t.content; break;
              case 'oficina': config.msgOficina = t.content; break;
              case 'presidentes': config.msgPresidentes = t.content; break;
              case 'oraciones': config.msgOraciones = t.content; break;
          }
      });
  }

  let usuario = { nombre: "Yorlen", segundoNombre: "", apellido: "Batista Reyes", sufijo: "", email: "yorlenbatistareyes@gmail.com", emailJw: "batistareyyorlen7@jwpub.org", movil: "54891111", id: "7164622", fechaCreacion: "4/11/2025" };
  let mostrarModalUsuario = false;
  let usuarioEditando = { ...usuario }; 
  function abrirModalUsuario() { usuarioEditando = { ...usuario }; mostrarModalUsuario = true; }
  function guardarUsuario() { usuario = { ...usuarioEditando }; mostrarModalUsuario = false; }
  function cerrar() { dispatch('close'); }
  function guardarCambiosConfig() { 
       whatsappTemplates.update(items => items.map(w => {
           let content = w.content;
           if(w.id === 'comite') content = config.msgComite;
           if(w.id === 'programa') content = config.msgPrograma;
           if(w.id === 'audiovideo') content = config.msgAudioVideo;
           if(w.id === 'oradores') content = config.msgOradores;
           if(w.id === 'oficina') content = config.msgOficina;
           if(w.id === 'presidentes') content = config.msgPresidentes;
           if(w.id === 'oraciones') content = config.msgOraciones;
           return {...w, content};
       }));
      alert("Configuración guardada correctamente"); 
  }
  async function respaldarDatos() { alert("Iniciando copia de seguridad..."); }
  async function restaurarDatos() { if(confirm("¿Sobrescribir datos actuales?")) alert("Seleccionar archivo..."); }
  async function limpiarBaseDatos() { if (prompt("Escribe 'ELIMINAR':") === 'ELIMINAR') { alert("Limpiado."); location.reload(); } }
</script>

<div class="config-layout">
    <aside class="config-sidebar">
        <div class="config-header">
            <button class="btn-back-config" on:click={cerrar}><ArrowLeft size={20}/> Volver</button>
            <h2>Configuración</h2>
        </div>
        <nav class="config-nav">
            <button class:active={configSeccion === 'general'} on:click={() => {configSeccion = 'general'; editandoPlantilla=false;}}><Sliders size={18}/> General</button>
            <button class:active={configSeccion === 'correos'} on:click={() => {configSeccion = 'correos'; editandoPlantilla=false;}}><Mail size={18}/> Plantillas de correo</button>
            <button class:active={configSeccion === 'cuenta'} on:click={() => {configSeccion = 'cuenta'; editandoPlantilla=false;}}><Shield size={18}/> Cuenta y Seguridad</button>
            <div class="nav-divider"></div>
            <button class:active={configSeccion === 'datos'} on:click={() => {configSeccion = 'datos'; editandoPlantilla=false;}}><Database size={18}/> Datos</button>
            <button class:active={configSeccion === 'ayuda'} on:click={() => {configSeccion = 'ayuda'; editandoPlantilla=false;}}><CircleHelp size={18}/> Ayuda</button>
        </nav>
        <div class="config-footer"><span>Versión 2.1.0</span></div>
    </aside>

    <main class="config-content">
        <div class="config-title-bar">
            <h1>
                {#if editandoPlantilla} Editar Plantilla de Correo Electrónico
                {:else if configSeccion === 'general'} Configuraciones generales 
                {:else if configSeccion === 'correos'} Plantillas de correo electrónico 
                {:else if configSeccion === 'cuenta'} Cuenta y Seguridad 
                {:else if configSeccion === 'datos'} Gestión de Datos 
                {:else if configSeccion === 'ayuda'} Centro de Ayuda {/if}
            </h1>
            {#if !editandoPlantilla && configSeccion !== 'ayuda' && configSeccion !== 'datos'}
                <div class="config-actions"><button class="btn-save-config" on:click={guardarCambiosConfig}>Guardar Cambios</button></div>
            {/if}
        </div>

        <div class="config-scroll-area">
            
            {#if editandoPlantilla && plantillaActual}
                <div class="editor-layout">
                    <div class="editor-main">
                        <div class="editor-header-bar">
                            <div class="title-wrap"><FileText size={18}/> <span>{plantillaActual.title}</span></div>
                            <button class="btn-close-editor" on:click={cancelarEdicionPlantilla}><X size={18}/></button>
                        </div>
                        
                        <div class="editor-form">
                            <label>Asunto</label>
                            <input 
                                type="text" 
                                class="input-subject" 
                                bind:value={plantillaActual.subject} 
                                bind:this={subjectInput}
                                on:focus={() => activeField = 'subject'}
                            />
                            
                            <label>Cuerpo</label>
                            
                            <div class="toolbar-ribbon" on:click={() => { if(editor) editor.commands.focus(); activeField='body'; }}>
                                <div class="toolbar-row">
                                    <button class="tool-btn" class:active={isBold} on:click={toggleBold} title="Negrita"><Bold size={16}/></button>
                                    <button class="tool-btn" class:active={isItalic} on:click={toggleItalic} title="Cursiva"><Italic size={16}/></button>
                                    <button class="tool-btn" class:active={isUnderline} on:click={toggleUnderline} title="Subrayado"><UnderlineIcon size={16}/></button>
                                    <button class="tool-btn" class:active={isStrike} on:click={toggleStrike} title="Tachado"><RemoveFormatting size={16}/></button>
                                    <button class="tool-btn" on:click={unsetAllMarks} title="Borrar formato"><X size={16}/></button>
                                    <div class="sep"></div>
                                    <button class="tool-btn" class:active={textAlign === 'left'} on:click={() => setAlign('left')} title="Izquierda"><AlignLeft size={16}/></button>
                                    <button class="tool-btn" class:active={textAlign === 'center'} on:click={() => setAlign('center')} title="Centrar"><AlignCenter size={16}/></button>
                                    <button class="tool-btn" class:active={textAlign === 'right'} on:click={() => setAlign('right')} title="Derecha"><AlignRight size={16}/></button>
                                    <button class="tool-btn" class:active={textAlign === 'justify'} on:click={() => setAlign('justify')} title="Justificar"><AlignJustify size={16}/></button>
                                    <div class="sep"></div>
                                    <button class="tool-btn" class:active={isBulletList} on:click={toggleBulletList} title="Viñetas"><List size={16}/></button>
                                    <button class="tool-btn" class:active={isOrderedList} on:click={toggleOrderedList} title="Lista numerada"><ListOrdered size={16}/></button>
                                    <div class="sep"></div>
                                    <button class="tool-btn" on:click={outdent} title="Disminuir sangría"><IndentDecrease size={16}/></button>
                                    <button class="tool-btn" on:click={indent} title="Aumentar sangría"><IndentIncrease size={16}/></button>
                                    <div class="sep"></div>
                                    <button class="tool-btn" on:click={setTextColor} title="Color de texto"><div class="color-indicator">A</div></button>
                                    <button class="tool-btn" class:active={isHighlight} on:click={toggleHighlight} title="Resaltado"><Highlighter size={16}/></button>
                                    <div class="sep"></div>
                                    <button class="tool-btn" class:active={isLink} on:click={setLink} title="Insertar enlace"><LinkIcon size={16}/></button>
                                    <button class="tool-btn" on:click={unsetLink} title="Quitar enlace"><Unlink size={16}/></button>
                                    <div class="sep"></div>
                                    <button class="tool-btn" on:click={addHorizontalRule} title="Línea horizontal"><Minus size={16}/></button>
                                </div>

                                <div class="toolbar-row">
                                    <button class="tool-btn" title="Párrafo"><Pilcrow size={16}/></button>
                                    <button class="tool-btn" class:active={!showSourceCode} on:click={() => showSourceCode = false} title="Vista previa"><Eye size={16}/></button>
                                    <button class="tool-btn" class:active={showSourceCode} on:click={toggleSourceView} title="Ver código fuente"><FileCode size={16}/></button>
                                    <button class="tool-btn" class:active={isCodeBlock} on:click={toggleCodeBlock} title="Bloque de código"><Code size={16}/></button>
                                    <div class="sep"></div>
                                    <button class="tool-btn" on:click={undo} title="Deshacer"><Undo size={16}/></button>
                                    <button class="tool-btn" on:click={redo} title="Rehacer"><Redo size={16}/></button>
                                    <div class="sep"></div>
                                    <button class="tool-btn" on:click={copyContent} title="Copiar"><Copy size={16}/></button>
                                    <button class="tool-btn" on:click={pasteContent} title="Pegar"><Clipboard size={16}/></button>
                                </div>
                            </div>
                            
                            {#if showSourceCode}
                                <textarea class="source-code-view" bind:value={plantillaActual.body} on:focus={() => activeField='body'}></textarea>
                            {:else}
                                <div class="editor-container" use:setupEditor></div>
                            {/if}
                        </div>

                        <div class="editor-footer-actions">
                            <button class="btn-cancelar-editor" on:click={cancelarEdicionPlantilla}>Deshacer</button>
                            <button class="btn-guardar-editor" on:click={guardarPlantillaEditada}>Guardar</button>
                        </div>
                    </div>

                    <div class="editor-sidebar">
                        <div class="sidebar-title">Marcadores de posición</div>
                        <div class="markers-accordion">
                            {#each marcadoresUI as group, i}
                                <div class="marker-group-item">
                                    <button class="marker-header" on:click={() => toggleMarcadorGroup(i)}>
                                        <span>{group.category}</span>
                                        {#if group.isOpen}<ChevronUp size={14}/>{:else}<ChevronDown size={14}/>{/if}
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

            {:else if configSeccion === 'general'}
                <div class="config-grid">
                    <div class="col-main">
                        <div class="config-group">
                            <label class="group-label">Plantillas de Mensajes Rápidos (WhatsApp)</label>
                            <div class="accordion-list">
                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('comite')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje a Comité</div>
                                        {#if mensajesOpen.comite}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.comite}<div class="accordion-body"><textarea rows="2" bind:value={config.msgComite}></textarea></div>{/if}
                                </div>
                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('programa')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje a Sup. Programa</div>
                                        {#if mensajesOpen.programa}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.programa}<div class="accordion-body"><textarea rows="2" bind:value={config.msgPrograma}></textarea></div>{/if}
                                </div>
                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('audiovideo')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje a Audio y Video</div>
                                        {#if mensajesOpen.audiovideo}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.audiovideo}<div class="accordion-body"><textarea rows="2" bind:value={config.msgAudioVideo}></textarea></div>{/if}
                                </div>
                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('oradores')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje a Oradores</div>
                                        {#if mensajesOpen.oradores}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.oradores}<div class="accordion-body"><textarea rows="2" bind:value={config.msgOradores}></textarea></div>{/if}
                                </div>
                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('oficina')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje a Oficina</div>
                                        {#if mensajesOpen.oficina}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.oficina}<div class="accordion-body"><textarea rows="2" bind:value={config.msgOficina}></textarea></div>{/if}
                                </div>
                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('presidentes')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje a Presidentes</div>
                                        {#if mensajesOpen.presidentes}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.presidentes}<div class="accordion-body"><textarea rows="2" bind:value={config.msgPresidentes}></textarea></div>{/if}
                                </div>
                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('oraciones')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje a Oraciones</div>
                                        {#if mensajesOpen.oraciones}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.oraciones}<div class="accordion-body"><textarea rows="2" bind:value={config.msgOraciones}></textarea></div>{/if}
                                </div>
                            </div>
                        </div>
                        
                        <div class="config-group radio-group-box">
                            <label class="group-label">Configuraciones de PDF</label>
                            <label class="radio-item" class:active-radio={config.accionPdf === 'nada'}><input type="radio" name="pdf" value="nada" bind:group={config.accionPdf}> <span>Sin acción</span></label>
                            <label class="radio-item" class:active-radio={config.accionPdf === 'carpeta'}><input type="radio" name="pdf" value="carpeta" bind:group={config.accionPdf}> <span>Mostrar en Explorer</span></label>
                            <label class="radio-item active-radio" class:active-radio={config.accionPdf === 'abrir'}><input type="radio" name="pdf" value="abrir" bind:group={config.accionPdf}> <span>Abrir predeterminado</span></label>
                        </div>
                        <div class="config-group"><label>Idioma</label><select bind:value={config.idioma} class="input-light"><option value="es">Español</option><option value="en">English</option></select></div>
                    </div>
                    
                    <div class="col-side">
                        <div class="config-group">
                            <label class="group-label">Opciones de Correo</label>
                            <div class="toggle-list">
                                <div class="toggle-item"><span>Correos de asignaciones</span><label class="switch"><input type="checkbox" bind:checked={config.email_asignaciones}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Correo general de clase</span><label class="switch"><input type="checkbox" bind:checked={config.email_general_clase}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Recordatorios de clase</span><label class="switch"><input type="checkbox" bind:checked={config.email_recordatorios_clase}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Conclusión de clase</span><label class="switch"><input type="checkbox" bind:checked={config.email_conclusion_clase}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Foto de clase</span><label class="switch"><input type="checkbox" bind:checked={config.email_foto_clase}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Anuncio de emergencia</span><label class="switch"><input type="checkbox" bind:checked={config.email_emergencia}><span class="slider round"></span></label></div>
                            </div>
                        </div>
                        <div class="config-group mt-large">
                            <label class="group-label-icon">Utilice el cliente de correo electrónico <HelpCircle size={14}/></label>
                            <div class="toggle-item description-toggle">
                                <label class="switch"><input type="checkbox" bind:checked={config.usar_cliente_sistema}><span class="slider round"></span></label>
                                <div class="desc-text">Utilice Thunderbird, BlueMail u otro cliente compatible</div>
                            </div>
                        </div>
                        <div class="config-group">
                            <label class="group-label-icon">No complete con texto sin formato <HelpCircle size={14}/></label>
                            <div class="toggle-item description-toggle">
                                <label class="switch"><input type="checkbox" bind:checked={config.no_precompletar}><span class="slider round"></span></label>
                                <div class="desc-text">Solo cuerpo HTML</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="user-info-section">
                    <div class="user-info-header"><h3>Información del usuario</h3><button class="btn-edit-user" on:click={abrirModalUsuario}>Editar</button></div>
                    <div class="user-info-grid">
                        <div class="ui-item"><label>nombre completo</label><span>{usuario.nombre} {usuario.apellido}</span></div>
                        <div class="ui-item"><label>Correo electrónico</label><span>{usuario.email}</span></div>
                        <div class="ui-item"><label>Móvil</label><span>{usuario.movil}</span></div>
                        <div class="ui-item"><label>Correo electrónico JWPub</label><span>{usuario.emailJw}</span></div>
                        <div class="ui-item"><label>Número de identificación</label><span>{usuario.id}</span></div>
                        <div class="ui-item"><label>Fecha de creación</label><span>{usuario.fechaCreacion}</span></div>
                    </div>
                </div>

            {:else if configSeccion === 'correos'}
                <div class="mail-templates-container">
                    <div class="accordion-list">
                        {#each $emailTemplates as plantilla (plantilla.id)}
                            <div class="accordion-item">
                                <button class="accordion-header" on:click={() => togglePlantilla(plantilla.id)}>
                                    <div class="acc-title"><FileText size={16}/> {plantilla.title}</div>
                                    {#if plantilla.isOpen}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                </button>
                                {#if plantilla.isOpen}
                                    <div class="accordion-body-template">
                                        <div class="preview-group">
                                            <label>Asunto</label>
                                            <input type="text" value={plantilla.subject || '(Sin asunto)'} readonly class="preview-input"/>
                                        </div>
                                        <div class="preview-group">
                                            <label>Cuerpo</label>
                                            <div class="preview-textarea">
                                                {@html plantilla.body || '<span style="color:var(--text-secondary); font-style:italic;">(Sin contenido...)</span>'}
                                            </div>
                                        </div>
                                        <div class="template-actions">
                                            <button class="btn-template-action left" on:click={() => editarPlantilla(plantilla)}><PenTool size={14}/> Editar</button>
                                            <div class="group-center">
                                                <button class="btn-template-action"><Upload size={14}/> Exportar plantilla</button>
                                                <button class="btn-template-action"><Download size={14}/> Importar plantilla</button>
                                            </div>
                                            <button class="btn-template-action right"><RefreshCw size={14}/> Restablecer a los valores predeterminados</button>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>

            {:else if configSeccion === 'datos'}
                <div class="data-management-container">
                    <div class="data-card">
                        <div class="data-icon-wrapper blue"><Upload size={24} /></div> <div class="data-content"><h3>Respaldar Datos</h3><p>Guardar copia de seguridad.</p></div>
                        <button class="btn-data-action primary" on:click={respaldarDatos}>Respaldar</button>
                    </div>
                    <div class="data-card">
                        <div class="data-icon-wrapper green"><Download size={24} /></div> <div class="data-content"><h3>Restaurar Datos</h3><p>Cargar copia de seguridad.</p></div>
                        <button class="btn-data-action secondary" on:click={restaurarDatos}>Restaurar</button>
                    </div>
                    <div class="data-card danger-zone">
                        <div class="data-icon-wrapper red"><Trash2 size={24} /></div> <div class="data-content"><h3>Limpiar Todo</h3><p>Borrar base de datos.</p></div>
                        <button class="btn-data-action danger" on:click={limpiarBaseDatos}>Eliminar</button>
                    </div>
                </div>
            {:else if configSeccion === 'ayuda'}
                <div class="help-container">
                    <div class="accordion-list">
                        {#each ayudaItems as item, i}
                            <div class="accordion-item">
                                <button class="accordion-header" on:click={() => toggleAyuda(i)}>
                                    <div class="acc-title"><HelpCircle size={16}/> {item.title}</div>
                                    {#if item.isOpen}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                </button>
                                {#if item.isOpen}
                                    <div class="accordion-body"><p class="help-text-content">{item.content}</p></div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </main>

    {#if mostrarModalUsuario}
        <div class="modal-backdrop" on:click|self={() => mostrarModalUsuario = false}>
            <div class="modal-content-user">
                <div class="modal-header-user"><h3>Editar información de usuario</h3><button class="btn-close" on:click={() => mostrarModalUsuario = false}><X size={20}/></button></div>
                <div class="modal-body-user">
                    <div class="form-user-grid">
                        <div class="input-group"><label>Nombre</label><input type="text" bind:value={usuarioEditando.nombre} /></div>
                        <div class="input-group"><label>Segundo nombre</label><input type="text" bind:value={usuarioEditando.segundoNombre} /></div>
                        <div class="input-group"><label>Apellido</label><input type="text" bind:value={usuarioEditando.apellido} /></div>
                        <div class="input-group"><label>Sufijo</label><input type="text" bind:value={usuarioEditando.sufijo} /></div>
                        <div class="input-group"><label>Correo electrónico</label><input type="email" bind:value={usuarioEditando.email} /></div>
                        <div class="input-group"><label>Correo electrónico JWPub</label><input type="email" bind:value={usuarioEditando.emailJw} /></div>
                        <div class="input-group"><label>Móvil</label><input type="text" bind:value={usuarioEditando.movil} /></div>
                        <div class="input-group"><label>Número de identificación</label><input type="text" bind:value={usuarioEditando.id} /></div>
                    </div>
                </div>
                <div class="modal-footer-user"><button class="btn-cancel-user" on:click={() => mostrarModalUsuario = false}>Cancelar</button><button class="btn-save-user" on:click={guardarUsuario}>Guardar</button></div>
            </div>
        </div>
    {/if}
</div>

<style>
  /* VARIABLES */
  .config-layout { display: grid; grid-template-columns: 260px 1fr; height: 100vh; background: var(--bg-body); color: var(--text-main); font-family: 'Segoe UI', sans-serif; }
  
  /* Sidebar y Header */
  .config-sidebar { background: var(--bg-secondary); border-right: 1px solid var(--border-color); padding: 20px 0; }
  .config-header { padding: 0 20px 20px; border-bottom: 1px solid var(--border-color); }
  .config-header h2 { margin: 15px 0 0; font-size: 1.2rem; }
  .btn-back-config { background: none; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; }
  
  .config-nav { padding: 20px 10px; display: flex; flex-direction: column; gap: 5px; }
  .config-nav button { background: none; border: none; width: 100%; text-align: left; padding: 12px 16px; color: var(--text-secondary); font-size: 14px; font-weight: 500; cursor: pointer; border-radius: 8px; display: flex; align-items: center; gap: 12px; }
  .config-nav button:hover { background: var(--hover-bg); color: var(--text-main); }
  .config-nav button.active { background: var(--primary); color: white; font-weight: 600; }
  .config-footer { padding: 20px; font-size: 11px; color: var(--text-secondary); text-align: center; }

  /* Content */
  .config-content { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: var(--bg-body); }
  .config-title-bar { padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); background: var(--bg-card); }
  .config-title-bar h1 { margin: 0; font-size: 24px; color: var(--text-main); font-weight: 700; }
  .btn-save-config { background: #10b981; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; }
  
  .config-scroll-area { flex: 1; overflow-y: auto; padding: 40px; }
  .config-grid { display: grid; grid-template-columns: 3fr 2fr; gap: 60px; max-width: 1200px; }

  /* --- EDITOR ESTILOS --- */
  .editor-layout { display: grid; grid-template-columns: 1fr 300px; gap: 20px; height: 100%; }
  .editor-main { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
  .editor-header-bar { background: var(--bg-secondary); padding: 10px 20px; border-bottom: 1px solid var(--border-color); font-weight: 600; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--text-main); }
  .title-wrap { display: flex; align-items: center; gap: 8px; }
  .btn-close-editor { background: none; border: none; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px; }
  .btn-close-editor:hover { background: var(--hover-bg); color: var(--text-main); }
  
  .editor-form { padding: 20px; flex: 1; display: flex; flex-direction: column; gap: 10px; overflow-y: hidden; }
  .editor-form label { font-weight: 700; font-size: 13px; color: var(--text-secondary); margin-top: 10px; }
  .input-subject { padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--input-bg); color: var(--text-main); font-size: 14px; }
  
  /* BARRA CINTA (RIBBON) */
  .toolbar-ribbon { background: var(--bg-secondary); border: 1px solid var(--border-color); border-bottom: none; border-radius: 4px 4px 0 0; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
  .toolbar-row { display: flex; gap: 2px; align-items: center; flex-wrap: wrap; }
  
  .tool-btn { background: none; border: 1px solid transparent; padding: 4px; cursor: pointer; color: var(--text-secondary); border-radius: 3px; display: flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; }
  .tool-btn:hover { background: var(--hover-bg); color: var(--text-main); }
  .tool-btn.active { background: #dbeafe; border-color: #bfdbfe; color: var(--primary); }
  :global(html.dark-theme) .tool-btn.active { background: #1e3a8a; border-color: #1e40af; }
  .sep { width: 1px; height: 18px; background: var(--border-color); margin: 0 4px; }
  
  .color-indicator { font-weight: 900; font-family: serif; border-bottom: 3px solid #d32f2f; line-height: 12px; }

  .editor-container { flex: 1; padding: 15px; border: 1px solid var(--border-color); border-radius: 0 0 4px 4px; background: var(--input-bg); color: var(--text-main); overflow-y: auto; cursor: text; }
  .source-code-view { flex: 1; padding: 15px; border: 1px solid var(--border-color); border-radius: 0 0 4px 4px; background: #1e1e1e; color: #d4d4d4; font-family: monospace; resize: none; }
  
  :global(.ProseMirror) { height: 100%; outline: none; }
  :global(.ProseMirror p) { margin-top: 0; margin-bottom: 0.5em; }

  .editor-footer-actions { padding: 15px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; background: var(--bg-card); }
  .btn-cancelar-editor { background: #e2580c; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .btn-guardar-editor { background: #e2580c; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }

  /* SIDEBAR MARCADORES */
  .editor-sidebar { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
  .sidebar-title { padding: 15px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); font-weight: 600; color: var(--text-main); font-size: 14px; }
  .markers-accordion { overflow-y: auto; flex: 1; }
  .marker-group-item { border-bottom: 1px solid var(--border-color); }
  .marker-header { width: 100%; display: flex; justify-content: space-between; padding: 10px 15px; background: transparent; border: none; cursor: pointer; text-align: left; font-size: 13px; color: var(--text-main); font-weight: 500; }
  .marker-header:hover { background: var(--hover-bg); }
  .marker-content { background: var(--bg-body); padding: 5px 0; }
  .marker-pill { display: block; width: 100%; text-align: left; padding: 8px 15px; border: none; background: transparent; font-size: 11px; cursor: pointer; color: var(--text-main); border-bottom: 1px solid rgba(0,0,0,0.03); }
  .marker-pill:last-child { border-bottom: none; }
  .marker-pill:hover { background: var(--hover-bg); }
  .marker-content-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
  .m-label { font-weight: 600; color: var(--text-main); }
  .marker-row-desc { font-size: 10px; color: var(--text-secondary); font-style: italic; margin-bottom: 2px; }
  .m-code { font-size: 10px; color: var(--primary); font-family: monospace; background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 3px; width: fit-content; }

  /* OTROS ESTILOS (Acordeones, Inputs, etc.) */
  .accordion-list { border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
  .accordion-item { border-bottom: 1px solid var(--border-color); background: var(--bg-card); }
  .accordion-header { width: 100%; display: flex; justify-content: space-between; padding: 12px 15px; background: var(--bg-card); border: none; cursor: pointer; color: var(--text-main); }
  .acc-title { display: flex; align-items: center; gap: 10px; }
  .accordion-body { padding: 15px; background: var(--bg-body); border-top: 1px solid var(--border-color); }
  .accordion-body textarea { width: 100%; background: var(--input-bg); border: 1px solid var(--border-color); padding: 10px; border-radius: 6px; box-sizing: border-box; resize: vertical; }

  /* --- ESTILOS PREVIEW CORREGIDOS (CAJAS BLANCAS) --- */
  .accordion-body-template { padding: 25px; background: var(--bg-body); border-top: 1px solid var(--border-color); }
  
  .preview-group { margin-bottom: 15px; }
  .preview-group label { display: block; font-weight: 700; font-size: 13px; color: var(--text-main); margin-bottom: 5px; }
  
  .preview-input { width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-card); color: var(--text-secondary); font-size: 14px; box-sizing: border-box; }
  .preview-textarea { width: 100%; padding: 15px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-card); color: var(--text-secondary); font-size: 14px; min-height: 100px; max-height: 300px; box-sizing: border-box; overflow-y: auto; }

  .template-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
  .btn-template-action { background: #5f1d22; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .btn-template-action:hover { background: #4a1519; }
  .group-center { display: flex; gap: 10px; }

  /* Inputs Generales */
  .config-group { margin-bottom: 30px; }
  .config-group label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
  .input-light { width: 100%; background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: 8px; }
  .radio-group-box { background: var(--bg-card); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); }
  .radio-item { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 6px; cursor: pointer; color: var(--text-secondary); }
  .active-radio { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; }
  
  .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .4s; border-radius: 34px; }
  .slider:before { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
  input:checked + .slider { background-color: #ea580c; }
  input:checked + .slider:before { transform: translateX(20px); }
  .toggle-item { display: flex; justify-content: space-between; align-items: center; color: var(--text-main); font-size: 14px; margin-bottom: 12px; }
  .description-toggle { align-items: center; margin-bottom: 8px; }
  .desc-text { font-size: 12px; color: var(--text-secondary); margin-left: 10px; }
  .mt-large { margin-top: 30px; }
  .group-label-icon { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; color: var(--text-main); margin-bottom: 10px; }

  /* User Info (RESTAURADO) */
  .user-info-section { 
      grid-column: span 2; 
      background: var(--bg-card); 
      border: 1px solid var(--border-color); 
      border-radius: 8px; 
      padding: 25px; 
      margin-top: 20px; 
      margin-bottom: 40px; 
      box-shadow: 0 2px 5px var(--shadow-color); 
  }
  .user-info-header { display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; }
  .user-info-header h3 { margin: 0; font-size: 20px; color: var(--text-main); font-weight: 700; }
  .btn-edit-user { background: #ea580c; color: white; border: none; padding: 8px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; }
  .user-info-grid { 
      display: grid; 
      grid-template-columns: repeat(3, 1fr); 
      gap: 30px; 
  }
  .ui-item { display: flex; flex-direction: column; gap: 4px; }
  .ui-item label { font-size: 12px; color: var(--text-secondary); text-transform: lowercase; }
  .ui-item label::first-letter { text-transform: uppercase; }
  .ui-item span { font-size: 15px; color: var(--text-main); font-weight: 400; }

  /* Modal */
  .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 2000; }
  .modal-content-user { background: var(--bg-card); padding: 0; border-radius: 8px; width: 800px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden; border: 1px solid var(--border-color); }
  .modal-header-user { display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; border-bottom: 1px solid var(--border-color); }
  .modal-header-user h3 { margin: 0; font-size: 20px; font-weight: 700; color: var(--text-main); }
  .btn-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
  .modal-body-user { padding: 30px; background: var(--bg-card); }
  .form-user-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 30px; }
  .input-group { display: flex; flex-direction: column; gap: 5px; }
  .input-group label { font-size: 13px; color: var(--text-secondary); font-weight: 400; }
  .input-group input { padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 4px; width: 100%; box-sizing: border-box; background: var(--input-bg); font-size: 15px; color: var(--text-main); }
  .modal-footer-user { padding: 20px 30px; display: flex; justify-content: flex-end; gap: 15px; background: var(--bg-card); }
  .btn-cancel-user { background: white; border: 1px solid var(--border-color); padding: 10px 20px; border-radius: 6px; cursor: pointer; color: var(--text-main); font-weight: 600; }
  .btn-save-user { background: #ea580c; border: none; padding: 10px 24px; border-radius: 6px; color: white; cursor: pointer; font-weight: 600; }

  /* Datos & Ayuda */
  .data-management-container { max-width: 800px; display: flex; flex-direction: column; gap: 20px; }
  .data-card { display: flex; align-items: center; gap: 20px; background: var(--bg-card); border: 1px solid var(--border-color); padding: 20px; border-radius: 12px; }
  .data-content h3 { margin: 0; color: var(--text-main); } .data-content p { margin: 0; color: var(--text-secondary); font-size: 13px; }
  .data-icon-wrapper { width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .data-icon-wrapper.blue { background: #eff6ff; color: #2563eb; } .data-icon-wrapper.green { background: #f0fdf4; color: #16a34a; } .data-icon-wrapper.red { background: #fef2f2; color: #dc2626; }
  .btn-data-action { padding: 10px 20px; border-radius: 6px; cursor: pointer; border: none; font-weight: 600; }
  .btn-data-action.primary { background: var(--primary); color: white; } .btn-data-action.secondary { background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-secondary); } .btn-data-action.danger { background: #fee2e2; color: #dc2626; }
  .help-container { max-width: 1000px; margin: 0 auto; }
  .help-text-content { color: var(--text-main); font-size: 14px; line-height: 1.6; }
</style>