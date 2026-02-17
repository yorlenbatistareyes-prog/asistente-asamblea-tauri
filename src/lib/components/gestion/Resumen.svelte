<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  // Iconos
  import { 
    Users, Droplets, Mic, CheckCircle, AlertCircle, 
    Clock, Activity, ArrowRight 
  } from 'lucide-svelte';

  // Importamos el Store Global (asegúrate que la ruta sea correcta)
  import { appStore, cargarDatosGlobales } from '$lib/stores/appStore';

  // --- VARIABLES DE ESTADO ---
  let horaActual = '';
  let asambleaIdActual = 0; // Iniciamos en 0 para detectar si cargó
  let nombreAsamblea = '';
  
  // Datos Manuales (Se guardan en localStorage por ID)
  let asistenciaTotal = 0;
  let bautismosTotal = 0;
  let reportesRecibidos = 0;
  let totalCongregaciones = 12;

  // Datos Automáticos (Vienen de la Base de Datos SQLite)
  let oradoresPendientesLista: any[] = [];
  let estadisticasPrograma = { confirmados: 0, pendientes: 0 };
  
  // Monitor en Vivo
  let parteActual: any = null;
  let siguienteParte: any = null;
  let programaCompletoCache: any[] = [];

  // --- INICIO ---
  onMount(async () => {
    // 1. OBTENER ID DE LA ASAMBLEA ACTIVA
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
        const data = JSON.parse(datosGuardados);
        asambleaIdActual = data.id;
        nombreAsamblea = data.nombre || data.tema || "Asamblea";
        console.log("📂 Cargando Resumen para Asamblea ID:", asambleaIdActual);
    } else {
        console.error("⚠️ No hay asamblea activa. Redirigiendo o usando ID 1 por defecto.");
        asambleaIdActual = 1; // Fallback de seguridad
    }

    // 2. Cargar identidad (Usuario y Versión)
    await cargarDatosGlobales();

    // 3. Cargar datos manuales (Asistencia/Bautismos específicos de este ID)
    cargarDatosLocales();

    // 4. Cargar datos automáticos (DB filtrada por ID)
    await cargarDatosDB();

    // 5. Iniciar reloj
    actualizarReloj();
    setInterval(actualizarReloj, 30000); // Actualizar cada 30 seg
  });

  // --- LÓGICA DE RELOJ Y MONITOR ---
  function actualizarReloj() {
    const ahora = new Date();
    horaActual = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    calcularParteEnVivo(ahora);
  }

  function calcularParteEnVivo(ahora: Date) {
    if (!programaCompletoCache || programaCompletoCache.length === 0) return;
    
    // Convertimos hora actual a minutos (0 a 1440)
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    
    // Buscar qué está pasando AHORA
    const actual = programaCompletoCache.find((p: any) => {
        if (!p.hora_inicio) return false;
        
        const [hStr, mStr] = p.hora_inicio.split(':');
        const h = parseInt(hStr);
        const m = parseInt(mStr);
        
        const inicio = h * 60 + m;
        const duracion = Number(p.duracion) || 10; 
        const fin = inicio + duracion;

        // Comprobamos si estamos dentro del intervalo
        return minutosAhora >= inicio && minutosAhora < fin;
    });

    if (actual) {
        parteActual = actual;
        // Buscar el siguiente en la lista
        const idx = programaCompletoCache.findIndex(p => p.id === actual.id);
        siguienteParte = programaCompletoCache[idx + 1] || null;
    } else {
        parteActual = null;
        // Buscar el PRÓXIMO más cercano
        siguienteParte = programaCompletoCache.find((p: any) => {
            if (!p.hora_inicio) return false;
            const [hStr, mStr] = p.hora_inicio.split(':');
            const inicio = parseInt(hStr) * 60 + parseInt(mStr);
            return inicio > minutosAhora;
        });
    }
  }

  // --- LÓGICA DE BASE DE DATOS (FILTRADA POR ID) ---
  async function cargarDatosDB() {
    if (!asambleaIdActual) return;

    const dias = ['Viernes', 'Sábado', 'Domingo'];
    let pendientes = [];
    let confirmadosCount = 0;
    programaCompletoCache = [];

    for (const dia of dias) {
        try {
            // ¡AQUÍ ES DONDE FILTRAMOS POR ID!
            const partes: any[] = await invoke('obtener_programa_dia', { 
                asambleaId: asambleaIdActual, 
                dia: dia 
            }); 
            
            partes.forEach(p => {
                programaCompletoCache.push({ ...p, dia }); // Guardamos para el monitor
                
                // Estadísticas: Solo discursos humanos
                if (!p.es_video && p.nombre_orador) {
                    if (p.estado === 'Confirmado' || p.recibido_manual) {
                        confirmadosCount++;
                    } else {
                        pendientes.push({ ...p, dia });
                    }
                }
            });
        } catch (e) { 
            console.error(`Error cargando ${dia} para asamblea ${asambleaIdActual}:`, e); 
        }
    }
    
    // Ordenar programa cronológicamente para el monitor
    programaCompletoCache.sort((a, b) => {
       return a.hora_inicio.localeCompare(b.hora_inicio);
    });

    estadisticasPrograma.confirmados = confirmadosCount;
    estadisticasPrograma.pendientes = pendientes.length;
    oradoresPendientesLista = pendientes;
    
    actualizarReloj(); // Refrescar monitor con los datos cargados
  }

  async function confirmarOradorDesdeResumen(parte: any) {
      if(!confirm(`¿Confirmar a ${parte.nombre_orador}?`)) return;
      try {
          await invoke('alternar_estado_parte', { 
              id: parte.id, 
              tipoAccion: 'confirmacion', 
              valorNuevo: true 
          });
          // Recargamos datos para actualizar la lista
          await cargarDatosDB();
      } catch(e) { alert("Error: " + e); }
  }

  // --- LÓGICA MANUAL (LOCALSTORAGE POR ID) ---
  function cargarDatosLocales() {
    if (!asambleaIdActual) return;
    // Usamos el ID como sufijo en la clave para no mezclar asambleas
    asistenciaTotal = Number(localStorage.getItem(`dash_asistencia_${asambleaIdActual}`)) || 0;
    bautismosTotal = Number(localStorage.getItem(`dash_bautismos_${asambleaIdActual}`)) || 0;
    reportesRecibidos = Number(localStorage.getItem(`dash_reportes_${asambleaIdActual}`)) || 0;
  }

  function guardarDato(tipo: string, valor: number) {
    if (!asambleaIdActual) return;
    // Guardamos: 'dash_asistencia_2', 'dash_asistencia_3', etc.
    localStorage.setItem(`dash_${tipo}_${asambleaIdActual}`, valor.toString());
  }

  // Cálculo reactivo
  $: porcentajeReportes = totalCongregaciones > 0 ? (reportesRecibidos / totalCongregaciones) * 100 : 0;

