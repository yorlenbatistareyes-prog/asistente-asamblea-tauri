<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import Panel from '$lib/components/ui/Panel.svelte';
  
  // Iconos
  import { 
    Users, Droplets, Mic, CheckCircle, AlertCircle, 
    Clock, Activity, ArrowRight 
  } from 'lucide-svelte';

  // Importamos el Store Global
  import { appStore, cargarDatosGlobales } from '$lib/stores/appStore';

  // --- VARIABLES DE ESTADO ---
  let horaActual = '';
  let asambleaIdActual = 0; 
  let nombreAsamblea = '';
  
  // --- 1. ASISTENCIA DETALLADA (6 SESIONES) ---
  let mostrarModalAsistencia = false; 

  let asistenciaDetalle = {
      viernes_am: 0, viernes_pm: 0,
      sabado_am: 0, sabado_pm: 0,
      domingo_am: 0, domingo_pm: 0
  };

  // Cálculo Automático
  $: maxAsistencia = Math.max(
      asistenciaDetalle.viernes_am, asistenciaDetalle.viernes_pm,
      asistenciaDetalle.sabado_am, asistenciaDetalle.sabado_pm,
      asistenciaDetalle.domingo_am, asistenciaDetalle.domingo_pm
  );

  // --- 2. RESTO DE DATOS MANUALES ---
  let bautismosTotal = 0;
  let totalCongregacionesReales = 0; // Se carga desde DB

  // --- 3. DATOS AUTOMÁTICOS ---
  let oradoresPendientesLista: any[] = []; 
  let estadisticasPrograma = { confirmados: 0, pendientes: 0 };
  
  // --- 4. MONITOR Y DESFASE DE TIEMPO (NUEVO) ---
  let parteActual: any = null;
  let siguienteParte: any = null;
  let programaCompletoCache: any[] = [];
  
  // Variable para adelantar/atrasar el reloj del monitor
  let offsetMinutos = 0; 

  // --- INICIO ---
  onMount(async () => {
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
        const data = JSON.parse(datosGuardados);
        asambleaIdActual = data.id;
        nombreAsamblea = data.nombre || data.tema || "Asamblea";
    } else {
        asambleaIdActual = 1; 
    }

    await cargarDatosGlobales();
    cargarDatosLocales(); 
    await cargarDatosDB();

    actualizarReloj();
    setInterval(actualizarReloj, 30000); 
  });

  // --- FUNCIÓN CARGAR DATOS LOCALES ---
  function cargarDatosLocales() {
    if (!asambleaIdActual) return;

    // A. Asistencia
    const rawAsis = localStorage.getItem(`dash_asistencia_obj_${asambleaIdActual}`);
    if (rawAsis) {
        asistenciaDetalle = JSON.parse(rawAsis);
    } else {
        asistenciaDetalle = { viernes_am: 0, viernes_pm: 0, sabado_am: 0, sabado_pm: 0, domingo_am: 0, domingo_pm: 0 };
    }

    // B. Bautismos
    bautismosTotal = Number(localStorage.getItem(`dash_bautismos_${asambleaIdActual}`)) || 0;

    // C. Desfase de tiempo (NUEVO)
    offsetMinutos = Number(localStorage.getItem(`dash_offset_${asambleaIdActual}`)) || 0;
  }

  // Guardar ASISTENCIA
  function guardarAsistencia() {
      if (!asambleaIdActual) return;
      localStorage.setItem(`dash_asistencia_obj_${asambleaIdActual}`, JSON.stringify(asistenciaDetalle));
  }

  // Guardar OTROS DATOS
  function guardarDato(tipo: string, valor: number) {
    if (!asambleaIdActual) return;
    localStorage.setItem(`dash_${tipo}_${asambleaIdActual}`, valor.toString());
  }

  // --- LÓGICA DE CONTROL DE TIEMPO (NUEVO) ---
  
  function ajustarDesfase(valor: number) {
      offsetMinutos += valor;
      localStorage.setItem(`dash_offset_${asambleaIdActual}`, offsetMinutos.toString());
      actualizarReloj(); 
  }

  function resetearDesfase() {
      offsetMinutos = 0;
      localStorage.setItem(`dash_offset_${asambleaIdActual}`, "0");
      actualizarReloj();
  }

  // --- LÓGICA DE RELOJ Y MONITOR ---
  function actualizarReloj() {
    const ahora = new Date();
    horaActual = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    calcularParteEnVivo(ahora);
  }

  function calcularParteEnVivo(ahora: Date) {
    if (!programaCompletoCache || programaCompletoCache.length === 0) return;
    
    // 1. Minutos REALES
    const minutosReales = ahora.getHours() * 60 + ahora.getMinutes();
    
    // 2. Minutos VIRTUALES (Aplicando el ajuste manual)
    const minutosSistema = minutosReales + offsetMinutos;

    const actual = programaCompletoCache.find((p: any) => {
        if (!p.hora_inicio) return false;
        const [hStr, mStr] = p.hora_inicio.split(':');
        const inicio = parseInt(hStr) * 60 + parseInt(mStr);
        const duracion = Number(p.duracion) || 10; 
        
        // Comparamos con el tiempo ajustado
        return minutosSistema >= inicio && minutosSistema < (inicio + duracion);
    });

    if (actual) {
        parteActual = actual;
        const idx = programaCompletoCache.findIndex(p => p.id === actual.id);
        siguienteParte = programaCompletoCache[idx + 1] || null;
    } else {
        parteActual = null;
        siguienteParte = programaCompletoCache.find((p: any) => {
            if (!p.hora_inicio) return false;
            const [hStr, mStr] = p.hora_inicio.split(':');
            return (parseInt(hStr) * 60 + parseInt(mStr)) > minutosSistema;
        });
    }
  }

  // --- CARGA DE DATOS DB ---
  async function cargarDatosDB() {
    if (!asambleaIdActual) return;

    // 1. CARGAR TOTAL CONGREGACIONES
    try {
        const listaCongregaciones: any = await invoke('obtener_congregaciones', { 
            asambleaId: asambleaIdActual 
        });
        
        if (Array.isArray(listaCongregaciones)) {
            totalCongregacionesReales = listaCongregaciones.length;
        } else {
            totalCongregacionesReales = 0;
        }
    } catch (e) {
        console.error("Error al obtener congregaciones:", e);
        totalCongregacionesReales = 0;
    }

    // 2. CARGAR PROGRAMA
    const dias = ['Viernes', 'Sábado', 'Domingo'];
    let pendientes: any[] = []; 
    let confirmadosCount = 0;
    programaCompletoCache = [];

    for (const dia of dias) {
        try {
            const partes: any[] = await invoke('obtener_programa_dia', { asambleaId: asambleaIdActual, dia }); 
            if (Array.isArray(partes)) {
                partes.forEach(p => {
                    programaCompletoCache.push({ ...p, dia });
                    if (!p.es_video && p.nombre_orador) {
                        if (p.estado === 'Confirmado' || p.recibido_manual) confirmadosCount++;
                        else pendientes.push({ ...p, dia });
                    }
                });
            }
        } catch (e) { console.error(e); }
    }
    
    programaCompletoCache.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    estadisticasPrograma.confirmados = confirmadosCount;
    estadisticasPrograma.pendientes = pendientes.length;
    oradoresPendientesLista = pendientes;
    
    actualizarReloj();
  }

  async function confirmarOradorDesdeResumen(parte: any) {
      if(!confirm(`¿Confirmar a ${parte.nombre_orador}?`)) return;
      try {
          await invoke('alternar_estado_parte', { id: parte.id, tipoAccion: 'confirmacion', valorNuevo: true });
          await cargarDatosDB();
      } catch(e) { alert("Error: " + e); }
  }
