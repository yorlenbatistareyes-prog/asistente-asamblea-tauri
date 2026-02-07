<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { goto } from '$app/navigation';
  import { 
    Plus, MapPin, Calendar, Briefcase, Trash2,
    Mail, Mic, UserCheck, MessageSquare, ChevronRight, Settings, X, Building, Map, LayoutGrid,
    User, Clock 
  } from 'lucide-svelte';
  
  // --- IMPORTACIÓN DE COMPONENTES ---
  import Correspondencia from '$lib/components/gestion/Correspondencia.svelte';
  // Asegúrate de que la ruta sea correcta según donde creaste el archivo:
  import Configuracion from '$lib/components/gestion/Configuracion.svelte';

  // --- ESTADO ---
  let vistaActual = 'inicio'; // Valores posibles: 'inicio', 'correspondencia', 'configuracion'
  let seccionCorrespondencia = 'oradores'; 
  
  // VARIABLES DE RELOJ, FECHA Y SALUDO
  let horaActual = "";
  let fechaActual = "";
  let saludo = "Hola"; 
  let intervaloReloj: any;

  // Listas de datos
  let listaAsambleas: any[] = [];
  let listaLocales: any[] = []; 

  // --- VARIABLES MODAL ASAMBLEA ---
  let mostrarModalAsamblea = false;
  let nuevaAsamblea = { tema: "", fecha: "", local_id: null as number | null, local_nombre: "" };

  // --- VARIABLES MODAL SALONES ---
  let mostrarModalLocales = false;
  let nuevoLocal = { 
      nombre: "", 
      direccion: "", 
      ciudad: "", 
      estado: "", 
      capacidad: 0 
  };

  onMount(() => {
    cargarDatos();
    iniciarReloj(); 
  });

  onDestroy(() => {
    if (intervaloReloj) clearInterval(intervaloReloj); 
  });

  // ==========================================
  // LÓGICA DEL RELOJ Y TIEMPO
  // ==========================================
  function iniciarReloj() {
    actualizarTiempo(); 
    intervaloReloj = setInterval(actualizarTiempo, 1000); 
  }

  function actualizarTiempo() {
    const ahora = new Date();
    
    // Hora
    horaActual = ahora.toLocaleTimeString('es-ES', { 
        hour: '2-digit', minute: '2-digit', hour12: true 
    });

    // Fecha
    const opcionesFecha: Intl.DateTimeFormatOptions = { 
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
    };
    let fechaRaw = ahora.toLocaleDateString('es-ES', opcionesFecha);
    fechaActual = fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1);

    // Saludo
    const hora = ahora.getHours(); 
    if (hora >= 6 && hora < 12) saludo = "Buenos días";
    else if (hora >= 12 && hora < 20) saludo = "Buenas tardes";
    else saludo = "Buenas noches";
  }

  async function cargarDatos() {
    try {
      const [asambleas, locales] = await Promise.all([
        invoke('obtener_asambleas'),
        invoke('obtener_locales')
      ]);
      listaAsambleas = asambleas as any[];
      listaLocales = locales as any[];
    } catch (e) { console.error(e); }
  }

  // ==========================================
  // LÓGICA DE LOCALES
  // ==========================================
  async function guardarLocal() {
    if (!nuevoLocal.nombre) return alert("Escribe el nombre del salón");
    try {
      await invoke('crear_local', { 
        nombre: nuevoLocal.nombre, 
        direccion: nuevoLocal.direccion, 
        ciudad: nuevoLocal.ciudad,
        estado: nuevoLocal.estado,
        capacidad: Number(nuevoLocal.capacidad) 
      });
      
      nuevoLocal = { nombre: "", direccion: "", ciudad: "", estado: "", capacidad: 0 }; 
      listaLocales = await invoke('obtener_locales') as any[];
    } catch (e) { alert("Error al guardar local: " + e); }
  }

  async function eliminarLocal(id: number) {
    if (!confirm("¿Borrar este salón de la base de datos?")) return;
    try {
      await invoke('eliminar_local', { id });
      listaLocales = await invoke('obtener_locales') as any[];
    } catch (e) { alert(e); }
  }

  // ==========================================
  // LÓGICA DE ASAMBLEAS
  // ==========================================
  function abrirCrearAsamblea() {
    nuevaAsamblea = { tema: "", fecha: "", local_id: null, local_nombre: "" };
    mostrarModalAsamblea = true;
  }

  async function guardarNuevaAsamblea() {
    if (!nuevaAsamblea.tema || !nuevaAsamblea.fecha) return alert("Falta Tema o Fecha");

    let nombreLugar = "";
    let idLocalFinal = null;

    if (nuevaAsamblea.local_id) {
        const localObj = listaLocales.find(l => l.id === nuevaAsamblea.local_id);
        if (localObj) {
            nombreLugar = localObj.nombre;
            idLocalFinal = localObj.id;
        }
    } else {
        nombreLugar = "Sin asignar"; 
    }

    try {
      await invoke('crear_asamblea', { 
        tema: nuevaAsamblea.tema, 
        fecha: nuevaAsamblea.fecha, 
        lugar: nombreLugar,
        localId: idLocalFinal
      });
      
      mostrarModalAsamblea = false;
      cargarDatos();
    } catch (e) { alert("Error: " + e); }
  }

  async function eliminarAsamblea(id: number, e: Event) {
    e.stopPropagation(); 
    if (confirm("¿Seguro que quieres eliminar esta asamblea y todos sus datos?")) {
      try { await invoke('eliminar_asamblea', { id }); cargarDatos(); } catch (err) { alert(err); }
    }
  }

  // ==========================================
  // NAVEGACIÓN ENTRE VISTAS
  // ==========================================
  function irAGestionar(item: any) {
    localStorage.setItem('asambleaActiva', JSON.stringify(item));
    goto('/gestion');
  }

  function irACorrespondencia(tipo: string) {
    seccionCorrespondencia = tipo;
    vistaActual = 'correspondencia';
  }

  // FUNCIÓN PARA ABRIR CONFIGURACIÓN
  function irAConfiguracion() {
    vistaActual = 'configuracion';
  }

  // VOLVER AL INICIO (Se usa en el evento 'close' de los componentes hijos)
  const volverAlInicio = () => vistaActual = 'inicio';
