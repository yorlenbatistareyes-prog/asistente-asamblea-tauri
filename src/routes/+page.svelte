<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
 import { getVersion } from '@tauri-apps/api/app';
  import { invoke } from '@tauri-apps/api/core';
  import { ask } from "@tauri-apps/plugin-dialog";
  import { goto } from '$app/navigation';
  import { 
    Plus, MapPin, Calendar, Briefcase, Trash2,
    Mail, Mic, UserCheck, MessageSquare, ChevronRight, Settings, X, Building, Map, LayoutGrid,
    User, Users, Clock,
    Sun, Moon, Monitor, Lectern, Activity // Iconos para el tema
  } from 'lucide-svelte';
  
  // --- IMPORTACIÓN DE COMPONENTES ---
  import Correspondencia from '$lib/components/gestion/Correspondencia.svelte';
  import Configuracion from '$lib/components/gestion/Configuracion.svelte';
 
  // --- ESTADO ---
  let vistaActual = 'inicio';
  let seccionCorrespondencia = 'oradores'; 
  
  // VARIABLES RELOJ
  let horaActual = "";
  let fechaActual = "";
  let saludo = "Hola"; 
  let intervaloReloj: any;

  // ESTADO DEL TEMA
  let temaActual = 'sistema'; // 'sistema', 'claro', 'oscuro'

  // Listas de datos
  let listaAsambleas: any[] = [];
  let listaLocales: any[] = []; 

  // --- VARIABLES MODALES ---
  let mostrarModalAsamblea = false;
  let nuevaAsamblea = { tema: "", fecha: "", local_id: null as number | null, local_nombre: "", identificador: "" };
  let mostrarModalLocales = false;
  let nuevoLocal = { nombre: "", direccion: "", ciudad: "", estado: "", capacidad: 0 };

  let nombreUsuario = ""; // Se llenará cuando cargue la configuración
  let versionReal = "";

  onMount(async () => { // <--- Añadimos 'async' aquí
    // 1. Cargamos la versión real de la app
    try {
        versionReal = await getVersion();
    } catch (error) {
        console.error("No se pudo obtener la versión:", error);
        versionReal = "1.0.0"; // Valor de respaldo
    }

    // 2. Ejecutamos tus funciones actuales
    cargarDatos();
    iniciarReloj(); 
    cargarTemaGuardado(); 
});

  onDestroy(() => {
    if (intervaloReloj) clearInterval(intervaloReloj); 
  });

  // ==========================================
  // LÓGICA DE TEMAS (DARK / LIGHT / SYSTEM)
  // ==========================================
  function cargarTemaGuardado() {
    const temaGuardado = localStorage.getItem('temaApp');
    if (temaGuardado) {
        temaActual = temaGuardado;
    }
    aplicarTema(temaActual);
  }

  function cambiarTema() {
      // Ciclo: Sistema -> Claro -> Oscuro -> Sistema
      if (temaActual === 'sistema') temaActual = 'claro';
      else if (temaActual === 'claro') temaActual = 'oscuro';
      else temaActual = 'sistema';

      localStorage.setItem('temaApp', temaActual);
      aplicarTema(temaActual);
  }

  function aplicarTema(modo: string) {
      const root = document.documentElement;
      const esOscuroSistema = window.matchMedia('(prefers-color-scheme: dark)').matches;

      if (modo === 'oscuro' || (modo === 'sistema' && esOscuroSistema)) {
          root.classList.add('dark-theme');
      } else {
          root.classList.remove('dark-theme');
      }
  }

  // ==========================================
  // LÓGICA DEL RELOJ
  // ==========================================
  function iniciarReloj() {
    actualizarTiempo(); 
    intervaloReloj = setInterval(actualizarTiempo, 1000); 
  }

  function actualizarTiempo() {
    const ahora = new Date();
    horaActual = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
    const opcionesFecha: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    let fechaRaw = ahora.toLocaleDateString('es-ES', opcionesFecha);
    fechaActual = fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1);
    const hora = ahora.getHours(); 
    if (hora >= 6 && hora < 12) saludo = "Buenos días";
    else if (hora >= 12 && hora < 20) saludo = "Buenas tardes";
    else saludo = "Buenas noches";
  }
