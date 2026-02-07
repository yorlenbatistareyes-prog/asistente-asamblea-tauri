<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { 
    ArrowLeft, Sliders, Mail, Shield, X, 
    Database, CircleHelp, Download, Upload, Trash2, HelpCircle, 
    ChevronDown, ChevronUp, MessageCircle, FileText, RefreshCw, PenTool 
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  // --- ESTADO ---
  let configSeccion = 'general'; 
  
  // Estado para los acordeones de mensajes rápidos (WhatsApp)
  // Definimos explícitamente el tipo para evitar errores de índice
  let mensajesOpen = {
      comite: false,
      programa: false,
      audiovideo: false,
      oradores: false,
      oficina: false,
      presidentes: false,
      oraciones: false
  };

  // Función con tipo específico para las claves
  function toggleMensaje(key: keyof typeof mensajesOpen) {
      mensajesOpen[key] = !mensajesOpen[key];
  }

  // --- PLANTILLAS DE CORREO ---
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

  // --- AYUDA ---
  let ayudaItems = [
      {
          title: "Primeros pasos y configuración inicial",
          content: "Antes de comenzar, asegúrese de configurar su perfil en la sección 'Cuenta y Seguridad'. Los datos allí ingresados (Nombre, Teléfono, Email) se utilizarán automáticamente como firma en los correos electrónicos y mensajes generados por el sistema.",
          isOpen: false
      },
      {
          title: "Personalización de mensajes de WhatsApp",
          content: "En la sección 'General', puede predefinir las plantillas de mensajes rápidos. Estos mensajes se copiarán al portapapeles o abrirán WhatsApp Web cuando haga clic en el botón 'WhatsApp' desde el programa de la asamblea. Use marcadores claros para saber dónde insertar nombres automáticamente.",
          isOpen: false
      },
      {
          title: "Configuración de plantillas de correo electrónico",
          content: "En la sección 'Plantillas de correo', puede editar el Asunto y el Cuerpo de los correos para cada rol. El sistema permite usar marcadores de posición (ej: [[nombre]], [[tema]]) que se reemplazarán automáticamente con los datos de la asamblea actual al momento de generar el correo.",
          isOpen: false
      },
      {
          title: "Uso de clientes de correo (Outlook vs Sistema)",
          content: "Por defecto, la aplicación intenta abrir 'Outlook Online' (OWA) para enviar correos institucionales (jwpub.org). Si prefiere usar una aplicación de escritorio como Thunderbird, Mail (Mac) o Outlook Desktop, active la opción 'Utilice el cliente de correo electrónico en lugar de Outlook Online' en la configuración General.",
          isOpen: false
      },
      {
          title: "Gestión de Asambleas y Programa",
          content: "Desde la pantalla principal, puede crear nuevas asambleas. Una vez dentro, en la sección 'Programa', puede asignar oradores arrastrando o seleccionando de la lista. El estado de 'Confirmado', 'Presente' o 'Ensayo' ayuda a la oficina a llevar el control en tiempo real.",
          isOpen: false
      },
      {
          title: "Respaldo y Restauración de Datos",
          content: "Es recomendable realizar copias de seguridad periódicas. Vaya a la sección 'Datos' y pulse 'Respaldar Datos' para descargar un archivo JSON con toda la información. Para recuperar información en otro dispositivo o tras una limpieza, use 'Restaurar Datos'.",
          isOpen: false
      }
  ];

  function toggleAyuda(index: number) {
      ayudaItems[index].isOpen = !ayudaItems[index].isOpen;
  }

  // Configuración General
  let config = {
      // Mensajes WhatsApp
      msgComite: "", msgPrograma: "", msgAudioVideo: "", msgOradores: "", msgOficina: "", msgPresidentes: "", msgOraciones: "",
      
      accionPdf: "abrir", 
      idioma: "es",
      
      // Toggles de correo
      email_asignaciones: true,
      email_general_clase: true,
      email_recordatorios_clase: true,
      email_conclusion_clase: true,
      email_foto_clase: true,
      email_emergencia: false,
      
      usar_cliente_sistema: false,
      no_precompletar: false
  };

  // Datos de usuario
  let usuario = {
      nombre: "Yorlen",
      segundoNombre: "",
      apellido: "Batista Reyes",
      sufijo: "",
      email: "yorlenbatistareyes@gmail.com",
      emailJw: "batistareyyorlen7@jwpub.org",
      movil: "54891111",
      id: "7164622",
      fechaCreacion: "4/11/2025" 
  };

  // --- MODAL USUARIO ---
  let mostrarModalUsuario = false;
  let usuarioEditando = { ...usuario }; 

  function abrirModalUsuario() {
      usuarioEditando = { ...usuario }; 
      mostrarModalUsuario = true;
  }

  function guardarUsuario() {
      usuario = { ...usuarioEditando }; 
      mostrarModalUsuario = false;
  }

  function cerrar() { dispatch('close'); }

  function guardarCambiosConfig() {
      alert("Configuración guardada correctamente");
  }

  // --- LÓGICA DE DATOS ---
  async function respaldarDatos() { alert("Iniciando copia de seguridad..."); }
  async function restaurarDatos() { if(confirm("¿Sobrescribir datos actuales?")) alert("Seleccionar archivo..."); }
  async function limpiarBaseDatos() {
      const confirmacion = prompt("Escribe 'ELIMINAR' para confirmar:");
      if (confirmacion === 'ELIMINAR') { alert("Base de datos limpiada."); location.reload(); }
  }
</script>

<div class="config-layout">
    <aside class="config-sidebar">
        <div class="config-header">
            <button class="btn-back-config" on:click={cerrar}><ArrowLeft size={20}/> Volver</button>
            <h2>Configuración</h2>
        </div>
        <nav class="config-nav">
            <button class:active={configSeccion === 'general'} on:click={() => configSeccion = 'general'}><Sliders size={18}/> General</button>
            <button class:active={configSeccion === 'correos'} on:click={() => configSeccion = 'correos'}><Mail size={18}/> Plantillas de correo</button>
            <button class:active={configSeccion === 'cuenta'} on:click={() => configSeccion = 'cuenta'}><Shield size={18}/> Cuenta y Seguridad</button>
            <div class="nav-divider"></div>
            <button class:active={configSeccion === 'datos'} on:click={() => configSeccion = 'datos'}><Database size={18}/> Datos</button>
            <button class:active={configSeccion === 'ayuda'} on:click={() => configSeccion = 'ayuda'}><CircleHelp size={18}/> Ayuda</button>
        </nav>
        <div class="config-footer"><span>Versión 2.1.0</span></div>
    </aside>

    <main class="config-content">
        <div class="config-title-bar">
            <h1>
                {#if configSeccion === 'general'} Configuraciones generales {/if}
                {#if configSeccion === 'correos'} Plantillas de correo electrónico {/if}
                {#if configSeccion === 'cuenta'} Cuenta y Seguridad {/if}
                {#if configSeccion === 'datos'} Gestión de Datos {/if}
                {#if configSeccion === 'ayuda'} Centro de Ayuda {/if}
            </h1>
            {#if configSeccion !== 'ayuda' && configSeccion !== 'datos'}
                <div class="config-actions"><button class="btn-save-config" on:click={guardarCambiosConfig}>Guardar Cambios</button></div>
            {/if}
        </div>

        <div class="config-scroll-area">
            {#if configSeccion === 'general'}
                <div class="config-grid">
                    <div class="col-main">
                        
                        <div class="config-group">
                            <label class="group-label">Plantillas de Mensajes Rápidos (WhatsApp)</label>
                            <div class="accordion-list">
                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('comite')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje de WhatsApp a Comité de asamblea</div>
                                        {#if mensajesOpen.comite}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.comite}
                                        <div class="accordion-body">
                                            <textarea rows="2" bind:value={config.msgComite} placeholder="Escriba el mensaje..."></textarea>
                                        </div>
                                    {/if}
                                </div>

                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('programa')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje de WhatsApp a Sup. de Programa</div>
                                        {#if mensajesOpen.programa}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.programa}
                                        <div class="accordion-body">
                                            <textarea rows="2" bind:value={config.msgPrograma} placeholder="Escriba el mensaje..."></textarea>
                                        </div>
                                    {/if}
                                </div>

                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('audiovideo')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje de WhatsApp a Audio y Video</div>
                                        {#if mensajesOpen.audiovideo}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.audiovideo}
                                        <div class="accordion-body">
                                            <textarea rows="2" bind:value={config.msgAudioVideo} placeholder="Escriba el mensaje..."></textarea>
                                        </div>
                                    {/if}
                                </div>

                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('oradores')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje de WhatsApp a Oradores</div>
                                        {#if mensajesOpen.oradores}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.oradores}
                                        <div class="accordion-body">
                                            <textarea rows="2" bind:value={config.msgOradores} placeholder="Escriba el mensaje..."></textarea>
                                        </div>
                                    {/if}
                                </div>

                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('oficina')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje de WhatsApp a Oficina del Presidente</div>
                                        {#if mensajesOpen.oficina}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.oficina}
                                        <div class="accordion-body">
                                            <textarea rows="2" bind:value={config.msgOficina} placeholder="Escriba el mensaje..."></textarea>
                                        </div>
                                    {/if}
                                </div>

                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('presidentes')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje de WhatsApp a Presidentes de Sesión</div>
                                        {#if mensajesOpen.presidentes}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.presidentes}
                                        <div class="accordion-body">
                                            <textarea rows="2" bind:value={config.msgPresidentes} placeholder="Escriba el mensaje..."></textarea>
                                        </div>
                                    {/if}
                                </div>

                                <div class="accordion-item">
                                    <button class="accordion-header" on:click={() => toggleMensaje('oraciones')}>
                                        <div class="acc-title"><MessageCircle size={16}/> Mensaje de WhatsApp a Hermanos de Oración</div>
                                        {#if mensajesOpen.oraciones}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                                    </button>
                                    {#if mensajesOpen.oraciones}
                                        <div class="accordion-body">
                                            <textarea rows="2" bind:value={config.msgOraciones} placeholder="Escriba el mensaje..."></textarea>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>

                        <div class="config-group radio-group-box">
                            <label class="group-label">Configuraciones de PDF</label>
                            <p class="help-text">Acción al generar PDF.</p>
                            <label class="radio-item" class:active-radio={config.accionPdf === 'nada'}>
                                <input type="radio" name="pdf_action" value="nada" bind:group={config.accionPdf}> <span>Sin acción</span>
                            </label>
                            <label class="radio-item" class:active-radio={config.accionPdf === 'carpeta'}>
                                <input type="radio" name="pdf_action" value="carpeta" bind:group={config.accionPdf}> <span>Mostrar en Explorer</span>
                            </label>
                            <label class="radio-item active-radio" class:active-radio={config.accionPdf === 'abrir'}>
                                <input type="radio" name="pdf_action" value="abrir" bind:group={config.accionPdf}> <span>Abrir predeterminado</span>
                            </label>
                        </div>
                        <div class="config-group">
                            <label>Idioma</label>
                            <select bind:value={config.idioma} class="input-light">
                                <option value="es">Español (Latinoamérica)</option>
                                <option value="en">English (US)</option>
                            </select>
                        </div>
                    </div>

                    <div class="col-side">
                        <div class="config-group">
                            <label class="group-label">Incluir CCA en la configuración de correos electrónicos de clase</label>
                            <div class="toggle-list">
                                <div class="toggle-item"><span>Correos electrónicos de asignaciones</span><label class="switch"><input type="checkbox" bind:checked={config.email_asignaciones}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>correo electrónico general de clase</span><label class="switch"><input type="checkbox" bind:checked={config.email_general_clase}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Correo electrónico de recordatorios de clase.</span><label class="switch"><input type="checkbox" bind:checked={config.email_recordatorios_clase}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Correo electrónico de conclusión de clase</span><label class="switch"><input type="checkbox" bind:checked={config.email_conclusion_clase}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Correo electrónico de foto de clase</span><label class="switch"><input type="checkbox" bind:checked={config.email_foto_clase}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Correo electrónico de anuncio de emergencia</span><label class="switch"><input type="checkbox" bind:checked={config.email_emergencia}><span class="slider round"></span></label></div>
                            </div>
                        </div>
                        
                        <div class="config-group mt-large">
                            <label class="group-label-icon">Utilice el cliente de correo electrónico en lugar de Outlook Online <HelpCircle size={14}/></label>
                            <div class="toggle-item description-toggle">
                                <label class="switch"><input type="checkbox" bind:checked={config.usar_cliente_sistema}><span class="slider round"></span></label>
                                <div class="desc-text">Utilice Thunderbird, BlueMail u otro cliente de correo electrónico compatible</div>
                            </div>
                        </div>

                        <div class="config-group">
                            <label class="group-label-icon">No complete previamente el cuerpo del correo electrónico con texto sin formato <HelpCircle size={14}/></label>
                            <div class="toggle-item description-toggle">
                                <label class="switch"><input type="checkbox" bind:checked={config.no_precompletar}><span class="slider round"></span></label>
                                <div class="desc-text">No complete previamente el cuerpo del correo electrónico con texto sin formato</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="user-info-section">
                    <div class="user-info-header">
                        <h3>Información del usuario</h3>
                        <button class="btn-edit-user" on:click={abrirModalUsuario}>Editar</button>
                    </div>
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
                                        <div class="template-field">
                                            <label>Asunto</label>
                                            <input type="text" bind:value={plantilla.subject} placeholder="Asunto del correo..."/>
                                        </div>
                                        
                                        <div class="template-field">
                                            <label>Cuerpo</label>
                                            <textarea rows="8" bind:value={plantilla.body} placeholder="Cuerpo del mensaje..."></textarea>
                                        </div>

                                        <div class="template-actions">
                                            <button class="btn-template-action left"><PenTool size={14}/> Editar</button>
                                            
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
                        <div class="data-icon-wrapper blue"><Upload size={24} /></div>
                        <div class="data-content"><h3>Respaldar Datos</h3><p>Guardar copia de seguridad.</p></div>
                        <button class="btn-data-action primary" on:click={respaldarDatos}>Respaldar</button>
                    </div>
                    <div class="data-card">
                        <div class="data-icon-wrapper green"><Download size={24} /></div>
                        <div class="data-content"><h3>Restaurar Datos</h3><p>Cargar copia de seguridad.</p></div>
                        <button class="btn-data-action secondary" on:click={restaurarDatos}>Restaurar</button>
                    </div>
                    <div class="data-card danger-zone">
                        <div class="data-icon-wrapper red"><Trash2 size={24} /></div>
                        <div class="data-content"><h3>Limpiar Todo</h3><p>Borrar base de datos.</p></div>
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
                                    <div class="accordion-body">
                                        <p class="help-text-content">{item.content}</p>
                                    </div>
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
                <div class="modal-header-user">
                    <h3>Editar información de usuario</h3>
                    <button class="btn-close" on:click={() => mostrarModalUsuario = false}><X size={20}/></button>
                </div>
                <div class="modal-body-user">
                    <div class="form-user-grid">
                        <div class="input-group">
                            <label>Nombre</label>
                            <input type="text" bind:value={usuarioEditando.nombre} />
                        </div>
                        <div class="input-group">
                            <label>Segundo nombre</label>
                            <input type="text" bind:value={usuarioEditando.segundoNombre} />
                        </div>

                        <div class="input-group">
                            <label>Apellido</label>
                            <input type="text" bind:value={usuarioEditando.apellido} />
                        </div>
                        <div class="input-group">
                            <label>Sufijo (es decir: Jr, Sr, etc.)</label>
                            <input type="text" bind:value={usuarioEditando.sufijo} />
                        </div>

                        <div class="input-group">
                            <label>Correo electrónico</label>
                            <input type="email" bind:value={usuarioEditando.email} />
                        </div>
                        <div class="input-group">
                            <label>Correo electrónico JWPub</label>
                            <input type="email" bind:value={usuarioEditando.emailJw} />
                        </div>

                        <div class="input-group">
                            <label>Móvil</label>
                            <input type="text" bind:value={usuarioEditando.movil} />
                        </div>
                        <div class="input-group">
                            <label>Número de identificación</label>
                            <input type="text" bind:value={usuarioEditando.id} />
                        </div>
                    </div>
                </div>
                <div class="modal-footer-user">
                    <button class="btn-cancel-user" on:click={() => mostrarModalUsuario = false}>Cancelar</button>
                    <button class="btn-save-user" on:click={guardarUsuario}>Guardar</button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
  /* VARIABLES */
  .config-layout { display: grid; grid-template-columns: 260px 1fr; height: 100vh; background: var(--bg-body); color: var(--text-main); font-family: 'Segoe UI', sans-serif; }
  
  /* Sidebar */
  .config-sidebar { background: var(--bg-secondary); display: flex; flex-direction: column; border-right: 1px solid var(--border-color); padding: 20px 0; }
  .config-header { padding: 0 20px 20px; border-bottom: 1px solid var(--border-color); }
  .config-header h2 { margin: 15px 0 0; font-size: 1.2rem; color: var(--text-main); }
  .btn-back-config { background: none; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 0; }
  .btn-back-config:hover { color: var(--text-main); }
  
  .config-nav { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; gap: 5px; }
  .config-nav button { background: none; border: none; width: 100%; text-align: left; padding: 12px 16px; color: var(--text-secondary); font-size: 14px; font-weight: 500; cursor: pointer; border-radius: 8px; display: flex; align-items: center; gap: 12px; transition: all 0.2s; }
  .config-nav button:hover { background: var(--hover-bg); color: var(--text-main); }
  .config-nav button.active { background: var(--primary); color: white; font-weight: 600; }
  
  .nav-divider { height: 1px; background: var(--border-color); margin: 10px 16px; }
  .config-footer { padding: 20px; font-size: 11px; color: var(--text-secondary); text-align: center; }

  /* Content */
  .config-content { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: var(--bg-body); }
  .config-title-bar { padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); background: var(--bg-card); }
  .config-title-bar h1 { margin: 0; font-size: 24px; color: var(--text-main); font-weight: 700; }
  
  /* Botón Guardar Cambios (VERDE) */
  .btn-save-config { background: #10b981; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .btn-save-config:hover { background: #059669; }
  
  .config-scroll-area { flex: 1; overflow-y: auto; padding: 40px; }
  .config-grid { display: grid; grid-template-columns: 3fr 2fr; gap: 60px; max-width: 1200px; padding-bottom: 40px; }
  
  /* --- ESTILOS ACORDEÓN (GENERAL) --- */
  .accordion-list { display: flex; flex-direction: column; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
  .accordion-item { border-bottom: 1px solid var(--border-color); background: var(--bg-card); }
  .accordion-item:last-child { border-bottom: none; }
  .accordion-header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: var(--bg-card); border: none; cursor: pointer; color: var(--text-main); font-size: 14px; font-weight: 500; transition: background 0.2s; }
  .accordion-header:hover { background: var(--hover-bg); }
  .acc-title { display: flex; align-items: center; gap: 10px; }
  .accordion-body { padding: 15px; background: var(--bg-body); border-top: 1px solid var(--border-color); }
  .accordion-body textarea { width: 100%; background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: 6px; box-sizing: border-box; resize: vertical; font-family: inherit; font-size: 13px; }

  /* --- ESTILOS PLANTILLAS DE CORREO (DETALLE) --- */
  .mail-templates-container, .help-container { max-width: 1000px; margin: 0 auto; }
  .accordion-body-template { padding: 25px; background: #fafafa; /* Fondo ligero interno para el editor */ border-top: 1px solid var(--border-color); }
  /* En tema oscuro */
  :global(html.dark-theme) .accordion-body-template { background: #1e293b; }

  .template-field { margin-bottom: 20px; }
  .template-field label { display: block; font-weight: 700; margin-bottom: 8px; color: var(--text-main); font-size: 14px; }
  .template-field input { width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; box-sizing: border-box; background: var(--input-bg); color: var(--text-main); }
  .template-field textarea { width: 100%; padding: 15px; border: 1px solid var(--border-color); border-radius: 4px; box-sizing: border-box; resize: vertical; background: var(--input-bg); color: var(--text-main); font-family: inherit; }

  /* Barra de botones de plantilla (Estilo imagen) */
  .template-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 30px; }
  .group-center { display: flex; gap: 10px; }
  
  .btn-template-action { 
      background: #5f1d22; /* Tono rojizo oscuro de la imagen */
      color: white; 
      border: none; 
      padding: 8px 16px; 
      border-radius: 4px; 
      font-size: 13px; 
      font-weight: 600; 
      cursor: pointer; 
      display: flex; 
      align-items: center; 
      gap: 6px;
  }
  .btn-template-action:hover { background: #4a1519; }

  /* Inputs Generales */
  .config-group { margin-bottom: 30px; }
  .config-group label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
  .input-light { width: 100%; background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-main); padding: 10px; border-radius: 8px; box-sizing: border-box; }

  .radio-group-box { background: var(--bg-card); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); }
  .group-label { font-size: 15px !important; color: var(--text-main) !important; margin-bottom: 5px !important; }
  .help-text { font-size: 12px; color: var(--text-secondary); margin: 0 0 15px 0; }
  .radio-item { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 6px; cursor: pointer; color: var(--text-secondary); }
  .radio-item:hover { background: var(--hover-bg); }
  .active-radio { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; }

  /* Toggles (Naranjas #ea580c) */
  .toggle-item { display: flex; justify-content: flex-start; align-items: center; color: var(--text-main); font-size: 14px; margin-bottom: 12px; gap: 15px; }
  .toggle-item span { flex: 1; }
  .description-toggle { align-items: center; margin-bottom: 8px; }
  .desc-text { font-size: 12px; color: var(--text-secondary); margin-left: 10px; }
  .mt-large { margin-top: 30px; }
  .group-label-icon { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; color: var(--text-main); margin-bottom: 10px; }

  .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .4s; border-radius: 34px; }
  .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
  input:checked + .slider { background-color: #ea580c; } /* Naranja */
  input:checked + .slider:before { transform: translateX(20px); }

  /* --- INFO USUARIO --- */
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
  .user-info-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 20px; 
  }
  .user-info-header h3 { margin: 0; font-size: 20px; color: var(--text-main); font-weight: 700; }
  
  .btn-edit-user { 
      background: #ea580c; 
      color: white; 
      border: none; 
      padding: 8px 24px; 
      border-radius: 6px; 
      font-weight: 600; 
      cursor: pointer; 
      font-size: 14px;
  }
  .btn-edit-user:hover { background: #c2410c; }

  .user-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
  .ui-item { display: flex; flex-direction: column; gap: 4px; }
  .ui-item label { font-size: 12px; color: var(--text-secondary); text-transform: lowercase; }
  .ui-item label::first-letter { text-transform: uppercase; }
  .ui-item span { font-size: 15px; color: var(--text-main); font-weight: 400; }

  /* --- MODAL --- */
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
  .input-group input:focus { border-color: #3b82f6; border-bottom: 2px solid #3b82f6; outline: none; }

  .modal-footer-user { padding: 20px 30px; display: flex; justify-content: flex-end; gap: 15px; background: var(--bg-card); }
  
  .btn-cancel-user { background: white; border: 1px solid var(--border-color); padding: 10px 20px; border-radius: 6px; cursor: pointer; color: var(--text-main); font-weight: 600; }
  .btn-cancel-user:hover { background: var(--hover-bg); }
  
  .btn-save-user { background: #ea580c; border: none; padding: 10px 24px; border-radius: 6px; color: white; cursor: pointer; font-weight: 600; }
  .btn-save-user:hover { background: #c2410c; }

  /* Datos y Otros */
  .data-management-container { max-width: 800px; display: flex; flex-direction: column; gap: 20px; }
  .data-card { display: flex; align-items: center; gap: 20px; background: var(--bg-card); border: 1px solid var(--border-color); padding: 20px; border-radius: 12px; }
  .data-content h3 { margin: 0; color: var(--text-main); } .data-content p { margin: 0; color: var(--text-secondary); font-size: 13px; }
  .data-icon-wrapper { width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .data-icon-wrapper.blue { background: #eff6ff; color: #2563eb; }
  .data-icon-wrapper.green { background: #f0fdf4; color: #16a34a; }
  .data-icon-wrapper.red { background: #fef2f2; color: #dc2626; }
  .btn-data-action { padding: 10px 20px; border-radius: 6px; cursor: pointer; border: none; font-weight: 600; }
  .btn-data-action.primary { background: var(--primary); color: white; }
  .btn-data-action.secondary { background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-secondary); }
  .btn-data-action.danger { background: #fee2e2; color: #dc2626; }

  .empty-section { text-align: center; color: var(--text-secondary); padding-top: 50px; }
  
  /* Ayuda */
  .help-text-content { color: var(--text-main); font-size: 14px; line-height: 1.6; }
</style>