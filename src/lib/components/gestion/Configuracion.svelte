<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getVersion } from '@tauri-apps/api/app';
  import { onMount } from 'svelte';
  import Datos from '$lib/components/gestion/Datos.svelte';

  import ActualizacionApp from './ActualizacionApp.svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { cargarDatosGlobales } from '$lib/stores/appStore';

  import SincronizacionCarpeta from '$lib/components/gestion/SincronizacionCarpeta.svelte';
  
  // --- COMPONENTES HIJOS ---
  import PlantillasWhatsapp from './secciones/PlantillasWhatsapp.svelte';
  import PlantillasCorreos from './secciones/PlantillasCorreos.svelte';
  import SeccionAyuda from './secciones/SeccionAyuda.svelte';
  import PlantillasCartas from './secciones/PlantillasCartas.svelte';
 
  // --- ICONOS (Corregido: Agregados X, ChevronUp, ChevronDown) ---
  import { 
    DownloadCloud, ArrowLeft, Sliders, Mail, Shield, Database, CircleHelp, HelpCircle,
    ChevronUp, ChevronDown, X, Info, ShieldCheck, Activity, FileText, 
  } from 'lucide-svelte';

  import Panel from '$lib/components/ui/Panel.svelte';

  import MembreteConfig from '$lib/components/gestion/MembreteConfig.svelte';

  import { verificarActualizacion, irA_Descarga, type UpdateResult } from '$lib/services/updater';
  
  let buscandoUpdate = false;
  let updateInfo: UpdateResult | null = null;

  async function buscarActualizaciones() {
    buscandoUpdate = true;
    const resultado = await verificarActualizacion();
    updateInfo = resultado;
    buscandoUpdate = false;
    
    if (resultado.error) {
      alert(`❌ No se pudo buscar actualizaciones.\nMotivo: ${resultado.mensajeError}`);
      return;
    }
    if (!resultado.hayNueva) {
      alert("✅ ¡Estás al día! Tienes la última versión instalada.");
    }
  }

  const dispatch = createEventDispatcher();
  let configSeccion = 'general'; 
  
  // ESTADO: ¿Hay un editor abierto en pantalla completa en alguno de los hijos?
  let editorAbierto = false; 

  let versionReal = "";

  function cerrar() { dispatch('close'); }
  
  // Recibe el aviso del hijo (WhatsApp/Correo) para expandir la pantalla
  function manejarCambioModo(e: CustomEvent<boolean>) {
      editorAbierto = e.detail;
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
      try {
          versionReal = await getVersion();
      } catch (e) {
          console.error("Error al leer la versión:", e);
          versionReal = "Desconocida";
      }
  });
  
</script>

