<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { goto } from '$app/navigation';
  import { 
    Plus, MapPin, Calendar, Briefcase, Trash2,
    Mail, Mic, UserCheck, MessageSquare, ChevronRight, Settings, X, Building
  } from 'lucide-svelte';
  import Correspondencia from '$lib/components/gestion/Correspondencia.svelte';

  // --- ESTADO ---
  let vistaActual = 'inicio';
  
  // Variable para saber qué sección de correspondencia abrir directamente
  let seccionCorrespondencia = 'oradores'; 
  
  // Listas de datos
  let listaAsambleas: any[] = [];
  let listaLocales: any[] = []; 

  // --- VARIABLES PARA MODAL NUEVA ASAMBLEA ---
  let mostrarModalAsamblea = false;
  let nuevaAsamblea = { tema: "", fecha: "", local_id: null as number | null, local_nombre: "" };

  // --- VARIABLES PARA MODAL GESTIÓN LOCALES ---
  let mostrarModalLocales = false;
  let nuevoLocal = { nombre: "", direccion: "", capacidad: 0 };

  onMount(() => {
    cargarDatos();
  });

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
  // LÓGICA DE LOCALES (SALONES)
  // ==========================================
  async function guardarLocal() {
    if (!nuevoLocal.nombre) return alert("Escribe el nombre del salón");
    try {
      await invoke('crear_local', { 
        nombre: nuevoLocal.nombre, 
        direccion: nuevoLocal.direccion, 
        capacidad: Number(nuevoLocal.capacidad) 
      });
      
      nuevoLocal = { nombre: "", direccion: "", capacidad: 0 }; 
      listaLocales = await invoke('obtener_locales') as any[];
    } catch (e) { alert(e); }
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

  function irAGestionar(item: any) {
    localStorage.setItem('asambleaActiva', JSON.stringify(item));
    goto('/gestion');
  }

  // --- LÓGICA CORREGIDA PARA NAVEGACIÓN A CORRESPONDENCIA ---
  // Ahora recibe el tipo de sección a la que queremos ir
  function irACorrespondencia(tipo: string) {
    seccionCorrespondencia = tipo;
    vistaActual = 'correspondencia';
  }

  const volverAlInicio = () => vistaActual = 'inicio';
</script>

<div class="main-container">
  {#if vistaActual === 'inicio'}
    <header class="top-bar">
      <div class="brand">
        <h1>Asistente de Asamblea</h1>
        <span class="version">v2.0</span>
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
        
        <button class="btn-config"><Settings size={20} /></button>
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
          <div class="modal-header"><h3>Gestionar Salones</h3><button class="btn-close" on:click={() => mostrarModalLocales = false}><X size={20}/></button></div>
          
          <div class="modal-body">
            <div class="form-local">
                <input type="text" placeholder="Nombre (Ej: Salón Cotorro)" bind:value={nuevoLocal.nombre} class="input-grow"/>
                <input type="text" placeholder="Dirección" bind:value={nuevoLocal.direccion} class="input-grow"/>
                <input type="number" placeholder="Cap." bind:value={nuevoLocal.capacidad} class="input-cap" min="0" title="Capacidad de asientos"/>
                <button class="btn-confirm-small" on:click={guardarLocal}><Plus size={16}/> Añadir</button>
            </div>

            <div class="lista-locales-scroll">
                {#each listaLocales as l}
                    <div class="item-local">
                        <div class="info-local">
                            <strong>
                                <Building size={14}/> {l.nombre}
                                <span class="badge-cap">{l.capacidad || 0} asientos</span>
                            </strong>
                            <small>{l.direccion || 'Sin dirección'}</small>
                        </div>
                        <button class="btn-trash-mini" on:click={() => eliminarLocal(l.id)} title="Borrar Salón"><Trash2 size={14}/></button>
                    </div>
                {:else}
                    <p class="text-muted">No hay salones registrados.</p>
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
  {/if}
</div>

<style>
  :global(body) { margin: 0; font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; }
  .main-container { padding: 40px; max-width: 1200px; margin: 0 auto; }
  
  /* HEADER */
  .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
  .brand h1 { font-size: 24px; font-weight: 800; margin: 0; color: #0f172a; }
  .version { font-size: 11px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: #64748b; font-weight: bold; }
  .header-actions { display: flex; align-items: center; gap: 10px; }

  /* BOTONES */
  .btn-nueva { background-color: #1e293b; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s; }
  .btn-nueva:hover { background-color: #334155; }
  
  .btn-secondary { background-color: white; color: #475569; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
  .btn-secondary:hover { background-color: #f1f5f9; }
  
  .btn-config { background: white; border: 1px solid #e2e8f0; padding: 8px; border-radius: 8px; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; }
  .btn-config:hover { background: #f1f5f9; color: #334155; }

  /* DASHBOARD */
  .dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .section-header { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; margin-bottom: 20px; text-transform: uppercase; }
  .grid-asambleas { display: flex; flex-direction: column; gap: 20px; }

  /* CARDS */
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
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; } .modal-header h3 { margin: 0; font-size: 18px; color: #0f172a; }
  .btn-close { background: none; border: none; cursor: pointer; color: #64748b; }
  
  .modal-body { display: flex; flex-direction: column; gap: 15px; }
  .modal-body label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; }
  .modal-body input, select { padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box; }
  .modal-body input:focus, select:focus { border-color: #0078d4; }

  .select-wrapper { display: flex; gap: 5px; }
  .btn-mini-add { background: #eff6ff; border: 1px solid #dbeafe; color: #2563eb; border-radius: 8px; width: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .btn-mini-add:hover { background: #dbeafe; }

  /* --- GESTOR DE SALONES --- */
  .modal-content.large { 
    width: 750px; 
    max-width: 95vw;
  }

  .form-local { 
    display: flex; 
    gap: 12px; 
    background: #f8fafc; 
    padding: 20px; 
    border-radius: 8px; 
    margin-bottom: 20px; 
    border: 1px solid #e2e8f0;
    align-items: center;
  }

  .form-local .input-grow {
    flex: 3; 
    min-width: 150px; 
    height: 40px; 
    margin: 0;
  }

  .form-local .input-cap {
    width: 70px;    
    flex: none;     
    height: 40px;   
    margin: 0;
    text-align: center;
  }

  .btn-confirm-small { 
    background: #0078d4; 
    border: none; 
    padding: 0 20px; 
    height: 40px;
    border-radius: 6px; 
    font-weight: 600; 
    cursor: pointer; 
    color: white; 
    display: flex; 
    align-items: center; 
    justify-content: center;
    gap: 6px; 
    font-size: 13px;
    flex-shrink: 0;
  }
  .btn-confirm-small:hover { background: #005a9e; }

  .lista-locales-scroll { 
    max-height: 300px; 
    overflow-y: auto; 
    display: flex; 
    flex-direction: column; 
    gap: 8px; 
    padding-right: 5px; 
  }

  .item-local { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    padding: 12px 15px; 
    border: 1px solid #e2e8f0; 
    border-radius: 8px; 
    background: white; 
    transition: all 0.2s;
  }
  .item-local:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  }

  .info-local { display: flex; flex-direction: column; gap: 2px; } 
  .info-local strong { font-size: 14px; color: #1e293b; display: flex; gap: 8px; align-items: center; } 
  .info-local small { color: #64748b; font-size: 12px; }
  
  .badge-cap {
    background: #e0f2fe;
    color: #0284c7;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
    border: 1px solid #bae6fd;
  }

  .btn-trash-mini { 
    background: none; 
    border: none; 
    color: #cbd5e1; 
    cursor: pointer; 
    padding: 8px;
    border-radius: 4px;
    transition: all 0.2s;
  } 
  .btn-trash-mini:hover { 
    background: #fee2e2; 
    color: #ef4444; 
  }

  .text-muted { text-align: center; color: #94a3b8; font-style: italic; font-size: 13px; margin-top: 20px; }

  .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; }
  .btn-cancel { background: white; border: 1px solid #e2e8f0; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; color: #64748b; }
  .btn-confirm { background: #0078d4; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; color: white; display: flex; align-items: center; gap: 5px; }
  .btn-confirm:hover { background: #005a9e; }
</style>
