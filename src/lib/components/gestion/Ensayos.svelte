<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Clock, MapPin, Mic, CheckSquare, CheckCircle, CalendarDays, Video, Download, Globe, UserCheck } from 'lucide-svelte';

  let asambleaId = 0;
  let asambleaTema = '';
  let asambleaIdentificador = '';
  
  let ensayosProgramados: any[] = [];
  let cargando = true;

  onMount(async () => {
      // 1. Extraemos los datos completos de la asamblea para el subtítulo
      const datosGuardados = localStorage.getItem('asambleaActiva');
      if (datosGuardados) {
          const asamblea = JSON.parse(datosGuardados);
          asambleaId = asamblea.id;
          asambleaTema = asamblea.tema || 'Sin tema';
          asambleaIdentificador = asamblea.identificador || '0000';
          await cargarEnsayos();
      }
      cargando = false;
  });

  async function cargarEnsayos() {
      if (!asambleaId) return;
      
      const dias = ['Viernes', 'Sábado', 'Domingo'];
      let ensayosTemp: any[] = [];

      for (const dia of dias) {
          try {
              const partes: any[] = await invoke('obtener_programa_dia', { asambleaId, dia });
              if (Array.isArray(partes)) {
                  partes.forEach(p => {
                      if (p.requiere_ensayo) {
                          ensayosTemp.push({ 
                              ...p, 
                              dia,
                              ensayo_terminado: p.ensayo_terminado === true || p.ensayo_terminado === 1 
                          });
                      }
                  });
              }
          } catch (e) {
              console.error(`Error cargando el día ${dia}:`, e);
          }
      }

      ensayosTemp.sort((a, b) => {
          const fechaA = a.fecha_ensayo || '9999-99-99';
          const fechaB = b.fecha_ensayo || '9999-99-99';
          if (fechaA !== fechaB) return fechaA.localeCompare(fechaB);
          return (a.hora_ensayo || '23:59').localeCompare(b.hora_ensayo || '23:59');
      });

      ensayosProgramados = ensayosTemp;
  }

  async function toggleEnsayoTerminado(ensayo: any) {
      const nuevoEstado = !ensayo.ensayo_terminado;
      
      // Cambio visual instantáneo
      ensayo.ensayo_terminado = nuevoEstado;
      ensayosProgramados = [...ensayosProgramados]; 

      try {
          await invoke('alternar_estado_parte', {
              id: ensayo.id,
              tipoAccion: 'ensayo_terminado',
              valorNuevo: nuevoEstado
          });
      } catch (error) {
          console.error("Error al actualizar ensayo:", error);
          alert("Ocurrió un error al guardar el estado del ensayo.");
          ensayo.ensayo_terminado = !nuevoEstado;
          ensayosProgramados = [...ensayosProgramados];
      }
  }
</script>