<div class="config-layout">
    <header class="config-top-header">
        <div class="config-top-title-area">
            <button class="btn-back-config" on:click={cerrar}><ArrowLeft size={18}/> Volver</button>
            <h2>Configuración</h2>
        </div>
        
        <nav class="config-tabs">
            <button class:active={configSeccion === 'general'} on:click={() => configSeccion = 'general'}>General</button>
            <button class:active={configSeccion === 'cartas'} on:click={() => configSeccion = 'cartas'}>Plantillas de cartas</button>
            <button class:active={configSeccion === 'correos'} on:click={() => configSeccion = 'correos'}>Plantillas de correo</button>
            <button class:active={configSeccion === 'whatsapp'} on:click={() => configSeccion = 'whatsapp'}>Plantillas de WhatsApp</button>
            <button class:active={configSeccion === 'datos'} on:click={() => configSeccion = 'datos'}>Datos</button>
            <button class:active={configSeccion === 'ayuda'} on:click={() => configSeccion = 'ayuda'}>Ayuda</button>
            <button class:active={configSeccion === 'actualizaciones'} on:click={() => configSeccion = 'actualizaciones'}>Acerca de</button>
        </nav>
    </header>

    <main class="config-content">
        <div class="config-scroll-area">
            
            {#if configSeccion === 'general'}

              {#if !editorAbierto}
                    <Panel padding="25px" clasesExtra="user-info-section-override">
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
                    </Panel>
                {/if}
                
                <MembreteConfig />

            {:else if configSeccion === 'whatsapp'}
                <div class="config-grid" class:full-width={editorAbierto}>
                    <div class="col-main">
                        <PlantillasWhatsapp on:cambioModo={manejarCambioModo} />
                    </div>                  
                </div>

            {:else if configSeccion === 'cartas'}
                <PlantillasCartas on:cambioModo={manejarCambioModo} />
                  
            {:else if configSeccion === 'correos'}
                <PlantillasCorreos on:cambioModo={manejarCambioModo}/>
            
            {:else if configSeccion === 'datos'}
                <div style="display: flex; flex-direction: column; gap: 30px; padding-bottom: 20px;">
                    <SincronizacionCarpeta />
                    <Datos />
                </div>

            {:else if configSeccion === 'ayuda'} 
              <SeccionAyuda />
            {:else if configSeccion === 'actualizaciones'}
              <ActualizacionApp />
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
/* ==========================================================================
   LAYOUT PRINCIPAL (AHORA VERTICAL)
   ========================================================================== */
.config-layout { 
    display: flex; 
    flex-direction: column; 
    height: 100vh; 
    background: var(--bg-body); 
    color: var(--text-main); 
    font-family: 'Segoe UI', sans-serif; 
}

/* === NUEVA CABECERA SUPERIOR (PESTAÑAS) === */
.config-top-header {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding-top: 20px;
    flex-shrink: 0;
}

.config-top-title-area {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 0 40px 15px 40px;
}

.config-top-title-area h2 {
    margin: 0;
    font-size: 22px;
    color: var(--text-main);
    font-weight: 700;
}

/* BOTÓN VOLVER */
.btn-back-config { 
    display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 6px; 
    background: transparent; border: 1px solid var(--border); color: var(--text-secondary); 
    font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; 
}
.btn-back-config:hover { 
    background: var(--hover-bg); color: var(--text-main); border-color: var(--text-secondary);
}

/* === PESTAÑAS HORIZONTALES ESTILO IMAGEN === */
.config-tabs { 
    display: flex; 
    gap: 32px; 
    padding: 0 40px; 
    overflow-x: auto; 
    scrollbar-width: none; /* Oculta scrollbar en Firefox */
}
.config-tabs::-webkit-scrollbar { display: none; } /* Oculta scrollbar Chrome/Safari */

.config-tabs button { 
    background: transparent; 
    border: none; 
    padding: 12px 0; 
    color: var(--text-secondary); 
    font-size: 14.5px; 
    font-weight: 500; 
    cursor: pointer; 
    border-bottom: 2.5px solid transparent; /* La línea invisible abajo */
    transition: all 0.2s; 
    white-space: nowrap; 
}
.config-tabs button:hover { 
    color: var(--text-main); 
}
.config-tabs button.active { 
    /* El color de la línea activa. Usa el rosa de tu imagen (#c2185b) o tu azul (var(--primary)) */
    color: #c2185b; 
    border-bottom-color: #c2185b; 
    font-weight: 600; 
}

/* === CONTENIDO PRINCIPAL === */
.config-content { display: flex; flex-direction: column; flex: 1; overflow: hidden; background: var(--bg-body); }
.config-title-bar { padding: 25px 40px; display: flex; justify-content: space-between; align-items: center; }
.config-title-bar h1 { margin: 0; font-size: 24px; color: var(--text-main); font-weight: 700; }

.btn-save-config { background: var(--primary); color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: transform 0.2s; }
.btn-save-config:hover { opacity: 0.9; transform: translateY(-1px); }

.config-scroll-area { flex: 1; overflow-y: auto; padding: 0 40px 40px 40px; }
.config-grid { display: grid; grid-template-columns: minmax(0, 60%) minmax(0, 40%); gap: 60px; max-width: 1200px; transition: all 0.3s ease; }
.config-grid.full-width { grid-template-columns: 1fr; gap: 0; max-width: 100%; }


/* INPUTS Y RADIO BUTTONS (General) */
:global(.config-group) { margin-bottom: 30px; }
.group-label { display: block; font-size: 13px; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }

.input-light { width: 100%; background: var(--input-bg); border: 1px solid var(--border); color: var(--text-main); padding: 10px; border-radius: 8px; outline: none; transition: all 0.2s; }
.input-light:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

.radio-item { display: flex; align-items: center; gap: 10px; padding: 12px 15px; border-radius: 8px; cursor: pointer; color: var(--text-main); border: 1px solid transparent; transition: all 0.2s; }
.radio-item:hover { background: var(--hover-bg); border-color: var(--border); }
.radio-item input[type="radio"] { accent-color: var(--primary); width: 16px; height: 16px; }

.active-radio { background: rgba(59, 130, 246, 0.08); border: 1px solid var(--primary); color: var(--primary); font-weight: 600; }
.active-radio:hover { background: rgba(59, 130, 246, 0.12); border-color: var(--primary); }

/* === USER INFO SECTION === */
:global(.user-info-section-override) { margin-top: 40px; margin-bottom: 40px; }
.user-info-header { display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; }
.user-info-header h3 { margin: 0; font-size: 18px; color: var(--text-main); font-weight: 700; }
.btn-edit-user { background: transparent; border: 1px solid var(--border); color: var(--text-main); padding: 8px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.2s; }
.btn-edit-user:hover { background: var(--hover-bg); border-color: var(--primary); color: var(--primary); }

.user-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
.ui-item { display: flex; flex-direction: column; gap: 4px; }
.ui-item label { font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.ui-item span { font-size: 14px; color: var(--text-main); font-weight: 500; }

/* === MODAL DE EDICIÓN DE USUARIO === */
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 2000; padding: 20px; box-sizing: border-box; }
.modal-content-user { background: var(--bg-card); border-radius: 12px; width: 800px; max-width: 100%; box-shadow: var(--shadow-premium); overflow: hidden; border: 1px solid var(--border); display: flex; flex-direction: column; max-height: 90vh; }
.modal-header-user { display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; border-bottom: 1px solid var(--border); background: var(--bg-secondary); }
.modal-header-user h3 { margin: 0; font-size: 18px; font-weight: 700; color: var(--text-main); }
.btn-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); transition: color 0.2s; }
.btn-close:hover { color: #ef4444; }

.modal-body-user { padding: 30px; overflow-y: auto; background: var(--bg-body); }
.form-user-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 30px; }
.input-group { display: flex; flex-direction: column; gap: 6px; }
.input-group label { font-size: 12px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; }
.input-group input { padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; width: 100%; box-sizing: border-box; background: var(--input-bg); font-size: 14px; color: var(--text-main); transition: all 0.2s; }
.input-group input:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

