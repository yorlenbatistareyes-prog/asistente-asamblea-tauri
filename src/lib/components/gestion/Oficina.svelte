<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  // Imports de Utilidades Compartidas
  import { generarContexto } from '$lib/utils/contexto_impresion';
  import { generarCartaPDF } from '$lib/utils/impresion';
  import { exportarOficinaPDF } from '$lib/utils/exportar';
  
  // Iconos
  import { 
    Users, Search, X, Trash2, FileUp, Phone, Mail, UserPlus, UserCheck, 
    FileCheck, Mic, Settings, ChevronRight, MessageCircle, FileJson, Printer, 
    Briefcase, CalendarClock, ClipboardList, LayoutList
  } from 'lucide-svelte';

  import Panel from '$lib/components/ui/Panel.svelte';

  // --- ESTADO ---
  let asambleaId = 0; 
  let tabPrincipal = 'auxiliares'; 
  let diaSeleccionado = 'Viernes';
  
  let oficina: { [key: string]: any } = {
      personal: [] as any[],
      presidente_manana: null, oracion_apertura: null, bosquejos_manana: null, plataforma_manana: null,
      presidente_tarde: null, oracion_conclusion: null, bosquejos_tarde: null, plataforma_tarde: null
  };

  let listaHermanos: any[] = []; 
  let terminoBusqueda = "";
  
  // Modales
  let mostrarModalAsignar = false; 
  let mostrarModalGestion = false;
  let rolOficinaEditando: string | null = null; 
  let asignacionActual: any = null; 

  // --- CARGA DE DATOS ---
  onMount(async () => {
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
        asambleaId = JSON.parse(datosGuardados).id;
        await Promise.all([ cargarDatos(), cargarHermanos() ]);
    }
  });

  async function cargarDatos() {
    if (!asambleaId) return;
    try { 
        const datos = await invoke('obtener_asignaciones_especiales', { asambleaId, dia: diaSeleccionado }) as any[]; 
        organizarOficina(datos); 
    } catch (e) { console.error(e); }
  }

  async function cargarHermanos() { 
    if (!asambleaId) return;
    listaHermanos = await invoke('obtener_personas', { asambleaId }) as any[]; 
  }

  $: if (diaSeleccionado && asambleaId) cargarDatos();

  function organizarOficina(datos: any[]) {
      let nuevaOficina: any = { 
          personal: [], 
          presidente_manana: null, oracion_apertura: null, bosquejos_manana: null, plataforma_manana: null, 
          presidente_tarde: null, oracion_conclusion: null, bosquejos_tarde: null, plataforma_tarde: null 
      };
      
      if (datos && Array.isArray(datos)) {
          datos.forEach(d => {
              d.recibido_manual = d.estado === 'Confirmado';
              d.esta_presente = d.esta_presente === true || d.esta_presente === 1;
              d.ensayo_terminado = d.ensayo_terminado || false;

              if (d.tipo_asignacion === 'personal_oficina') {
                  nuevaOficina.personal.push(d);
              } else if (Object.keys(nuevaOficina).includes(d.tipo_asignacion)) {
                  nuevaOficina[d.tipo_asignacion] = d;
              }
          });
      }
      oficina = nuevaOficina;
  }

  // --- LÓGICA MODALES ---
  function abrirModalAsignar(rol: string) { 
    rolOficinaEditando = rol; 
    terminoBusqueda = ""; 
    mostrarModalAsignar = true; 
  }

  function clickEnAsignacion(key: string, asignacion: any) {
      if (asignacion) {
          const datos = prepararDatosOficina(asignacion);
          asignacionActual = { ...datos, rol_key: key };
          mostrarModalGestion = true;
      } else { abrirModalAsignar(key); }
  }

  function clickEnPersonal(persona: any) {
      const datos = prepararDatosOficina(persona);
      asignacionActual = { ...datos, es_personal: true };
      mostrarModalGestion = true;
  }

  function cerrarModales() { 
      mostrarModalAsignar = false; 
      mostrarModalGestion = false;
      rolOficinaEditando = null; 
      asignacionActual = null;
  }

  function prepararDatosOficina(asignacion: any) {
      const datosCompletos = listaHermanos.find(h => h.id === asignacion.persona_id || h.nombre_completo === asignacion.nombre_completo) || {};
      return {
          ...asignacion,
          telefono_visual: asignacion.telefono || datosCompletos.telefono || '',
          email_visual: asignacion.email || datosCompletos.email || '',
          congregacion_visual: asignacion.nombre_congregacion || datosCompletos.nombre_congregacion || ''
      };
  }

  // --- GUARDAR Y ACTUALIZAR ---
  async function asignarHermano(oradorId: number) {
      if (!oradorId || !rolOficinaEditando) return;
      try {
          await invoke('guardar_asignacion_especial', { 
              asambleaId, dia: diaSeleccionado, tipoAsignacion: rolOficinaEditando, personaId: oradorId 
          });
          cerrarModales();
          await cargarDatos(); 
      } catch (e) { alert("Error al guardar: " + e); }
  }

  async function eliminarAsignacion(id: number) {
      if (!confirm("¿Quitar a este hermano?")) return;
      try {
          await invoke('eliminar_asignacion_especial', { id });
          cerrarModales();
          cargarDatos(); 
      } catch (e) { alert("Error: " + e); }
  }

  // --- CAMBIO DE ESTADOS ---
  async function toggleStatus(objeto: any, campo: string, tipoAccionBackend: string) {
      if (!objeto || !objeto.id) return;
      const nuevoEstado = !objeto[campo];
      try {
          objeto[campo] = nuevoEstado;
          if (campo === 'recibido_manual') objeto.estado = nuevoEstado ? 'Confirmado' : 'Pendiente';
          
          await invoke('alternar_estado_oficina', {
              id: objeto.id, tipoAccion: tipoAccionBackend, valorNuevo: nuevoEstado
          });
          
          if (objeto.es_personal) {
             const idx = oficina.personal.findIndex((p: any) => p.id === objeto.id);
             if (idx >= 0) oficina.personal[idx] = { ...objeto };
          } else if (objeto.rol_key) {
             oficina[objeto.rol_key] = { ...objeto };
          }
          oficina = {...oficina};
      } catch (e) { 
          alert("Error: " + e); 
          objeto[campo] = !nuevoEstado;
      }
  }

  const MAPA_PLANTILLAS: Record<string, string> = {
      'presidente': 'presidentes', 'oracion': 'oraciones', 'plataforma': 'oradores', 'default': 'oradores'
  };

  async function procesarImpresionLocal(objeto: any) {
      try {
          const contexto = await generarContexto(objeto, asambleaId, false);
          let plantillaId = MAPA_PLANTILLAS['default'];
          const rol = (objeto.rol_key || objeto.tipo_asignacion || '').toLowerCase();
          
          if (rol.includes('presidente')) plantillaId = MAPA_PLANTILLAS['presidente']; 
          else if (rol.includes('oracion')) plantillaId = MAPA_PLANTILLAS['oracion'];
          
          await generarCartaPDF(contexto, plantillaId);
      } catch(e) { alert("Error PDF: " + e); }
  }

  const getHermanosFiltrados = () => !terminoBusqueda ? listaHermanos : listaHermanos.filter(h => h.nombre_completo.toLowerCase().includes(terminoBusqueda.toLowerCase()));
  const nombreTxt = (obj: any) => obj ? obj.nombre_completo : "Seleccionar...";