async function cargarDatos() {
    try {
      const [asambleas, locales, configData] = await Promise.all([
        invoke('obtener_asambleas'),
        invoke('obtener_locales'),
        invoke('obtener_configuracion_general')
      ]);

      listaAsambleas = asambleas as any[];
      listaLocales = locales as any[];
      
      // Forzamos la lectura de la configuración
      if (configData) {
        const c = configData as any;
        // IMPORTANTE: Prueba si es .nombre o .nombre_usuario
        // Ponemos un log para que lo veas en la consola (F12)
        console.log("Datos de configuración recibidos:", c);
        
        nombreUsuario = c.nombre || c.nombre_usuario || "Yorlen";
      }

    } catch (e) { 
      console.error("Error crítico en carga:", e); 
    }
  }

  // LÓGICA DE SALONES
  async function guardarLocal() {
    if (!nuevoLocal.nombre) return alert("Escribe el nombre del salón");
    try {
      await invoke('crear_local', { ...nuevoLocal, capacidad: Number(nuevoLocal.capacidad) });
      nuevoLocal = { nombre: "", direccion: "", ciudad: "", estado: "", capacidad: 0 }; 
      listaLocales = await invoke('obtener_locales') as any[];
    } catch (e) { alert("Error al guardar local: " + e); }
  }

  async function eliminarLocal(id: number) {
    if (!confirm("¿Borrar este salón de la base de datos?")) return;
    try { await invoke('eliminar_local', { id }); listaLocales = await invoke('obtener_locales') as any[]; } catch (e) { alert(e); }
  }

  // LÓGICA DE ASAMBLEAS
  function abrirCrearAsamblea() {
    // 1. Limpiamos también el identificador al abrir
    nuevaAsamblea = { tema: "", fecha: "", local_id: null, local_nombre: "", identificador: "" };
    mostrarModalAsamblea = true;
  }

  async function guardarNuevaAsamblea() {
    if (!nuevaAsamblea.tema || !nuevaAsamblea.fecha) return alert("Falta Tema o Fecha");
    
    let nombreLugar = "Sin asignar";
    let idLocalFinal = null;
    
    if (nuevaAsamblea.local_id) {
        const localObj = listaLocales.find(l => l.id === nuevaAsamblea.local_id);
        if (localObj) { 
            nombreLugar = localObj.nombre; 
            idLocalFinal = localObj.id; 
        }
    }

    try {
      // 2. Enviamos el 'identificador' a Rust junto con los demás datos
      await invoke('crear_asamblea', { 
        tema: nuevaAsamblea.tema, 
        fecha: nuevaAsamblea.fecha, 
        lugar: nombreLugar, 
        localId: idLocalFinal,
        identificador: nuevaAsamblea.identificador // 👈 LA PIEZA CLAVE
      });
      
      mostrarModalAsamblea = false; 
      cargarDatos();
    } catch (e) { 
      alert("Error: " + e); 
    }
  }

  async function eliminarAsamblea(id: number, e: Event) {
    // Evita que se abra la asamblea al intentar borrarla
    e.stopPropagation(); 

    // 1. Llamamos a la ventana nativa (ask)
    const confirmar = await ask(
    '¿Estás seguro de que deseas eliminar esta asamblea? Esta acción es permanente.', 
    { 
        title: 'Confirmar Eliminación', 
        kind: 'warning', // 👈 Cambia 'type' por 'kind' aquí
        okLabel: 'Eliminar',
        cancelLabel: 'Cancelar'
    }
);

    // 2. Si el usuario confirma (da clic en el botón de confirmación)
    if (confirmar) {
        try { 
            await invoke('eliminar_asamblea', { id }); 
            // Recargamos la lista para que la tarjeta desaparezca
            await cargarDatos(); 
        } catch (err) { 
            alert("Error al eliminar: " + err); 
        }
    }
}

  // NAVEGACIÓN
  function irAGestionar(item: any) {
    localStorage.setItem('asambleaActiva', JSON.stringify(item));
    goto('/gestion');
  }

  function irACorrespondencia(tipo: string) {
    seccionCorrespondencia = tipo;
    vistaActual = 'correspondencia';
  }

  function irAConfiguracion() {
    vistaActual = 'configuracion';
  }

  const volverAlInicio = () => vistaActual = 'inicio';