.modal-footer-user { padding: 20px 30px; display: flex; justify-content: flex-end; gap: 15px; background: var(--bg-card); border-top: 1px solid var(--border); }
.btn-cancel-user { background: transparent; border: 1px solid var(--border); padding: 10px 20px; border-radius: 6px; cursor: pointer; color: var(--text-main); font-weight: 600; transition: all 0.2s; }
.btn-cancel-user:hover { background: var(--hover-bg); }
.btn-save-user { background: var(--primary); border: none; padding: 10px 24px; border-radius: 6px; color: white; cursor: pointer; font-weight: 600; transition: transform 0.2s; }
.btn-save-user:hover { opacity: 0.9; transform: translateY(-1px); }

/* =========================================================
   DISEÑO RESPONSIVO (CONFIGURACIÓN: WINDOWS + ANDROID)
   ========================================================= */

@media (max-width: 768px) {
    /* 1 y 2. CABECERA SUPERIOR Y PESTAÑAS EN MÓVIL */
    .config-top-title-area { padding: 0 20px 10px 20px; }
    .config-tabs { padding: 0 20px; gap: 24px; }
    
    /* 3. ÁREA DE CONTENIDO PRINCIPAL */
    .config-title-bar {
        padding: 20px;
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
    }
    .config-title-bar h1 { font-size: 20px; }
    .config-actions { width: 100%; }
    .btn-save-config { width: 100%; min-height: 48px; }
    .config-scroll-area { padding: 0 20px 20px 20px; }

    /* 4. FORMULARIOS A 1 SOLA COLUMNA */
    .config-grid {
        grid-template-columns: 1fr;
        gap: 20px;
    }

    .user-info-grid {
        grid-template-columns: 1fr; /* Todo hacia abajo */
        gap: 15px;
    }

    .user-info-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
    }
    
    .btn-edit-user { width: 100%; min-height: 48px; }

    /* 5. MODAL DE EDITAR USUARIO (Antidesbordes) */
    .modal-content-user {
        width: 95vw !important;
        max-height: 90vh;
    }

    .modal-header-user, .modal-body-user, .modal-footer-user {
        padding: 15px;
    }

    .form-user-grid {
        grid-template-columns: 1fr; /* Los inputs uno debajo del otro */
        gap: 15px;
    }

    .modal-footer-user {
        flex-direction: column-reverse; /* Botón de guardar arriba, cancelar abajo */
        gap: 10px;
    }

    .btn-save-user, .btn-cancel-user {
        width: 100%;
        min-height: 48px;
    }
} /* <--- Esta es la llave que faltaba poner hasta acá abajo */

</style>