<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { 
    ShieldCheck, Save, Search, X, MapPin, Phone, Mail, 
    User, ChevronDown, Layers, Monitor, Mic, Radio, Users, Plus, Droplet, BookOpen,
     Presentation, Mic2, Home, Building, CalendarDays, ScrollText, FileText, ListTodo,
     ListOrdered, NotepadText, ClipboardList, SlidersHorizontal   
  } from 'lucide-svelte';

  // --- ESTADO ---
  let asambleaId = 0; // <--- ID DE LA ASAMBLEA ACTUAL
  
  let hermanos: any[] = [];
  let congregaciones: any[] = []; 
  
  let c: any = {
    presi: 0, coord: 0, coord_a: 0, 
    prog: 0, prog_a: 0, aloj: 0, aloj_a: 0,
    av: 0, video: 0, audio: 0, plat: 0
  };

  // --- MODAL ---
  let mostrarModal = false;
  let rolEditando = ""; 
  let terminoBusqueda = "";

  // --- VARIABLES PARA CREACIÓN RÁPIDA ---
  let modoCreacionRapida = false;
  let nuevoNombre = "";
  let nuevoTelefono = "";      
  let nuevoEmail = "";        
  let nuevaCongregacionId = 0; 

  onMount(async () => {
    // 1. RECUPERAR ID
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
        asambleaId = JSON.parse(datosGuardados).id;
        await recargarTodo();
    } else {
        alert("⚠️ No hay asamblea seleccionada.");
    }
  });

  async function recargarTodo() {
    if (!asambleaId) return;
    try {
      // 2. PEDIR DATOS FILTRADOS POR ASAMBLEA
      const [h, congs, asamblea] = await Promise.all([
        invoke('obtener_personas', { asambleaId }),
        invoke('obtener_congregaciones', { asambleaId }),
        invoke('obtener_asamblea_activa') // Este trae la última activa, que coincide con la nuestra
      ]) as [any[], any[], any]; 

      hermanos = h || [];
      congregaciones = congs || [];

      if (asamblea) {
        c = {
          presi: asamblea.presidente_id || 0,
          coord: asamblea.coordinador_id || 0,
          coord_a: asamblea.coordinador_aux_id || 0,
          prog: asamblea.prog_super_id || 0,
          prog_a: asamblea.prog_aux_id || 0,
          aloj: asamblea.aloj_super_id || 0,
          aloj_a: asamblea.aloj_aux_id || 0,
          av: asamblea.audio_video_super_id || 0,
          video: asamblea.video_super_id || 0,
          audio: asamblea.audio_super_id || 0,
          plat: asamblea.plataforma_super_id || 0
        };
      }
    } catch (e) { 
      console.error("Error al recargar datos:", e); 
    }
  }

  function getDetalles(id: number) {
    if(!id) return null;
    return hermanos.find(h => h.id === id);
  }

  function abrirModal(rol: string) { 
    rolEditando = rol; 
    terminoBusqueda = ""; 
    
    // Resetear formulario de creación
    modoCreacionRapida = false;
    nuevoNombre = "";
    nuevoTelefono = "";
    nuevoEmail = "";
    nuevaCongregacionId = 0;

    mostrarModal = true; 
  }

  function seleccionar(id: number) { 
    c[rolEditando] = id; 
    mostrarModal = false; 
  }

  function quitar(rol: string) { c[rol] = 0; }

  // --- CREAR CON DETALLES EN LA ASAMBLEA ACTUAL ---
  async function crearYSeleccionar() {
    if (!nuevoNombre.trim()) return alert("Escribe un nombre");
    
    try {
      // 3. ENVIAR ID AL CREAR
      await invoke('crear_persona', { 
        asambleaId, // <--- Importante
        nombreCompleto: nuevoNombre, 
        genero: "Hombre", 
        privilegios: "Superintendente", 
        idCongregacion: nuevaCongregacionId, 
        telefono: nuevoTelefono, 
        email: nuevoEmail        
      });

      // Recargamos la lista de esta asamblea
      hermanos = await invoke('obtener_personas', { asambleaId }) || [];
      
      const creado = hermanos.find(h => h.nombre_completo === nuevoNombre);
      
      if (creado) {
        seleccionar(creado.id);
      } else {
        alert("Error al recuperar el nuevo registro");
      }
    } catch (e) {
      alert("Error: " + e);
    }
  }

  async function guardar() {
    try {
      const n = (val: number) => val === 0 ? null : val;
      // Guardar comité usa IDs directos, no necesita asambleaId extra
      await invoke('guardar_comite', { 
        presidenteId: n(c.presi),
        coordinadorId: n(c.coord), coordinadorAuxId: n(c.coord_a),
        progSuperId: n(c.prog), progAuxId: n(c.prog_a),
        alojSuperId: n(c.aloj), alojAuxId: n(c.aloj_a),
        audioVideoId: n(c.av), videoId: n(c.video), audioId: n(c.audio), plataformaId: n(c.plat)
      });
      alert("✅ Comité guardado correctamente");
    } catch (e) { alert("Error: " + e); }
  }

  $: filtrados = hermanos.filter(h => h.nombre_completo.toLowerCase().includes(terminoBusqueda.toLowerCase()));