</script>

<div class="main-container" class:full-screen={vistaActual === 'configuracion'}>
  
  {#if vistaActual === 'inicio'}
    <header class="top-bar-welcome">
      <div class="welcome-left">
        <div class="avatar-circle"><User size={28} strokeWidth={2} /></div>
        <div class="user-info">
            <h2 class="greeting">{saludo}, Yorlen</h2> 
            <span class="current-date">{fechaActual}</span>
        </div>
      </div>

      <div class="welcome-center-clock">
        <Clock size={18} class="clock-icon"/>
        <span class="digital-clock">{horaActual}</span>
      </div>
      
      <div class="header-actions">
        <button class="btn-theme" on:click={cambiarTema} title="Cambiar Tema ({temaActual})">
            {#if temaActual === 'claro'} <Sun size={20} /> {/if}
            {#if temaActual === 'oscuro'} <Moon size={20} /> {/if}
            {#if temaActual === 'sistema'} <Monitor size={20} /> {/if}
        </button>

        <button class="btn-secondary" on:click={() => mostrarModalLocales = true}>
            <Building size={18} /><span>Salones</span>
        </button>

        <button class="btn-nueva" on:click={abrirCrearAsamblea}>
            <Plus size={18} /><span>Nueva Asamblea</span>
        </button>
        
        <button class="btn-config" on:click={irAConfiguracion} title="Configuración">
            <Settings size={20} />
        </button>
      </div>
    </header>

    <div class="dashboard">
      <section class="asambleas-list">
        <div class="section-header"><Lectern size={26} /> <span>MIS ASAMBLEAS</span></div>
        {#if listaAsambleas.length === 0}
            <div class="empty-state"><p>No tienes ninguna asamblea creada.</p><button on:click={abrirCrearAsamblea}>Crear la primera ahora</button></div>
        {:else}
            <div class="grid-asambleas">
                {#each listaAsambleas as item, i (item.id)}
                  <div class="card-hero" on:click={() => irAGestionar(item)} on:keydown role="button" tabindex="0">

                    <button class="btn-trash" on:click={(e) => eliminarAsamblea(item.id, e)} title="Eliminar"><Trash2 size={16} /></button>

                  <div class="hero-content">
      
                    <span class="status-pill">
                      {item.identificador ? item.identificador : `Asamblea ${i + 1}`}
                    </span>

                    <h2>{item.tema}</h2>
                    <div class="hero-details">
                       <span><Calendar size={14} /> {item.fecha}</span>
                       {#if item.lugar}<span><MapPin size={14} /> {item.lugar}</span>{/if}
                    </div>
                  </div>

                  <button class="btn-manage">Gestionar Datos &rarr;</button>

                  <div class="card-logo-bg">
                       <Lectern size={120} strokeWidth={0.9} />
                  </div>
                </div>
               {/each}
            </div>
        {/if}
      </section>

      <section class="gestion-global">
        <div class="section-header"><Mail size={24} /> <span>PLANTILLAS GLOBALES</span></div>
        <div class="grid-cartas">
          <button class="card-action" on:click={() => irACorrespondencia('oradores')}>
            <div class="card-icon oradores"><Mic size={22} /></div>
            <div class="card-text"><h3>Cartas a Oradores</h3><p>Editar plantilla global</p></div><ChevronRight size={16} />
          </button>
          <button class="card-action" on:click={() => irACorrespondencia('presidentes')}>
            <div class="card-icon presidentes"><UserCheck size={22} /></div>
            <div class="card-text"><h3>Cartas a Presidentes</h3><p>Editar plantilla global</p></div><ChevronRight size={16} />
          </button>
          <button class="card-action" on:click={() => irACorrespondencia('oraciones')}>
            <div class="card-icon oraciones"><MessageSquare size={22} /></div>
            <div class="card-text"><h3>Cartas de Oración</h3><p>Editar plantilla global</p></div><ChevronRight size={16} />
          </button>
        </div>
      </section>
    </div>

    {#if mostrarModalAsamblea}
      <div class="modal-backdrop" on:click|self={() => mostrarModalAsamblea = false}>
        <div class="modal-content">
          <div class="modal-header"><h3>Nueva Asamblea</h3><button class="btn-close" on:click={() => mostrarModalAsamblea = false}><X size={20}/></button></div>
          <div class="modal-body">
            
            <label>Identificador</label><input type="text" placeholder="Ej: Holguín 2026" bind:value={nuevaAsamblea.identificador} />
            
            <label>Tema de la Asamblea</label><input type="text" placeholder="Ej: ¡Prediquemos...!" bind:value={nuevaAsamblea.tema} />
            <label>Fecha</label><input type="text" placeholder="Ej: 25-27 de Julio" bind:value={nuevaAsamblea.fecha} />
            <label>Lugar / Salón</label>
            <div class="select-wrapper">
                <select bind:value={nuevaAsamblea.local_id}>
                    <option value={null}>-- Seleccionar Salón --</option>
                    {#each listaLocales as l}<option value={l.id}>{l.nombre}</option>{/each}
                </select>
                <button class="btn-mini-add" on:click={() => { mostrarModalAsamblea = false; mostrarModalLocales = true; }}><Plus size={16}/></button>
            </div>
          </div>
          <div class="modal-footer"><button class="btn-cancel" on:click={() => mostrarModalAsamblea = false}>Cancelar</button><button class="btn-confirm" on:click={guardarNuevaAsamblea}>Crear Asamblea</button></div>
        </div>
      </div>
    {/if}

    {#if mostrarModalLocales}
  <div class="modal-backdrop" on:click|self={() => mostrarModalLocales = false}>
    <div class="modal-content large">
      
      <div class="modal-header">
        <h3><Building size={20} style="margin-right:8px"/> Gestionar Salones</h3>
        <button class="btn-close" on:click={() => mostrarModalLocales = false}><X size={20}/></button>
      </div>
      
      <div class="modal-body">
        <div class="form-local-grid">
            <div class="input-group full-width"><label>Nombre del Lugar</label><input type="text" bind:value={nuevoLocal.nombre}/></div>
            <div class="input-group full-width"><label>Dirección</label><input type="text" bind:value={nuevoLocal.direccion}/></div>
            <div class="input-group"><label>Ciudad</label><input type="text" bind:value={nuevoLocal.ciudad}/></div>
            <div class="input-group"><label>Estado / Provincia</label><input type="text" bind:value={nuevoLocal.estado}/></div>
            <div class="input-group"><label>Capacidad</label><input type="number" bind:value={nuevoLocal.capacidad} min="0"/></div>
            <div class="action-area"><button class="btn-confirm-small" on:click={guardarLocal}><Plus size={16}/> Guardar Salón</button></div>
        </div>
        
        <div class="separador"></div>
        
        <div class="lista-locales-scroll">
            {#each listaLocales as l}
                <div class="item-local">
                    <div class="icon-box"><Building size={20}/></div>
                    <div class="info-local">
                        <strong class="nombre-local">{l.nombre}</strong>
                        
                        <div class="grid-detalles-local" style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                            
                            <div class="detalle-fila" style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary, #6b7280);">
                                <MapPin size={13} class="icon-gris"/> 
                                <span>{l.direccion || 'Sin dirección'}</span>
                            </div>

                            <div class="detalle-fila" style="display: flex; align-items: center; gap: 15px; font-size: 12px; color: var(--text-secondary, #6b7280);">
                                {#if l.ciudad || l.estado}
                                    <span>
                                      <Map size={13} class="icon-gris"/>
                                        {l.ciudad || ''}{l.ciudad && l.estado ? ', ' : ''}{l.estado || ''}
                                    </span>
                                {/if}
                                
                                {#if l.capacidad && l.capacidad > 0}
                                    <span> 
                                      <Users size={13} class="icon-gris"/>
                                        Capacidad: <strong>{l.capacidad}</strong>
                                    </span>
                                {/if}
                            </div>

                        </div>
                    </div>
                    <button class="btn-trash-mini" on:click={() => eliminarLocal(l.id)}><Trash2 size={16}/></button>
                </div>
            {:else}
                <div class="empty-locales"><LayoutGrid size={32} /><p>No hay salones registrados aún.</p></div>
            {/each}
        </div>

      </div>
    </div>
  </div>
{/if}

  {:else if vistaActual === 'correspondencia'}
    <Correspondencia seccionInicial={seccionCorrespondencia} on:close={volverAlInicio} />

  {:else if vistaActual === 'configuracion'}
    <Configuracion on:close={volverAlInicio} />
  {/if}

  <footer class="status-bar">
    <div class="status-left">
        <div class="connection-status">
            <span class="dot pulse"></span>
            <span class="status-label">Sistema Conectado <strong class="tech-stack">(Rust/Tauri)</strong></span>
        </div>
        
        <span class="separator">|</span>
        
        <div class="user-status">
            <User size={18} />
            <span>Usuario: <strong>{nombreUsuario || 'Invitado'}</strong></span>
        </div>
    </div>

    <div class="status-center">
        <span>Construido y diseñado para Presidentes de Asambleas Regionales</span>
    </div>

    <div class="status-right">
    <div class="stat-item">
        <Lectern size={18} />
        <span>Asambleas: <strong>{listaAsambleas.length}</strong></span>
    </div>
    
    <span class="separator">|</span>
    
    <div class="version-info">
        <Activity size={16} />
        <span class="app-version">v{versionReal}</span>
    </div>
</div>
</footer>
</div>

<style>
  /* === VARIABLES GLOBALES DE TEMA (Se aplicarán a toda la app) === */
  :global(:root) {
      /* CLARO (Default) */
      --bg-body: #f8fafc;
      --bg-card: #ffffff;
      --bg-secondary: #f1f5f9;
      --text-main: #1e293b;
      --text-secondary: #64748b;
      --border-color: #e2e8f0;
      --primary: #0078d4;
      --input-bg: #ffffff;
      --shadow-color: rgba(0,0,0,0.05);
      --hover-bg: #e2e8f0;
  }

  :global(html.dark-theme) {
      /* OSCURO */
      --bg-body: #0f172a;       
      --bg-card: #1e293b;       
      --bg-secondary: #334155;  
      --text-main: #f8fafc;     
      --text-secondary: #cbd5e1; 
      --border-color: #334155;  
      --primary: #3b82f6;       
      --input-bg: #1e293b;
      --shadow-color: rgba(0,0,0,0.3);
      --hover-bg: #334155;
  }

  /* Aplicar estilos globales al body */
  :global(body) { 
      margin: 0; 
      font-family: 'Segoe UI', sans-serif; 
      background: var(--bg-body); 
      color: var(--text-main); 
      transition: background 0.3s, color 0.3s;
  }

  .main-container { padding: 40px; max-width: 1200px; margin: 0 auto; transition: all 0.2s; }
  .main-container.full-screen { padding: 0; max-width: 100%; height: 100vh; overflow: hidden; background: var(--bg-body); }

  /* HEADER */
  .top-bar-welcome { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 40px; 
    background: var(--bg-card); 
    padding: 15px 30px; 
    border-radius: 16px; 
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    border: 1px solid var(--border-color); 
}

  .welcome-left { display: flex; align-items: center; gap: 15px; }
  .avatar-circle { width: 50px; height: 50px; background: linear-gradient(135deg, var(--primary), #005a9e); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 10px rgba(0, 120, 212, 0.3); }
  .user-info { display: flex; flex-direction: column; }
  .greeting { margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px; }
  .current-date { font-size: 13px; color: var(--text-secondary); text-transform: capitalize; font-weight: 500; }
  
  .welcome-center-clock { 
      display: flex; align-items: center; gap: 8px; 
      background: var(--bg-body); 
      padding: 8px 16px; border-radius: 12px; 
      border: 1px solid var(--border-color); 
  }
  .digital-clock { font-size: 20px; font-weight: 700; color: var(--text-main); font-family: 'Segoe UI', monospace; letter-spacing: 1px; }
  .clock-icon { color: var(--primary); }
  
  .header-actions { display: flex; align-items: center; gap: 10px; }
  
  /* Botones adaptados al tema */
  .btn-theme { 
      background: var(--bg-card); border: 1px solid var(--border-color); 
      padding: 10px; border-radius: 10px; cursor: pointer; color: var(--text-secondary); 
      display: flex; align-items: center; justify-content: center; transition: all 0.2s; 
  }
  .btn-theme:hover { background: var(--hover-bg); color: var(--text-main); }

  .btn-nueva { background-color: #1e293b; color: white; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 10px rgba(30, 41, 59, 0.2); }
  .btn-nueva:hover { background-color: #334155; transform: translateY(-2px); }
  
  .btn-secondary { background-color: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border-color); padding: 10px 18px; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
  .btn-secondary:hover { background-color: var(--hover-bg); border-color: var(--border-color); color: var(--text-main); }
  
  .btn-config { background: var(--bg-card); border: 1px solid var(--border-color); padding: 10px; border-radius: 10px; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .btn-config:hover { background: var(--hover-bg); color: var(--text-main); border-color: var(--border-color); }

  /* DASHBOARD */
  .dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .section-header { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 800; color: var(--text-secondary); letter-spacing: 1px; margin-bottom: 20px; text-transform: uppercase; }
  .grid-asambleas {
    display: grid;
    /* Crea dos columnas si hay espacio, o una si la pantalla es pequeña */
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
    gap: 20px;
    /* Limitamos la altura para que no se pierdan hacia abajo */
    max-height: 65vh; 
    overflow-y: auto;
    padding: 10px 15px 10px 5px; /* Espacio para que no se corte la sombra */
}

/* Estilo para que el scroll de la lista sea discreto */
.grid-asambleas::-webkit-scrollbar {
    width: 6px;
}
.grid-asambleas::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 10px;
}
  
  /* Tarjetas y Elementos */
  .card-hero { 
    background: linear-gradient(135deg, var(--primary) 0%, #005a9e 100%); 
    padding: 40px 25px 25px 25px; /* Reducimos un poco el padding */
    border-radius: 20px; 
    color: white; 
    cursor: pointer; 
    box-shadow: 0 10px 20px var(--shadow-color); 
    transition: transform 0.2s, box-shadow 0.2s; 
    position: relative; 
    overflow: hidden;
    min-height: 200px; /* Altura controlada */
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.card-hero h2 { 
    font-size: 20px; /* Bajamos de 24px a 20px para que no rompa en dos columnas */
    margin: 5px 0 10px 0; 
    line-height: 1.2; 
    font-weight: 700;
}

  .card-hero:hover { transform: translateY(-5px); }
  .hero-content {
    position: relative;
    z-index: 1;
    margin-top: 15px; /* 👈 Espacio para que el botón de arriba respire */
    display: flex;
    flex-direction: column;
}

.status-pill { 
    background: rgba(255,255,255,0.2); 
    padding: 4px 12px; 
    border-radius: 20px; 
    font-size: 11px; 
    font-weight: 700; 
    margin-bottom: 5px; 
    align-self: flex-start; /* Asegura que se alinee a la izquierda */
}
  
  .hero-details { display: flex; flex-direction: column; gap: 8px; opacity: 0.9; font-size: 14px; }
  .hero-details span { display: flex; align-items: center; gap: 8px; }
  .btn-manage { margin-top: 25px; background: white; color: var(--primary); border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; width: 100%; }
  .btn-trash { 
    position: absolute; 
    top: 12px; 
    left: 12px; /* 👈 Cambiado de 'right' a 'left' */
    right: auto; 
    
    background: #ef4444; /* Rojo desde el inicio para que se vea claro */
    border: none; 
    color: white; 
    padding: 6px; 
    border-radius: 6px; 
    cursor: pointer; 
    opacity: 0.8; 
    transition: all 0.2s; 
    z-index: 10; 
    display: flex;
    align-items: center;
    justify-content: center;
}

.card-hero:hover .btn-trash { 
    opacity: 1; 
    transform: scale(1.1); 
}
  
  .empty-state { border: 2px dashed var(--border-color); border-radius: 20px; padding: 40px; text-align: center; color: var(--text-secondary); }
  .empty-state button { margin-top: 10px; padding: 8px 16px; background: var(--bg-secondary); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; color: var(--text-secondary); }

  .grid-cartas { display: flex; flex-direction: column; gap: 12px; }
  .card-action { 
    background: var(--bg-card); 
    border: 1px solid var(--border-color); 
    padding: 16px 20px; 
    border-radius: 12px; 
    display: flex; 
    align-items: center; 
    gap: 15px; 
    cursor: pointer; 
    transition: all 0.2s ease-in-out; 
    width: 100%; 
    text-align: left;
    position: relative;
    box-shadow: 0 1px 3px var(--shadow-color);
}

.card-action::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 12px 0 0 12px;
    background: transparent;
}

/* Colores por sección */
.card-action:has(.oradores)::before { background: #22c55e; }
.card-action:has(.presidentes)::before { background: #3b82f6; }
.card-action:has(.oraciones)::before { background: #f97316; }

  .card-action:hover { 
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    border-color: var(--primary);
}

  .card-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .oradores { background: #f0fdf4; color: #16a34a; } .presidentes { background: #eff6ff; color: #2563eb; } .oraciones { background: #fff7ed; color: #ea580c; }
  .card-text h3 { margin: 0; font-size: 16px; color: var(--text-main); } .card-text p { margin: 2px 0 0; font-size: 12px; color: var(--text-secondary); }

  /* MODALS ACTUALIZADOS A TEMA */
  .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .modal-content { background: var(--bg-card); padding: 25px; border-radius: 16px; width: 400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); border: 1px solid var(--border-color); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; } 
  .modal-header h3 { margin: 0; font-size: 18px; color: var(--text-main); display: flex; align-items: center; }
  .btn-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
  
  .modal-body { display: flex; flex-direction: column; gap: 10px; }
  .modal-body label { font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px; display: block; }
  .modal-body input, select { padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box; background: var(--input-bg); color: var(--text-main); }
  .modal-body input:focus, select:focus { border-color: var(--primary); }

  .select-wrapper { display: flex; gap: 5px; }
  .btn-mini-add { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--primary); border-radius: 8px; width: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .btn-mini-add:hover { background: var(--bg-body); }

  .modal-content.large { width: 700px; max-width: 95vw; }
  .form-local-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; background: var(--bg-body); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); }
  .input-group { display: flex; flex-direction: column; } .full-width { grid-column: span 3; }
  .action-area { grid-column: span 3; display: flex; justify-content: flex-end; margin-top: 10px; }
  .btn-confirm-small { background: var(--primary); border: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; }
  .btn-confirm-small:hover { opacity: 0.9; }
  
  .separador { height: 1px; background: var(--border-color); margin: 20px 0; }
  .lista-locales-scroll { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 5px; }
  
  .item-local { display: flex; align-items: flex-start; gap: 15px; padding: 15px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--bg-card); transition: all 0.2s; }
  .item-local:hover { border-color: var(--primary); box-shadow: 0 4px 6px -2px var(--shadow-color); }
  
  .icon-box { width: 40px; height: 40px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); flex-shrink: 0; }
  .info-local { flex: 1; display: flex; flex-direction: column; gap: 4px; } .nombre-local { font-size: 15px; color: var(--text-main); margin-bottom: 2px; }
  .detalle-fila { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .icon-gris { color: var(--text-secondary); flex-shrink: 0; }
  .text-cap { font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
  
  .btn-trash-mini { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 8px; border-radius: 6px; transition: all 0.2s; height: fit-content; } 
  .btn-trash-mini:hover { background: #fee2e2; color: #ef4444; }
  
  .empty-locales { text-align: center; color: var(--text-secondary); padding: 30px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; }
  .btn-cancel { background: var(--bg-card); border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; color: var(--text-secondary); }
  .btn-confirm { background: var(--primary); border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; color: white; display: flex; align-items: center; gap: 5px; }
  .btn-confirm:hover { opacity: 0.9; }

  .card-logo-bg {
    position: absolute;
    top: 15px;    /* 👈 Ubicado arriba */
    right: 15px;  /* 👈 Ubicado a la derecha */
    color: white;
    opacity: 0.70;
    transform: scale(0.65); 
    pointer-events: none; 
    z-index: 0;
}

/* Asegura que el contenido quede encima del icono */
.hero-content {
    position: relative;
    z-index: 1;
    margin-top: 15px; /* 👈 Espacio para que el botón de arriba respire */
    display: flex;
    flex-direction: column;
}

.asambleas-list, .gestion-global {
    background: rgba(255, 255, 255, 0.5); /* Fondo casi transparente */
    padding: 25px;
    border-radius: 20px;
    border: 1px solid var(--border-color);
}
.section-header {
    background: var(--bg-body);
    padding: 8px 15px;
    border-radius: 10px;
    width: fit-content;
    margin-bottom: 25px;
}

/* BARRA DE ESTADO FINAL */
  .status-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 35px;
      background-color: #1e293b; /* Azul marino profundo casi negro */
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 15px;
      font-size: 14px;
      z-index: 1000;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.2);
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.3px;
      font-family: system-ui, -apple-system, sans-serif;
  }

  /* Para la versión y etiquetas secundarias */
.status-bar span {
  color: rgba(255, 255, 255, 0.9); /* Un blanco más sólido */
}

  .status-left, .status-right {
      display: flex;
      align-items: center;
      gap: 15px;
      flex: 1.5;
  }

  .status-right {
    justify-content: flex-end; /* Empuja el reloj y versión a la derecha */
}

.status-center {
    flex: 2;
    text-align: center;
    font-size: 12.5px;
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
}

  .user-status, .stat-item, .version-info {
    display: flex;
    align-items: center;
    gap: 8px; /* Espacio entre icono y texto */
}

  .connection-status {
      display: flex;
      align-items: center;
      gap: 8px;
  }

  /* El punto verde con animación */
  .dot {
      width: 7px;
      height: 7px;
      background-color: #22c55e;
      border-radius: 50%;
  }

  .dot.pulse {
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
      animation: pulse-green 2s infinite;
  }

  @keyframes pulse-green {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
  }

  .separator {
    margin: 0 10px;
    opacity: 0.3;
    font-weight: 300;
}

  .status-bar strong {
  color: #ffffff;
  font-weight: 700;
  margin-left: 4px;
}

  /* Ajuste de iconos para que no brillen demasiado */
  :global(.status-bar svg) {
      opacity: 0.7;
  }

  .connection-status strong {
    color: #4ade80; /* Un verde vibrante pero profesional */
    font-weight: 600;
    margin-left: 5px;
}

.status-center span {
    font-weight: 400;
    letter-spacing: 0.3px;
    /* Al ser un texto largo, un tamaño ligeramente menor ayuda a que no se vea apretado */
    font-size: 12.5px; 
}

.status-left {
    display: flex;
    align-items: center;
    gap: 15px; /* Espacio entre el grupo de conexión y el de usuario */
    flex: 1.5;
}

.connection-group, .user-group {
    display: flex;
    flex-direction: row; /* Fuerza a que el texto y el icono estén al lado */
    align-items: center;
    white-space: nowrap; /* Prohíbe que el texto salte a una segunda línea */
    gap: 8px;
}

.tech-stack {
    color: #4ade80; /* El verde que ya tienes */
    margin-left: 6px; /* Separación del texto "Sistema Conectado" */
    font-weight: 600;
}

.status-label {
    display: inline-flex; /* Permite que el contenido se comporte como texto corrido */
    align-items: center;
}
</style>