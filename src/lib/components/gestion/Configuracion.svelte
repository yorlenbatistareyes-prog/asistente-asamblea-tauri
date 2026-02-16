<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { guiaUsuario } from '$lib/data/ayuda';
  import { getVersion } from '@tauri-apps/api/app';
  import { onMount } from 'svelte';
  import Datos from '$lib/components/gestion/Datos.svelte';

  import { invoke } from '@tauri-apps/api/core';
  import { cargarDatosGlobales } from '$lib/stores/appStore';
  
  // --- COMPONENTES HIJOS ---
  import PlantillasWhatsapp from './secciones/PlantillasWhatsapp.svelte';
  import PlantillasCorreos from './secciones/PlantillasCorreos.svelte';

  // --- ICONOS (Corregido: Agregados X, ChevronUp, ChevronDown) ---
  import { 
    ArrowLeft, Sliders, Mail, Shield, Database, CircleHelp, HelpCircle,
    ChevronUp, ChevronDown, X, Info, ShieldCheck, Activity 
} from 'lucide-svelte';

  import MembreteConfig from '$lib/components/gestion/MembreteConfig.svelte';

  const dispatch = createEventDispatcher();
  let configSeccion = 'general'; 
  
  // ESTADO: ¿Hay un editor abierto en pantalla completa en alguno de los hijos?
  let editorAbierto = false; 

  let versionReal = "Cargando...";

  function cerrar() { dispatch('close'); }
  
  // Recibe el aviso del hijo (WhatsApp/Correo) para expandir la pantalla
  function manejarCambioModo(e: CustomEvent<boolean>) {
      editorAbierto = e.detail;
  }

  // Ayuda y Datos Dummy
  let ayudaItems = guiaUsuario.map(item => ({ ...item, isOpen: false }));
  function toggleAyuda(index: number) { 
      if (ayudaItems[index]) { 
          ayudaItems[index].isOpen = !ayudaItems[index].isOpen; 
          ayudaItems = [...ayudaItems]; 
      } 
  }

  let config = { 
    accionPdf: "abrir", 
    idioma: "es", 
    email_oradores: true, 
    email_presidente: true, 
    email_oraciones: true, 
    email_oficina: true, 
    email_comite: true, 
    email_audio_video: true, 
    email_emergencia: false, 
    usar_cliente_sistema: false, 
    no_precompletar: false 
  };

  let usuario = { nombre: "Yorlen", segundoNombre: "", apellido: "Batista Reyes", sufijo: "", email: "yorlenbatistareyes@gmail.com", emailJw: "batistareyyorlen7@jwpub.org", movil: "54891111", id: "7164622", fechaCreacion: "4/11/2025" };
  
  let mostrarModalUsuario = false;
  let usuarioEditando = { ...usuario }; 
  
  
  function guardarCambiosConfig() { alert("Configuración guardada"); }
  function abrirModalUsuario() { usuarioEditando = { ...usuario }; mostrarModalUsuario = true; }
  
  async function guardarUsuario() {
  try {
    // Obtener la configuración actual para conservar tema e idioma
    const configActual = await invoke('obtener_configuracion_general') as any;

    // Construir el objeto con todos los campos del formulario
    const datosConfig = {
      nombre: usuarioEditando.nombre || null,
      segundo_nombre: usuarioEditando.segundoNombre || null,
      apellido: usuarioEditando.apellido || null,
      sufijo: usuarioEditando.sufijo || null,
      email: usuarioEditando.email || null,
      email_jwpub: usuarioEditando.emailJw || null,
      movil: usuarioEditando.movil || null,
      identificador: usuarioEditando.id || null,
      fecha_creacion: usuarioEditando.fechaCreacion || null,
      tema: configActual.tema,
      idioma: configActual.idioma,
    };

    // Guardar en la base de datos usando el comando Rust
    await invoke('guardar_configuracion_general', { config: datosConfig });

    // Actualizar la variable local del usuario
    usuario = { ...usuarioEditando };
    mostrarModalUsuario = false;

    // Actualizar el store global para que la barra de estado refleje el cambio
    await cargarDatosGlobales();

  } catch (e) {
    alert('Error al guardar usuario: ' + e);
  }
}

  onMount(async () => {
    versionReal = await getVersion();
  });
  
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

        <div class="config-footer">
            <div class="sidebar-about-card">
                <div class="about-header">
                    <Info size={16} color="#0f172a" strokeWidth={2.5} /> 
                    <span>Información del Software</span>
                </div>
                
                <div class="about-row">
                    <span class="about-label">Versión:</span>
                    <span class="about-value">v{versionReal}</span>
                </div>
                
                <div class="about-row">
                    <span class="about-label">Tecnología:</span>
                    <span class="about-value tech-tag">Rust + Tauri</span>
                </div>

                <div class="nav-divider-mini"></div>
                
                <p class="about-disclaimer">
                    Construido y diseñado para Presidentes de Asambleas Regionales
                </p>
            </div>
        </div>
    </aside>

    <main class="config-content">
        <div class="config-title-bar">
            <h1>
                {#if configSeccion === 'general'} Configuraciones generales 
                {:else if configSeccion === 'correos'} Plantillas de correo electrónico 
                {:else if configSeccion === 'cuenta'} Cuenta y Seguridad 
                {:else if configSeccion === 'datos'} Gestión de Datos 
                {:else if configSeccion === 'ayuda'} Centro de Ayuda {/if}
            </h1>
            {#if configSeccion === 'general' && !editorAbierto}
                <div class="config-actions"><button class="btn-save-config" on:click={guardarCambiosConfig}>Guardar Cambios</button></div>
            {/if}
        </div>

        <div class="config-scroll-area">
            
            {#if configSeccion === 'general'}
                <div class="config-grid" class:full-width={editorAbierto}>
                    <div class="col-main">
                        <PlantillasWhatsapp on:cambioModo={manejarCambioModo} />
                        
                        {#if !editorAbierto}
                            <div class="config-group radio-group-box">
                                <label class="group-label">Configuraciones de PDF</label>
                                <label class="radio-item" class:active-radio={config.accionPdf === 'nada'}><input type="radio" name="pdf" value="nada" bind:group={config.accionPdf}> <span>Sin acción</span></label>
                                <label class="radio-item" class:active-radio={config.accionPdf === 'carpeta'}><input type="radio" name="pdf" value="carpeta" bind:group={config.accionPdf}> <span>Mostrar en Explorer</span></label>
                                <label class="radio-item active-radio" class:active-radio={config.accionPdf === 'abrir'}><input type="radio" name="pdf" value="abrir" bind:group={config.accionPdf}> <span>Abrir predeterminado</span></label>
                            </div>
                            <div class="config-group"><label>Idioma</label><select bind:value={config.idioma} class="input-light"><option value="es">Español</option><option value="en">English</option></select></div>
                        {/if}
                    </div>
                    
                    {#if !editorAbierto}
                        <div class="col-side">
                            <div class="config-group">
                                <label class="group-label">Opciones de Correo</label>
                                <div class="toggle-list">
                                    <div class="toggle-item"><span>Correo a oradores</span><label class="switch"><input type="checkbox" bind:checked={config.email_oradores}><span class="slider round"></span></label></div>
            
                                    <div class="toggle-item"><span>Correo a presidentes de sesión</span><label class="switch"><input type="checkbox" bind:checked={config.email_presidente}><span class="slider round"></span></label></div>
            
                                    <div class="toggle-item"><span>Correo a oraciones</span><label class="switch"><input type="checkbox" bind:checked={config.email_oraciones}><span class="slider round"></span></label></div>
            
                                    <div class="toggle-item"><span>Correo a personal de oficina</span><label class="switch"><input type="checkbox" bind:checked={config.email_oficina}><span class="slider round"></span></label></div>
            
                                    <div class="toggle-item"><span>Correo al comité de asamblea</span><label class="switch"><input type="checkbox" bind:checked={config.email_comite}><span class="slider round"></span></label></div>
            
                                    <div class="toggle-item"><span>Correo a audio y video</span><label class="switch"><input type="checkbox" bind:checked={config.email_audio_video}><span class="slider round"></span></label></div>
            
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
                    {/if}
                </div>

                {#if !editorAbierto}
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
                {/if}

                <MembreteConfig />

            {:else if configSeccion === 'correos'}
                <PlantillasCorreos on:cambioModo={manejarCambioModo}/>
            
            {:else if configSeccion === 'datos'}
                <Datos />

            {:else if configSeccion === 'ayuda'}
                <div class="help-container">
                    <div class="accordion-list">
                        {#each ayudaItems as item, i}
                            <div class="accordion-item">
                                <button class="accordion-header" on:click={() => toggleAyuda(i)}>
                                    <div class="acc-title"><CircleHelp size={16}/> {item.title}</div>
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
/* VARIABLES */
.config-layout { display: grid; grid-template-columns: 260px 1fr; height: 100vh; background: var(--bg-body); color: var(--text-main); font-family: 'Segoe UI', sans-serif; }

/* Sidebar y Header */
.config-sidebar { background: var(--bg-secondary); border-right: 1px solid var(--border-color); padding: 20px 0; display: flex; flex-direction: column; height: 100vh;}
.config-header { padding: 0 20px 20px; border-bottom: 1px solid var(--border-color); }
.config-header h2 { margin: 15px 0 0; font-size: 1.2rem; }
.btn-back-config { background: none; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; }

.config-nav { padding: 20px 10px; display: flex; flex-direction: column; gap: 5px; }
.config-nav button { background: none; border: none; width: 100%; text-align: left; padding: 12px 16px; color: var(--text-secondary); font-size: 14px; font-weight: 500; cursor: pointer; border-radius: 8px; display: flex; align-items: center; gap: 12px; }
.config-nav button:hover { background: var(--hover-bg); color: var(--text-main); }
.config-nav button.active { background: var(--primary); color: white; font-weight: 600; }
.config-footer {
    padding: 20px 15px;
    margin-top: auto; /* Esto lo empuja al fondo del aside */
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* Content */
.config-content { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: var(--bg-body); }
.config-title-bar { padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); background: var(--bg-card); }
.config-title-bar h1 { margin: 0; font-size: 24px; color: var(--text-main); font-weight: 700; }
.btn-save-config { background: #10b981; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; }

.config-scroll-area { flex: 1; overflow-y: auto; padding: 40px; }
.config-grid { 
    display: grid; 
    /* Esta es la línea mágica que evita que se empuje todo a la derecha */
    grid-template-columns: minmax(0, 60%) minmax(0, 40%); 
    gap: 60px; 
    max-width: 1200px; 
    transition: all 0.3s ease; 
}
.config-grid.full-width { grid-template-columns: 1fr; gap: 0; max-width: 100%; }

/* Inputs Generales */
.config-group { margin-bottom: 30px; }
.group-label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
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

/* User Info */
.user-info-section { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 25px; margin-top: 40px; margin-bottom: 40px; box-shadow: 0 2px 5px var(--shadow-color); }
.user-info-header { display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; }
.user-info-header h3 { margin: 0; font-size: 20px; color: var(--text-main); font-weight: 700; }
.btn-edit-user { background: #ea580c; color: white; border: none; padding: 8px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; }
.user-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
.ui-item { display: flex; flex-direction: column; gap: 4px; }
.ui-item label { font-size: 12px; color: var(--text-secondary); text-transform: lowercase; }
.ui-item label::first-letter { text-transform: uppercase; }
.ui-item span { font-size: 15px; color: var(--text-main); font-weight: 400; }

/* Modal, Datos & Ayuda */
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

/* Acordeones (Ayuda) */
.help-container { max-width: 1000px; margin: 0 auto; }
.help-text-content { color: var(--text-main); font-size: 14px; line-height: 1.6; }
.accordion-list { border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
.accordion-item { border-bottom: 1px solid var(--border-color); background: var(--bg-card); }
.accordion-header { width: 100%; display: flex; justify-content: space-between; padding: 12px 15px; background: var(--bg-card); border: none; cursor: pointer; color: var(--text-main); }
.acc-title { display: flex; align-items: center; gap: 10px; }
.accordion-body { padding: 15px; background: var(--bg-body); border-top: 1px solid var(--border-color); }
.toggle-list {
    display: flex;
    flex-direction: column;
    gap: 12px; /* Un poco más de espacio entre interruptores */
    max-height: 400px; /* Por si la lista crece mucho, permite hacer scroll */
    overflow-y: auto;
    padding-right: 5px;
}


.about-header {
    display: flex;
    align-items: center;
    gap: 8px;
    /* Cambiamos a un color más oscuro y sólido */
    color: #475569; 
    font-size: 11px;
    margin-bottom: 15px;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 800; /* Más negrita para que resalte */
}

.about-header span {
    color: #1e293b; /* Casi negro para máxima legibilidad */
}


.about-label {
    color: #64748b;
}

.about-value {
    color: #f8fafc;
    font-weight: 600;
}


.about-disclaimer {
    font-size: 10px;
    line-height: 1.4; /* Un poco más de espacio entre líneas */
    color: rgba(255, 255, 255, 0.5); /* Subimos la opacidad para que sea legible en Cuba */
    text-align: center;
    margin-top: 8px;
}



.config-footer {
    margin-top: auto; /* Empuja todo al final del lateral */
    padding: 15px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}
.sidebar-about-card {
    background: rgba(0, 0, 0, 0.06); 
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 12px;
    padding: 18px;
    margin: 20px 15px;
}

.about-header {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #94a3b8;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
}

.about-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-bottom: 4px;
}

.about-label { 
    color: #64748b; /* Gris oscuro para las etiquetas */
}

.about-value { 
    color: #1e293b; /* Azul casi negro para que resalte la versión */
    font-weight: 600; 
}

.tech-tag { 
    color: #059669; /* Un verde esmeralda más serio y legible */
    font-weight: 700;
}/* El verde que te gusta */

.nav-divider-mini {
    height: 1px;
    background: rgba(255, 255, 255, 0.05);
    margin: 10px 0;
}

.about-disclaimer {
    margin-top: 12px;
    font-size: 11px; /* Un poco más grande para facilitar la lectura */
    line-height: 1.4;
    color: #64748b; 
    text-align: center;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    padding-top: 10px;
}
</style>