</script>

<div class="dashboard-container">

  <div class="main-grid">
      
    <div class="col-left">
        
        <div class="stats-row">
            <button class="card stat-card btn-card-asistencia" on:click={() => mostrarModalAsistencia = true}>
              <div class="icon-wrapper blue"><Users size={22} /></div>
              <div class="stat-info">
                 <span class="label">Asistencia Máxima</span>
                 <span class="numero-grande">{maxAsistencia}</span>
                <span class="subtext">Clic para desglosar</span>
              </div>
            </button>

            <Panel padding="15px" clasesExtra="stat-card">
                <div class="icon-wrapper cyan"><Droplets size={22} /></div>
                <div class="stat-info">
                    <span class="label">Bautismos</span>
                    <input type="number" class="editable-num" 
                           bind:value={bautismosTotal} 
                           on:input={() => guardarDato('bautismos', bautismosTotal)}>
                </div>
            </Panel>
            
            <Panel padding="15px" clasesExtra="stat-card">
                <div class="icon-wrapper purple">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="2" x2="9" y2="22"></line><line x1="15" y1="2" x2="15" y2="22"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="17" x2="20" y2="17"></line></svg>
                </div>
                <div class="stat-info">
                    <span class="label">Congregaciones</span>
                    <span class="numero-grande">{totalCongregacionesReales}</span>
                    <span class="subtext">Registradas</span>
                </div>
            </Panel>
        </div>

        <Panel padding="0" clasesExtra="alertas-section">
            <div class="card-header-red">
                <h4><AlertCircle size={18} /> Oradores Pendientes ({estadisticasPrograma.pendientes})</h4>
            </div>
            <div class="lista-pendientes">
                {#if oradoresPendientesLista.length > 0}
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr><th>Orador</th><th>Asignación</th><th>Acción</th></tr>
                            </thead>
                            <tbody>
                                {#each oradoresPendientesLista.slice(0, 5) as p}
                                    <tr>
                                        <td class="fw-bold">{p.nombre_orador}</td>
                                        <td>
                                            <div class="tema-mini">{p.tema.substring(0, 25)}...</div>
                                            <span class="badge-dia">{p.dia}</span>
                                        </td>
                                        <td>
                                            <button class="btn-sm-confirmar" on:click={() => confirmarOradorDesdeResumen(p)}>
                                                Confirmar
                                            </button>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                        {#if oradoresPendientesLista.length > 5}
                            <div class="ver-mas">...y {oradoresPendientesLista.length - 5} más</div>
                        {/if}
                    </div>
                {:else}
                    <div class="empty-state">
                        <CheckCircle size={40} color="#10b981"/>
                        <p>¡Todo al día! No hay pendientes.</p>
                    </div>
                {/if}
            </div>
        </Panel>
    </div>

    <div class="col-right">
        <Panel padding="0" clasesExtra="live-monitor-container">
            <div class="monitor-header">
                <div class="header-left">
                    <div class="live-badge">
                        <span class="blink-dot"></span> EN CURSO
                    </div>
                    {#if parteActual}
                        <span class="monitor-dia">{parteActual.dia}</span>
                    {/if}
                </div>
                
                <div class="ajuste-tiempo">
                    <button class="btn-ajuste" on:click={() => ajustarDesfase(-1)} title="Atrasar 1 min">-</button>
                    
                    <button class="valor-ajuste" 
                            class:activo={offsetMinutos !== 0} 
                            on:click={resetearDesfase}
                            title="Clic para volver a la Hora Real (0m)">
                        {offsetMinutos > 0 ? '+' : ''}{offsetMinutos}m
                    </button>
                    
                    <button class="btn-ajuste" on:click={() => ajustarDesfase(1)} title="Adelantar 1 min">+</button>
                </div>
            </div>

            <div class="monitor-body">
                {#if parteActual}
                    <span class="hora-big">{parteActual.hora_inicio}</span>
                    <h3 class="tema-big">{parteActual.tema}</h3>
                    <div class="orador-box">
                        <Mic size={18}/>
                        <span>{parteActual.nombre_orador || "---"}</span>
                    </div>
                {:else}
                    <div class="descanso-mode">
                        <Activity size={40} color="var(--text-sec)"/>
                        <h3>En pausa</h3>
                        <p>Esperando siguiente sesión...</p>
                    </div>
                {/if}
            </div>

            <div class="monitor-footer">
                <span class="label-next">A CONTINUACIÓN:</span>
                {#if siguienteParte}
                    <div class="next-row">
                        <span class="next-hora">{siguienteParte.hora_inicio}</span>
                        <div class="next-info">
                            <span class="next-tema">{siguienteParte.tema}</span>
                            <span class="next-orador">{siguienteParte.nombre_orador || ""}</span>
                        </div>
                        <ArrowRight size={16} color="var(--text-sec)"/>
                    </div>
                {:else}
                    <span class="text-muted">Fin del programa.</span>
                {/if}
            </div>
       </Panel>

        <div class="accesos-grid">
            <button class="btn-acceso" on:click={cargarDatosDB}>
                <Activity size={20}/> <span>Actualizar Datos</span>
            </button>
        </div>

    </div>
  </div>
</div>

{#if mostrarModalAsistencia}
<div class="modal-backdrop" on:click|self={() => mostrarModalAsistencia = false}>
    <div class="modal-content-asistencia">
        <div class="modal-header">
            <h3>Registro de Asistencia</h3>
            <button class="btn-close" on:click={() => mostrarModalAsistencia = false}>✕</button>
        </div>
        
        <div class="grid-dias">
            <div class="col-dia">
                <h4>Viernes</h4>
                <div class="input-group-modal"><label>Mañana</label><input type="number" bind:value={asistenciaDetalle.viernes_am} on:input={guardarAsistencia}></div>
                <div class="input-group-modal"><label>Tarde</label><input type="number" bind:value={asistenciaDetalle.viernes_pm} on:input={guardarAsistencia}></div>
            </div>
            <div class="col-dia">
                <h4>Sábado</h4>
                <div class="input-group-modal"><label>Mañana</label><input type="number" bind:value={asistenciaDetalle.sabado_am} on:input={guardarAsistencia}></div>
                <div class="input-group-modal"><label>Tarde</label><input type="number" bind:value={asistenciaDetalle.sabado_pm} on:input={guardarAsistencia}></div>
            </div>
            <div class="col-dia">
                <h4>Domingo</h4>
                <div class="input-group-modal"><label>Mañana</label><input type="number" bind:value={asistenciaDetalle.domingo_am} on:input={guardarAsistencia}></div>
                <div class="input-group-modal"><label>Tarde</label><input type="number" bind:value={asistenciaDetalle.domingo_pm} on:input={guardarAsistencia}></div>
            </div>
        </div>
        
        <div class="modal-footer">
            <p>Se mostrará en el resumen el valor más alto: <strong>{maxAsistencia}</strong></p>
        </div>
    </div>
</div>
{/if}

<style>
  /* --- ESTILOS --- */
  .dashboard-container {
    display: flex; flex-direction: column; gap: 20px; height: 100%; overflow-y: auto;
    padding-bottom: 20px;
  }
  
  .header-torre {
    display: flex; justify-content: space-between; align-items: flex-end;
    padding-bottom: 10px; border-bottom: 1px solid var(--border);
  }
  h2 { margin: 0; font-size: 1.5rem; color: var(--text-main); }
  .subtitulo-header { font-size: 0.9rem; color: var(--text-sec); }
  .reloj-badge {
    font-size: 1.5rem; font-weight: 800; color: var(--primary);
    display: flex; align-items: center; gap: 10px;
    background: var(--bg-card); padding: 5px 15px; border-radius: 12px;
    border: 1px solid var(--border);
  }

  .main-grid {
    display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px;
  }
  @media (max-width: 950px) { .main-grid { grid-template-columns: 1fr; } }

  .col-left, .col-right { display: flex; flex-direction: column; gap: 20px; }

  /* --- TARJETAS STATS --- */
  .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
 
 .icon-wrapper {
    min-width: 40px !important;
    height: 40px !important;
    border-radius: 10px !important;
    display: flex !important;
    align-items: center;
    justify-content: center;
    color: white;
    position: static !important; /* Quitamos el position absolute */
    margin-bottom: 0 !important;
}

  .icon-wrapper.blue { background: #3b82f6; }
  .icon-wrapper.cyan { background: #06b6d4; }
  .icon-wrapper.purple { background: #8b5cf6; } /* Violeta */
:global(.stat-card) {
    display: flex !important;
    flex-direction: row !important; /* Vuelve a ponerlos uno al lado del otro */
    align-items: center !important;
    gap: 12px;
    padding: 15px !important; /* Restauramos el relleno original */
}

.stat-info {
    padding: 0 !important; /* Quitamos el relleno extra que no necesitamos */
    display: flex;
    flex-direction: column;
    width: 100%;
}

.label { font-size: 0.7rem; color: var(--text-sec); font-weight: 700; text-transform: uppercase; margin-bottom: 2px;}
  .subtext { font-size: 0.65rem; color: var(--text-sec); }

  .editable-num {
    border: none; background: transparent; font-size: 1.4rem; font-weight: 800;
    color: var(--text-main); width: 100%; outline: none; padding: 0;
  }
  .editable-num:focus { border-bottom: 2px solid var(--primary); }
  
  /* --- ZONA DE PENDIENTES --- */
  .alertas-section {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; flex: 1;
  }
  .card-header-red {
    background: #fef2f2; border-bottom: 1px solid #fecaca; padding: 12px 20px;
    color: #b91c1c; 
  }
  .card-header-red h4 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 0.95rem; }
  
  .table-container { width: 100%; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { text-align: left; padding: 8px 15px; background: var(--bg-body); color: var(--text-sec); font-size: 0.7rem; text-transform: uppercase; }
  
  td { 
    padding: 10px 15px; 
    border-bottom: 1px solid rgba(0, 0, 0, 0.08); /* Línea interna muy suave */
    color: var(--text-main); 
    vertical-align: middle; 
}
  .fw-bold { font-weight: 600; font-size: 0.9rem; }
  .tema-mini { font-size: 0.8rem; color: var(--text-sec); margin-bottom: 2px; }
  .badge-dia { background: var(--bg-body); padding: 1px 5px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--border); }
  .btn-sm-confirmar {
      background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb;
      padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: 600;
  }
  .btn-sm-confirmar:hover { background: #2563eb; color: white; }
  .empty-state { padding: 40px; display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-sec); }
  .ver-mas { text-align: center; padding: 10px; font-size: 0.8rem; color: var(--text-sec); font-style: italic; }

  /* --- MONITOR EN VIVO --- */

:global(.live-monitor-container) {
    overflow: hidden;
    border: 1px solid var(--border) !important;
    box-shadow: var(--shadow-premium) !important; /* Esto lo hace flotar */
}

  .header-left { display: flex; flex-direction: column; gap: 2px; }

  .live-badge {
    background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px;
    font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 6px;
    border: 1px solid rgba(255,255,255,0.3); width: fit-content;
  }
  .blink-dot { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; box-shadow: 0 0 10px #ef4444; animation: blink 1s infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .monitor-dia { font-weight: 600; font-size: 0.9rem; opacity: 0.9; }

  /* CONTROLES DE AJUSTE */
  .ajuste-tiempo {
      display: flex; align-items: center; gap: 5px;
      background: rgba(0,0,0,0.2); padding: 4px; border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.1);
  }
  .btn-ajuste {
      background: rgba(255,255,255,0.2); border: none; color: white;
      width: 24px; height: 24px; border-radius: 50%; cursor: pointer;
      font-weight: bold; display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
  }
  .btn-ajuste:hover { background: rgba(255,255,255,0.4); }

  .valor-ajuste { 
      font-size: 0.85rem; font-weight: 600; min-width: 35px; text-align: center; 
      opacity: 0.7; color: white; background: none; border: none; cursor: pointer;
  }
  .valor-ajuste.activo { color: #fbbf24; opacity: 1; font-weight: 800; }

  
  .hora-big { font-size: 2.5rem; font-weight: 900; color: var(--primary); line-height: 1; display: block; margin-bottom: 10px; }
  .tema-big { font-size: 1.3rem; margin: 0 0 15px 0; color: var(--text-main); line-height: 1.3; }
  .orador-box { 
    display: inline-flex; align-items: center; gap: 10px; 
    background: var(--bg-body); padding: 8px 16px; border-radius: 50px;
    border: 1px solid var(--border); color: var(--text-main); font-weight: 600;
  }
  .descanso-mode { padding: 20px; opacity: 0.6; }

  .monitor-footer { padding: 20px; background: var(--bg-body); }
  .label-next { font-size: 0.7rem; font-weight: 800; color: var(--text-sec); margin-bottom: 10px; display: block; letter-spacing: 1px; }
  .next-row { display: flex; align-items: center; gap: 15px; }
  .next-hora { font-weight: 800; font-size: 1.1rem; color: var(--text-main); }
  .next-info { display: flex; flex-direction: column; flex: 1; }
  .next-tema { font-weight: 600; font-size: 0.9rem; color: var(--text-main); }
  .next-orador { font-size: 0.8rem; color: var(--text-sec); }
  .text-muted { font-size: 0.8rem; color: var(--text-sec); font-style: italic; }

  .accesos-grid { margin-top: 15px; }
  .btn-acceso {
      width: 100%; background: var(--bg-card); border: 1px solid var(--border);
      padding: 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center;
      justify-content: center; gap: 10px; font-weight: 600; color: var(--text-sec);
  }
  .btn-acceso:hover { border-color: var(--primary); color: var(--primary); background: var(--hover-bg); }

  /* ESTILOS NUEVOS PARA LA TARJETA CLICKABLE */
:global(.btn-card-asistencia) {
    width: 100%; 
    text-align: left; 
    cursor: pointer; 
    display: flex; 
    align-items: center; 
    gap: 12px;
    padding: 15px !important;
    border-radius: 12px !important;
    background-color: var(--bg-card) !important;
    
    /* Forzamos el borde en los 4 lados para que no desaparezca arriba en modo oscuro */
    border: 1px solid var(--border) !important;
    outline: none !important; /* Evita que el navegador ponga su propio borde de botón */
    
    box-shadow: var(--shadow-premium) !important;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}


  .numero-grande {
    font-size: 1.8rem; font-weight: 800; color: var(--text-main);
    display: block; line-height: 1.2;
  }

  /* ESTILOS DEL MODAL */
  .modal-backdrop {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); z-index: 2000;
    display: flex; justify-content: center; align-items: center;
    backdrop-filter: blur(3px);
  }
  .modal-content-asistencia {
    background: var(--bg-card); width: 600px; max-width: 95%;
    border-radius: 12px; border: 1px solid var(--border);
    box-shadow: 0 20px 50px rgba(0,0,0,0.3); overflow: hidden;
  }
  .modal-header {
    padding: 15px 20px; border-bottom: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: center;
    background: var(--bg-body);
  }
  .modal-header h3 { margin: 0; font-size: 1.1rem; color: var(--text-main); }
  .btn-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-sec); }

  .grid-dias {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; padding: 25px;
  }
  .col-dia { display: flex; flex-direction: column; gap: 15px; }
  .col-dia h4 { 
    text-align: center; color: var(--primary); margin: 0; 
    font-size: 0.9rem; text-transform: uppercase; font-weight: 700; 
    border-bottom: 2px solid var(--border); padding-bottom: 5px;
  }

  .input-group-modal label { font-size: 0.75rem; color: var(--text-sec); display: block; margin-bottom: 5px; font-weight: 600; }
  .input-group-modal input {
    width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;
    background: var(--bg-body); color: var(--text-main); font-weight: bold; text-align: center; font-size: 1.1rem;
  }
  .input-group-modal input:focus { border-color: var(--primary); outline: none; }

  .modal-footer {
    padding: 15px; background: var(--bg-body); text-align: center;
    border-top: 1px solid var(--border); font-size: 0.9rem; color: var(--text-sec);
  }

  /* Esto asegura que los paneles de esta página usen la sombra premium */
:global(.stat-card), 
:global(.live-monitor-container), 
:global(.alertas-section),
:global(.btn-card-asistencia) { /* Añadimos la asistencia aquí para unificarlas */
    box-shadow: var(--shadow-premium) !important;
    border-radius: 12px !important;
    overflow: hidden;
    /* Usamos la variable global para que se vea tanto en claro como en oscuro */
    border: 1px solid var(--border) !important; 
    background-color: var(--bg-card) !important;
}

/* Ajuste específico para el botón de asistencia para que no pierda sus curvas */
:global(.btn-card-asistencia) {
    width: 100%;
    background: transparent !important;
    border: 1px solid rgba(0, 0, 0, 0.16) !important; /* Un poco más de fuerza para que se vea nítido */
    padding: 15px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    border-radius: 12px;
}

/* En modo oscuro, el borde del botón asistencia debe ser más claro */
:global(.dark-theme) :global(.btn-card-asistencia) {
    border-color: var(--text-sec) !important; /* Usa el texto secundario que en oscuro es #cbd5e1 */
}

.live-monitor {
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow-premium);
    overflow: hidden;
}

/* Ajuste para que el header mantenga sus bordes redondeados arriba */
.monitor-header {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: white;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-acceso:hover {
    background-color: var(--bg-body);
    border-color: var(--primary);
    color: var(--primary);
}
</style>