</script>

<div class="panel-comite">
  <div class="header">
    <h3><ShieldCheck class="text-blue"/> Organización de la Asamblea (Asamblea #{asambleaId})</h3>
    <button class="btn-save" on:click={guardar}><Save size={18}/> Guardar Todo</button>
  </div>

  <div class="scroll-container">
    
    <div class="seccion">
       <h4 class="titulo-seccion"><User size={18} />PRESIDENTE</h4>
     
      <div class="grid-uno">
         <div class="role-wrapper">
            <span class="label-rol">Presidente de la Asamblea</span>
            {#if getDetalles(c.presi)}
                {@const p = getDetalles(c.presi)}
                <div class="tarjeta">
                    <div class="card-top">
                        <div class="avatar"><User size={20}/></div>
                        <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || 'Publicador'}</span></div>
                        <button class="btn-x" on:click={() => quitar('presi')}><X size={16}/></button>
                    </div>
                    <div class="card-bottom">
                        <div class="row"><MapPin size={12}/> {p.nombre_congregacion || 'Sin Congregación'}</div>
                        <div class="row"><Phone size={12}/> {p.telefono || 'Sin Teléfono'}</div>
                        <div class="row"><Mail size={12}/> {p.email || 'Sin Email'}</div>
                    </div>
                </div>
            {:else}
                <button class="btn-select" on:click={() => abrirModal('presi')}>Seleccionar... <ChevronDown size={16}/></button>
            {/if}
         </div>
      </div>
    </div>

    <h3 class="titulo-separador">Miembros del Comité de Asamblea</h3>

    <div class="seccion">
        <h4 class="titulo-seccion"><User size={18}/> COORDINACIÓN</h4>
        <div class="grid-dos">
            <div class="role-wrapper">
                <span class="label-rol">Coordinador del Comité de Asamblea</span>
                {#if getDetalles(c.coord)}
                    {@const p = getDetalles(c.coord)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('coord')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('coord')}>Seleccionar... <ChevronDown size={16}/></button>{/if}
            </div>
            <div class="role-wrapper">
                <span class="label-rol">Auxiliar del Coordinador del Comité de Asamblea</span>
                {#if getDetalles(c.coord_a)}
                    {@const p = getDetalles(c.coord_a)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('coord_a')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('coord_a')}>Seleccionar... <ChevronDown size={16}/></button>{/if}
            </div>
        </div>
    </div>

    <div class="grid-dos-grande">
        <div class="seccion">
            <h4 class="titulo-seccion"><NotepadText size={16}/> PROGRAMA</h4>
            <div class="stack-roles">
                <div class="role-wrapper">
                    <span class="label-rol">Superintendente de Programa</span>
                    {#if getDetalles(c.prog)}
                        {@const p = getDetalles(c.prog)}
                        <div class="tarjeta">
                            <div class="card-top">
                                <div class="avatar"><User size={20}/></div>
                                <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                                <button class="btn-x" on:click={() => quitar('prog')}><X size={16}/></button>
                            </div>
                            <div class="card-bottom">
                                <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                                <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                                <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                            </div>
                        </div>
                    {:else}<button class="btn-select" on:click={() => abrirModal('prog')}>Seleccionar...</button>{/if}
                </div>
                <div class="role-wrapper">
                    <span class="label-rol">Auxiliar del Superintendente del Programa</span>
                    {#if getDetalles(c.prog_a)}
                        {@const p = getDetalles(c.prog_a)}
                        <div class="tarjeta">
                            <div class="card-top">
                                <div class="avatar"><User size={20}/></div>
                                <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                                <button class="btn-x" on:click={() => quitar('prog_a')}><X size={16}/></button>
                            </div>
                            <div class="card-bottom">
                                <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                                <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                                <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                            </div>
                        </div>
                    {:else}<button class="btn-select" on:click={() => abrirModal('prog_a')}>Seleccionar...</button>{/if}
                </div>
            </div>
        </div>

        <div class="seccion">
            <h4 class="titulo-seccion"><Home size={16}/> ALOJAMIENTO</h4>
            <div class="stack-roles">
                <div class="role-wrapper">
                    <span class="label-rol">Superintendente de Alojamiento</span>
                    {#if getDetalles(c.aloj)}
                        {@const p = getDetalles(c.aloj)}
                        <div class="tarjeta">
                            <div class="card-top">
                                <div class="avatar"><User size={20}/></div>
                                <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                                <button class="btn-x" on:click={() => quitar('aloj')}><X size={16}/></button>
                            </div>
                            <div class="card-bottom">
                                <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                                <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                                <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                            </div>
                        </div>
                    {:else}<button class="btn-select" on:click={() => abrirModal('aloj')}>Seleccionar...</button>{/if}
                </div>
                <div class="role-wrapper">
                    <span class="label-rol">Auxiliar del Superintendente de Alojamiento</span>
                    {#if getDetalles(c.aloj_a)}
                        {@const p = getDetalles(c.aloj_a)}
                        <div class="tarjeta">
                            <div class="card-top">
                                <div class="avatar"><User size={20}/></div>
                                <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                                <button class="btn-x" on:click={() => quitar('aloj_a')}><X size={16}/></button>
                            </div>
                            <div class="card-bottom">
                                <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                                <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                                <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                            </div>
                        </div>
                    {:else}<button class="btn-select" on:click={() => abrirModal('aloj_a')}>Seleccionar...</button>{/if}
                </div>
            </div>
        </div>
    </div>

    <h3 class="titulo-separador">Otras Responsabilidades</h3>

    <div class="seccion">
        <h4 class="titulo-seccion">DEPARTAMENTO DE AUDIO Y VIDEO</h4>
        <div class="grid-dos">
            <div class="role-wrapper">
                <span class="label-rol"><Radio size={12}/> Superintendente A/V</span>
                {#if getDetalles(c.av)}
                    {@const p = getDetalles(c.av)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('av')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('av')}>Seleccionar...</button>{/if}
            </div>
            <div class="role-wrapper">
                <span class="label-rol"><Monitor size={12}/> Superintendente de Video</span>
                {#if getDetalles(c.video)}
                    {@const p = getDetalles(c.video)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('video')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('video')}>Seleccionar...</button>{/if}
            </div>
            <div class="role-wrapper">
                <span class="label-rol"><Mic size={12}/> Superintendente de Audio</span>
                {#if getDetalles(c.audio)}
                    {@const p = getDetalles(c.audio)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('audio')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('audio')}>Seleccionar...</button>{/if}
            </div>
            <div class="role-wrapper">
                <span class="label-rol"><SlidersHorizontal size={12}/> Superintendente de Plataforma</span>
                {#if getDetalles(c.plat)}
                    {@const p = getDetalles(c.plat)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('plat')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('plat')}>Seleccionar...</button>{/if}
            </div>
        </div>
    </div>

    <div class="seccion">
        <h4 class="titulo-seccion"><Droplet size={16}/> DEPARTAMENTO DE BAUTISMO</h4>
        <div class="grid-dos">
            <div class="role-wrapper">
                <span class="label-rol">Superintendente de Bautismo</span>
                {#if getDetalles(c.baut)}
                    {@const p = getDetalles(c.baut)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('baut')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('baut')}>Seleccionar...</button>{/if}
            </div>
            
            <div class="role-wrapper">
                <span class="label-rol">Auxiliar del Superintendente de Bautismo</span>
                {#if getDetalles(c.baut_a)}
                    {@const p = getDetalles(c.baut_a)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('baut_a')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('baut_a')}>Seleccionar...</button>{/if}
            </div>
        </div>
    </div>

  </div>
</div>

{#if mostrarModal}
<div class="modal-backdrop" on:click|self={() => mostrarModal = false}>
  <div class="modal">
    <div class="modal-header"><h3>Seleccionar</h3><button class="btn-close" on:click={() => mostrarModal = false}><X size={18}/></button></div>
    
    <div class="modal-body">
      {#if modoCreacionRapida}
        <div class="form-rapido">
            <h4 class="form-title">Nuevo Registro (En Asamblea #{asambleaId})</h4>
            
            <div class="campo">
                <label>Nombre Completo</label>
                <input type="text" placeholder="Ej: Juan Pérez" bind:value={nuevoNombre} autofocus class="input-std" />
            </div>

            <div class="campo">
                <label>Congregación</label>
                <select bind:value={nuevaCongregacionId} class="input-std">
                    <option value={0}>-- Superintendente de Circuito --</option>
                    {#each congregaciones as cong}
                        <option value={cong.id}>{cong.nombre}</option>
                    {/each}
                </select>
            </div>

            <div class="grid-form">
                <div class="campo">
                    <label>Teléfono</label>
                    <input type="text" placeholder="+53..." bind:value={nuevoTelefono} class="input-std" />
                </div>
                <div class="campo">
                    <label>Email</label>
                    <input type="text" placeholder="@email.com" bind:value={nuevoEmail} class="input-std" />
                </div>
            </div>

            <div class="botones-form">
                <button class="btn-cancelar" on:click={() => modoCreacionRapida = false}>Cancelar</button>
                <button class="btn-confirmar" on:click={crearYSeleccionar}>Guardar</button>
            </div>
        </div>
      {:else}
        <div class="search-box">
            <Search size={16} color="var(--text-secondary)"/>
            <input type="text" placeholder="Buscar..." bind:value={terminoBusqueda} autofocus/>
        </div>
        
        <div class="lista-personas">
            <button class="item-nuevo" on:click={() => modoCreacionRapida = true}>
                <div class="icon-plus"><Plus size={16}/></div>
                <span>Agregar Nuevo / Soy Yo</span>
            </button>

            {#each filtrados as p}
            <button class="item-persona" on:click={() => seleccionar(p.id)}>
                <div class="avatar-small">{p.nombre_completo.charAt(0)}</div>
                <div class="datos"><span class="p-nombre">{p.nombre_completo}</span><span class="p-cong">{p.nombre_congregacion || '-'}</span></div>
            </button>
            {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
{/if}

<style>
  /* APLICANDO VARIABLES GLOBALES DE TEMA */
  .panel-comite { display: flex; flex-direction: column; gap: 20px; height: 100%; background: var(--bg-body); }
  
  .header { 
      display: flex; justify-content: space-between; align-items: center; 
      background: var(--bg-card); 
      padding: 15px 20px; 
      border-bottom: 1px solid var(--border-color); 
  }
  .header h3 { margin: 0; color: var(--text-main); display: flex; gap: 10px; align-items: center; } 
  .text-blue { color: var(--primary); }
  
  .btn-save { 
      background: var(--primary); color: white; border: none; 
      padding: 8px 16px; border-radius: 6px; cursor: pointer; 
      display: flex; gap: 6px; font-weight: 600; align-items: center; 
  }
  
  .scroll-container { padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px; }
  
  .seccion { 
      background: var(--bg-card); 
      border: 1px solid var(--border-color); 
      border-radius: 10px; padding: 15px; 
  }
  
  .titulo-seccion { 
      margin: 0 0 15px 0; 
      color: var(--text-secondary); 
      font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; 
      display: flex; gap: 8px; align-items: center; 
      border-bottom: 1px solid var(--border-color); 
      padding-bottom: 8px; 
  }

  /* GRIDS */
  .grid-uno { display: grid; grid-template-columns: 1fr; }
  .grid-dos { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
  .grid-dos-grande { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .stack-roles { display: flex; flex-direction: column; gap: 10px; }

  /* TARJETA */
  .role-wrapper { display: flex; flex-direction: column; gap: 5px; }
  .label-rol { font-size: 11px; font-weight: 700; color: var(--text-secondary); display: flex; gap: 4px; align-items: center; }
  
  .tarjeta { 
      background: var(--bg-card); 
      border: 1px solid var(--border-color); 
      border-radius: 8px; overflow: hidden; 
      box-shadow: 0 2px 4px var(--shadow-color); 
      transition: all 0.2s; 
  }
  .tarjeta:hover { border-color: var(--primary); box-shadow: 0 4px 8px rgba(0,0,0,0.06); }
  
  .card-top { 
      display: flex; align-items: center; gap: 10px; padding: 10px; 
      background: var(--bg-card); /* Ajustado para consistencia */
      border-bottom: 1px solid var(--border-color); 
  }
  .avatar { 
      width: 32px; height: 32px; 
      background: var(--bg-secondary); color: var(--primary); 
      border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; 
  }
  
  .info { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .t-nombre { font-weight: 700; color: var(--text-main); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .t-priv { font-size: 10px; color: var(--text-secondary); background: var(--bg-body); width: fit-content; padding: 1px 4px; border-radius: 3px; }

  .card-bottom { padding: 8px 12px; background: var(--bg-body); display: flex; flex-direction: column; gap: 4px; }
  .row { font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }

  .btn-x { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 2px; } .btn-x:hover { color: #ef4444; }
  
  .btn-select { 
      width: 100%; padding: 10px; 
      background: var(--bg-body); 
      border: 1px dashed var(--border-color); 
      border-radius: 6px; 
      color: var(--text-secondary); font-size: 12px; 
      cursor: pointer; display: flex; justify-content: space-between; 
  } 
  .btn-select:hover { background: var(--hover-bg); border-color: var(--text-secondary); color: var(--text-main); }

  /* MODAL */
  .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: center; z-index: 999; }
  .modal { 
      background: var(--bg-card); 
      width: 350px; border-radius: 10px; overflow: hidden; 
      display: flex; flex-direction: column; max-height: 80vh; 
      box-shadow: 0 4px 15px var(--shadow-color);
  }
  .modal-header { padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; }
  .modal-header h3 { color: var(--text-main); margin: 0; }
  .btn-close { background: none; border: none; color: var(--text-secondary); cursor: pointer; }
  .btn-close:hover { color: var(--text-main); }

  .modal-body { padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
  
  .search-box { 
      display: flex; align-items: center; gap: 8px; padding: 8px; 
      background: var(--bg-body); 
      border-radius: 6px; border: 1px solid var(--border-color);
  } 
  .search-box input { border: none; background: transparent; outline: none; width: 100%; font-size: 13px; color: var(--text-main); }
  
  .item-persona { 
      display: flex; align-items: center; gap: 10px; padding: 8px; 
      background: var(--bg-card); 
      border: none; text-align: left; cursor: pointer; 
      border-bottom: 1px solid var(--border-color); 
  } 
  .item-persona:hover { background: var(--hover-bg); }
  
  .avatar-small { width: 28px; height: 28px; background: var(--bg-secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--text-secondary); font-size: 10px; }
  .datos { display: flex; flex-direction: column; } 
  .p-nombre { font-weight: 600; font-size: 12px; color: var(--text-main); } 
  .p-cong { font-size: 10px; color: var(--text-secondary); }

  /* ESTILOS CREACION RAPIDA (FORMULARIO) */
  .item-nuevo { 
      display: flex; align-items: center; gap: 10px; padding: 10px; 
      background: var(--bg-secondary); 
      border: 1px dashed var(--primary); 
      color: var(--primary); 
      border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; margin-bottom: 5px; 
  }
  .item-nuevo:hover { opacity: 0.8; }
  
  .form-rapido { display: flex; flex-direction: column; gap: 10px; padding: 5px; }
  .form-title { margin: 0; color: var(--text-main); font-size: 14px; font-weight: 700; border-bottom: 1px solid var(--border-color); padding-bottom: 5px; }
  
  .campo { display: flex; flex-direction: column; gap: 4px; }
  .campo label { font-size: 11px; font-weight: 700; color: var(--text-secondary); }
  
  .input-std { 
      width: 100%; padding: 8px; 
      border: 1px solid var(--border-color); 
      border-radius: 6px; font-size: 13px; box-sizing: border-box; 
      background: var(--input-bg); color: var(--text-main);
  }
  .grid-form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  
  .botones-form { display: flex; gap: 10px; margin-top: 5px; }
  .btn-confirmar { flex: 1; background: var(--primary); color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600; }
  .btn-cancelar { flex: 1; background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color); padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600; }
  .titulo-separador {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-main); /* 👈 Ahora usará tu color de texto principal (negro) */
    margin: 40px 0 20px 0; 
    padding-bottom: 8px;
    border-bottom: 2px solid var(--border-color); 
    width: 100%;
}
</style>