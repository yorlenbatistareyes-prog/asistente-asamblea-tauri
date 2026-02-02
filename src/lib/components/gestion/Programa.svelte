<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  
  import { 
    Users, Video, Mic, Search, X, Plus, Trash2, FileUp, 
    MapPin, Phone, Mail, UserPlus, UserMinus, ChevronRight,
    FileCheck, UserCheck, User 
  } from 'lucide-svelte';

  // --- ESTADO ---
  let asambleaId = 0; // <--- LA LLAVE MAESTRA
  let diaSeleccionado = 'Viernes';
  let partes: any[] = []; 
  
  let oficina: { [key: string]: any } = {
      personal: [] as any[],
      presidente_manana: null as any, oracion_apertura: null as any, bosquejos_manana: null as any, plataforma_manana: null as any,
      presidente_tarde: null as any, oracion_conclusion: null as any, bosquejos_tarde: null as any, plataforma_tarde: null as any
  };

  // --- MODALS ---
  let mostrarModalAsignar = false; 
  let mostrarModalCrear = false;   
  let parteEditando: any = null; 
  let rolOficinaEditando: string | null = null; 
  
  let listaHermanos: any[] = []; 
  let terminoBusqueda = "";
  let nuevaParte = { hora: '', tema: '', tipo: 'Discurso', duracion: 10, sesion: 'Mañana', nombre_orador: '', congregacion: '', email: '', telefono: '' };
  
  let sugerenciasOradores: any[] = [];
  let mostrarSugerencias = false;

  onMount(() => {
    // 1. RECUPERAR ID AL INICIAR
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
        asambleaId = JSON.parse(datosGuardados).id;
        cargarDatos();
        cargarHermanos();
    } else {
        alert("⚠️ No hay asamblea seleccionada.");
    }
  });

  async function cargarDatos() {
    if (!asambleaId) return;
    try { 
        // 2. PEDIR PROGRAMA DE ESTA ASAMBLEA
        partes = await invoke('obtener_programa_dia', { asambleaId, dia: diaSeleccionado }) as any[]; 
    } catch (e) { console.error(e); }
    
    try { 
        // 3. PEDIR OFICINA DE ESTA ASAMBLEA
        const datos = await invoke('obtener_asignaciones_especiales', { asambleaId, dia: diaSeleccionado }) as any[]; 
        organizarOficina(datos); 
    } catch (e) { console.error(e); }
  }

  function organizarOficina(datos: any[]) {
      oficina = { personal: [], presidente_manana: null, oracion_apertura: null, bosquejos_manana: null, plataforma_manana: null, presidente_tarde: null, oracion_conclusion: null, bosquejos_tarde: null, plataforma_tarde: null };
      datos.forEach(d => {
          if (d.tipo_asignacion === 'personal_oficina') oficina.personal.push(d);
          else if (oficina.hasOwnProperty(d.tipo_asignacion)) oficina[d.tipo_asignacion] = d;
      });
      oficina = { ...oficina };
  }

  async function cargarHermanos() { 
    if (!asambleaId) return;
    // 4. PEDIR HERMANOS DE ESTA ASAMBLEA (Para autocompletar)
    listaHermanos = await invoke('obtener_personas', { asambleaId }) as any[]; 
  }

  $: if (diaSeleccionado && asambleaId) cargarDatos();

  // --- LÓGICA OFICINA ---
  async function eliminarAsignacionOficina(idAsignacion: number) {
      if (!confirm("¿Deseas quitar a este hermano de la asignación?")) return;
      try {
          await invoke('eliminar_asignacion_especial', { id: idAsignacion });
          cargarDatos(); 
      } catch (e) { alert("Error al eliminar: " + e); }
  }

  async function toggleCheck(parte: any, tipo: 'confirmacion' | 'presencia') {
      let valorActual = (tipo === 'confirmacion') ? parte.estado === 'Confirmado' : parte.esta_presente;
      try {
          await invoke('alternar_estado_parte', { id: parte.id, tipoAccion: tipo, valorActual });
          cargarDatos(); 
      } catch (e) { console.error(e); }
  }

  // --- MODALS ---
  function abrirModalPrograma(parte: any) { parteEditando = parte; rolOficinaEditando = null; terminoBusqueda = ""; mostrarModalAsignar = true; }
  function abrirModalOficina(rol: string) { rolOficinaEditando = rol; parteEditando = null; terminoBusqueda = ""; mostrarModalAsignar = true; }
  function cerrarModales() { mostrarModalAsignar = false; mostrarModalCrear = false; parteEditando = null; rolOficinaEditando = null; }

  async function asignarOrador(oradorId: number | null, esVideo: boolean) {
    if (oradorId === null && !esVideo) return;
    try {
        if (parteEditando) {
            // Asignar parte usa ID único, no necesita asambleaId
            await invoke('asignar_parte', { idParte: parteEditando.id, oradorId, esVideo });
        }
        else if (rolOficinaEditando && oradorId) {
            // 5. GUARDAR ASIGNACIÓN ESPECIAL EN ESTA ASAMBLEA
            await invoke('guardar_asignacion_especial', { 
                asambleaId, 
                dia: diaSeleccionado, 
                tipoAsignacion: rolOficinaEditando, 
                personaId: oradorId 
            });
        }
        cerrarModales(); cargarDatos();
    } catch (e) { alert(e); }
  }

  async function guardarNuevaParte() {
    if(!nuevaParte.hora || !nuevaParte.tema) return alert("Falta datos");
    try {
      // 6. CREAR PARTE EN ESTA ASAMBLEA
      await invoke('crear_parte', { 
        asambleaId,
        dia: diaSeleccionado, 
        sesion: nuevaParte.sesion, 
        hora: nuevaParte.hora, 
        tema: nuevaParte.tema, 
        tipo: nuevaParte.tipo, 
        duracion: Number(nuevaParte.duracion), 
        nombreOrador: nuevaParte.nombre_orador || null, 
        congregacion: nuevaParte.congregacion || null, 
        email: nuevaParte.email || null, 
        telefono: nuevaParte.telefono || null 
      });
      mostrarModalCrear = false; nuevaParte = { hora: '', tema: '', tipo: 'Discurso', duracion: 10, sesion: 'Mañana', nombre_orador: '', congregacion: '', email: '', telefono: '' };
      cargarDatos();
      // Recargamos hermanos por si se creó uno nuevo al vuelo
      cargarHermanos(); 
    } catch (e) { alert(e); }
  }

  async function quitarPersonal(id: number) { if(confirm("¿Quitar?")) { await invoke('eliminar_asignacion_especial', { id }); cargarDatos(); } }
  
  async function limpiarTodo() { 
      if(confirm("¿Borrar todo el programa de ESTE DÍA?")) { 
          // 7. LIMPIAR PROGRAMA DE ESTA ASAMBLEA
          await invoke('limpiar_programa', { asambleaId }); 
          cargarDatos(); 
      } 
  }
  
  async function eliminarParte(id: number) { if(confirm("¿Eliminar?")) { await invoke('eliminar_parte', { id }); cargarDatos(); } }
  
  async function importarPrograma() { 
      try { 
          const f = await open({ filters: [{ name: 'CSV', extensions: ['csv'] }] }); 
          if(f) { 
              // 8. IMPORTAR PROGRAMA EN ESTA ASAMBLEA
              await invoke('importar_programa_jw', { asambleaId, rutaArchivo: f }); 
              cargarDatos(); 
              cargarHermanos(); // Importante: recargar lista de hermanos
          } 
      } catch(e) { alert(e); } 
  }

  function filtrarOradores() { const t = nuevaParte.nombre_orador.toLowerCase(); if(t.length<2){sugerenciasOradores=[];mostrarSugerencias=false;return;} sugerenciasOradores = listaHermanos.filter(h => h.nombre_completo.toLowerCase().includes(t)); mostrarSugerencias = sugerenciasOradores.length > 0; }
  function selectSugerencia(h: any) { nuevaParte.nombre_orador = h.nombre_completo; nuevaParte.congregacion = h.nombre_congregacion || ''; nuevaParte.telefono = h.telefono || ''; nuevaParte.email = h.email || ''; mostrarSugerencias = false; }
  
  $: hermanosFiltrados = listaHermanos.filter(h => h.nombre_completo.toLowerCase().includes(terminoBusqueda.toLowerCase()));
  const nombreTxt = (obj: any) => obj ? obj.nombre_completo : "Seleccionar...";
