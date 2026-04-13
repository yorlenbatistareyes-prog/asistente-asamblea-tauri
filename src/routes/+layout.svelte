<script lang="ts">
// 1. IMPORTACIÓN DEL CSS GLOBAL AQUÍ
  import '../app.css';
  import { onMount } from 'svelte';
  import { Loader2, CheckCircle, AlertTriangle, CloudOff, RefreshCw, User, Upload, Clock, Sun, Moon, Monitor, Settings, Building, X, Home, Trash2, MapPin, Users, Plus 
  } from 'lucide-svelte';
  import { appStore, vistaActual, cargarDatosGlobales } from '$lib/stores/appStore';
  import { goto } from '$app/navigation';
  import { invoke } from '@tauri-apps/api/core';
  import Panel from '$lib/components/ui/Panel.svelte';
  import { getVersion } from '@tauri-apps/api/app';

  import Cronometro from '$lib/components/ui/Cronometro.svelte'; 

  // 2. Importa las herramientas de sincronización
  import { sesionApp } from '$lib/stores/authStore';
  import { syncStatus, iniciarRadarNube, detenerRadarNube } from '$lib/stores/autoSyncStore';

  let versionApp = "";

  // --- VARIABLES DE ESTADO ---
  let horaActual = "";
  let fechaActual = "";
  let saludo = "Hola"; 
  let temaActual = 'sistema';
  let nombreUsuario = "Usuario";
  let fotoUsuario = ""; 
  let mostrarMenuAvatar = false; 
  let fileInput: HTMLInputElement;

  // --- QUITAR FOTO ---
  function quitarFoto() {
      fotoUsuario = ""; 
      localStorage.removeItem('fotoPerfil'); 
      if (fileInput) fileInput.value = ""; 
      mostrarMenuAvatar = false; 
  }
  
  // --- VARIABLES GESTIÓN SALONES ---
  let mostrarModalLocales = false;
  let listaLocales: any[] = [];
  let nuevoLocal = { nombre: "", direccion: "", ciudad: "", estado: "", capacidad: 0 };

  // ==========================================
  // INICIALIZACIÓN (ONMOUNT LIMPIO)
  // ==========================================
  onMount(() => {
      const inicializarApp = async () => {
          await cargarDatosGlobales();
          await cargarNombreUsuario();
          fotoUsuario = localStorage.getItem('fotoPerfil') || "";
          iniciarReloj(); 
          cargarTemaGuardado();
          cargarLocales();
          
          try {
              versionApp = await getVersion();
          } catch (e) {
              console.error("Error al obtener la versión:", e);
              versionApp = "Desconocida"; 
          }
      };

      inicializarApp();

      // 👈 NUEVO: Encendemos el radar de la nube
      iniciarRadarNube();

          // 👈 NUEVO: Apagamos el radar si el usuario cierra la app
      return () => detenerRadarNube();
  });

  // --- NUEVA FUNCIÓN: CARGAR NOMBRE DESDE RUST ---
  async function cargarNombreUsuario() {
    try {
        const config: any = await invoke('obtener_configuracion_general');
        if (config && config.nombre) {
            nombreUsuario = config.nombre;
        }
    } catch (e) {
        console.error("No se pudo cargar el nombre del usuario:", e);
    }
  }

  $: if ($appStore) {
      cargarNombreUsuario();
  }

  // --- CARGAR NUEVA FOTO ---
  function manejarCambioFoto(event: Event) {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files.length > 0) {
          const archivo = input.files[0];
          const reader = new FileReader();
          
          reader.onload = (e) => {
              const resultado = e.target?.result as string;
              fotoUsuario = resultado; 
              localStorage.setItem('fotoPerfil', resultado); 
          };
          reader.readAsDataURL(archivo); 
      }
  }

  // --- GESTIÓN DE SALONES ---
  function abrirModalSalones() {
      mostrarModalLocales = true; 
      nuevoLocal = { nombre: "", direccion: "", ciudad: "", estado: "", capacidad: 0 }; 
      cargarLocales(); 
  }

  async function cargarLocales() {
      try { listaLocales = await invoke('obtener_locales') as any[]; } catch(e) { console.error(e); }
  }

  async function guardarLocal() {
    if (!nuevoLocal.nombre) return alert("El nombre es obligatorio");
    try {
        await invoke('crear_local', { ...nuevoLocal, capacidad: Number(nuevoLocal.capacidad) });
        cargarLocales();
        nuevoLocal = { nombre: "", direccion: "", ciudad: "", estado: "", capacidad: 0 }; 
    } catch (e) { alert("Error al guardar: " + e); }
  }

  async function eliminarLocal(id: number) {
     if(confirm("¿Seguro que deseas eliminar este salón?")) { 
         try {
            await invoke('eliminar_local', { id }); 
            cargarLocales();
         } catch (e) { alert("No se pudo eliminar: " + e); }
     }
  }

  // --- RELOJ ---
  function iniciarReloj() {
    actualizarTiempo(); setInterval(actualizarTiempo, 1000); 
  }
  function actualizarTiempo() {
    const ahora = new Date();
    horaActual = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
    const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } as const;
    let f = ahora.toLocaleDateString('es-ES', opciones);
    fechaActual = f.charAt(0).toUpperCase() + f.slice(1);
    const h = ahora.getHours(); 
    saludo = h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
  }

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

