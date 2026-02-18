<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    User, Clock, Sun, Moon, Monitor, Settings, Building, X, Home, Trash2 
  } from 'lucide-svelte';
  import { appStore, vistaActual, cargarDatosGlobales } from '$lib/stores/appStore';
  import { goto } from '$app/navigation';
  import { invoke } from '@tauri-apps/api/core';

  // --- VARIABLES ---
  let horaActual = "";
  let fechaActual = "";
  let saludo = "Hola"; 
  let temaActual = 'sistema';
  
  // Modal Salones (Global)
  let mostrarModalLocales = false;
  let listaLocales: any[] = [];
  let nuevoLocal = { nombre: "", direccion: "", ciudad: "", estado: "", capacidad: 0 };

  onMount(async () => {
    await cargarDatosGlobales();
    iniciarReloj(); 
    cargarTemaGuardado();
    cargarLocales();
  });

  async function cargarLocales() {
      try { listaLocales = await invoke('obtener_locales') as any[]; } catch(e) { console.error(e); }
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

  // --- ACCIONES ---
  function irInicio() { vistaActual.set('inicio'); goto('/'); }
  function irConfig() { vistaActual.set('configuracion'); }

  async function guardarLocal() {
    if (!nuevoLocal.nombre) return;
    await invoke('crear_local', { ...nuevoLocal, capacidad: Number(nuevoLocal.capacidad) });
    nuevoLocal = { nombre: "", direccion: "", ciudad: "", estado: "", capacidad: 0 }; cargarLocales();
  }
  async function eliminarLocal(id: number) {
     if(confirm("¿Borrar salón?")) { await invoke('eliminar_local', { id }); cargarLocales(); }
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
            <button class="btn-nav" on:click={irInicio} title="Inicio"><Home size={18}/><span>Inicio</span></button>
            <button class="btn-icon" on:click={cambiarTema}>
                {#if temaActual==='claro'}<Sun size={18}/>{:else if temaActual==='oscuro'}<Moon size={18}/>{:else}<Monitor size={18}/>{/if}
            </button>
            <button class="btn-nav" on:click={()=>mostrarModalLocales=true}><Building size={16}/><span>Salones</span></button>
            <button class="btn-icon" on:click={irConfig}><Settings size={18}/></button>
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
            <div class="modal-top"><h3>Gestión de Salones</h3><button on:click={()=>mostrarModalLocales=false}><X size={20}/></button></div>
            <div class="form-grid">
                <input placeholder="Nombre" bind:value={nuevoLocal.nombre}>
                <input placeholder="Ciudad" bind:value={nuevoLocal.ciudad}>
                <button class="btn-blue" on:click={guardarLocal}>Guardar</button>
            </div>
            <div class="list-scroll">
                {#each listaLocales as l}
                    <div class="list-item"><span>{l.nombre}</span><button class="btn-red" on:click={()=>eliminarLocal(l.id)}><Trash2 size={14}/></button></div>
                {/each}
            </div>
        </div>
      </div>
    {/if}
</div>

<style>
  /* VARIABLES */
  :global(:root) {
      --bg-body: #f8fafc; --bg-card: #ffffff; --text-main: #1e293b; --text-sec: #64748b;
      --border: #e2e8f0; --primary: #0078d4; 
      --status-bg: #EBEBEB; --status-text: #000000;
  }
  :global(html.dark-theme) {
      --bg-body: #0f172a; --bg-card: #1e293b; --text-main: #f8fafc; --text-sec: #cbd5e1;
      --border: #334155; --primary: #3b82f6;
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
  .btn-nav { background: var(--bg-body); border: 1px solid var(--border); padding: 8px 12px; border-radius: 8px; cursor: pointer; display: flex; gap: 6px; color: var(--text-main); font-weight: 600; }
  .btn-icon { background: transparent; border: 1px solid transparent; padding: 8px; cursor: pointer; color: var(--text-sec); }
  .btn-nav:hover, .btn-icon:hover { background: var(--border); }

  /* FOOTER */
  .status-bar { position: fixed; bottom: 0; width: 100%; height: 32px; background: var(--status-bg); color: var(--status-text); display: flex; justify-content: space-between; align-items: center; padding: 0 15px; font-size: 12px; font-weight: 600; border-top: 1px solid var(--border); z-index: 100; transition: background 0.3s; box-sizing: border-box; }
  .status-center span, .tech { color: inherit; } .tech { color: #059669; }
  .dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; display: inline-block; margin-right: 5px; }

  /* MODAL */
  .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(2px); }
  .modal-box { background: var(--bg-card); padding: 20px; border-radius: 12px; width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); border: 1px solid var(--border); }
  .modal-top { display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: 700; }
  .form-grid { display: flex; gap: 5px; margin-bottom: 10px; }
  .form-grid input { flex: 1; padding: 8px; border: 1px solid var(--border); background: var(--bg-body); color: var(--text-main); border-radius: 6px; }
  .btn-blue { background: var(--primary); color: white; border: none; padding: 0 15px; border-radius: 6px; cursor: pointer; }
  .list-item { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border); }
  .btn-red { color: #ef4444; background: none; border: none; cursor: pointer; }
  button { font-family: inherit; }
</style>