</script>

<div class="dashboard-container">
  
  <div class="header-torre">
    <div>
        <h2>Hola, {$appStore.usuario} 👋</h2>
        <span class="subtitulo-header">
            Panel de Control • {nombreAsamblea} • v{$appStore.version}
        </span>
    </div>
    <div class="reloj-badge">
        <Clock size={18}/> {horaActual}
    </div>
  </div>

  <div class="main-grid">
      
    <div class="col-left">
        
        <div class="stats-row">
            <div class="card stat-card">
                <div class="icon-wrapper blue"><Users size={22} /></div>
                <div class="stat-info">
                    <span class="label">Asistencia</span>
                    <input type="number" class="editable-num" 
                           bind:value={asistenciaTotal} 
                           on:input={() => guardarDato('asistencia', asistenciaTotal)}>
                    <span class="subtext">Editable</span>
                </div>
            </div>

            <div class="card stat-card">
                <div class="icon-wrapper cyan"><Droplets size={22} /></div>
                <div class="stat-info">
                    <span class="label">Bautismos</span>
                    <input type="number" class="editable-num" 
                           bind:value={bautismosTotal} 
                           on:input={() => guardarDato('bautismos', bautismosTotal)}>
                </div>
            </div>
            
            <div class="card stat-card">
                <div class="icon-wrapper green"><CheckCircle size={22} /></div>
                <div class="stat-info">
                    <span class="label">Reportes ({Math.round(porcentajeReportes)}%)</span>
                    <div class="input-group">
                        <input type="number" class="editable-num small" 
                               bind:value={reportesRecibidos} 
                               on:input={() => guardarDato('reportes', reportesRecibidos)}>
                        <span class="sep">/</span>
                        <span class="static-val">{totalCongregaciones}</span>
                    </div>
                    <div class="progress-bar-mini">
                        <div class="fill" style="width: {porcentajeReportes}%"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card alertas-section">
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
        </div>
    </div>

    <div class="col-right">
        
        <div class="card live-monitor">
            <div class="monitor-header">
                <div class="live-badge">
                    <span class="blink-dot"></span> EN CURSO
                </div>
                {#if parteActual}
                    <span class="monitor-dia">{parteActual.dia}</span>
                {/if}
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
                        <Activity size={40} color="var(--text-secondary)"/>
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
                        <ArrowRight size={16} color="var(--text-secondary)"/>
                    </div>
                {:else}
                    <span class="text-muted">Fin del programa.</span>
                {/if}
            </div>
        </div>

        <div class="accesos-grid">
            <button class="btn-acceso" on:click={cargarDatosDB}>
                <Activity size={20}/> <span>Actualizar Datos</span>
            </button>
        </div>

    </div>
  </div>
</div>

<style>
  /* --- ESTILOS --- */
  .dashboard-container {
    display: flex; flex-direction: column; gap: 20px; height: 100%; overflow-y: auto;
    padding-bottom: 20px;
  }
  
  .header-torre {
    display: flex; justify-content: space-between; align-items: flex-end;
    padding-bottom: 10px; border-bottom: 1px solid var(--border-color);
  }
  h2 { margin: 0; font-size: 1.5rem; color: var(--text-main); }
  .subtitulo-header { font-size: 0.9rem; color: var(--text-secondary); }
  .reloj-badge {
    font-size: 1.5rem; font-weight: 800; color: var(--primary);
    display: flex; align-items: center; gap: 10px;
    background: var(--bg-card); padding: 5px 15px; border-radius: 12px;
    border: 1px solid var(--border-color);
  }

  .main-grid {
    display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px;
  }
  @media (max-width: 950px) { .main-grid { grid-template-columns: 1fr; } }

  .col-left, .col-right { display: flex; flex-direction: column; gap: 20px; }

  /* --- TARJETAS STATS --- */
  .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .stat-card {
    background: var(--bg-card); border: 1px solid var(--border-color);
    border-radius: 12px; padding: 15px; display: flex; align-items: center; gap: 12px;
  }
  .icon-wrapper {
    min-width: 40px; height: 40px; border-radius: 10px; display: flex; 
    align-items: center; justify-content: center; color: white;
  }
  .icon-wrapper.blue { background: #3b82f6; }
  .icon-wrapper.cyan { background: #06b6d4; }
  .icon-wrapper.green { background: #10b981; }

  .stat-info { display: flex; flex-direction: column; width: 100%; overflow: hidden; }
  .label { font-size: 0.7rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; margin-bottom: 2px;}
  .subtext { font-size: 0.65rem; color: var(--text-secondary); }

  .editable-num {
    border: none; background: transparent; font-size: 1.4rem; font-weight: 800;
    color: var(--text-main); width: 100%; outline: none; padding: 0;
  }
  .editable-num:focus { border-bottom: 2px solid var(--primary); }
  
  .input-group { display: flex; align-items: baseline; gap: 2px; }
  .editable-num.small { font-size: 1.2rem; width: 35px; }
  .sep, .static-val { font-size: 0.9rem; color: var(--text-secondary); }
  
  .progress-bar-mini { height: 4px; background: var(--bg-body); border-radius: 2px; margin-top: 5px; overflow: hidden; }
  .progress-bar-mini .fill { height: 100%; background: #10b981; }

  /* --- ZONA DE PENDIENTES --- */
  .alertas-section {
    background: var(--bg-card); border: 1px solid var(--border-color);
    border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; flex: 1;
  }
  .card-header-red {
    background: #fef2f2; border-bottom: 1px solid #fecaca; padding: 12px 20px;
    color: #b91c1c; 
  }
  .card-header-red h4 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 0.95rem; }
  
  .table-container { width: 100%; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { text-align: left; padding: 8px 15px; background: var(--bg-body); color: var(--text-secondary); font-size: 0.7rem; text-transform: uppercase; }
  td { padding: 8px 15px; border-bottom: 1px solid var(--border-color); color: var(--text-main); vertical-align: middle; }
  .fw-bold { font-weight: 600; font-size: 0.9rem; }
  .tema-mini { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 2px; }
  .badge-dia { background: var(--bg-body); padding: 1px 5px; border-radius: 4px; font-size: 0.7rem; border: 1px solid var(--border-color); }
  .btn-sm-confirmar {
      background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb;
      padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: 600;
  }
  .btn-sm-confirmar:hover { background: #2563eb; color: white; }
  .empty-state { padding: 40px; display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-secondary); }
  .ver-mas { text-align: center; padding: 10px; font-size: 0.8rem; color: var(--text-secondary); font-style: italic; }

  /* --- MONITOR EN VIVO --- */
  .live-monitor {
    background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-color);
    overflow: hidden; display: flex; flex-direction: column;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
  }
  .monitor-header {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    padding: 15px 25px; display: flex; justify-content: space-between; align-items: center;
    color: white;
  }
  .live-badge {
    background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px;
    font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 6px;
    border: 1px solid rgba(255,255,255,0.3);
  }
  .blink-dot { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; box-shadow: 0 0 10px #ef4444; animation: blink 1s infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .monitor-dia { font-weight: 600; font-size: 0.9rem; opacity: 0.9; }

  .monitor-body { padding: 30px; text-align: center; border-bottom: 1px dashed var(--border-color); }
  .hora-big { font-size: 2.5rem; font-weight: 900; color: var(--primary); line-height: 1; display: block; margin-bottom: 10px; }
  .tema-big { font-size: 1.3rem; margin: 0 0 15px 0; color: var(--text-main); line-height: 1.3; }
  .orador-box { 
    display: inline-flex; align-items: center; gap: 10px; 
    background: var(--bg-body); padding: 8px 16px; border-radius: 50px;
    border: 1px solid var(--border-color); color: var(--text-main); font-weight: 600;
  }
  .descanso-mode { padding: 20px; opacity: 0.6; }

  .monitor-footer { padding: 20px; background: var(--bg-body); }
  .label-next { font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); margin-bottom: 10px; display: block; letter-spacing: 1px; }
  .next-row { display: flex; align-items: center; gap: 15px; }
  .next-hora { font-weight: 800; font-size: 1.1rem; color: var(--text-main); }
  .next-info { display: flex; flex-direction: column; flex: 1; }
  .next-tema { font-weight: 600; font-size: 0.9rem; color: var(--text-main); }
  .next-orador { font-size: 0.8rem; color: var(--text-secondary); }
  .text-muted { font-size: 0.8rem; color: var(--text-secondary); font-style: italic; }

  .accesos-grid { margin-top: 15px; }
  .btn-acceso {
      width: 100%; background: var(--bg-card); border: 1px solid var(--border-color);
      padding: 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center;
      justify-content: center; gap: 10px; font-weight: 600; color: var(--text-secondary);
  }
  .btn-acceso:hover { border-color: var(--primary); color: var(--primary); background: var(--hover-bg); }
</style>