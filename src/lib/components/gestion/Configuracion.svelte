<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  // --- TIPTAP IMPORTS ---
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  import TextAlign from '@tiptap/extension-text-align';
  import Link from '@tiptap/extension-link';
  import { Color } from '@tiptap/extension-color';
  import { TextStyle } from '@tiptap/extension-text-style';

  // --- ICONOS ---
  import { 
    ArrowLeft, Sliders, Mail, Shield, X,
    Database, CircleHelp, Download, Upload, Trash2, HelpCircle, 
    ChevronDown, ChevronUp, MessageCircle, FileText, RefreshCw, PenTool,
    Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, Link as LinkIcon 
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  // --- ESTADO GENERAL ---
  let configSeccion = 'general'; 
  
  // --- ESTADO EDICIÓN PLANTILLA ---
  let editandoPlantilla = false;
  let plantillaActual: any = null;
  let editor: Editor | null = null; 

  // Variables Reactivas del Editor
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let textAlignLeft = false;
  let textAlignCenter = false;
  let textAlignRight = false;
  let textAlignJustify = false;
  let isLink = false;

  // Acción para inicializar el editor
  function setupEditor(node: HTMLElement) {
      editor = new Editor({
          element: node,
          extensions: [
              StarterKit, Underline, TextStyle, Color,
              Link.configure({ openOnClick: false }),
              TextAlign.configure({ types: ['heading', 'paragraph'] }),
          ],
          content: plantillaActual?.body || '',
          onUpdate: ({ editor }) => {
              plantillaActual.body = editor.getHTML();
              updateToolbar();
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
      isLink = editor.isActive('link');
      textAlignLeft = editor.isActive({ textAlign: 'left' });
      textAlignCenter = editor.isActive({ textAlign: 'center' });
      textAlignRight = editor.isActive({ textAlign: 'right' });
      textAlignJustify = editor.isActive({ textAlign: 'justify' });
  }

  function toggleBold() { editor?.chain().focus().toggleBold().run(); }
  function toggleItalic() { editor?.chain().focus().toggleItalic().run(); }
  function toggleUnderline() { editor?.chain().focus().toggleUnderline().run(); }
  function setAlign(align: string) { editor?.chain().focus().setTextAlign(align).run(); }
  function setLink() {
      const previousUrl = editor?.getAttributes('link').href;
      const url = window.prompt('URL', previousUrl);
      if (url === null) return;
      if (url === '') { editor?.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  // --- LOGICA DE MARCADORES Y PLANTILLAS ---
  let plantillasCorreo = [
      { id: 'comite', title: "Plantilla de correo electrónico a todos los miembros de Comité de asamblea", subject: "", body: "", isOpen: false },
      { id: 'programa', title: "Plantilla de correo electrónico a Sup. de Programa", subject: "", body: "", isOpen: false },
      { id: 'av', title: "Plantilla de correo electrónico a Audio y video", subject: "", body: "", isOpen: false },
      { id: 'oradores', title: "Plantilla de correo electrónico a Oradores del programa", subject: "", body: "", isOpen: false },
      { id: 'oficina', title: "Plantilla de correo electrónico a Miembros de la Oficina del presidente", subject: "", body: "", isOpen: false },
      { id: 'presidentes', title: "Plantilla de correo electrónico a Presidentes de Sesión", subject: "", body: "", isOpen: false },
      { id: 'oraciones', title: "Plantilla de correo electrónico a hermanos que harán oraciones", subject: "", body: "", isOpen: false }
  ];

  function togglePlantilla(index: number) {
      plantillasCorreo[index].isOpen = !plantillasCorreo[index].isOpen;
  }

  function editarPlantilla(plantilla: any) {
      plantillaActual = { ...plantilla };
      editandoPlantilla = true;
  }

  function guardarPlantillaEditada() {
      const index = plantillasCorreo.findIndex(p => p.id === plantillaActual.id);
      if (index !== -1) { plantillasCorreo[index] = { ...plantillaActual }; }
      editandoPlantilla = false;
      plantillaActual = null;
      alert("Plantilla guardada correctamente.");
  }

  function cancelarEdicionPlantilla() {
      editandoPlantilla = false;
      plantillaActual = null;
  }

  function insertarMarcador(marcador: string) {
      if (editor) { editor.chain().focus().insertContent(` [[${marcador}]] `).run(); }
      else if (plantillaActual) { plantillaActual.body += ` [[${marcador}]]`; }
  }

  // --- MARCADORES (DATOS) ---
  let marcadoresItems = [
      { category: "Lista rápida", items: ["Saludo según sexo", "Designación del Circuito"] },
      { category: "Fechas", items: ["Fecha Actual Mediana", "Fecha Actual Completa"] },
      { category: "Asignación", items: ["Hora", "Duración", "Tema", "Número de Bosquejo", "Tipo de asignación", "Enlace(s) del Bosquejo", "Notas"] },
      { category: "Orador", items: ["Nombre", "Segundo nombre", "Apellidos"] },
      { category: "Lugar", items: ["Nombre del lugar", "Dirección", "Ciudad", "Estado o Provincia"] },
      { category: "Evento", items: ["Fecha", "Tipo de Evento", "Tema del Evento"] },
      { category: "Ensayo", items: ["Información completa", "Notas ensayo", "Lugar ensayo", "Fecha/Hora ensayo"] },
      { category: "Presidente", items: ["Email Presidente", "Teléfono Presidente"] }
  ];
  
  let marcadoresOpen: boolean[] = new Array(marcadoresItems.length).fill(false);
  marcadoresOpen[0] = true; 

  function toggleMarcadorGroup(index: number) { marcadoresOpen[index] = !marcadoresOpen[index]; }

  // --- WHATSAPP (ACORDEÓN) - CORRECCIÓN DE TIPOS ---
  // Se usa una estructura manual en el HTML para evitar errores de índice en TS
  let mensajesOpen = { 
      comite: false, 
      programa: false, 
      audiovideo: false, 
      oradores: false, 
      oficina: false, 
      presidentes: false, 
      oraciones: false 
  };
  
  function toggleMensaje(key: keyof typeof mensajesOpen) { 
      mensajesOpen[key] = !mensajesOpen[key]; 
  }

  // --- AYUDA ---
  let ayudaItems = [
      { title: "Primeros pasos y configuración inicial", content: "Configure su perfil...", isOpen: false },
      { title: "Personalización de mensajes de WhatsApp", content: "Configure mensajes rápidos...", isOpen: false },
  ];
  function toggleAyuda(index: number) { ayudaItems[index].isOpen = !ayudaItems[index].isOpen; }

  // Configuración General
  let config = {
      msgComite: "", msgPrograma: "", msgAudioVideo: "", msgOradores: "", msgOficina: "", msgPresidentes: "", msgOraciones: "",
      accionPdf: "abrir", idioma: "es",
      email_asignaciones: true, email_general_clase: true, email_recordatorios_clase: true, email_conclusion_clase: true, email_foto_clase: true, email_emergencia: false,
      usar_cliente_sistema: false, no_precompletar: false
  };

  // Datos de usuario
  let usuario = {
      nombre: "Yorlen", segundoNombre: "", apellido: "Batista Reyes", sufijo: "",
      email: "yorlenbatistareyes@gmail.com", emailJw: "batistareyyorlen7@jwpub.org",
      movil: "54891111", id: "7164622", fechaCreacion: "4/11/2025" 
  };

  // --- MODAL USUARIO ---
  let mostrarModalUsuario = false;
  let usuarioEditando = { ...usuario }; 
  function abrirModalUsuario() { usuarioEditando = { ...usuario }; mostrarModalUsuario = true; }
  function guardarUsuario() { usuario = { ...usuarioEditando }; mostrarModalUsuario = false; }
  function cerrar() { dispatch('close'); }
  function guardarCambiosConfig() { alert("Configuración guardada correctamente"); }

  // --- LÓGICA DE DATOS ---
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
                            <input type="text" bind:value={plantillaActual.subject} class="input-subject" />
                            
                            <label>Cuerpo</label>
                            <div class="toolbar-reactive">
                                <button class="tool-btn" class:active={isBold} on:click={toggleBold} title="Negrita"><Bold size={16}/></button>
                                <button class="tool-btn" class:active={isItalic} on:click={toggleItalic} title="Cursiva"><Italic size={16}/></button>
                                <button class="tool-btn" class:active={isUnderline} on:click={toggleUnderline} title="Subrayado"><UnderlineIcon size={16}/></button>
                                <div class="sep"></div>
                                <button class="tool-btn" class:active={textAlignLeft} on:click={() => setAlign('left')}><AlignLeft size={16}/></button>
                                <button class="tool-btn" class:active={textAlignCenter} on:click={() => setAlign('center')}><AlignCenter size={16}/></button>
                                <button class="tool-btn" class:active={textAlignRight} on:click={() => setAlign('right')}><AlignRight size={16}/></button>
                                <button class="tool-btn" class:active={textAlignJustify} on:click={() => setAlign('justify')}><AlignJustify size={16}/></button>
                                <div class="sep"></div>
                                <button class="tool-btn" class:active={isLink} on:click={setLink}><LinkIcon size={16}/></button>
                            </div>
                            
                            <div class="editor-container" use:setupEditor></div>
                        </div>

                        <div class="editor-footer-actions">
                            <button class="btn-cancelar-editor" on:click={cancelarEdicionPlantilla}>Deshacer</button>
                            <button class="btn-guardar-editor" on:click={guardarPlantillaEditada}>Guardar</button>
                        </div>
                    </div>

                    <div class="editor-sidebar">
                        <div class="sidebar-title">Marcadores de posición</div>
                        <div class="markers-accordion">
                            {#each marcadoresItems as group, i}
                                <div class="marker-group-item">
                                    <button class="marker-header" on:click={() => toggleMarcadorGroup(i)}>
                                        <span>{group.category}</span>
                                        {#if marcadoresOpen[i]}<ChevronUp size={14}/>{:else}<ChevronDown size={14}/>{/if}
                                    </button>
                                    {#if marcadoresOpen[i]}
                                        <div class="marker-content">
                                            {#each group.items as item}
                                                <button class="marker-pill" on:click={() => insertarMarcador(item)}>{item}</button>
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
                        {#each plantillasCorreo as plantilla, index}
                            <div class="accordion-item">
                                <button class="accordion-header" on:click={() => togglePlantilla(index)}>
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
                    <div class="data-card"><div class="data-icon-wrapper blue"><Upload size={24}/></div><div class="data-content"><h3>Respaldar Datos</h3><p>Guardar copia.</p></div><button class="btn-data-action primary">Respaldar</button></div>
                    </div>
            {:else if configSeccion === 'ayuda'}
                <div class="help-container">
                    <div class="accordion-list">
                        {#each ayudaItems as item, i}
                            <div class="accordion-item">
                                <button class="accordion-header" on:click={() => toggleAyuda(i)}><div class="acc-title"><HelpCircle size={16}/> {item.title}</div>{#if item.isOpen}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}</button>
                                {#if item.isOpen}<div class="accordion-body"><p>{item.content}</p></div>{/if}
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
                        <div class="input-group"><label>Email</label><input type="email" bind:value={usuarioEditando.email} /></div>
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
  
  /* Sidebar */
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
  .btn-close-editor { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
  
  .editor-form { padding: 20px; flex: 1; display: flex; flex-direction: column; gap: 10px; overflow-y: hidden; }
  .editor-form label { font-weight: 700; font-size: 13px; color: var(--text-secondary); margin-top: 10px; }
  .input-subject { padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--input-bg); color: var(--text-main); font-size: 14px; }
  
  .toolbar-reactive { display: flex; gap: 5px; padding: 5px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-bottom: none; border-radius: 4px 4px 0 0; }
  .tool-btn { background: none; border: 1px solid transparent; padding: 4px; cursor: pointer; color: var(--text-secondary); border-radius: 3px; display: flex; align-items: center; }
  .tool-btn:hover { background: var(--hover-bg); color: var(--text-main); }
  .tool-btn.active { background: #dbeafe; border-color: #bfdbfe; color: var(--primary); }
  .sep { width: 1px; background: var(--border-color); margin: 0 5px; }
  
  .editor-container { flex: 1; padding: 15px; border: 1px solid var(--border-color); border-radius: 0 0 4px 4px; background: var(--input-bg); color: var(--text-main); overflow-y: auto; cursor: text; }
  :global(.ProseMirror) { height: 100%; outline: none; }
  
  .editor-footer-actions { padding: 15px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; background: var(--bg-card); }
  .btn-cancelar-editor { background: #ea580c; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .btn-guardar-editor { background: #ea580c; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }

  .editor-sidebar { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
  .sidebar-title { padding: 15px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); font-weight: 600; color: var(--text-main); font-size: 14px; }
  .markers-accordion { overflow-y: auto; flex: 1; }
  .marker-header { width: 100%; display: flex; justify-content: space-between; padding: 10px 15px; background: transparent; border: none; border-bottom: 1px solid var(--border-color); cursor: pointer; text-align: left; font-size: 13px; color: var(--text-main); font-weight: 500; }
  .marker-header:hover { background: var(--hover-bg); }
  .marker-content { background: var(--bg-body); padding: 10px; display: flex; flex-direction: column; gap: 5px; }
  .marker-pill { background: var(--bg-card); border: 1px solid var(--border-color); padding: 6px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; text-align: left; color: var(--text-secondary); }
  .marker-pill:hover { border-color: var(--primary); color: var(--primary); background: var(--hover-bg); }

  /* OTROS */
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
  /* Estilo visual ajustado: Fondo blanco (input-bg), borde sutil, relleno cómodo */
  .preview-input { 
      width: 100%; 
      padding: 10px; 
      border: 1px solid var(--border-color); 
      border-radius: 4px; 
      background: var(--bg-card); /* Se adapta al tema */
      color: var(--text-secondary); /* Color texto secundario para indicar solo lectura */
      font-size: 14px; 
      box-sizing: border-box; 
  }
  .preview-textarea { 
      width: 100%; 
      padding: 15px; 
      border: 1px solid var(--border-color); 
      border-radius: 4px; 
      background: var(--bg-card); 
      color: var(--text-secondary); 
      font-size: 14px; 
      min-height: 100px; 
      max-height: 300px; 
      box-sizing: border-box; 
      overflow-y: auto; 
  }

  .template-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
  /* Botones color vino */
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
  
  /* Toggles */
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