<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { goto } from '$app/navigation';
  import { 
    Plus, MapPin, Calendar, Briefcase, Trash2,
    Mail, Mic, UserCheck, MessageSquare, ChevronRight, Settings, X
  } from 'lucide-svelte';
  import Correspondencia from '$lib/components/gestion/Correspondencia.svelte';

  // --- ESTADO ---
  let vistaActual = 'inicio';
  let mostrarModal = false; // Controla la ventana emergente
  let listaAsambleas: any[] = []; // Lista que viene de la Base de Datos

  // Variables para el formulario nuevo
  let nuevaAsamblea = {
    tema: "",
    fecha: "",
    lugar: ""
  };

  // --- CARGA DE DATOS (Al iniciar) ---
  async function cargarAsambleas() {
    try {
      listaAsambleas = await invoke('obtener_asambleas');
    } catch (e) {
      console.error("Error cargando lista:", e);
    }
  }

  onMount(() => {
    cargarAsambleas();
  });

  // --- FUNCIONES DEL MODAL ---
  function abrirModal() {
    nuevaAsamblea = { tema: "", fecha: "", lugar: "" }; // Limpiar campos
    mostrarModal = true;
  }
  
  function cerrarModal() {
    mostrarModal = false;
  }

  // --- ACCIONES CON RUST ---
  async function guardarNuevaAsamblea() {
    if (!nuevaAsamblea.tema || !nuevaAsamblea.fecha) {
      alert("⚠️ Por favor, escribe al menos el Tema y la Fecha.");
      return;
    }

    try {
      // 1. Guardar en Base de Datos
      await invoke('crear_asamblea', { 
        tema: nuevaAsamblea.tema, 
        fecha: nuevaAsamblea.fecha, 
        lugar: nuevaAsamblea.lugar 
      });

      // 2. Recargar lista y cerrar modal
      await cargarAsambleas();
      cerrarModal();

    } catch (e) {
      alert("Error al guardar: " + e);
    }
  }

  async function eliminarAsamblea(id: number, e: Event) {
    // Evitamos que al dar click en borrar, se abra la tarjeta
    e.stopPropagation(); 
    
    if (confirm("¿Seguro que quieres eliminar esta asamblea y todos sus datos?")) {
      try {
        await invoke('eliminar_asamblea', { id });
        await cargarAsambleas();
      } catch (err) {
        alert("Error al eliminar: " + err);
      }
    }
  }

  // --- NAVEGACIÓN ---
  function irAGestionar(item: any) {
    // Guardamos cuál asamblea estamos editando
    localStorage.setItem('asambleaActiva', JSON.stringify(item));
    goto('/gestion');
  }

  const irACorrespondencia = () => vistaActual = 'correspondencia';
  const volverAlInicio = () => vistaActual = 'inicio';
</script>