</script>

<div class="contenedor-oficina">
    <div class="top-bar">
        <div class="titulo-pagina">
            <h2><Briefcase size={22}/> Organización de la Oficina</h2>
            <p>Personal, horario, formularios, etc.</p>
        </div>
        
        <button class="btn-exportar" on:click={() => exportarOficinaPDF(oficina, oficina.personal, diaSeleccionado)}>
            <FileUp size={18}/> Exportar PDF
        </button>
    </div>

    <div class="tabs-principales">
        <button class:active={tabPrincipal === 'auxiliares'} on:click={() => tabPrincipal = 'auxiliares'}>
            <Users size={18}/> Auxiliar(es) 
        </button>
        <button class:active={tabPrincipal === 'horario'} on:click={() => tabPrincipal = 'horario'}>
            <CalendarClock size={18}/> Horario
        </button>
        <button class:active={tabPrincipal === 'asignaciones'} on:click={() => tabPrincipal = 'asignaciones'}>
            <ClipboardList size={18}/> Asignaciones 
        </button>
    </div>

    <div class="area-contenido">
        
        {#if tabPrincipal === 'auxiliares'}
            <Panel padding="20px" clasesExtra="panel-full-override">
                <div class="header-panel">
                    <div class="header-textos">
                        <h4><Users size={16}/> Auxiliares añadidos</h4>
                        <span class="subtitulo-suave">Personal de la oficina y apoyo a la Asamblea</span>
                    </div>
                    <button class="btn-mini-add" on:click={() => abrirModalAsignar('personal_oficina')}>
                        <UserPlus size={14}/> Añadir persona
                    </button>
                </div>
                <div class="lista-personal-grid">
                    {#each oficina.personal as p}
                        <div class="card-personal" on:click={() => clickEnPersonal(p)}>
                            <div class="avatar-placeholder">{p.nombre_completo.charAt(0)}</div>
                            <div class="info">
                                <span class="nombre">{p.nombre_completo}</span>
                                {#if p.nombre_congregacion}
                                    <span class="cong">{p.nombre_congregacion}</span>
                                {/if}
                                <div class="badges-estado">
                                    {#if p.recibido_manual} <span class="badge blue">Recibido</span> {/if}
                                    {#if p.esta_presente} <span class="badge green">Presente</span> {/if}
                                </div>
                            </div>
                            <Settings size={16} class="ico-gear"/>
                        </div>
                    {/each}
                    
                    {#if oficina.personal.length === 0}
                        <div class="vacio-box">
                            <p>Aún no se ha añadido auxiliares de oficina.</p>
                            <small>Puede añadirlos con el botón "Añadir persona".</small>
                        </div>
                    {/if}
                </div>
            </Panel>
        {/if}

        {#if tabPrincipal === 'horario'}
            <Panel padding="20px" clasesExtra="panel-full-override center-content">
                <div class="placeholder-horario">
                    <CalendarClock size={48} color="var(--text-secondary)"/>
                    <h3>Horario de la Oficina</h3>
                    <p>Funcionalidad en construcción...</p>
                </div>
            </Panel>
        {/if}

        {#if tabPrincipal === 'asignaciones'}
            <div class="layout-asignaciones">
                
                <p class="descripcion-seccion">
                    Presidente de sesión, oraciones, seguimiento a bosquejos y acompañante a la plataforma
                </p>

                <div class="bar-dias">
                    <span class="label-dia">Seleccionar día:</span>
                    <div class="tabs-dias">
                        {#each ['Viernes', 'Sábado', 'Domingo'] as dia}
                            <button class:active={diaSeleccionado === dia} on:click={() => diaSeleccionado = dia}>
                                {dia}
                            </button>
                        {/each}
                    </div>
                </div>

                <div class="grid-sesiones">
                    <Panel padding="20px" clasesExtra="panel-seccion-override">
                        <div class="header-panel sun"><h4>☀️ Sesión de Mañana</h4></div>
                        <div class="lista-puestos">
                            {#each [{ label: 'Presidente', key: 'presidente_manana' }, { label: 'Oración', key: 'oracion_apertura' }, { label: 'Bosquejos', key: 'bosquejos_manana' }, { label: 'Plataforma', key: 'plataforma_manana' }] as item}
                                <div class="puesto-item">
                                    <label>{item.label}</label>
                                    <button class="btn-puesto" class:ocupado={oficina[item.key]} on:click={() => clickEnAsignacion(item.key, oficina[item.key])}>
                                        <span>{nombreTxt(oficina[item.key])}</span>
                                        {#if oficina[item.key]} <Settings size={14}/> {:else} <ChevronRight size={14}/> {/if}
                                    </button>
                                </div>
                            {/each}
                        </div>
                    </Panel>

                    <Panel padding="20px" clasesExtra="panel-seccion-override">
                        <div class="header-panel sunset"><h4>🌅 Sesión de Tarde</h4></div>
                        <div class="lista-puestos">
                            {#each [{ label: 'Presidente', key: 'presidente_tarde' }, { label: 'Oración', key: 'oracion_conclusion' }, { label: 'Bosquejos', key: 'bosquejos_tarde' }, { label: 'Plataforma', key: 'plataforma_tarde' }] as item}
                                <div class="puesto-item">
                                    <label>{item.label}</label>
                                    <button class="btn-puesto" class:ocupado={oficina[item.key]} on:click={() => clickEnAsignacion(item.key, oficina[item.key])}>
                                        <span>{nombreTxt(oficina[item.key])}</span>
                                        {#if oficina[item.key]} <Settings size={14}/> {:else} <ChevronRight size={14}/> {/if}
                                    </button>
                                </div>
                            {/each}
                        </div>
                    </Panel>
                </div>
            </div>
        {/if}

    </div>
</div>

{#if mostrarModalAsignar}
  <div class="modal-backdrop" on:click|self={cerrarModales}>
    <div class="modal">
      <div class="modal-header">
        <h3>Asignar {rolOficinaEditando?.replace('_', ' ').toUpperCase()}</h3>
        <button class="btn-close" on:click={cerrarModales}><X size={18}/></button>
      </div>
      <div class="modal-body">
        <div class="buscador">
            <Search size={16}/> <input type="text" placeholder="Buscar hermano..." bind:value={terminoBusqueda} />
        </div>
        <div class="lista-opciones">
            {#each getHermanosFiltrados() as h}
                <button class="item-opcion" on:click={() => asignarHermano(h.id)}>
                    <div class="avatar">{h.nombre_completo.charAt(0)}</div>
                    <div class="datos"><span class="n">{h.nombre_completo}</span><span class="c">{h.nombre_congregacion}</span></div>
                </button>
            {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

{#if mostrarModalGestion && asignacionActual}
  <div class="modal-backdrop" on:click|self={cerrarModales}>
    <div class="modal modal-grande">
        <div class="modal-header">
            <h3>Gestión: {asignacionActual.nombre_completo}</h3>
            <button class="btn-close" on:click={cerrarModales}><X size={18}/></button>
        </div>
        <div class="modal-body">
            <div class="estados-row">
                <button class="btn-estado blue" class:active={asignacionActual.recibido_manual} 
                        on:click={() => toggleStatus(asignacionActual, 'recibido_manual', 'confirmacion')}>
                    <FileCheck size={20}/> RECIBIDO
                </button>
                <button class="btn-estado green" class:active={asignacionActual.esta_presente} 
                        on:click={() => toggleStatus(asignacionActual, 'esta_presente', 'presencia')}>
                    <UserCheck size={20}/> PRESENTE
                </button>
                <button class="btn-estado yellow" class:active={asignacionActual.ensayo_terminado} 
                        on:click={() => toggleStatus(asignacionActual, 'ensayo_terminado', 'ensayo')}>
                    <Mic size={20}/> ENSAYO
                </button>
            </div>
            <div class="acciones-lista">
                <button class="btn-accion" on:click={() => procesarImpresionLocal(asignacionActual)}><Printer size={16}/> Imprimir Carta</button>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-delete" on:click={() => eliminarAsignacion(asignacionActual.id)}>
                <Trash2 size={16}/> Quitar asignación
            </button>
        </div>
    </div>
  </div>
{/if}

<style>
   .contenedor-oficina { padding: 20px 40px; height: 100%; display: flex; flex-direction: column; gap: 20px; max-width: 1200px; margin: 0 auto; }
    
    /* TOP BAR */
    .top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
    .titulo-seccion h2 { margin: 0; display: flex; align-items: center; gap: 10px; color: var(--text-main); font-size: 22px; }
    .titulo-seccion p { margin: 4px 0 0 0; color: var(--text-secondary); font-size: 13px; margin-left: 34px; }
    .btn-exportar { display: flex; gap: 8px; align-items: center; background: transparent; border: 1px solid var(--border); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; color: var(--text-main); transition: all 0.2s; }
    .btn-exportar:hover { background: var(--hover-bg); border-color: var(--primary); }

    /* PESTAÑAS PRINCIPALES */
    .tabs-principales { display: flex; gap: 5px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
    .tabs-principales button {
        padding: 12px 20px; background: transparent; border: none; border-bottom: 3px solid transparent;
        color: var(--text-secondary); font-weight: 600; cursor: pointer; display: flex; gap: 8px; align-items: center; transition: all 0.2s; font-size: 14px;
    }
    .tabs-principales button:hover { color: var(--primary); background: var(--hover-bg); }
    .tabs-principales button.active { border-bottom-color: var(--primary); color: var(--primary); }

    /* CONTENIDOS Y BLINDAJE DE PANELES */
    .area-contenido { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    
    :global(.panel-full-override) { flex: 1 !important; display: flex !important; flex-direction: column !important; }
    :global(.center-content) { align-items: center !important; justify-content: center !important; }
    
    .header-panel { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
    .header-textos h4 { margin: 0; font-size: 15px; color: var(--text-main); display: flex; gap: 8px; align-items: center; text-transform: uppercase; letter-spacing: 0.5px; }
    .header-textos .subtitulo-suave { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 4px; font-weight: 400; }
    
    .header-panel.sun h4 { color: #d97706; }
    .header-panel.sunset h4 { color: #ea580c; }

    .descripcion-seccion { color: var(--text-secondary); font-size: 13px; margin: 0 0 5px 0; padding-left: 5px; }

    /* AUXILIARES GRID */
    .lista-personal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; overflow-y: auto; padding: 5px; }
    .card-personal { 
        background: transparent; border: 1px solid var(--border); border-radius: 8px; padding: 15px; 
        display: flex; gap: 12px; align-items: center; cursor: pointer; transition: all 0.2s; position: relative;
    }
    .card-personal:hover { transform: translateY(-2px); box-shadow: var(--shadow-premium); border-color: var(--primary); }
    
    /* Adaptado para Modo Oscuro con rgba */
    .avatar-placeholder { width: 40px; height: 40px; background: rgba(59, 130, 246, 0.1); color: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
    .info { flex: 1; display: flex; flex-direction: column; }
    .nombre { font-weight: 700; color: var(--text-main); font-size: 14px; }
    .cong { font-size: 11px; color: var(--text-secondary); }
    
    .badges-estado { display: flex; gap: 6px; margin-top: 6px; }
    .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
    .badge.blue { background: rgba(59, 130, 246, 0.15); color: var(--primary); }
    .badge.green { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .ico-gear { color: var(--text-secondary); opacity: 0.5; }
    .card-personal:hover .ico-gear { opacity: 1; color: var(--primary); }

    .vacio-box { text-align: center; padding: 40px; color: var(--text-secondary); width: 100%; grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .btn-mini-add { background: var(--primary); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; gap: 6px; align-items: center; font-size: 12px; font-weight: 600; }

    /* ASIGNACIONES LAYOUT */
    .layout-asignaciones { display: flex; flex-direction: column; gap: 15px; height: 100%; }
    .bar-dias { display: flex; align-items: center; gap: 15px; background: var(--bg-card); padding: 10px 20px; border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow-premium); }
    .label-dia { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; }
    .tabs-dias { display: flex; gap: 5px; }
    .tabs-dias button { padding: 6px 12px; border: 1px solid var(--border); background: transparent; border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--text-main); transition: all 0.2s; }
    .tabs-dias button.active { background: var(--primary); color: white; border-color: var(--primary); }

    .grid-sesiones { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; flex: 1; }
    :global(.panel-seccion-override) { display: flex !important; flex-direction: column !important; overflow-y: auto !important; height: 100% !important; }
    
    .puesto-item { margin-bottom: 15px; }
    .puesto-item label { font-size: 11px; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 5px; text-transform: uppercase; }
    .btn-puesto { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: transparent; cursor: pointer; color: var(--text-main); transition: all 0.2s; }
    .btn-puesto:hover { border-color: var(--primary); background: var(--hover-bg); }
    
    /* Adaptado para Modo Oscuro */
    .btn-puesto.ocupado { background: rgba(59, 130, 246, 0.1); border-color: var(--primary); color: var(--primary); font-weight: 600; }

    /* PLACEHOLDER HORARIO */
    .placeholder-horario { text-align: center; color: var(--text-secondary); }
    .placeholder-horario h3 { margin: 10px 0 5px 0; color: var(--text-main); }

    /* MODALES */
    .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
    .modal { background: var(--bg-card); padding: 20px; border-radius: 12px; width: 400px; max-height: 90vh; display: flex; flex-direction: column; border: 1px solid var(--border); box-shadow: var(--shadow-premium); }
    .modal-grande { width: 600px; }
    .modal-header { display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: bold; font-size: 18px; color: var(--text-main); }
    .estados-row { display: flex; gap: 10px; margin-bottom: 20px; }
    .btn-estado { flex: 1; padding: 15px; border-radius: 8px; border: 1px solid var(--border); background: transparent; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 5px; font-weight: 700; color: var(--text-secondary); transition: all 0.2s; }
    
    /* Botones de Estado amigables con Modo Oscuro */
    .btn-estado.active.blue { background: rgba(59, 130, 246, 0.1); border-color: var(--primary); color: var(--primary); }
    .btn-estado.active.green { background: rgba(34, 197, 94, 0.1); border-color: #22c55e; color: #22c55e; }
    .btn-estado.active.yellow { background: rgba(234, 179, 8, 0.1); border-color: #eab308; color: #eab308; }
    
    .acciones-lista { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .btn-accion { padding: 10px; border: 1px solid var(--border); background: transparent; color: var(--text-main); border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; justify-content: center; font-weight: 600; transition: background 0.2s;}
    .btn-accion:hover { background: var(--hover-bg); }
    .buscador { display: flex; align-items: center; gap: 10px; border: 1px solid var(--border); background: var(--bg-body); padding: 8px; border-radius: 8px; margin-bottom: 10px; color: var(--text-secondary); }
    .buscador input { border: none; outline: none; background: transparent; flex: 1; color: var(--text-main); }
    .lista-opciones { max-height: 300px; overflow-y: auto; }
    .item-opcion { display: flex; align-items: center; gap: 10px; padding: 8px; width: 100%; border: none; background: transparent; cursor: pointer; text-align: left; border-bottom: 1px solid var(--border); transition: background 0.2s; }
    .item-opcion:hover { background: var(--hover-bg); }
    .avatar { width: 30px; height: 30px; background: rgba(59, 130, 246, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--primary); }
    .datos { display: flex; flex-direction: column; } .n { font-weight: 600; font-size: 14px; color: var(--text-main); } .c { font-size: 11px; color: var(--text-secondary); }
    
    .btn-delete { width: 100%; padding: 10px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; cursor: pointer; font-weight: 600; display: flex; justify-content: center; align-items: center; gap: 8px; transition: all 0.2s; }
    .btn-delete:hover { background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); }
    .btn-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); transition: color 0.2s; }
    .btn-close:hover { color: var(--text-main); }
</style>