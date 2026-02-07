<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { 
    ArrowLeft, Sliders, Mail, Shield, X, 
    Database, CircleHelp, Download, Upload, Trash2, AlertTriangle 
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  // --- ESTADO DE CONFIGURACIÓN ---
  let configSeccion = 'general'; 
  
  let config = {
      smsEstudiantes: "",
      smsCoordinadores: "",
      accionPdf: "abrir", 
      idioma: "es",
      email_asignaciones: true,
      email_general: true,
      email_recordatorios: true,
      email_conclusion: true,
      email_foto: true,
      email_emergencia: false,
      usar_cliente_sistema: false,
      no_precompletar: false
  };

  // --- DATOS DEL USUARIO ---
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

  // --- LÓGICA MODAL USUARIO ---
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

  // --- LÓGICA GENERAL ---
  function cerrar() { dispatch('close'); }

  function guardarCambiosConfig() {
      alert("Configuración guardada correctamente");
  }

  // --- LÓGICA DE DATOS ---
  async function respaldarDatos() {
      alert("Iniciando copia de seguridad... (Simulación)");
  }

  async function restaurarDatos() {
      if(confirm("Al restaurar se sobrescribirán los datos actuales. ¿Deseas continuar?")) {
          alert("Abriendo selector de archivo... (Simulación)");
      }
  }

  async function limpiarBaseDatos() {
      const confirmacion = prompt("Escribe 'ELIMINAR' para confirmar el borrado completo de la base de datos:");
      if (confirmacion === 'ELIMINAR') {
          alert("Base de datos limpiada. La aplicación se reiniciará.");
          location.reload();
      }
  }
</script>

<div class="config-layout">
    <aside class="config-sidebar">
        <div class="config-header">
            <button class="btn-back-config" on:click={cerrar}><ArrowLeft size={20}/> Volver</button>
            <h2>Configuración</h2>
        </div>
        <nav class="config-nav">
            <button class:active={configSeccion === 'general'} on:click={() => configSeccion = 'general'}>
                <Sliders size={18}/> General
            </button>
            <button class:active={configSeccion === 'correos'} on:click={() => configSeccion = 'correos'}>
                <Mail size={18}/> Plantillas de correo
            </button>
            <button class:active={configSeccion === 'cuenta'} on:click={() => configSeccion = 'cuenta'}>
                <Shield size={18}/> Cuenta y Seguridad
            </button>
            
            <div class="nav-divider"></div>

            <button class:active={configSeccion === 'datos'} on:click={() => configSeccion = 'datos'}>
                <Database size={18}/> Datos
            </button>
            <button class:active={configSeccion === 'ayuda'} on:click={() => configSeccion = 'ayuda'}>
                <CircleHelp size={18}/> Ayuda
            </button>
        </nav>
        <div class="config-footer">
            <span>Versión 2.1.0</span>
        </div>
    </aside>

    <main class="config-content">
        <div class="config-title-bar">
            <h1>
                {#if configSeccion === 'general'} Configuraciones generales {/if}
                {#if configSeccion === 'correos'} Plantillas de Correo {/if}
                {#if configSeccion === 'cuenta'} Cuenta y Seguridad {/if}
                {#if configSeccion === 'datos'} Gestión de Datos {/if}
                {#if configSeccion === 'ayuda'} Centro de Ayuda {/if}
            </h1>
            
            {#if configSeccion !== 'ayuda' && configSeccion !== 'datos'}
                <div class="config-actions">
                    <button class="btn-save-config" on:click={guardarCambiosConfig}>Guardar Cambios</button>
                </div>
            {/if}
        </div>

        <div class="config-scroll-area">
            
            {#if configSeccion === 'general'}
                <div class="config-grid">
                    <div class="col-main">
                        <div class="config-group">
                            <label>Mensaje SMS predeterminado para estudiantes</label>
                            <textarea rows="3" bind:value={config.smsEstudiantes} placeholder="Escriba el mensaje aquí..."></textarea>
                        </div>

                        <div class="config-group">
                            <label>Mensaje SMS predeterminado para coordinadores</label>
                            <textarea rows="3" bind:value={config.smsCoordinadores} placeholder="Escriba el mensaje aquí..."></textarea>
                        </div>

                        <div class="config-group radio-group-box">
                            <label class="group-label">Configuraciones de PDF</label>
                            <p class="help-text">Selecciona una acción para realizar después de generar el PDF.</p>
                            
                            <label class="radio-item" class:active-radio={config.accionPdf === 'nada'}>
                                <input type="radio" name="pdf_action" value="nada" bind:group={config.accionPdf}>
                                <span>Sin acción</span>
                            </label>
                            <label class="radio-item" class:active-radio={config.accionPdf === 'carpeta'}>
                                <input type="radio" name="pdf_action" value="carpeta" bind:group={config.accionPdf}>
                                <span>Mostrar archivo en Explorer</span>
                            </label>
                            <label class="radio-item" class:active-radio={config.accionPdf === 'abrir'}>
                                <input type="radio" name="pdf_action" value="abrir" bind:group={config.accionPdf}>
                                <span>Abrir en el lector de PDF predeterminado</span>
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
                            <label class="group-label">Incluir CCA en correos electrónicos</label>
                            <div class="toggle-list">
                                <div class="toggle-item"><span>Correos de asignaciones</span><label class="switch"><input type="checkbox" bind:checked={config.email_asignaciones}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Correo general</span><label class="switch"><input type="checkbox" bind:checked={config.email_general}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Correo de recordatorios</span><label class="switch"><input type="checkbox" bind:checked={config.email_recordatorios}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Correo de conclusión</span><label class="switch"><input type="checkbox" bind:checked={config.email_conclusion}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Correo de foto</span><label class="switch"><input type="checkbox" bind:checked={config.email_foto}><span class="slider round"></span></label></div>
                                <div class="toggle-item"><span>Correo de emergencia</span><label class="switch"><input type="checkbox" bind:checked={config.email_emergencia}><span class="slider round"></span></label></div>
                            </div>
                        </div>

                        <div class="config-group mt-large">
                            <label class="group-label">Cliente de correo</label>
                            <div class="toggle-item description-toggle">
                                <div><span>Usar cliente de sistema</span><p>Outlook, Mail, Thunderbird...</p></div>
                                <label class="switch"><input type="checkbox" bind:checked={config.usar_cliente_sistema}><span class="slider round"></span></label>
                            </div>
                        </div>
                        
                        <div class="config-group">
                            <div class="toggle-item description-toggle">
                                <div><span>Cuerpo de correo vacío</span><p>No rellenar texto automáticamente.</p></div>
                                <label class="switch"><input type="checkbox" bind:checked={config.no_precompletar}><span class="slider round"></span></label>
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
                        <div class="ui-item"><label>Nombre completo</label><span>{usuario.nombre} {usuario.apellido}</span></div>
                        <div class="ui-item"><label>Correo electrónico</label><span>{usuario.email}</span></div>
                        <div class="ui-item"><label>Móvil</label><span>{usuario.movil}</span></div>
                        <div class="ui-item"><label>Correo electrónico JWPub</label><span>{usuario.emailJw}</span></div>
                        <div class="ui-item"><label>Número de identificación</label><span>{usuario.id}</span></div>
                        <div class="ui-item"><label>Fecha de creación</label><span>{usuario.fechaCreacion}</span></div>
                    </div>
                </div>

            {:else if configSeccion === 'correos'}
                <div class="empty-section">
                    <p>Configuración de plantillas de correo próximamente...</p>
                </div>

            {:else if configSeccion === 'cuenta'}
                <div class="empty-section">
                    <p>Ajustes de seguridad y cuenta próximamente...</p>
                </div>

            {:else if configSeccion === 'datos'}
                <div class="data-management-container">
                    <div class="data-card">
                        <div class="data-icon-wrapper blue"><Upload size={24} /></div>
                        <div class="data-content">
                            <h3>Respaldar Datos</h3>
                            <p>Crea una copia de seguridad de toda la base de datos (congregaciones, historial, asignaciones).</p>
                        </div>
                        <button class="btn-data-action primary" on:click={respaldarDatos}>Respaldar</button>
                    </div>

                    <div class="data-card">
                        <div class="data-icon-wrapper green"><Download size={24} /></div>
                        <div class="data-content">
                            <h3>Restaurar Datos</h3>
                            <p>Importa una copia de seguridad previamente guardada. <strong>Sobrescribirá los datos actuales.</strong></p>
                        </div>
                        <button class="btn-data-action secondary" on:click={restaurarDatos}>Restaurar</button>
                    </div>

                    <div class="data-card danger-zone">
                        <div class="data-icon-wrapper red"><Trash2 size={24} /></div>
                        <div class="data-content">
                            <h3>Limpiar Base de Datos</h3>
                            <p>Elimina permanentemente todos los registros y restablece la aplicación a su estado inicial.</p>
                        </div>
                        <button class="btn-data-action danger" on:click={limpiarBaseDatos}>Limpiar Todo</button>
                    </div>
                </div>

            {:else if configSeccion === 'ayuda'}
                <div class="help-center-container">
                    <div class="help-hero">
                        <CircleHelp size={48} color="#0078d4" />
                        <h2>Centro de Ayuda</h2>
                        <p>Selecciona un tema a la izquierda o busca en la documentación.</p>
                    </div>
                    <div class="help-placeholder">
                        <p>Contenido de ayuda en construcción...</p>
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
                <div class="modal-footer-user">
                    <button class="btn-cancel-user" on:click={() => mostrarModalUsuario = false}>Cancelar</button>
                    <button class="btn-save-user" on:click={guardarUsuario}>Guardar</button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
  /* Layout Global */
  .config-layout { display: grid; grid-template-columns: 260px 1fr; height: 100vh; background: white; color: #1e293b; font-family: 'Segoe UI', sans-serif; }
  
  /* Sidebar */
  .config-sidebar { background: #f8fafc; display: flex; flex-direction: column; border-right: 1px solid #e2e8f0; padding: 20px 0; }
  .config-header { padding: 0 20px 20px; border-bottom: 1px solid #e2e8f0; }
  .config-header h2 { margin: 15px 0 0; font-size: 1.2rem; color: #1e293b; }
  .btn-back-config { background: none; border: none; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 0; }
  .btn-back-config:hover { color: #1e293b; }
  
  .config-nav { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; gap: 5px; }
  .config-nav button { background: none; border: none; width: 100%; text-align: left; padding: 12px 16px; color: #64748b; font-size: 14px; font-weight: 500; cursor: pointer; border-radius: 8px; display: flex; align-items: center; gap: 12px; transition: all 0.2s; }
  .config-nav button:hover { background: #e2e8f0; color: #1e293b; }
  .config-nav button.active { background: #eff6ff; color: #0078d4; font-weight: 600; }
  
  .nav-divider { height: 1px; background: #e2e8f0; margin: 10px 16px; }
  .config-footer { padding: 20px; font-size: 11px; color: #94a3b8; text-align: center; }

  /* Content */
  .config-content { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: white; }
  .config-title-bar { padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; background: white; }
  .config-title-bar h1 { margin: 0; font-size: 24px; color: #1e293b; }
  .btn-save-config { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .btn-save-config:hover { background: #059669; }

  .config-scroll-area { flex: 1; overflow-y: auto; padding: 40px; }
  .config-grid { display: grid; grid-template-columns: 3fr 2fr; gap: 60px; max-width: 1100px; padding-bottom: 40px; }
  
  /* ESTILOS DE DATOS */
  .data-management-container { max-width: 800px; display: flex; flex-direction: column; gap: 20px; }
  .data-card { display: flex; align-items: center; gap: 20px; background: white; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; transition: box-shadow 0.2s; }
  .data-card:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-color: #cbd5e1; }
  .data-icon-wrapper { width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .data-icon-wrapper.blue { background: #eff6ff; color: #2563eb; }
  .data-icon-wrapper.green { background: #f0fdf4; color: #16a34a; }
  .data-icon-wrapper.red { background: #fef2f2; color: #dc2626; }
  
  .data-content { flex: 1; }
  .data-content h3 { margin: 0 0 5px 0; font-size: 16px; color: #1e293b; }
  .data-content p { margin: 0; font-size: 13px; color: #64748b; line-height: 1.4; }

  .btn-data-action { padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; border: none; white-space: nowrap; }
  .btn-data-action.primary { background: #0078d4; color: white; }
  .btn-data-action.primary:hover { background: #0060aa; }
  .btn-data-action.secondary { background: white; border: 1px solid #cbd5e1; color: #475569; }
  .btn-data-action.secondary:hover { background: #f8fafc; border-color: #94a3b8; }
  .btn-data-action.danger { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
  .btn-data-action.danger:hover { background: #fecaca; }
  .danger-zone { border-color: #fecaca; background: #fffbfb; }

  /* ESTILOS DE AYUDA */
  .help-center-container { max-width: 800px; text-align: center; margin-top: 40px; }
  .help-hero { margin-bottom: 40px; }
  .help-hero h2 { font-size: 24px; color: #1e293b; margin: 15px 0 5px 0; }
  .help-hero p { color: #64748b; }
  .help-placeholder { border: 2px dashed #e2e8f0; padding: 40px; border-radius: 12px; color: #94a3b8; }

  /* Grupos General */
  .config-group { margin-bottom: 30px; }
  .config-group label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 8px; }
  .config-group textarea { width: 100%; background: #f8fafc; border: 1px solid #cbd5e1; color: #1e293b; padding: 12px; border-radius: 8px; resize: vertical; font-family: inherit; box-sizing: border-box; }
  .config-group textarea:focus { border-color: #0078d4; outline: none; background: white; }
  .input-light { width: 100%; background: #f8fafc; border: 1px solid #cbd5e1; color: #1e293b; padding: 10px; border-radius: 8px; box-sizing: border-box; }

  /* Radio Box */
  .radio-group-box { background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
  .group-label { font-size: 15px !important; color: #1e293b !important; margin-bottom: 5px !important; }
  .help-text { font-size: 12px; color: #64748b; margin: 0 0 15px 0; }
  .radio-item { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 6px; cursor: pointer; color: #475569; transition: background 0.2s; }
  .radio-item:hover { background: #e2e8f0; }
  .radio-item input { accent-color: #10b981; width: 16px; height: 16px; }
  .active-radio { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }

  /* Toggles */
  .toggle-list { display: flex; flex-direction: column; gap: 15px; }
  .toggle-item { display: flex; justify-content: space-between; align-items: center; color: #475569; font-size: 14px; }
  .description-toggle { align-items: flex-start; }
  .description-toggle div { flex: 1; margin-right: 20px; }
  .description-toggle p { font-size: 12px; color: #94a3b8; margin: 4px 0 0 0; }
  .mt-large { margin-top: 40px; }

  .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .4s; border-radius: 34px; }
  .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  input:checked + .slider { background-color: #ea580c; } 
  input:checked + .slider:before { transform: translateX(20px); }

  /* Info Usuario */
  .user-info-section { grid-column: span 2; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; margin-top: 40px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
  .user-info-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; }
  .user-info-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: #1e293b; }
  .btn-edit-user { background: #ea580c; border: none; color: white; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; transition: background 0.2s; }
  .btn-edit-user:hover { background: #c2410c; }
  .user-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
  .ui-item { display: flex; flex-direction: column; gap: 5px; }
  .ui-item label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
  .ui-item span { font-size: 15px; color: #334155; font-weight: 500; }

  .empty-section { text-align: center; color: #64748b; padding-top: 50px; }

  /* Modal Usuario */
  .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }
  .modal-content-user { background: white; padding: 0; border-radius: 8px; width: 700px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); overflow: hidden; font-family: 'Segoe UI', sans-serif; }
  .modal-header-user { display: flex; justify-content: space-between; align-items: center; padding: 20px 25px; border-bottom: 1px solid #e5e7eb; }
  .modal-header-user h3 { margin: 0; font-size: 18px; font-weight: 700; color: #1f2937; }
  .btn-close { background: none; border: none; cursor: pointer; color: #6b7280; }
  .modal-body-user { padding: 25px; }
  .form-user-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .input-group { display: flex; flex-direction: column; gap: 6px; }
  .input-group label { font-size: 12px; color: #6b7280; font-weight: 500; }
  .input-group input { padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; outline: none; transition: border-color 0.2s; color: #1f2937; }
  .input-group input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); }
  .modal-footer-user { padding: 20px 25px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 12px; background: #f9fafb; }
  .btn-cancel-user { background: white; border: 1px solid #d1d5db; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 14px; color: #374151; cursor: pointer; }
  .btn-cancel-user:hover { background: #f3f4f6; }
  .btn-save-user { background: #ea580c; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; color: white; cursor: pointer; }
  .btn-save-user:hover { background: #c2410c; }
</style>