</script>

<div class="layout-programa">
  <aside class="panel-oficina dark-theme">
    <div class="header-oficina-dark"><h3><Users size={20}/> Oficina</h3><span class="badge-dark">{diaSeleccionado}</span></div>
    <div class="contenido-oficina">
        <div class="seccion-oficina">
            <h4 class="titulo-seccion">PERSONAL</h4>
            <div class="lista-personal">
                {#each oficina.personal as p}<div class="item-personal"><span class="nombre-p">{p.nombre_completo}</span><button class="btn-x" on:click={() => quitarPersonal(p.id)}><UserMinus size={14}/></button></div>{/each}
                {#if oficina.personal.length === 0}<span class="vacio">(Vacío)</span>{/if}
            </div>
            <button class="btn-add-dark" on:click={() => abrirModalOficina('personal_oficina')}><UserPlus size={14}/> Añadir</button>
        </div>
        
        <div class="separador-dark"></div>

        <div class="seccion-oficina">
            <h4 class="titulo-seccion">MAÑANA</h4>
            {#each [
                { label: 'Presidente', key: 'presidente_manana' },
                { label: 'Oración', key: 'oracion_apertura' },
                { label: 'Bosquejos', key: 'bosquejos_manana' },
                { label: 'Plataforma', key: 'plataforma_manana' }
            ] as item}
                <div class="campo-dark">
                    <label>{item.label}</label>
                    <div class="input-con-acciones">
                        <button class="btn-select-dark" on:click={() => abrirModalOficina(item.key)}>
                            {nombreTxt(oficina[item.key])} <ChevronRight size={14}/>
                        </button>
                        {#if oficina[item.key]}
                            <button class="btn-quitar-rol" on:click={() => eliminarAsignacionOficina(oficina[item.key].id)}>
                                <X size={14}/>
                            </button>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>

        <div class="seccion-oficina mt-4">
            <h4 class="titulo-seccion">TARDE</h4>
            {#each [
                { label: 'Presidente', key: 'presidente_tarde' },
                { label: 'Oración', key: 'oracion_conclusion' },
                { label: 'Bosquejos', key: 'bosquejos_tarde' },
                { label: 'Plataforma', key: 'plataforma_tarde' }
            ] as item}
                <div class="campo-dark">
                    <label>{item.label}</label>
                    <div class="input-con-acciones">
                        <button class="btn-select-dark" on:click={() => abrirModalOficina(item.key)}>
                            {nombreTxt(oficina[item.key])} <ChevronRight size={14}/>
                        </button>
                        {#if oficina[item.key]}
                            <button class="btn-quitar-rol" on:click={() => eliminarAsignacionOficina(oficina[item.key].id)}>
                                <X size={14}/>
                            </button>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    </div>
  </aside>

  <main class="panel-discursos">
    <div class="tabs">
      {#each ['Viernes', 'Sábado', 'Domingo'] as dia}<button class:active={diaSeleccionado === dia} on:click={() => diaSeleccionado = dia}>{dia}</button>{/each}
    </div>
    <div class="header-sesion">
      <h2>Programa - {diaSeleccionado}</h2>
      <div class="acciones-header">
        <button class="btn-icon" on:click={importarPrograma} title="Importar CSV"><FileUp size={16}/></button>
        <button class="btn-icon danger" on:click={limpiarTodo} title="Limpiar Programa"><Trash2 size={16}/></button>
        <button class="btn-primary" on:click={() => mostrarModalCrear = true}><Plus size={16}/> Agregar</button>
      </div>
    </div>
    <div class="lista-partes">
      {#if partes.length === 0}<div class="empty-state"><p>Programa vacío para este día.</p></div>{/if}
      
      {#each partes as parte}
        <div class="card-parte">
          <div class="col-hora"><span class="hora">{parte.hora_inicio}</span><span class="tipo-badge">{parte.tipo}</span></div>
          <div class="col-info">
            <span class="tema">{parte.tema}</span>
            <div class="controles">
              {#if parte.es_video}
                <button class="tag-video" on:click={() => abrirModalPrograma(parte)}><Video size={14}/> Video</button>
              {:else}
                <div class="orador-wrapper">
                  <button class="selector-orador" class:asignado={parte.nombre_orador} on:click={() => abrirModalPrograma(parte)}>
                    <User size={14}/> <span>{parte.nombre_orador || "Seleccionar..."}</span>
                  </button>
                  {#if parte.nombre_orador}
                    <div class="detalles-orador">
                        {#if parte.congregacion_orador}<span class="dato-extra"><MapPin size={11}/> {parte.congregacion_orador}</span>{/if}
                        {#if parte.telefono_orador}<span class="dato-extra"><Phone size={11}/> {parte.telefono_orador}</span>{/if}
                        {#if parte.email_orador}<span class="dato-extra"><Mail size={11}/> {parte.email_orador}</span>{/if}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
          
          <div class="col-estados">
            {#if !parte.es_video && parte.nombre_orador}
                <button class="btn-estado recepcion" class:activo={parte.estado === 'Confirmado'} on:click={() => toggleCheck(parte, 'confirmacion')} title="Recibido">
                    <FileCheck size={18} /><span class="label-estado">Recibido</span>
                </button>
                <button class="btn-estado presencia" class:activo={parte.esta_presente} on:click={() => toggleCheck(parte, 'presencia')} title="Presente">
                    <UserCheck size={18} /><span class="label-estado">Presente</span>
                </button>
            {/if}
          </div>

          <div class="col-acciones"><button class="btn-eliminar" on:click={() => eliminarParte(parte.id)}><X size={14}/></button></div>
        </div>
      {/each}
    </div>
  </main>
</div>

{#if mostrarModalCrear}
  <div class="modal-backdrop" on:click|self={cerrarModales}>
    <div class="modal">
      <div class="modal-header"><h3>Nueva Parte</h3><button class="btn-close" on:click={cerrarModales}><X size={18}/></button></div>
      <div class="modal-body form-body">
        <h4 class="form-title">Detalles</h4>
        <div class="fila">
             <div class="campo"><label>Sesión</label><select bind:value={nuevaParte.sesion}><option>Mañana</option><option>Tarde</option></select></div>
            <div class="campo"><label>Hora</label><input type="time" bind:value={nuevaParte.hora} /></div>
            <div class="campo"><label>Min</label><input type="number" bind:value={nuevaParte.duracion} /></div>
        </div>
        <div class="campo"><label>Tipo</label><select bind:value={nuevaParte.tipo}><option>Cántico</option><option>Discurso</option><option>Simposio</option><option>Video</option></select></div>
        <div class="campo"><label>Tema</label><input type="text" placeholder="Tema..." bind:value={nuevaParte.tema} /></div>
        {#if nuevaParte.tipo !== 'Video'}
            <div class="separator-line"></div>
            <h4 class="form-title">Asignación Rápida</h4>
            <div class="campo autocomplete-container">
                <label>Orador</label><div class="input-icon"><Mic size={14}/><input type="text" placeholder="Nombre..." bind:value={nuevaParte.nombre_orador} on:input={filtrarOradores} on:blur={() => setTimeout(()=>mostrarSugerencias=false, 200)}/></div>
                {#if mostrarSugerencias}
                    <div class="sugerencias-lista">{#each sugerenciasOradores as s}<button class="sugerencia-item" on:click={() => selectSugerencia(s)}>{s.nombre_completo}</button>{/each}</div>
                {/if}
            </div>
            {#if nuevaParte.nombre_orador.length > 0}
                <div class="campo"><label>Congregación</label><div class="input-icon"><MapPin size={14}/><input type="text" placeholder="Cong..." bind:value={nuevaParte.congregacion} /></div></div>
                <div class="fila"><div class="campo"><label>Tel</label><div class="input-icon"><Phone size={14}/><input type="text" bind:value={nuevaParte.telefono} /></div></div><div class="campo"><label>Email</label><div class="input-icon"><Mail size={14}/><input type="text" bind:value={nuevaParte.email} /></div></div></div>
            {/if}
        {/if}
        <button class="btn-guardar" on:click={guardarNuevaParte}>Guardar</button>
      </div>
    </div>
  </div>
{/if}

{#if mostrarModalAsignar}
  <div class="modal-backdrop" on:click|self={cerrarModales}>
    <div class="modal">
      <div class="modal-header"><h3>Asignar</h3><button class="btn-close" on:click={cerrarModales}><X size={18}/></button></div>
      <div class="modal-body">
        <div class="buscador"><Search size={16} color="#64748b"/><input type="text" placeholder="Buscar..." bind:value={terminoBusqueda} autofocus /></div>
        <div class="lista-opciones">
          {#if !rolOficinaEditando}<button class="item-opcion video-option" on:click={() => asignarOrador(null, true)}><div class="icono-video"><Video size={18}/></div><span>Video</span></button>{/if}
          {#each hermanosFiltrados as h}<button class="item-opcion" on:click={() => asignarOrador(h.id, false)}><div class="avatar">{h.nombre_completo.charAt(0)}</div><div class="datos-opcion"><span class="nombre">{h.nombre_completo}</span><span class="detalle">{h.nombre_congregacion || '-'}</span></div></button>{/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* --- LAYOUT --- */
  .layout-programa { display: grid; grid-template-columns: 280px 1fr; gap: 20px; height: 100%; overflow: hidden; }
  
  /* --- OFICINA (DARK) --- */
  .panel-oficina.dark-theme { background: #1e293b; color: #e2e8f0; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
  .header-oficina-dark { background: #0f172a; padding: 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }
  .header-oficina-dark h3 { margin: 0; font-size: 15px; display: flex; gap: 8px; color: white; }
  .badge-dark { background: #3b82f6; color: white; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; }
  .contenido-oficina { padding: 15px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px; }
  .titulo-seccion { color: #94a3b8; font-size: 10px; font-weight: 700; letter-spacing: 1px; margin: 0 0 10px 0; }
  .lista-personal { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
  .item-personal { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 6px 10px; border-radius: 6px; font-size: 13px; }
  .btn-x { background: none; border: none; color: #64748b; cursor: pointer; padding: 0; display: flex; } .btn-x:hover { color: #ef4444; }
  .btn-add-dark { background: none; border: 1px dashed #475569; color: #94a3b8; width: 100%; padding: 8px; border-radius: 6px; cursor: pointer; display: flex; justify-content: center; gap: 6px; font-size: 12px; }
  .separador-dark { height: 1px; background: #334155; }
  
  .campo-dark { margin-bottom: 12px; } 
  .campo-dark label { font-size: 11px; color: #94a3b8; display: block; margin-bottom: 3px; }
  
  .input-con-acciones { display: flex; gap: 4px; align-items: center; }
  .btn-select-dark { flex: 1; background: #0f172a; border: 1px solid #334155; color: white; padding: 8px 10px; border-radius: 6px; text-align: left; cursor: pointer; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
  .btn-quitar-rol { background: #312e81; color: #93c5fd; border: 1px solid #1e3a8a; padding: 8px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; transition: all 0.2s; }
  .btn-quitar-rol:hover { background: #ef4444; color: white; border-color: #991b1b; }

  /* --- PROGRAMA (DERECHA) --- */
  .panel-discursos { background: white; border-radius: 10px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
  .header-sesion { padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; } .header-sesion h2 { margin: 0; font-size: 18px; color: #1e293b; }
  .tabs { display: flex; background: #f8fafc; border-bottom: 1px solid #e2e8f0; } .tabs button { flex: 1; padding: 15px; border: none; background: none; font-weight: 600; color: #64748b; cursor: pointer; border-bottom: 3px solid transparent; } .tabs button.active { color: #2563eb; border-bottom-color: #2563eb; background: white; }
  .lista-partes { padding: 20px; overflow-y: auto; flex: 1; }
  .card-parte { display: flex; gap: 15px; background: white; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 10px; }
  .col-hora { display: flex; flex-direction: column; align-items: center; min-width: 60px; } .hora { font-weight: bold; color: #1e293b; } .tipo-badge { font-size: 10px; background: #eff6ff; color: #2563eb; padding: 2px 6px; border-radius: 4px; }
  .col-info { flex: 1; } .tema { font-weight: 600; color: #334155; display: block; margin-bottom: 5px; }
  .orador-wrapper { display: flex; flex-direction: column; gap: 4px; }
  .selector-orador { font-size: 13px; display: flex; gap: 6px; align-items: center; padding: 5px 10px; border: 1px dashed #cbd5e1; background: white; border-radius: 4px; cursor: pointer; color: #ef4444; }
  .selector-orador.asignado { color: #0f172a; border-style: solid; background: #f1f5f9; border-color: #e2e8f0; font-weight: 600; }
  .detalles-orador { display: flex; gap: 10px; margin-left: 2px; } .dato-extra { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #64748b; }
  .tag-video { font-size: 12px; display: flex; gap: 5px; align-items: center; padding: 4px 8px; border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; border-radius: 4px; cursor: pointer; }
  
  .col-estados { display: flex; align-items: center; gap: 8px; padding: 0 15px; border-left: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; height: 40px; }
  .btn-estado { display: flex; flex-direction: column; align-items: center; gap: 2px; background: none; border: 1px solid transparent; cursor: pointer; color: #cbd5e1; padding: 4px 8px; border-radius: 6px; transition: all 0.2s; }
  .btn-estado:hover { background: #f8fafc; border-color: #e2e8f0; } .label-estado { font-size: 9px; font-weight: 700; text-transform: uppercase; }
  .btn-estado.recepcion.activo { color: #2563eb; background: #eff6ff; border-color: #dbeafe; }
  .btn-estado.presencia.activo { color: #10b981; background: #ecfdf5; border-color: #d1fae5; }

  .btn-primary { background: #2563eb; color: white; padding: 8px 16px; border-radius: 6px; border: none; display: flex; gap: 6px; cursor: pointer; }
  .btn-icon { background: white; border: 1px solid #e2e8f0; padding: 8px; border-radius: 6px; cursor: pointer; color: #64748b; }
  .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
  .modal { background: white; width: 450px; border-radius: 12px; max-height: 90vh; display: flex; flex-direction: column; }
  .modal-header { padding: 15px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
  .modal-body { padding: 20px; overflow-y: auto; }
  .buscador { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; } .buscador input { border: none; outline: none; flex: 1; }
  .item-opcion { display: flex; align-items: center; gap: 12px; padding: 10px; background: white; border: none; border-bottom: 1px solid #f1f5f9; cursor: pointer; width: 100%; text-align: left; }
  .item-opcion:hover { background: #f8fafc; } .avatar { width: 32px; height: 32px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #64748b; }
  .datos-opcion { display: flex; flex-direction: column; } .nombre { font-weight: 600; font-size: 14px; } .detalle { font-size: 12px; color: #94a3b8; }
  .acciones-header { display: flex; gap: 10px; }
  .col-acciones button { background: none; border: none; color: #cbd5e1; cursor: pointer; } .col-acciones button:hover { color: #ef4444; }
  
  .autocomplete-container { position: relative; }
  .sugerencias-lista { position: absolute; top: 100%; left: 0; width: 100%; background: white; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); z-index: 100; max-height: 200px; overflow-y: auto; margin-top: 5px; }
  .sugerencia-item { display: flex; justify-content: space-between; width: 100%; padding: 10px; border: none; background: white; text-align: left; cursor: pointer; border-bottom: 1px solid #f1f5f9; }
  .sugerencia-item:hover { background: #f1f5f9; } .s-nombre { font-weight: 600; font-size: 13px; color: #334155; } .s-cong { font-size: 11px; color: #94a3b8; }
  .form-title { margin: 0; font-size: 14px; border-left: 3px solid #3b82f6; padding-left: 8px; color: #334155; } .separator-line { height: 1px; background: #e2e8f0; margin: 10px 0; }
  .campo { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; } .campo label { font-size: 12px; font-weight: bold; color: #64748b; }
  .campo input, .campo select { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; }
  .input-icon { position: relative; display: flex; align-items: center; } .input-icon :global(svg) { position: absolute; left: 10px; color: #94a3b8; } .input-icon input { padding-left: 32px; width: 100%; }
  .fila { display: flex; gap: 15px; } .fila .campo { flex: 1; }
  .btn-guardar { background: #2563eb; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; }
</style>