<svelte:window on:click={() => mostrarMenuAvatar = false} />

<div class="app-layout">
   <header class="top-header">
        <div class="header-left">
            <input type="file" accept="image/*" style="display: none;" bind:this={fileInput} on:change={manejarCambioFoto} />
            
            <div class="avatar-container" on:click|stopPropagation={() => mostrarMenuAvatar = !mostrarMenuAvatar}>
                <div class="avatar" title="Opciones de perfil">
                    {#if fotoUsuario}
                        <img src={fotoUsuario} alt="Perfil" class="foto-perfil" />
                    {:else}
                        <User size={24} />
                    {/if}
                </div>
                
                {#if mostrarMenuAvatar}
                    <div class="dropdown-avatar" on:click|stopPropagation>
                        <button class="menu-item" on:click={() => { fileInput.click(); mostrarMenuAvatar = false; }}>
                            <Upload size={16} /> Seleccionar foto
                        </button>
                        
                        {#if fotoUsuario}
                            <div class="dropdown-separator"></div>
                            <button class="menu-item text-red" on:click={quitarFoto}>
                                <Trash2 size={16} /> Quitar foto
                            </button>
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="user-data">
                <h2>{saludo}, {$appStore.usuario}!</h2>
                <span>{fechaActual}</span>
            </div>
        </div>

        <div class="header-center">
            <Clock size={16}/> <span>{horaActual}</span>
        </div>

        <div class="header-right">
            
            {#if $sesionApp.isLoggedIn && $syncStatus.estado !== 'inactivo'}
                <div class="sync-badge state-{$syncStatus.estado}" 
                     title={$syncStatus.mensaje}
                     on:click={() => { if ($syncStatus.estado === 'conflicto') goto('/sincronizacion'); }}>
                    
                    {#if $syncStatus.estado === 'esperando'}
                        <Clock size={16} class="pulse-icon" /> <span class="badge-text">Esperando...</span>
                    {:else if $syncStatus.estado === 'sincronizando'}
                        <Loader2 size={16} class="spin-icon" /> <span class="badge-text">Guardando...</span>
                    {:else if $syncStatus.estado === 'al_dia'}
                        <CheckCircle size={16} /> <span class="badge-text">Al día</span>
                    {:else if $syncStatus.estado === 'conflicto'}
                        <AlertTriangle size={16} /> <span class="badge-text">Datos Nuevos</span>
                    {:else if $syncStatus.estado === 'error'}
                        <CloudOff size={16} /> <span class="badge-text">Error</span>
                    {/if}
                </div>
            {/if}
            
            <button class="btn-nav" on:click={irInicio} title="Inicio">
                <Home size={18}/><span>Inicio</span>
            </button>
            
            <button class="btn-icon" on:click={cambiarTema}>
                {#if temaActual==='claro'}<Sun size={18}/>{:else if temaActual==='oscuro'}<Moon size={18}/>{:else}<Monitor size={18}/>{/if}
            </button>
            
            <button class="btn-nav" on:click={abrirModalSalones}>
                <Building size={16}/><span>Salones</span>
            </button>
            
            <button class="btn-icon" on:click={irConfig}>
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

    {#if mostrarModalLocales}
      <div class="modal-backdrop" on:click|self={()=>mostrarModalLocales=false}>
        <Panel padding="25px" clasesExtra="modal-salones">
            <div class="modal-top">
                <h3><Building size={20} class="ico-blue"/> Gestión de Salones</h3>
                <button class="btn-close" on:click={()=>mostrarModalLocales=false}><X size={20}/></button>
            </div>
            
            <div class="form-grid">
                <div class="input-group full-width">
                    <label>Nombre del Salón</label>
                    <input type="text" placeholder="Ej: Salón de Asambleas Holguín" bind:value={nuevoLocal.nombre}>
                </div>

                <div class="input-group full-width">
                    <label>Dirección</label>
                    <input type="text" placeholder="Calle, Número, Reparto..." bind:value={nuevoLocal.direccion}>
                </div>

                <div class="input-group">
                    <label>Ciudad</label>
                    <input type="text" placeholder="Ciudad" bind:value={nuevoLocal.ciudad}>
                </div>

                <div class="input-group">
                    <label>Provincia / Estado</label>
                    <input type="text" placeholder="Provincia" bind:value={nuevoLocal.estado}>
                </div>

                <div class="input-group">
                    <label>Capacidad</label>
                    <input type="number" placeholder="0" bind:value={nuevoLocal.capacidad}>
                </div>

                <button class="btn-blue" on:click={guardarLocal}>
                    <Plus size={16}/> Guardar Salón
                </button>
            </div>

            <div class="separator"></div>
            <div class="list-label">Salones guardados:</div>
            
            <div class="list-scroll">
                {#if listaLocales.length === 0}
                    <div class="empty-msg">
                        <Building size={30} strokeWidth={1} style="opacity:0.3; margin-bottom:5px;"/>
                        <p>No hay salones registrados.</p>
                    </div>
                {:else}
                    {#each listaLocales as l}
                        <div class="list-item">
                            <div class="item-info">
                                <div class="item-title">
                                    <strong>{l.nombre}</strong>
                                    {#if l.capacidad}
                                        <span class="badge-cap"><Users size={10}/> {l.capacidad}</span>
                                    {/if}
                                </div>
                                
                                <div class="item-details">
                                    <MapPin size={10}/> 
                                    <span>
                                        {l.direccion || 'Sin dirección'}
                                        {#if l.ciudad} 
                                            <strong> • {l.ciudad}</strong> 
                                        {/if}
                                        {#if l.estado} 
                                            <span style="opacity:0.7"> ({l.estado})</span> 
                                        {/if}
                                    </span>
                                </div>
                            </div>
                            
                            <button class="btn-red" on:click={()=>eliminarLocal(l.id)} title="Borrar Salón">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    {/each}
                {/if}
            </div>
        </Panel>
      </div>
    {/if}

    {#if $syncStatus.estado === 'conflicto'}
      <div class="modal-backdrop">
        <Panel padding="25px" clasesExtra="modal-salones">
            <div class="modal-top">
                <h3 style="color: #ef4444;"><AlertTriangle size={24}/> ¡Atención: Cambios en la Nube!</h3>
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

<style>
  /* LAYOUT */
  .app-layout { display: flex; flex-direction: column; height: 100vh; width: 100vw; }
  .main-content { flex: 1; overflow-y: auto; padding-bottom: 40px; position: relative; z-index: 1; }

  /* HEADER */
 .top-header { 
      display: flex; justify-content: space-between; align-items: center; 
      padding: 15px 30px; 
      background-color: var(--bg-card); 
      background-image: linear-gradient(rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.04)); /* El mismo "tinte" gris de las tarjetas */
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
      cursor: pointer; /* 👈 NUEVO: Ratón de manito */
      overflow: hidden; /* 👈 NUEVO: Evita que la foto se salga del círculo */
      transition: opacity 0.2s; 
  }
  .avatar:hover { opacity: 0.8; } /* 👈 NUEVO: Efecto al pasar el ratón */
  
  /* 👈 NUEVA CLASE PARA LA IMAGEN */
  .foto-perfil { 
      width: 100%; 
      height: 100%; 
      object-fit: cover; /* Asegura que la foto no se deforme */
  }

  .user-data h2 { margin: 0; font-size: 14px; } .user-data span { font-size: 11px; color: var(--text-sec); }
  .header-center { background: var(--bg-body); padding: 5px 15px; border-radius: 20px; border: 1px solid var(--border); display: flex; gap: 8px; font-weight: 600; align-items: center; }
  .header-right { display: flex; gap: 8px; }
  .btn-nav { background: var(--bg-body); border: 1px solid var(--border); padding: 8px 12px; border-radius: 8px; cursor: pointer; display: flex; gap: 6px; color: var(--text-main); font-weight: 600; align-items: center; }
  .btn-icon { background: transparent; border: 1px solid transparent; padding: 8px; cursor: pointer; color: var(--text-sec); display: flex; }
  .btn-nav:hover, .btn-icon:hover { background: var(--border); }

  /* FOOTER */
  .status-bar { position: fixed; bottom: 0; width: 100%; height: 32px; background: var(--status-bg); color: var(--status-text); display: flex; justify-content: space-between; align-items: center; padding: 0 15px; font-size: 12px; font-weight: 600; border-top: 1px solid var(--border); z-index: 100; transition: background 0.3s; box-sizing: border-box; }
  .status-center, .tech { color: inherit; } .tech { color: #059669; }
  .dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; display: inline-block; margin-right: 5px; }

  /* MODAL ESTILIZADO */
  .modal-backdrop { 
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.6); 
      display: flex; align-items: center; justify-content: center; 
      z-index: 9999; backdrop-filter: blur(2px); 
  }
  :global(.modal-salones) { 
      width: 95%;          /* 1. Ocupa casi todo el espacio disponible */
      max-width: 700px;    /* 2. EL FRENO: En Windows se detiene en 700px */
      margin: 0 auto;      /* 3. Lo mantiene perfectamente centrado */
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
      
      /* EL FRENO PARA EL BOTÓN */
      width: 100%; 
      max-width: 350px; 
      margin: 15px auto 0 auto; /* Centrado en Windows */
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

  .btn-red { color: #ef4444; background: none; border: none; cursor: pointer; padding: 5px; }
  .btn-red:hover { background: #fee2e2; border-radius: 6px; }
  
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
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
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
      background: var(--hover-bg);
  }

  .menu-item.text-red {
      color: #ef4444;
  }

  .menu-item.text-red:hover {
      background: #fee2e2;
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
        padding: 10px 15px; /* Reducimos márgenes laterales */
        gap: 10px;
    }

    /* 2. OCULTAR ELEMENTOS NO ESENCIALES */
    .header-center {
        display: none; /* Ocultamos el reloj en el teléfono para liberar espacio */
    }
    
    .user-data h2 {
        font-size: 13px; /* Saludo un poco más pequeño */
    }

    /* 3. BOTONES DE NAVEGACIÓN (Solo Iconos, sin texto) */
    .header-right {
        gap: 5px;
    }
    
    .btn-nav span {
        display: none; /* Ocultamos las palabras "Inicio" y "Salones" */
    }
    
    .btn-nav, .btn-icon {
        padding: 10px; /* Áreas táctiles seguras de 40x40px aprox */
        min-width: 42px;
        min-height: 42px;
        justify-content: center;
    }

    /* 4. BARRA DE ESTADO (Antidesbordes) */
    .status-center {
        display: none; /* Ocultamos la frase larga para que no se amontone */
    }
    
    .status-bar {
        padding: 0 10px;
        font-size: 10px; /* Letra un poco más pequeña */
    }

    /* 5. MODAL DE SALONES (Apilado y fluido) */
    :global(.modal-salones) {
        width: 95vw !important; /* Ancho fluido */
        max-height: 90vh; /* Que no se pase del alto de la pantalla */
        overflow-y: auto; /* Permite hacer scroll si el teclado tapa algo */
        padding: 15px !important;
    }
    
    .form-grid {
        grid-template-columns: 1fr; /* 1 sola columna hacia abajo */
        gap: 12px;
    }
    
    /* Reseteamos los elementos que abarcaban 2 columnas en Windows */
    .input-group.full-width, .btn-blue {
        grid-column: 1 / -1; 
    }
    
    .btn-blue {
        min-height: 48px; /* Botón grande para el dedo */
    }
}

/* ANIMACIÓN DE GIRO PARA EL BOTÓN SYNC */
  .anim-spin {
      pointer-events: none; /* Evita doble clic */
  }
  .anim-spin :global(svg) {
      animation: spin 1s linear infinite;
  }
  @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
  }
  
  /* =========================================================
     ANIMACIÓN DEL BOTÓN DE SINCRONIZACIÓN INTELIGENTE
     ========================================================= */
  .btn-icon.anim-spin {
      color: #3b82f6 !important; /* El azul brillante */
      background-color: transparent;
      pointer-events: none; /* Bloquea clics dobles */
  }

  /* Hace que solo el icono SVG gire, no todo el botón */
  .btn-icon.anim-spin :global(svg) {
      animation: rotar-radar 1s linear infinite;
  }

  @keyframes rotar-radar {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
  }

  /* =========================================================
     ANIMACIÓN DEL BOTÓN DE SINCRONIZACIÓN INTELIGENTE
     ========================================================= */
  button.anim-spin {
      color: #3b82f6 !important; /* El azul brillante */
      background-color: transparent !important;
  }

  /* Hace que solo el icono SVG gire */
  button.anim-spin :global(svg) {
      animation: rotar-radar 1s linear infinite !important;
  }

  @keyframes rotar-radar {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
  }
</style>