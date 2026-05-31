<script lang="ts">
// 1. IMPORTACIÓN DEL CSS GLOBAL AQUÍ
  import '../app.css';
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import Resumen from '$lib/components/gestion/Resumen.svelte';
  import { Loader2, CheckCircle, AlertTriangle, CloudOff, RefreshCw, User, Upload, Clock, Sun, Moon, Monitor, Settings, Building, X, Home, Trash2, MapPin, Users, Plus 
  } from 'lucide-svelte';
  import { appStore, vistaActual, cargarDatosGlobales } from '$lib/stores/appStore';
  import { goto } from '$app/navigation';
  import { invoke } from '@tauri-apps/api/core';
  import Panel from '$lib/components/ui/Panel.svelte';
  import { getVersion } from '@tauri-apps/api/app';

  import Cronometro from '$lib/components/ui/Cronometro.svelte'; 

  // 2. Importa las herramientas de sincronización
  import { sesionApp, inicializarSesion } from '$lib/stores/authStore';
  import { syncStatus, iniciarRadarNube, detenerRadarNube } from '$lib/stores/autoSyncStore';

  let versionApp = "";
  let temaActual = 'sistema';

  let esModoMonitor = false;

  // ==========================================
  // INICIALIZACIÓN (ONMOUNT LIMPIO)
  // ==========================================
  onMount(() => {

    // 👇 NUEVO DETECTOR: Le preguntamos a Tauri si esta ventana se llama 'monitor-pip'
      const ventanaActual = getCurrentWindow();
      
      if (ventanaActual.label === 'monitor-pip') {
          esModoMonitor = true;
          aplicarTema(localStorage.getItem('temaApp') || 'sistema'); // Forzamos cargar el tema visual
          return; // Si es el monitor, no cargamos lo demás de la app principal
      }

      const inicializarApp = async () => {
          await inicializarSesion();
          await cargarDatosGlobales();
          cargarTemaGuardado();
          
          try {
              versionApp = await getVersion();
          } catch (e) {
              console.error("Error al obtener la versión:", e);
              versionApp = "Desconocida"; 
          }
      };

      inicializarApp();

      // Encendemos el radar de la nube
      iniciarRadarNube();

      // Apagamos el radar si el usuario cierra la app
      return () => detenerRadarNube();
  });

  // --- TEMA ---
  function cargarTemaGuardado() {
    const t = localStorage.getItem('temaApp');
    if (t) temaActual = t;
    aplicarTema(temaActual);
  }
  
  function cambiarTema() {
      temaActual = temaActual === 'sistema' ? 'claro' : temaActual === 'claro' ? 'oscuro' : 'sistema';
      localStorage.setItem('temaApp', temaActual);
      aplicarTema(temaActual);
  }
  
  function aplicarTema(modo: string) {
      const root = document.documentElement;
      const oscuro = modo === 'oscuro' || (modo === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (oscuro) root.classList.add('dark-theme'); else root.classList.remove('dark-theme');
  }

  // --- NAVEGACIÓN ---
  function irInicio() { vistaActual.set('inicio'); goto('/'); }

  function irConfig() {
    const currentPath = window.location.pathname;
    if (currentPath !== '/') {
      localStorage.setItem('rutaAnterior', currentPath);
    }
    vistaActual.set('configuracion');
    goto('/');
  }
</script>

{#if esModoMonitor}
    <main class="monitor-aislado" style="height: 100vh; background: var(--bg-card); overflow: hidden;">
        <Resumen />
    </main>

{:else}
    <div class="app-layout">
        <header class="top-header">
            <div class="header-left">
                <span class="app-brand">RAssembly</span>
            </div>

            <div class="header-right">
                
                <!-- 🔥 NUEVO INDICADOR DE SINCRONIZACIÓN AUTOMÁTICA 🔥 -->
                {#if $syncStatus.estado !== 'inactivo'}
                    <div class="sync-badge state-{$syncStatus.estado}" title={$syncStatus.mensaje}>
                        
                        {#if $syncStatus.estado === 'esperando'}
                            <Clock size={16} class="pulse-icon" /> <span class="badge-text">Esperando...</span>
                        {:else if $syncStatus.estado === 'sincronizando'}
                            <Loader2 size={16} class="spin-icon" /> <span class="badge-text">Guardando...</span>
                        {:else if $syncStatus.estado === 'al_dia'}
                            <CheckCircle size={16} /> <span class="badge-text">Al día</span>
                        {:else if $syncStatus.estado === 'error'}
                            <CloudOff size={16} /> <span class="badge-text">Error</span>
                        {/if}

                    </div>
                {/if}
                <!-- 🔥 FIN DEL NUEVO INDICADOR 🔥 -->

                <button class="btn-nav" on:click={irInicio} title="Inicio">
                    <Home size={18}/><span>Inicio</span>
                </button>
                
                <button class="btn-nav" on:click={irInicio} title="Inicio">
                    <Home size={18}/><span>Inicio</span>
                </button>
                
                <button class="btn-icon" on:click={cambiarTema} title="Cambiar Tema">
                    {#if temaActual==='claro'}
                      <Sun size={18}/>
                    {:else if temaActual==='oscuro'}
                      <Moon size={18}/>
                    {:else}
                      <Monitor size={18}/>
                    {/if}
                </button>
                
                <button class="btn-icon" on:click={irConfig} title="Configuración">
                    <Settings size={18}/>
                </button>
            </div>
        </header>

        <main class="main-content">
            <slot />
        </main>

        <footer class="status-bar">
            <div class="status-left">
                <span class="dot pulse"></span> Sistema Conectado <strong class="tech">(Rust/Tauri)</strong>
            </div>
            <div class="status-center">Construido y diseñado para Presidentes de Asambleas Regionales</div>
            
            <div class="status-right">
                v{#if versionApp}{versionApp}{:else}...{/if}
            </div>
        </footer>

        {#if $syncStatus.estado === 'conflicto'}
          <div class="modal-backdrop">
            <Panel padding="25px" clasesExtra="modal-salones">
                <div class="modal-top">
                    <h3 style="color: var(--accent-danger);"><AlertTriangle size={24}/> ¡Atención: Cambios en la Nube!</h3>
                </div>
                
                <div style="padding: 15px 0; color: var(--text-main); font-size: 14px; line-height: 1.5;">
                    <p>El dispositivo <strong>{$syncStatus.nubeDispositivo}</strong> acaba de guardar nuevos datos en la nube.</p>
                    <p>Para proteger esos datos y no borrarlos accidentalmente, hemos pausado tu guardado automático temporalmente.</p>
                    <p style="margin-top: 10px; font-weight: bold;">Ve a Sincronización para descargar los cambios recientes.</p>
                </div>

                <button class="btn-blue" on:click={() => goto('/sincronizacion')}>
                    Ir a Sincronización
                </button>
            </Panel>
          </div>
        {/if}

        <Cronometro />

    </div>
{/if}

<style>
  /* LAYOUT */
  .app-layout { display: flex; flex-direction: column; height: 100vh; width: 100vw; }
  .main-content { flex: 1; overflow-y: auto; padding-bottom: 40px; position: relative; z-index: 1; }

  /* HEADER */
 .top-header { 
      display: flex; justify-content: space-between; align-items: center; 
      padding: 15px 30px; 
      background-color: var(--bg-card); 
      background-image: linear-gradient(rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.04)); 
      border-bottom: 1px solid var(--border); 
      box-shadow: var(--shadow-sm); 
      z-index: 50; 
  }

  .header-left { display: flex; gap: 12px; align-items: center; }
  
  .avatar { 
      width: 40px; 
      height: 40px; 
      background: var(--primary); 
      border-radius: 50%; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      color: white; 
      cursor: pointer; 
      overflow: hidden; 
      transition: opacity 0.2s; 
  }
  .avatar:hover { opacity: 0.8; } 
  
  .foto-perfil { 
      width: 100%; 
      height: 100%; 
      object-fit: cover; 
  }

  .user-data h2 { margin: 0; font-size: 14px; } .user-data span { font-size: 11px; color: var(--text-sec); }
  
  .header-right { display: flex; gap: 8px; }
  .btn-nav { background: var(--bg-body); border: 1px solid var(--border); padding: 8px 12px; border-radius: 8px; cursor: pointer; display: flex; gap: 6px; color: var(--text-main); font-weight: 600; align-items: center; }
  .btn-icon { background: transparent; border: 1px solid transparent; padding: 8px; cursor: pointer; color: var(--text-sec); display: flex; align-items: center; }
  .btn-nav:hover, .btn-icon:hover { background: var(--border); }

  /* FOOTER */
  .status-bar { position: fixed; bottom: 0; width: 100%; height: 32px; background: var(--status-bg); color: var(--status-text); display: flex; justify-content: space-between; align-items: center; padding: 0 15px; font-size: 12px; font-weight: 600; border-top: 1px solid var(--border); z-index: 100; transition: background 0.3s; box-sizing: border-box; }
  .status-center, .tech { color: inherit; } 
  .tech { color: var(--accent-success); }
  .dot { width: 6px; height: 6px; background: var(--accent-success); border-radius: 50%; display: inline-block; margin-right: 5px; }

  /* MODAL ESTILIZADO */
  .modal-backdrop { 
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.6); 
      display: flex; align-items: center; justify-content: center; 
      z-index: 9999; backdrop-filter: blur(2px); 
  }
  :global(.modal-salones) { 
      width: 95%;          
      max-width: 700px;    
      margin: 0 auto;      
      display: flex; 
      flex-direction: column; 
      gap: 15px;
  }
  
  .modal-top { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
  .modal-top h3 { margin: 0; font-size: 18px; display: flex; gap: 10px; align-items: center; color: var(--text-main); }
  .ico-blue { color: var(--primary); }
  .btn-close { background: none; border: none; cursor: pointer; color: var(--text-main); }

  /* GRID DEL FORMULARIO */
  .form-grid { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 15px; 
      background: var(--bg-body); 
      padding: 15px; 
      border-radius: 8px; 
      border: 1px solid var(--border);
  }
  
  .input-group { display: flex; flex-direction: column; gap: 5px; }
  .input-group.full-width { grid-column: span 2; } 
  
  .input-group label { font-size: 11px; font-weight: 700; color: var(--text-sec); text-transform: uppercase; }
  .input-group input { padding: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text-main); border-radius: 6px; font-size: 13px; }
  
  .btn-blue { 
      grid-column: span 2; 
      background: var(--primary); color: white; border: none; 
      padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 700; 
      display: flex; justify-content: center; gap: 8px; align-items: center;
      width: 100%; 
      max-width: 350px; 
      margin: 15px auto 0 auto; 
  }

  .separator { height: 1px; background: var(--border); margin: 5px 0; }
  .list-label { font-size: 12px; font-weight: 700; color: var(--text-sec); text-transform: uppercase; }
  
  .list-scroll { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 5px; }
  
  .list-item { 
      display: flex; justify-content: space-between; align-items: center; 
      padding: 10px 15px; border: 1px solid var(--border); 
      border-radius: 8px; background: var(--bg-body); 
      transition: background 0.2s;
  }
  .list-item:hover { background: var(--border); }

  .item-info { display: flex; flex-direction: column; gap: 2px; }
  .item-title { display: flex; gap: 8px; align-items: center; font-size: 14px; color: var(--text-main); }
  .badge-cap { background: var(--primary); color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; display: flex; align-items: center; gap: 3px; }
  .item-details { display: flex; gap: 5px; align-items: center; font-size: 11px; color: var(--text-sec); }

  .btn-red { color: var(--accent-danger); background: none; border: none; cursor: pointer; padding: 5px; }
  .btn-red:hover { background: var(--accent-danger-hover); border-radius: 6px; color: white; }
  
  .empty-msg { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; color: var(--text-sec); font-size: 13px; }

  /* ===== MENÚ DE AVATAR PROFESIONAL ===== */
  .avatar-container { 
      position: relative; 
      display: flex; 
  }

  .dropdown-avatar {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: var(--shadow-premium);
      min-width: 160px;
      display: flex;
      flex-direction: column;
      z-index: 9999;
      overflow: hidden;
      animation: fadeInDown 0.2s ease;
  }

  .menu-item {
      width: 100%;
      padding: 12px 15px;
      background: transparent;
      border: none;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-main);
      cursor: pointer;
      text-align: left;
      transition: background 0.2s;
  }

  .menu-item:hover {
      background: var(--border);
  }

  .menu-item.text-red {
      color: var(--accent-danger);
  }

  .menu-item.text-red:hover {
      background: var(--accent-danger-hover);
      color: white;
  }

  .dropdown-separator {
      height: 1px;
      background: var(--border);
      margin: 0;
  }

  @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
  }

/* =============================================
     ESTILOS DEL INDICADOR DE SINCRONIZACIÓN NUBE
     ============================================= */
  .sync-badge {
      display: flex; align-items: center; gap: 6px; padding: 6px 12px;
      border-radius: 8px; font-size: 12px; font-weight: 700;
      transition: all 0.3s ease; border: 1px solid transparent;
      margin-right: 10px;
  }
  .state-esperando { background: rgba(234, 179, 8, 0.15); color: #ca8a04; border-color: rgba(234, 179, 8, 0.3); }
  .state-sincronizando { background: rgba(59, 130, 246, 0.15); color: #2563eb; border-color: rgba(59, 130, 246, 0.3); }
  .state-al_dia { background: rgba(34, 197, 94, 0.15); color: #16a34a; border-color: rgba(34, 197, 94, 0.3); }
  .state-error { background: rgba(107, 114, 128, 0.15); color: #4b5563; border-color: rgba(107, 114, 128, 0.3); }
  
  .state-conflicto { 
      background: rgba(239, 68, 68, 0.15); color: #dc2626; border-color: rgba(239, 68, 68, 0.4); 
      cursor: pointer; box-shadow: 0 0 10px rgba(239, 68, 68, 0.2);
  }
  .state-conflicto:hover { background: rgba(239, 68, 68, 0.25); transform: scale(1.05); }

  /* MODO OSCURO */
  :global(.dark-theme) .state-esperando { color: #fde047; }
  :global(.dark-theme) .state-sincronizando { color: #60a5fa; }
  :global(.dark-theme) .state-al_dia { color: #4ade80; }
  :global(.dark-theme) .state-conflicto { color: #f87171; }
  :global(.dark-theme) .state-error { color: #9ca3af; }

  .spin-icon { animation: spin 1.5s linear infinite; }
  .pulse-icon { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  /* =========================================================
   DISEÑO RESPONSIVO (+LAYOUT: WINDOWS + ANDROID)
   ========================================================= */

@media (max-width: 768px) {
    /* 1. HEADER MÁS COMPACTO Y LIMPIO */
    .top-header {
        padding: 10px 15px; 
        gap: 10px;
    }

    /* 2. OCULTAR ELEMENTOS NO ESENCIALES */
    .header-center {
        display: none; 
    }
    
    .user-data h2 {
        font-size: 13px; 
    }

    /* 3. BOTONES DE NAVEGACIÓN (Solo Iconos, sin texto) */
    .header-right {
        gap: 5px;
    }
    
    .btn-nav span {
        display: none; 
    }
    
    .btn-nav, .btn-icon {
        padding: 10px; 
        min-width: 42px;
        min-height: 42px;
        justify-content: center;
    }

    /* 4. BARRA DE ESTADO (Antidesbordes) */
    .status-center {
        display: none; 
    }
    
    .status-bar {
        padding: 0 10px;
        font-size: 10px; 
    }

    /* 5. MODAL DE SALONES (Apilado y fluido) */
    :global(.modal-salones) {
        width: 95vw !important; 
        max-height: 90vh; 
        overflow-y: auto; 
        padding: 15px !important;
    }
    
    .form-grid {
        grid-template-columns: 1fr; 
        gap: 12px;
    }
    
    .input-group.full-width, .btn-blue {
        grid-column: 1 / -1; 
    }
    
    .btn-blue {
        min-height: 48px; 
    }
}

  .anim-spin {
      pointer-events: none; 
  }
  .anim-spin :global(svg) {
      animation: spin 1s linear infinite;
  }
  @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
  }
  
  .btn-icon.anim-spin {
      color: var(--primary) !important; 
      background-color: transparent;
      pointer-events: none; 
  }

  .btn-icon.anim-spin :global(svg) {
      animation: rotar-radar 1s linear infinite;
  }

  @keyframes rotar-radar {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
  }

  button.anim-spin {
      color: var(--primary) !important; 
      background-color: transparent !important;
  }

  button.anim-spin :global(svg) {
      animation: rotar-radar 1s linear infinite !important;
  }

  .app-brand {
      font-size: 18px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.5px;
      user-select: none; 
  }

</style>