</script>

<div class="main-container" class:full-screen={vistaActual === 'configuracion'}>
  
  {#if vistaActual === 'inicio'}
    
    <header class="top-bar-welcome">
      <div class="welcome-left">
        <div class="avatar-circle">
            <User size={28} strokeWidth={2} />
        </div>
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
        <button class="btn-secondary" on:click={() => mostrarModalLocales = true}>
            <Building size={18} />
            <span>Salones</span>
        </button>

        <button class="btn-nueva" on:click={abrirCrearAsamblea}>
            <Plus size={18} />
            <span>Nueva Asamblea</span>
        </button>
        
        <button class="btn-config" on:click={irAConfiguracion} title="Configuración">
            <Settings size={20} />
        </button>
      </div>
    </header>

    <div class="dashboard">
      
      <section class="asambleas-list">
        <div class="section-header">
          <Briefcase size={18} /> <span>MIS ASAMBLEAS</span>
        </div>
        
        {#if listaAsambleas.length === 0}
            <div class="empty-state">
                <p>No tienes ninguna asamblea creada.</p>
                <button on:click={abrirCrearAsamblea}>Crear la primera ahora</button>
            </div>
        {:else}
            <div class="grid-asambleas">
                {#each listaAsambleas as item (item.id)}
                    <div class="card-hero" on:click={() => irAGestionar(item)} on:keydown role="button" tabindex="0">
                      <button class="btn-trash" on:click={(e) => eliminarAsamblea(item.id, e)} title="Eliminar"><Trash2 size={16} /></button>
                      <div class="hero-content">
                        <span class="status-pill">#{item.id}</span>
                        <h2>{item.tema}</h2>
                        <div class="hero-details">
                          <span><Calendar size={14} /> {item.fecha}</span>
                          {#if item.lugar}<span><MapPin size={14} /> {item.lugar}</span>{/if}
                        </div>
                      </div>
                      <button class="btn-manage">Gestionar Datos &rarr;</button>
                    </div>
                {/each}
            </div>
        {/if}
      </section>

      <section class="gestion-global">
        <div class="section-header">
          <Mail size={18} /> <span>PLANTILLAS GLOBALES</span>
        </div>
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
            <label>Tema de la Asamblea</label>
            <input type="text" placeholder="Ej: ¡Prediquemos las buenas noticias!" bind:value={nuevaAsamblea.tema} />
            
            <label>Fecha</label>
            <input type="text" placeholder="Ej: 25-27 de Julio, 2025" bind:value={nuevaAsamblea.fecha} />
            
            <label>Lugar / Salón</label>
            <div class="select-wrapper">
                <select bind:value={nuevaAsamblea.local_id}>
                    <option value={null}>-- Seleccionar Salón --</option>
                    {#each listaLocales as l}
                        <option value={l.id}>{l.nombre}</option>
                    {/each}
                </select>
                <button class="btn-mini-add" on:click={() => { mostrarModalAsamblea = false; mostrarModalLocales = true; }} title="Crear nuevo salón">
                    <Plus size={16}/>
                </button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" on:click={() => mostrarModalAsamblea = false}>Cancelar</button>
            <button class="btn-confirm" on:click={guardarNuevaAsamblea}>Crear Asamblea</button>
          </div>
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
                <div class="input-group full-width">
                    <label>Nombre del Lugar</label>
                    <input type="text" placeholder="Ej: Salón de Asambleas del Cotorro" bind:value={nuevoLocal.nombre}/>
                </div>
                
                <div class="input-group full-width">
                    <label>Dirección</label>
                    <input type="text" placeholder="Calle, Número, Reparto..." bind:value={nuevoLocal.direccion}/>
                </div>

                <div class="input-group">
                    <label>Ciudad</label>
                    <input type="text" placeholder="Ej: La Habana" bind:value={nuevoLocal.ciudad}/>
                </div>

                <div class="input-group">
                    <label>Estado / Provincia</label>
                    <input type="text" placeholder="Ej: La Habana" bind:value={nuevoLocal.estado}/>
                </div>

                <div class="input-group">
                    <label>Capacidad</label>
                    <input type="number" placeholder="0" bind:value={nuevoLocal.capacidad} min="0"/>
                </div>

                <div class="action-area">
                    <button class="btn-confirm-small" on:click={guardarLocal}><Plus size={16}/> Guardar Salón</button>
                </div>
            </div>

            <div class="separador"></div>

            <div class="lista-locales-scroll">
                {#each listaLocales as l}
                    <div class="item-local">
                        <div class="icon-box"><Building size={20}/></div>
                        <div class="info-local">
                            <strong class="nombre-local">{l.nombre}</strong>
                            <div class="grid-detalles-local">
                                <div class="detalle-fila" title="Dirección">
                                    <MapPin size={13} class="icon-gris"/> 
                                    <span>{l.direccion || 'Sin dirección'}</span>
                                </div>
                                <div class="detalle-fila" title="Ciudad y Estado">
                                    <Map size={13} class="icon-gris"/> 
                                    <span>
                                        {#if l.ciudad && l.estado}
                                            {l.ciudad}, {l.estado}
                                        {:else if l.ciudad}
                                            {l.ciudad}
                                        {:else if l.estado}
                                            {l.estado}
                                        {:else}
                                            <span style="opacity: 0.5;">Ubicación no especificada</span>
                                        {/if}
                                    </span>
                                </div>
                                <div class="detalle-fila" title="Capacidad">
                                    <UserCheck size={13} class="icon-gris"/> 
                                    <span class="text-cap">{l.capacidad || 0} asientos</span>
                                </div>
                            </div>
                        </div>
                        <button class="btn-trash-mini" on:click={() => eliminarLocal(l.id)} title="Borrar Salón"><Trash2 size={16}/></button>
                    </div>
                {:else}
                    <div class="empty-locales">
                        <LayoutGrid size={32} />
                        <p>No hay salones registrados aún.</p>
                    </div>
                {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}

  {:else if vistaActual === 'correspondencia'}
    <Correspondencia 
      seccionInicial={seccionCorrespondencia} 
      on:close={volverAlInicio} 
    />

  {:else if vistaActual === 'configuracion'}
    <Configuracion 
      on:close={volverAlInicio} 
    />
  {/if}
</div>

<style>
  :global(body) { margin: 0; font-family: 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
  .main-container { padding: 40px; max-width: 1200px; margin: 0 auto; transition: all 0.2s; }
  
  /* Cuando está en config, quitamos el padding para que ocupe todo */
  .main-container.full-screen { padding: 0; max-width: 100%; height: 100vh; overflow: hidden; background: #1e293b; }

  /* HEADER */
  .top-bar-welcome { display: flex; justify-content: space-between; align-items: center; margin-bottom: 45px; background: white; padding: 15px 25px; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; }
  .welcome-left { display: flex; align-items: center; gap: 15px; }
  .avatar-circle { width: 50px; height: 50px; background: linear-gradient(135deg, #0078d4, #005a9e); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 10px rgba(0, 120, 212, 0.3); }
  .user-info { display: flex; flex-direction: column; }
  .greeting { margin: 0; font-size: 18px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px; }
  .current-date { font-size: 13px; color: #64748b; text-transform: capitalize; font-weight: 500; }
  .welcome-center-clock { display: flex; align-items: center; gap: 8px; background: #f8fafc; padding: 8px 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
  .digital-clock { font-size: 20px; font-weight: 700; color: #334155; font-family: 'Segoe UI', monospace; letter-spacing: 1px; }
  .clock-icon { color: #0078d4; }
  
  .header-actions { display: flex; align-items: center; gap: 10px; }
  .btn-nueva { background-color: #1e293b; color: white; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 10px rgba(30, 41, 59, 0.2); }
  .btn-nueva:hover { background-color: #334155; transform: translateY(-2px); }
  .btn-secondary { background-color: white; color: #475569; border: 1px solid #e2e8f0; padding: 10px 18px; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
  .btn-secondary:hover { background-color: #f8fafc; border-color: #cbd5e1; }
  .btn-config { background: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: 10px; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .btn-config:hover { background: #f8fafc; color: #334155; border-color: #cbd5e1; }

  /* DASHBOARD */
  .dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .section-header { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; margin-bottom: 20px; text-transform: uppercase; }
  .grid-asambleas { display: flex; flex-direction: column; gap: 20px; }
  .card-hero { background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%); padding: 30px; border-radius: 20px; color: white; cursor: pointer; box-shadow: 0 20px 25px -5px rgba(0, 120, 212, 0.2); transition: transform 0.2s; position: relative; }
  .card-hero:hover { transform: translateY(-5px); }
  .status-pill { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-bottom: 10px; display: inline-block; }
  .card-hero h2 { font-size: 24px; margin: 10px 0 15px 0; line-height: 1.2; }
  .hero-details { display: flex; flex-direction: column; gap: 8px; opacity: 0.9; font-size: 14px; }
  .hero-details span { display: flex; align-items: center; gap: 8px; }
  .btn-manage { margin-top: 25px; background: white; color: #0078d4; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; width: 100%; }
  .btn-trash { position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.2); border: none; color: white; padding: 8px; border-radius: 8px; cursor: pointer; opacity: 0; transition: opacity 0.2s; }
  .card-hero:hover .btn-trash { opacity: 1; } .btn-trash:hover { background: #ef4444; }
  .empty-state { border: 2px dashed #cbd5e1; border-radius: 20px; padding: 40px; text-align: center; color: #64748b; }
  .empty-state button { margin-top: 10px; padding: 8px 16px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; color: #475569; }
  .grid-cartas { display: flex; flex-direction: column; gap: 12px; }
  .card-action { background: white; border: 1px solid #e2e8f0; padding: 15px; border-radius: 16px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: all 0.2s; width: 100%; text-align: left; }
  .card-action:hover { border-color: #0078d4; transform: scale(1.01); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
  .card-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .oradores { background: #f0fdf4; color: #16a34a; } .presidentes { background: #eff6ff; color: #2563eb; } .oraciones { background: #fff7ed; color: #ea580c; }
  .card-text h3 { margin: 0; font-size: 16px; color: #1e293b; } .card-text p { margin: 2px 0 0; font-size: 12px; color: #64748b; }

  /* MODALS */
  .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .modal-content { background: white; padding: 25px; border-radius: 16px; width: 400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; } .modal-header h3 { margin: 0; font-size: 18px; color: #0f172a; display: flex; align-items: center; }
  .btn-close { background: none; border: none; cursor: pointer; color: #64748b; }
  .modal-body { display: flex; flex-direction: column; gap: 10px; }
  .modal-body label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; display: block; }
  .modal-body input, select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box; }
  .modal-body input:focus, select:focus { border-color: #0078d4; }
  .select-wrapper { display: flex; gap: 5px; }
  .btn-mini-add { background: #eff6ff; border: 1px solid #dbeafe; color: #2563eb; border-radius: 8px; width: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .btn-mini-add:hover { background: #dbeafe; }
  .modal-content.large { width: 700px; max-width: 95vw; }
  .form-local-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
  .input-group { display: flex; flex-direction: column; } .full-width { grid-column: span 3; }
  .action-area { grid-column: span 3; display: flex; justify-content: flex-end; margin-top: 10px; }
  .btn-confirm-small { background: #0078d4; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; }
  .btn-confirm-small:hover { background: #005a9e; }
  .separador { height: 1px; background: #e2e8f0; margin: 20px 0; }
  .lista-locales-scroll { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 5px; }
  .item-local { display: flex; align-items: flex-start; gap: 15px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; transition: all 0.2s; }
  .item-local:hover { border-color: #0078d4; box-shadow: 0 4px 6px -2px rgba(0,0,0,0.05); }
  .icon-box { width: 40px; height: 40px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #64748b; flex-shrink: 0; }
  .info-local { flex: 1; display: flex; flex-direction: column; gap: 4px; } .nombre-local { font-size: 15px; color: #1e293b; margin-bottom: 2px; }
  .grid-detalles-local { display: grid; grid-template-columns: 1fr auto; gap: 4px 15px; }
  .detalle-fila { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .icon-gris { color: #94a3b8; flex-shrink: 0; }
  .text-cap { font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
  .btn-trash-mini { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 8px; border-radius: 6px; transition: all 0.2s; height: fit-content; } 
  .btn-trash-mini:hover { background: #fee2e2; color: #ef4444; }
  .empty-locales { text-align: center; color: #cbd5e1; padding: 30px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; }
  .btn-cancel { background: white; border: 1px solid #e2e8f0; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; color: #64748b; }
  .btn-confirm { background: #0078d4; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; color: white; display: flex; align-items: center; gap: 5px; }
  .btn-confirm:hover { background: #005a9e; }
</style>