<div class="main-container">
  {#if vistaActual === 'inicio'}
    <header class="top-bar">
      <h1>Asistente de Asamblea</h1>
      
      <div class="header-actions">
        <button class="btn-nueva" on:click={abrirModal}>
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
                <button on:click={abrirModal}>Crear la primera ahora</button>
            </div>
        {:else}
            <div class="grid-asambleas">
                {#each listaAsambleas as item (item.id)}
                    <div 
                      class="card-hero" 
                      on:click={() => irAGestionar(item)} 
                      on:keydown={(e) => e.key === 'Enter' && irAGestionar(item)}
                      role="button" 
                      tabindex="0"
                    >
                      <button class="btn-trash" on:click={(e) => eliminarAsamblea(item.id, e)} title="Eliminar">
                        <Trash2 size={16} />
                      </button>

                      <div class="hero-content">
                        <span class="status-pill">ID: {item.id}</span>
                        <h2>{item.tema}</h2>
                        <div class="hero-details">
                          <span><Calendar size={14} /> {item.fecha}</span>
                          {#if item.lugar}
                            <span><MapPin size={14} /> {item.lugar}</span>
                          {/if}
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
          <Mail size={18} /> <span>PLANTILLAS MAESTRAS (GLOBAL)</span>
        </div>

        <div class="grid-cartas">
          <button class="card-action" on:click={irACorrespondencia}>
            <div class="card-icon oradores"><Mic size={22} /></div>
            <div class="card-text">
              <h3>Cartas a Oradores</h3>
              <p>Editar plantilla global</p>
            </div>
            <ChevronRight size={16} />
          </button>

          <button class="card-action" on:click={irACorrespondencia}>
            <div class="card-icon presidentes"><UserCheck size={22} /></div>
            <div class="card-text">
              <h3>Cartas a Presidentes</h3>
              <p>Editar plantilla global</p>
            </div>
            <ChevronRight size={16} />
          </button>

          <button class="card-action" on:click={irACorrespondencia}>
            <div class="card-icon oraciones"><MessageSquare size={22} /></div>
            <div class="card-text">
              <h3>Cartas de Oración</h3>
              <p>Editar plantilla global</p>
            </div>
            <ChevronRight size={16} />
          </button>
        </div>
      </section>
    </div>

    {#if mostrarModal}
      <div class="modal-backdrop">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Nueva Asamblea</h3>
            <button class="btn-close" on:click={cerrarModal}><X size={20}/></button>
          </div>
          
          <div class="modal-body">
            <label>Tema de la Asamblea</label>
            <input type="text" placeholder="Ej: ¡Prediquemos las buenas noticias!" bind:value={nuevaAsamblea.tema} />
            
            <label>Fecha</label>
            <input type="text" placeholder="Ej: 25-27 de Julio, 2025" bind:value={nuevaAsamblea.fecha} />
            
            <label>Lugar / Salón</label>
            <input type="text" placeholder="Ej: Salón de Asambleas" bind:value={nuevaAsamblea.lugar} />
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" on:click={cerrarModal}>Cancelar</button>
            <button class="btn-confirm" on:click={guardarNuevaAsamblea}>Crear Tarjeta</button>
          </div>
        </div>
      </div>
    {/if}

  {:else if vistaActual === 'correspondencia'}
    <Correspondencia on:close={volverAlInicio} />
  {/if}
</div>

<style>
  :global(body) { margin: 0; font-family: 'Inter', 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
  .main-container { padding: 40px; max-width: 1200px; margin: 0 auto; }
  
  /* HEADER */
  .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
  .top-bar h1 { font-size: 24px; font-weight: 800; margin: 0; color: #0f172a; }
  .header-actions { display: flex; align-items: center; gap: 10px; }

  /* BOTONES SUPERIORES */
  .btn-nueva { background-color: #1e293b; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s; }
  .btn-nueva:hover { background-color: #334155; }
  .btn-config { background: white; border: 1px solid #e2e8f0; padding: 8px; border-radius: 8px; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; }
  .btn-config:hover { background: #f1f5f9; color: #334155; }

  /* ESTRUCTURA DASHBOARD */
  .dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .section-header { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; margin-bottom: 20px; text-transform: uppercase; }

  /* GRID DE TARJETAS AZULES (Para cuando hay varias) */
  .grid-asambleas { display: flex; flex-direction: column; gap: 20px; }

  /* TARJETA HERO (AZUL) - ESTILO PROFESIONAL */
  .card-hero { background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%); padding: 30px; border-radius: 20px; color: white; cursor: pointer; box-shadow: 0 20px 25px -5px rgba(0, 120, 212, 0.2); transition: transform 0.2s; position: relative; }
  .card-hero:hover { transform: translateY(-5px); }
  .status-pill { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-bottom: 10px; display: inline-block; }
  .card-hero h2 { font-size: 24px; margin: 10px 0 15px 0; line-height: 1.2; }
  .hero-details { display: flex; flex-direction: column; gap: 8px; opacity: 0.9; font-size: 14px; }
  .hero-details span { display: flex; align-items: center; gap: 8px; }
  .btn-manage { margin-top: 25px; background: white; color: #0078d4; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; width: 100%; }

  /* BOTÓN BASURA EN LA TARJETA */
  .btn-trash { position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.2); border: none; color: white; padding: 8px; border-radius: 8px; cursor: pointer; opacity: 0; transition: opacity 0.2s; }
  .card-hero:hover .btn-trash { opacity: 1; }
  .btn-trash:hover { background: #ef4444; }

  /* ESTADO VACÍO */
  .empty-state { border: 2px dashed #cbd5e1; border-radius: 20px; padding: 40px; text-align: center; color: #64748b; }
  .empty-state button { margin-top: 10px; padding: 8px 16px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; color: #475569; }

  /* GESTIÓN GLOBAL (Derecha) */
  .grid-cartas { display: flex; flex-direction: column; gap: 12px; }
  .card-action { background: white; border: 1px solid #e2e8f0; padding: 15px; border-radius: 16px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: all 0.2s; width: 100%; text-align: left; }
  .card-action:hover { border-color: #0078d4; transform: scale(1.01); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
  .card-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .oradores { background: #f0fdf4; color: #16a34a; }
  .presidentes { background: #eff6ff; color: #2563eb; }
  .oraciones { background: #fff7ed; color: #ea580c; }
  .card-text h3 { margin: 0; font-size: 16px; color: #1e293b; }
  .card-text p { margin: 2px 0 0; font-size: 12px; color: #64748b; }

  /* ESTILOS DEL MODAL (VENTANA EMERGENTE) */
  .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .modal-content { background: white; padding: 25px; border-radius: 16px; width: 400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .modal-header h3 { margin: 0; font-size: 18px; color: #0f172a; }
  .btn-close { background: none; border: none; cursor: pointer; color: #64748b; }
  
  .modal-body { display: flex; flex-direction: column; gap: 15px; }
  .modal-body label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; }
  .modal-body input { padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; }
  .modal-body input:focus { border-color: #0078d4; box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.1); }

  .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; }
  .btn-cancel { background: white; border: 1px solid #e2e8f0; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; color: #64748b; }
  .btn-confirm { background: #0078d4; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; color: white; }
  .btn-confirm:hover { background: #005a9e; }
</style>