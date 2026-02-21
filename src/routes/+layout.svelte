<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    User, Clock, Sun, Moon, Monitor, Settings, Building, X, Home, Trash2, MapPin, Users, Plus 
  } from 'lucide-svelte';
  import { appStore, vistaActual, cargarDatosGlobales } from '$lib/stores/appStore';
  import { goto } from '$app/navigation';
  import { invoke } from '@tauri-apps/api/core';

  // --- VARIABLES DE ESTADO ---
  let horaActual = "";
  let fechaActual = "";
  let saludo = "Hola"; 
  let temaActual = 'sistema';
  
  // --- VARIABLES GESTIÓN SALONES ---
  let mostrarModalLocales = false;
  let listaLocales: any[] = [];
  let nuevoLocal = { nombre: "", direccion: "", ciudad: "", estado: "", capacidad: 0 };

  onMount(async () => {
    await cargarDatosGlobales();
    iniciarReloj(); 
    cargarTemaGuardado();
    cargarLocales(); 
  });

  // --- FUNCIÓN QUE ARREGLA EL BOTÓN ---
  function abrirModalSalones() {
      console.log("Abriendo modal de salones..."); // Para verificar en consola
      mostrarModalLocales = true; // 1. Abrimos modal inmediatamente
      nuevoLocal = { nombre: "", direccion: "", ciudad: "", estado: "", capacidad: 0 }; // 2. Limpiamos
      cargarLocales(); // 3. Cargamos datos
  }

  async function cargarLocales() {
      try { listaLocales = await invoke('obtener_locales') as any[]; } catch(e) { console.error(e); }
  }

  async function guardarLocal() {
    if (!nuevoLocal.nombre) return alert("El nombre es obligatorio");
    try {
        // OJO: Tu backend en Rust debe aceptar estos campos nuevos (direccion, estado, capacidad)
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
  // Guardar la ruta actual (si no es la página de inicio)
  const currentPath = window.location.pathname;
  if (currentPath !== '/') {
    localStorage.setItem('rutaAnterior', currentPath);
  }
  vistaActual.set('configuracion');
  goto('/');
}

</script>

<div class="app-layout">
    <header class="top-header">
        <div class="header-left">
            <div class="avatar"><User size={24} /></div>
            <div class="user-data">
                <h2>{saludo}, {$appStore.usuario}</h2>
                <span>{fechaActual}</span>
            </div>
        </div>

        <div class="header-center">
            <Clock size={16}/> <span>{horaActual}</span>
        </div>

        <div class="header-right">
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
        <div class="status-right">v1.0.0</div>
    </footer>

    {#if mostrarModalLocales}
      <div class="modal-backdrop" on:click|self={()=>mostrarModalLocales=false}>
        <div class="modal-box">
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
        </div>
      </div>
    {/if}
</div>

<style>
  /* VARIABLES GLOBALES */
  :global(:root) {
      --bg-body: #f8fafc; --bg-card: #ffffff; --text-main: #1e293b; --text-sec: #64748b;
      --border: #e2e8f0; --primary: #0078d4; --input-bg: #ffffff;
      --status-bg: #EBEBEB; --status-text: #000000;
  }
  :global(html.dark-theme) {
      --bg-body: #0f172a; --bg-card: #1e293b; --text-main: #f8fafc; --text-sec: #cbd5e1;
      --border: #334155; --primary: #3b82f6; --input-bg: #0f172a;
      --status-bg: #1e293b; --status-text: #f1f5f9;
  }
  :global(body) { margin: 0; font-family: 'Segoe UI', sans-serif; background: var(--bg-body); color: var(--text-main); overflow: hidden; }

  /* LAYOUT */
  .app-layout { display: flex; flex-direction: column; height: 100vh; width: 100vw; }
  .main-content { flex: 1; overflow-y: auto; padding-bottom: 40px; position: relative; z-index: 1; }

  /* HEADER */
  .top-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 30px; background: var(--bg-card); border-bottom: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05); z-index: 50; }
  .header-left { display: flex; gap: 12px; align-items: center; }
  .avatar { width: 40px; height: 40px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
  .user-data h2 { margin: 0; font-size: 14px; } .user-data span { font-size: 11px; color: var(--text-sec); }
  .header-center { background: var(--bg-body); padding: 5px 15px; border-radius: 20px; border: 1px solid var(--border); display: flex; gap: 8px; font-weight: 700; }
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
  .modal-box { 
      background: var(--bg-card); padding: 25px; border-radius: 12px; width: 550px; 
      box-shadow: 0 20px 50px rgba(0,0,0,0.4); border: 1px solid var(--border); 
      display: flex; flex-direction: column; gap: 15px;
  }
  .modal-top { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
  .modal-top h3 { margin: 0; font-size: 18px; display: flex; gap: 10px; align-items: center; color: var(--text-main); }
  .ico-blue { color: var(--primary); }
  .btn-close { background: none; border: none; cursor: pointer; color: var(--text-main); }

  /* GRID DEL FORMULARIO */
  .form-grid { 
      display: grid; 
      grid-template-columns: 1fr 1fr; /* Dos columnas */
      gap: 15px; 
      background: var(--bg-body); 
      padding: 15px; 
      border-radius: 8px; 
      border: 1px solid var(--border);
  }
  
  .input-group { display: flex; flex-direction: column; gap: 5px; }
  .input-group.full-width { grid-column: span 2; } /* Ocupa todo el ancho */
  
  .input-group label { font-size: 11px; font-weight: 700; color: var(--text-sec); text-transform: uppercase; }
  .input-group input { padding: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text-main); border-radius: 6px; font-size: 13px; }
  
  .btn-blue { 
      grid-column: span 2; /* Botón ancho completo */
      background: var(--primary); color: white; border: none; 
      padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 700; 
      display: flex; justify-content: center; gap: 8px; align-items: center;
      margin-top: 5px;
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
</style>