<div class="pagina-ensayos">
  
  <div class="encabezado-superior">
      <h1 class="titulo-principal">Horario de Ensayos</h1>
      <h3 class="subtitulo-asamblea">
          {asambleaTema} <span class="badge-identificador">{asambleaIdentificador}</span>
      </h3>
  </div>

  <div class="seccion-principal">
      
      <div class="header-lista">
          <h2>Partes que requieren ensayo</h2>
          <span class="badge-contador">{ensayosProgramados.length}</span>
      </div>

      {#if cargando}
          <div class="empty-state"><p>Cargando ensayos...</p></div>
      {:else if ensayosProgramados.length > 0}
         <div class="lista-tarjetas-anchas">
              {#each ensayosProgramados as e}
                  <div class="tarjeta-ancha" class:terminado={e.ensayo_terminado}>
                      
                      {#if e.ensayo_terminado}
                          <div class="etiqueta-top-right">
                              Ensayo completado
                          </div>
                      {/if}

                      <div class="zona-info">
                          <h3 class="tema-discurso">
                              {#if e.numero_bosquejo && e.numero_bosquejo.trim() !== ''}
                                  <span class="bosquejo-parentesis">({e.numero_bosquejo})</span>
                              {/if}
                              {e.tema}
                          </h3>
                          <div class="orador-discurso">
                              <Mic size={16}/> {e.nombre_orador || 'Sin orador asignado'}
                          </div>
                          <div class="origen-discurso">Programa: {e.dia} a las {e.hora_inicio}</div>
                          
                          <div class="badges-row">
                              {#if e.es_video || e.fuente === 'video' || e.fuente === 'Video'}
                                  <span class="badge-fuente video"><Video size={10}/> Video</span>
                              {:else if e.fuente === 'jw_stream' || e.fuente === 'Descarga de JW Stream'}
                                  <span class="badge-fuente stream"><Download size={10}/> JW Stream</span>
                              {:else if e.fuente === 'transmision_remota' || e.fuente === 'Transmisión remota en directo'}
                                  <span class="badge-fuente remota"><Globe size={10}/> Remota</span>
                              {:else}
                                  <span class="badge-fuente en-persona"><UserCheck size={10}/> En persona</span>
                              {/if}
                          </div>

                          <label class="check-completado" class:marcado={e.ensayo_terminado}>
                              <input type="checkbox" class="check-input" 
                                     checked={e.ensayo_terminado} 
                                     on:change={() => toggleEnsayoTerminado(e)}>
                              <span class="check-texto">Ensayo completado</span>
                          </label>
                      </div>

                      <div class="zona-fechas">
                          <div class="bloque-dato">
                              <span class="lbl-dato">Fecha de ensayo</span>
                              <span class="val-dato"><CalendarDays size={15}/> {e.fecha_ensayo || 'Sin fecha'}</span>
                          </div>
                          <div class="bloque-dato">
                              <span class="lbl-dato">Hora</span>
                              <span class="val-dato"><Clock size={15}/> {e.hora_ensayo || '--:--'}</span>
                          </div>
                      </div>

                      <div class="zona-lugar">
                          <div class="lugar-texto"><MapPin size={16} style="flex-shrink:0;"/> {e.lugar_ensayo || 'Lugar no especificado'}</div>
                          {#if e.notas_ensayo}
                              <div class="notas-texto">"{e.notas_ensayo}"</div>
                          {/if}
                      </div>

                  </div>
              {/each}
          </div>
          
      {:else}
          <div class="empty-state">
              <CheckSquare size={48} color="var(--primary)" opacity="0.4"/>
              <h3>No hay ensayos</h3>
              <p>No se ha marcado ninguna parte del programa como "Requiere Ensayo".</p>
          </div>
      {/if}

  </div>
</div>

<style>
  /* --- CONTENEDOR GENERAL --- */
  .pagina-ensayos {
      padding: 30px 40px;
      height: 100%;
      overflow-y: auto;
      background: var(--bg-body);
  }

  .encabezado-superior { margin-bottom: 30px; }
  .titulo-principal { margin: 0 0 5px 0; font-size: 2rem; font-weight: 800; color: var(--text-main); }
  
  .subtitulo-asamblea {
      margin: 0; font-size: 1.1rem; font-weight: 500; color: var(--text-secondary);
      display: flex; align-items: center; gap: 12px;
  }
  .badge-identificador { background: var(--primary); color: white; padding: 2px 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; }

  /* --- SECCIÓN DE LA LISTA --- */
  .header-lista {
      display: flex; align-items: center; gap: 12px; margin-bottom: 15px; border-bottom: 2px solid var(--border); padding-bottom: 10px;
  }
  .header-lista h2 { margin: 0; font-size: 1.2rem; color: var(--text-main); }
  .badge-contador { background: #f97316; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: bold; }

  .lista-tarjetas-anchas {
      display: flex; flex-direction: column; gap: 12px;
      /* Eliminado el max-width para que abarque toda la pantalla */
  }

  /* --- TARJETAS COMPACTAS --- */
  .tarjeta-ancha {
      position: relative; 
      display: flex;
      align-items: center;
      background: var(--bg-card); 
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 20px; /* Padding reducido para mantenerlas delgadas */
      gap: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
      transition: all 0.3s ease;
  }

  .tarjeta-ancha:hover {
      box-shadow: var(--shadow-premium);
      transform: translateY(-1px);
  }

  .tarjeta-ancha.terminado {
      background-color: #fff7ed; 
      border-color: #fdba74;     
  }

  /* 👇 LA ETIQUETA EN LA ESQUINA */
  .etiqueta-top-right {
      position: absolute;
      top: 12px;
      right: 15px;
      background: #ffedd5; 
      color: #ea580c;      
      font-size: 0.7rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 4px;
      text-transform: uppercase;
      animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
  }

  /* --- ZONAS DE LA TARJETA --- */
  .zona-info {
      flex: 2; 
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px; 
      padding-right: 20px; /* Un margen sutil solo para que no roce la etiqueta en pantallas medias */
  }

  .tema-discurso {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1.2;
      /* Eliminado el padding-right gigante que causaba que la tarjeta se hiciera alta */
  }

  .orador-discurso { font-size: 0.9rem; font-weight: 600; color: var(--primary); display: flex; align-items: center; gap: 6px; }
  .terminado .orador-discurso { color: #ea580c; }

  .fila-etiquetas { display: flex; align-items: center; gap: 8px; margin-top: 2px; flex-wrap: wrap; }
  .origen-discurso { font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-body); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border); }
  .terminado .origen-discurso { background: rgba(255,255,255,0.6); border-color: #fdba74; }

  /* ESTILOS DE BOSQUEJO Y BADGES */
  .bosquejo-parentesis { color: var(--text-secondary); font-weight: 800; font-size: 0.9em; margin-right: 4px; }
  .badges-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
  .badge-fuente { font-size: 9px; padding: 2px 6px; border-radius: 999px; display: inline-flex; align-items: center; gap: 3px; font-weight: 700; text-transform: uppercase; border: 1px solid transparent; }
  .badge-fuente.video { background: rgba(100, 116, 139, 0.15); color: var(--text-secondary); border-color: var(--border); }
  .badge-fuente.stream { background: rgba(37, 99, 235, 0.15); color: #3b82f6; border-color: rgba(37, 99, 235, 0.3); }
  .badge-fuente.remota { background: rgba(147, 51, 234, 0.15); color: #9333ea; border-color: rgba(147, 51, 234, 0.3); }
  .badge-fuente.en-persona { background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.3); }
  .terminado .badge-fuente.en-persona { background: rgba(255, 255, 255, 0.6); border-color: #fdba74; color: #15803d; }

  /* CHECKBOX */
  .check-completado { display: flex; align-items: center; gap: 6px; cursor: pointer; margin-top: 4px; }
  .check-input { width: 14px !important; height: 14px !important; cursor: pointer; accent-color: #ea580c; appearance: auto !important; -webkit-appearance: checkbox !important; display: inline-block !important; margin: 0; }
  .check-texto { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); transition: color 0.2s; }
  .check-completado.marcado .check-texto { color: #ea580c; }

  /* --- FECHAS Y LUGARES (Más compactos) --- */
  .zona-fechas {
      flex: 1; display: flex; flex-direction: column; gap: 6px; border-left: 1px solid var(--border); padding-left: 20px;
  }
  .terminado .zona-fechas { border-left-color: #fdba74; }

  .bloque-dato { display: flex; flex-direction: column; gap: 0px; }
  .lbl-dato { font-size: 0.65rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; }
  .val-dato { display: flex; align-items: center; gap: 4px; font-size: 0.9rem; font-weight: 700; color: #ea580c; }
  .terminado .val-dato { color: #c2410c; }

  .zona-lugar {
      flex: 1.5; display: flex; flex-direction: column; gap: 4px; border-left: 1px solid var(--border); padding-left: 20px;
  }
  .terminado .zona-lugar { border-left-color: #fdba74; }

  .lugar-texto { font-size: 0.85rem; font-weight: 600; color: var(--text-main); display: flex; align-items: flex-start; gap: 6px; }
  .terminado .lugar-texto { color: #9a3412; }

  .notas-texto { font-size: 0.8rem; color: var(--text-secondary); font-style: italic; background: var(--bg-body); padding: 6px 10px; border-radius: 6px; line-height: 1.3; margin-top: 2px;}
  .terminado .notas-texto { background: rgba(255,255,255,0.6); color: #c2410c; }

  .empty-state { padding: 60px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-secondary); }
  .empty-state h3 { margin: 0; color: var(--text-main); font-size: 1.2rem; }
  .empty-state p { margin: 0; font-size: 0.95rem; }

  /* RESPONSIVO */
  @media (max-width: 900px) {
      .tarjeta-ancha {
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
          padding: 15px;
          padding-top: 35px; /* En móviles sí necesitamos este margen para que la etiqueta no tape el texto porque todo se apila */
      }

      .zona-info { padding-right: 0; }

      .zona-fechas, .zona-lugar {
          border-left: none;
          padding-left: 0;
          border-top: 1px solid var(--border);
          padding-top: 10px; 
      }

      .terminado .zona-fechas, .terminado .zona-lugar {
          border-top-color: #fdba74;
      }
      
      .pagina-ensayos {
          padding: 15px;
      }
  }
</style>