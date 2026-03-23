<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getVersion } from '@tauri-apps/api/app';
  import { onMount } from 'svelte';
  import Datos from '$lib/components/gestion/Datos.svelte';

  import { invoke } from '@tauri-apps/api/core';
  import { cargarDatosGlobales } from '$lib/stores/appStore';
  
  // --- COMPONENTES HIJOS ---
  import PlantillasWhatsapp from './secciones/PlantillasWhatsapp.svelte';
  import PlantillasCorreos from './secciones/PlantillasCorreos.svelte';
  import SeccionAyuda from './secciones/SeccionAyuda.svelte';
  import PlantillasCartas from './secciones/PlantillasCartas.svelte';
 
  // --- ICONOS (Corregido: Agregados X, ChevronUp, ChevronDown) ---
  import { 
    ArrowLeft, Sliders, Mail, Shield, Database, CircleHelp, HelpCircle,
    ChevronUp, ChevronDown, X, Info, ShieldCheck, Activity, FileText,
    FolderSync, FolderX, Trash2 // 👈 NUEVOS ICONOS
  } from 'lucide-svelte';

  // 👈 NUEVAS HERRAMIENTAS DE SINCRONIZACIÓN (TAURI FS y DIALOG)
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { readFile, writeFile, remove, stat, BaseDirectory } from '@tauri-apps/plugin-fs';

  import Panel from '$lib/components/ui/Panel.svelte';

  import MembreteConfig from '$lib/components/gestion/MembreteConfig.svelte';

  const dispatch = createEventDispatcher();
  let configSeccion = 'general'; 
  
  // ESTADO: ¿Hay un editor abierto en pantalla completa en alguno de los hijos?
  let editorAbierto = false; 

  let versionReal = "";

  function cerrar() { dispatch('close'); }
  
  // 👈 ACTUALIZA A RUST EN TIEMPO REAL SI EL USUARIO CAMBIA ALGO
  $: if (typeof window !== 'undefined') {
      invoke('actualizar_config_sync', { 
          auto_export: autoExportar, 
          sync_path: rutaSincronizacion 
      }).catch(e => console.error("Error notificando a Rust:", e));
  }
  
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

// ==========================================
  // LÓGICA DE SINCRONIZACIÓN (NUBE/USB EN RAM)
  // ==========================================
  const DB_NAME = 'asamblea_db_v7.sqlite';
  const BACKUP_NAME = 'rassembly_sync_backup.db';

  let rutaSincronizacion = typeof localStorage !== 'undefined' ? localStorage.getItem('assembly_sync_path') || '' : '';
  let autoExportar = typeof localStorage !== 'undefined' ? localStorage.getItem('assembly_auto_export') === 'true' : false;
  let ultimaExportacion = typeof localStorage !== 'undefined' ? localStorage.getItem('assembly_last_export') || 'Desconocido' : 'Desconocido';
  let ultimaImportacion = typeof localStorage !== 'undefined' ? localStorage.getItem('assembly_last_import') || 'Desconocido' : 'Desconocido';

  let fechaArchivoSync = "Buscando...";
  let tamanoArchivoSync = "0 KB";

  function obtenerFechaActual() { return new Date().toLocaleString(); }

  function obtenerRutaArchivoSync() {
      const separador = rutaSincronizacion.includes('\\') ? '\\' : '/';
      const barra = rutaSincronizacion.endsWith(separador) ? '' : separador;
      return `${rutaSincronizacion}${barra}${BACKUP_NAME}`;
  }

  async function revisarArchivoSync() {
      if (!rutaSincronizacion || rutaSincronizacion.trim() === "") {
          fechaArchivoSync = "No hay carpeta vinculada";
          tamanoArchivoSync = "-";
          return;
      }
      try {
          const rutaFinal = obtenerRutaArchivoSync();
          const metadata = await stat(rutaFinal);
          if (metadata.mtime) {
              fechaArchivoSync = new Date(metadata.mtime).toLocaleString();
          }
          const kb = (metadata.size / 1024).toFixed(1);
          tamanoArchivoSync = `${kb} KB`;
      } catch (error) {
          fechaArchivoSync = "No hay archivo en la carpeta";
          tamanoArchivoSync = "0 KB";
      }
  }

  async function elegirCarpetaSync() {
      try {
          const carpeta = await openDialog({ directory: true, multiple: false });
          if (!carpeta) return;
          rutaSincronizacion = carpeta as string;
          localStorage.setItem('assembly_sync_path', rutaSincronizacion);
          await revisarArchivoSync();
          alert("✅ Carpeta de sincronización vinculada.");
      } catch (error) {
          alert("❌ Ocurrió un error al abrir el explorador.");
      }
  }

  async function exportarSync() {
      if (!rutaSincronizacion) return;
      try {
          // 1. Leemos los bytes de RAssembly usando AppData
          const dbBytes = await readFile(DB_NAME, { baseDir: BaseDirectory.AppData });
          // 2. Escribimos en la ruta externa elegida
          const rutaFinal = obtenerRutaArchivoSync();
          await writeFile(rutaFinal, dbBytes);

          ultimaExportacion = obtenerFechaActual();
          localStorage.setItem('assembly_last_export', ultimaExportacion);
          await revisarArchivoSync();
          alert("✅ Datos exportados correctamente a la carpeta de sincronización.");
      } catch (error) {
          console.error(error);
          alert("❌ Error al exportar. Comprueba que la carpeta sigue existiendo y tienes permisos.");
      }
  }

  async function importarSync() {
      if (!rutaSincronizacion) return;
      if (!confirm("⚠️ ATENCIÓN: Esto SOBRESCRIBIRÁ tu base de datos actual en esta PC. ¿Deseas continuar?")) return;
      try {
          const rutaFinal = obtenerRutaArchivoSync();
          const backupBytes = await readFile(rutaFinal);

          await writeFile(DB_NAME, backupBytes, { baseDir: BaseDirectory.AppData });

          ultimaImportacion = obtenerFechaActual();
          localStorage.setItem('assembly_last_import', ultimaImportacion);
          await revisarArchivoSync();
          
          alert("✅ Datos sincronizados con éxito. La aplicación se reiniciará.");
          window.location.reload();
      } catch (error) {
          alert("❌ Error al importar. ¿Estás seguro de que existe el archivo en la nube?");
      }
  }

  async function restablecerCarpeta() {
      if (confirm("¿Seguro que deseas desvincular la carpeta?")) {
          rutaSincronizacion = "";
          autoExportar = false;
          localStorage.removeItem('assembly_sync_path');
          localStorage.setItem('assembly_auto_export', 'false');
          await revisarArchivoSync();
      }
  }

  async function limpiarCarpetaSync() {
      if (confirm("⚠️ ¿Deseas borrar el archivo de copia de tu nube/USB?")) {
          try {
              const rutaFinal = obtenerRutaArchivoSync();
              await remove(rutaFinal);
              ultimaExportacion = "Desconocido";
              ultimaImportacion = "Desconocido";
              localStorage.setItem('assembly_last_export', "Desconocido");
              localStorage.setItem('assembly_last_import', "Desconocido");
              await revisarArchivoSync();
              alert("✅ Archivo eliminado de la nube.");
          } catch (error) {
              alert("❌ No se pudo borrar el archivo. Puede que esté bloqueado.");
          }
      }
  }

  function toggleAutoExportar(e: Event) {
      autoExportar = (e.target as HTMLInputElement).checked;
      localStorage.setItem('assembly_auto_export', autoExportar ? 'true' : 'false');
  }

 onMount(async () => {
      try {
          versionReal = await getVersion();
      } catch (e) {
          console.error("Error al leer la versión:", e);
          versionReal = "Desconocida";
      }
      await revisarArchivoSync(); // 👈 NUEVA LÍNEA
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
            <button class:active={configSeccion === 'cartas'} on:click={() => configSeccion = 'cartas'}><FileText size={18}/> Plantillas de cartas</button>
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
                    <span class="about-value">
                        v{#if versionReal}{versionReal}{:else}...{/if}
                    </span>
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
                            <Panel padding="20px" clasesExtra="config-group">
                                <label class="group-label">Configuraciones de PDF</label>
                                <label class="radio-item" class:active-radio={config.accionPdf === 'nada'}><input type="radio" name="pdf" value="nada" bind:group={config.accionPdf}> <span>Sin acción</span></label>
                                <label class="radio-item" class:active-radio={config.accionPdf === 'carpeta'}><input type="radio" name="pdf" value="carpeta" bind:group={config.accionPdf}> <span>Mostrar en Explorer</span></label>
                                <label class="radio-item active-radio" class:active-radio={config.accionPdf === 'abrir'}><input type="radio" name="pdf" value="abrir" bind:group={config.accionPdf}> <span>Abrir predeterminado</span></label>
                            </Panel>
                            <div class="config-group"><label>Idioma</label><select bind:value={config.idioma} class="input-light"><option value="es">Español</option><option value="en">English</option></select></div>
                        {/if}
                    </div>                   
                </div>

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

            {:else if configSeccion === 'cartas'}
                <PlantillasCartas on:cambioModo={manejarCambioModo} />
                  
            {:else if configSeccion === 'correos'}
                <PlantillasCorreos on:cambioModo={manejarCambioModo}/>
            
            {:else if configSeccion === 'datos'}
                <div style="display: flex; flex-direction: column; gap: 30px; padding-bottom: 20px;">
                    <Datos />

                    <Panel padding="30px" clasesExtra="panel-sincronizacion">
                        <div class="sync-header">
                            <div class="sync-icon-box">
                                <FolderSync size={24} strokeWidth={2} />
                            </div>
                            <div class="sync-title">
                                <h3>Carpeta de Sincronización</h3>
                                <p>Elige una carpeta en la nube (Google Drive, OneDrive, etc.) para compartir datos entre tus dispositivos.</p>
                            </div>
                        </div>

                        <div class="sync-info-box">
                            <div class="sync-grid-info">
                                <span class="label">Carpeta actual:</span>
                                <div>
                                    {#if rutaSincronizacion}
                                        <span class="path-badge">{rutaSincronizacion}</span>
                                    {:else}
                                        <span class="path-badge" style="color: var(--text-secondary); background: var(--bg-body); border-color: var(--border);">Ninguna configurada</span>
                                    {/if}
                                </div>

                                <span class="label">Última exportación local:</span>
                                <span class="value">{ultimaExportacion}</span>

                                <span class="label">Última importación local:</span>
                                <span class="value">{ultimaImportacion}</span>
                            </div>
                        </div>

                        {#if rutaSincronizacion}
                            <div class="sync-status-box">
                                <h4>ESTADO DEL ARCHIVO DE SINCRONIZACIÓN</h4>
                                <p>Lectura en tiempo real del archivo físico en tu carpeta vinculada. Si la fecha detectada aquí es más reciente que tu memoria local, significa que tienes datos nuevos listos para importar.</p>
                                
                                <div class="sync-grid-info mt-15">
                                    <span class="label">Última modificación detectada:</span>
                                    <strong class="value-dark">{fechaArchivoSync}</strong>

                                    <span class="label">Peso del archivo:</span>
                                    <strong class="value-dark">{tamanoArchivoSync}</strong>
                                </div>
                            </div>
                        {/if}

                        <div class="sync-main-actions">
                            <button class="btn-sync-primary" on:click={elegirCarpetaSync}>Elegir carpeta sincronizada</button>
                            <button class="btn-sync-secondary" on:click={exportarSync} disabled={!rutaSincronizacion}>Exportar sincronización</button>
                            <button class="btn-sync-secondary" on:click={importarSync} disabled={!rutaSincronizacion}>Importar sincronización</button>
                        </div>

                        <label class="sync-checkbox" style={!rutaSincronizacion ? 'opacity: 0.5; cursor: not-allowed;' : ''}>
                            <input type="checkbox" bind:checked={autoExportar} on:change={toggleAutoExportar} disabled={!rutaSincronizacion} />
                            <span>Exportar cambios automáticamente al cerrar</span>
                        </label>

                        {#if rutaSincronizacion}
                            <div class="sync-danger-actions">
                                <button class="btn-sync-warning" on:click={restablecerCarpeta}>
                                    <FolderX size={16} /> Restablecer carpeta
                                </button>
                                <button class="btn-sync-danger" on:click={limpiarCarpetaSync}>
                                    <Trash2 size={16} /> Limpiar carpeta
                                </button>
                            </div>
                        {/if}
                    </Panel>
                </div>

            {:else if configSeccion === 'ayuda'} 
              <SeccionAyuda />
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
   LAYOUT PRINCIPAL
   ========================================================================== */
.config-layout { display: grid; grid-template-columns: 260px 1fr; height: 100vh; background: var(--bg-body); color: var(--text-main); font-family: 'Segoe UI', sans-serif; }

/* === SIDEBAR === */
.config-sidebar { background: var(--bg-card); border-right: 1px solid var(--border); padding: 20px 0; display: flex; flex-direction: column; height: 100vh;}
.config-header { padding: 0 20px 20px; border-bottom: 1px solid var(--border); }
.config-header h2 { margin: 15px 0 0; font-size: 1.2rem; color: var(--text-main); }

/* BOTÓN VOLVER */
.btn-back-config { 
    display: inline-flex; align-items: center; gap: 10px; padding: 8px 18px; border-radius: 50px; 
    background: transparent; border: 1px solid var(--border); color: var(--text-secondary); 
    font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.25s ease; margin-bottom: 15px; 
}
.btn-back-config:hover { 
    background: var(--hover-bg); border-color: var(--primary); color: var(--primary); 
    transform: translateX(-4px); 
}
.btn-back-config:hover :global(svg) { stroke: var(--primary); }

/* NAVEGACIÓN LATERAL */
.config-nav { padding: 20px 10px; display: flex; flex-direction: column; gap: 5px; }
.config-nav button { background: none; border: none; width: 100%; text-align: left; padding: 12px 16px; color: var(--text-secondary); font-size: 14px; font-weight: 500; cursor: pointer; border-radius: 8px; display: flex; align-items: center; gap: 12px; transition: all 0.2s; }
.config-nav button:hover { background: var(--hover-bg); color: var(--text-main); }
.config-nav button.active { background: var(--primary); color: white; font-weight: 600; }
.nav-divider { height: 1px; background: var(--border); margin: 5px 10px; }

/* === FOOTER SIDEBAR (Información del Software) === */
.config-footer { padding: 20px 15px; margin-top: auto; border-top: 1px solid var(--border); }
.sidebar-about-card { background: var(--bg-body); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }

.about-header { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 800; }
.about-header span { color: var(--text-main); }
.about-header :global(svg) { color: var(--text-main); }

.about-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
.about-label { color: var(--text-secondary); }
.about-value { color: var(--text-main); font-weight: 600; }
.tech-tag { color: var(--primary); font-weight: 700; } 

.nav-divider-mini { height: 1px; background: var(--border); margin: 10px 0; }
.about-disclaimer { margin-top: 12px; font-size: 11px; line-height: 1.4; color: var(--text-secondary); text-align: center; border-top: 1px solid var(--border); padding-top: 10px; }

/* === CONTENIDO PRINCIPAL === */
.config-content { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: var(--bg-body); }
.config-title-bar { padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); background: var(--bg-card); }
.config-title-bar h1 { margin: 0; font-size: 24px; color: var(--text-main); font-weight: 700; }

.btn-save-config { background: var(--primary); color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: transform 0.2s; }
.btn-save-config:hover { opacity: 0.9; transform: translateY(-1px); }

.config-scroll-area { flex: 1; overflow-y: auto; padding: 40px; }
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
    /* 1. LAYOUT PRINCIPAL (De 2 columnas a 1 columna vertical) */
    .config-layout {
        display: flex;
        flex-direction: column;
        height: 100vh;
    }

    /* 2. LA BARRA LATERAL SE CONVIERTE EN PESTAÑAS DESLIZABLES */
    .config-sidebar {
        height: auto;
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--border);
        padding: 15px 0 0 0;
    }

    .config-header {
        padding: 0 15px 10px 15px;
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .config-header h2 { margin: 0; }
    .btn-back-config { margin: 0; }

    .config-nav {
        flex-direction: row;
        overflow-x: auto; /* Permite deslizar con el dedo */
        -webkit-overflow-scrolling: touch;
        padding: 10px 15px;
        gap: 10px;
    }

    /* Ocultar la fea barra de scroll debajo de las pestañas */
    .config-nav::-webkit-scrollbar { 
        display: none; 
    }
    
    .config-nav button {
        width: auto;
        white-space: nowrap; /* Evita que el texto del botón se rompa en dos líneas */
        padding: 10px 18px;
        border-radius: 20px; /* Estilo de "píldoras" modernas */
        background: var(--bg-body);
        border: 1px solid var(--border);
    }
    
    .config-nav button.active {
        background: var(--primary);
        border-color: var(--primary);
    }

    .nav-divider { display: none; } /* Ocultamos las líneas divisorias */
    .config-footer { display: none; } /* Ocultamos la info del software para ahorrar pantalla */

    /* 3. ÁREA DE CONTENIDO PRINCIPAL */
    .config-content {
        height: auto;
        flex: 1;
    }

    .config-title-bar {
        padding: 15px;
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
    }
    
    .config-title-bar h1 { font-size: 20px; }
    .config-actions { width: 100%; }
    .btn-save-config { width: 100%; min-height: 48px; }

    .config-scroll-area {
        padding: 15px;
    }

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
}

/* =========================================================
   ESTILOS PANEL DE SINCRONIZACIÓN (ASISTENTE VISITAS)
   ========================================================= */

.panel-sincronizacion { font-family: 'Segoe UI', system-ui, sans-serif; }

.sync-header { display: flex; align-items: center; gap: 15px; margin-bottom: 25px; }
.sync-icon-box { width: 48px; height: 48px; background-color: #ffe4e6; color: #e11d48; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sync-title h3 { margin: 0 0 5px 0; font-size: 18px; color: var(--text-main); font-weight: 700; }
.sync-title p { margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.4; }

.sync-info-box { border: 1px dashed #cbd5e1; background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 25px; }
.sync-status-box { background-color: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 25px; }
.sync-status-box h4 { margin: 0 0 10px 0; color: #1e3a8a; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; }
.sync-status-box p { margin: 0; font-size: 13px; color: #475569; line-height: 1.5; }

.sync-grid-info { display: grid; grid-template-columns: 200px 1fr; gap: 12px 15px; align-items: center; }
.sync-grid-info.mt-15 { margin-top: 15px; }
.sync-grid-info .label { font-size: 13px; color: #475569; }
.sync-grid-info .value { font-size: 13px; color: #334155; }
.sync-grid-info .value-dark { font-size: 13px; color: #0f172a; font-weight: 700; text-align: right; }

.path-badge { background-color: #fff1f2; color: #e11d48; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 12px; border: 1px solid #fecdd3; }

.sync-main-actions { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.btn-sync-primary { background-color: #e11d48; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
.btn-sync-primary:hover { opacity: 0.9; }
.btn-sync-secondary { background-color: #ffffff; color: #334155; border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-sync-secondary:not(:disabled):hover { background-color: #f8fafc; border-color: #94a3b8; }
.btn-sync-secondary:disabled { opacity: 0.4; cursor: not-allowed; background-color: #f1f5f9; color: #94a3b8; }

.sync-danger-actions { display: flex; gap: 15px; border-top: 1px solid var(--border); padding-top: 20px; }
.btn-sync-warning { background: transparent; color: #d97706; border: 1px solid #fcd34d; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s; }
.btn-sync-warning:hover { background: #fef3c7; }
.btn-sync-danger { background: transparent; color: #ef4444; border: 1px solid #fca5a5; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s; }
.btn-sync-danger:hover { background: #fee2e2; }

/* FIX DEL CHECKBOX (A prueba de balas) */
.sync-checkbox { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #334155; margin-bottom: 25px; cursor: pointer; }
.sync-checkbox input[type="checkbox"] { display: inline-block !important; appearance: auto !important; -webkit-appearance: checkbox !important; width: 16px !important; height: 16px !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; margin: 0 !important; cursor: pointer !important; accent-color: #e11d48; }

/* Adaptación para modo oscuro RAssembly */
:global(html.dark-theme) .sync-info-box { background-color: var(--bg-card); border-color: var(--border); }
:global(html.dark-theme) .sync-status-box { background-color: rgba(30, 58, 138, 0.2); border-color: #1e3a8a; }
:global(html.dark-theme) .sync-status-box h4 { color: #60a5fa; }
:global(html.dark-theme) .sync-status-box p, :global(html.dark-theme) .sync-grid-info .label, :global(html.dark-theme) .sync-grid-info .value { color: var(--text-main); }
:global(html.dark-theme) .sync-grid-info .value-dark { color: #ffffff; }
:global(html.dark-theme) .btn-sync-secondary { background-color: var(--bg-body); border-color: var(--border); color: var(--text-main); }
:global(html.dark-theme) .sync-checkbox { color: var(--text-main); }

</style>