<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import Panel from '$lib/components/ui/Panel.svelte';
  import { Clock, MapPin, Mic, CheckSquare } from 'lucide-svelte';

  let asambleaId = 0;
  let ensayosProgramados: any[] = [];
  let cargando = true;

  onMount(async () => {
      const datosGuardados = localStorage.getItem('asambleaActiva');
      if (datosGuardados) {
          asambleaId = JSON.parse(datosGuardados).id;
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
                          ensayosTemp.push({ ...p, dia });
                      }
                  });
              }
          } catch (e) {
              console.error(`Error cargando el día ${dia}:`, e);
          }
      }

      // Ordenar por fecha de ensayo y luego por hora de ensayo
      ensayosTemp.sort((a, b) => {
          const fechaA = a.fecha_ensayo || '9999-99-99';
          const fechaB = b.fecha_ensayo || '9999-99-99';
          if (fechaA !== fechaB) return fechaA.localeCompare(fechaB);
          return (a.hora_ensayo || '23:59').localeCompare(b.hora_ensayo || '23:59');
      });

      ensayosProgramados = ensayosTemp;
  }
</script>

<div class="contenedor-ensayos">
  <Panel padding="0" clasesExtra="ensayos-panel">
      <div class="header-ensayos">
          <h2><Mic size={22} /> Ensayos Programados</h2>
          <span class="badge-contador">{ensayosProgramados.length}</span>
      </div>

      <div class="lista-ensayos">
          {#if cargando}
              <div class="empty-state"><p>Cargando ensayos...</p></div>
          {:else if ensayosProgramados.length > 0}
              <div class="table-container">
                  <table>
                      <thead>
                          <tr>
                              <th>Fecha / Hora Ensayo</th>
                              <th>Asignación / Orador</th>
                              <th>Lugar de Ensayo / Notas</th>
                          </tr>
                      </thead>
                      <tbody>
                          {#each ensayosProgramados as e}
                              <tr>
                                  <td class="col-fecha">
                                      <div class="fecha-txt">{e.fecha_ensayo || 'Sin fecha asignada'}</div>
                                      <div class="hora-txt"><Clock size={12} /> {e.hora_ensayo || 'Sin hora asignada'}</div>
                                  </td>
                                  <td>
                                      <div class="tema-txt">{e.tema}</div>
                                      <div class="orador-txt">{e.nombre_orador || 'Sin orador asignado'}</div>
                                      <span class="badge-dia">Discurso en Programa: {e.dia} {e.hora_inicio}</span>
                                  </td>
                                  <td class="col-notas">
                                      <div class="lugar-txt"><MapPin size={12} /> {e.lugar_ensayo || 'Lugar no especificado'}</div>
                                      {#if e.notas_ensayo}
                                          <div class="notas-txt">"{e.notas_ensayo}"</div>
                                      {/if}
                                  </td>
                              </tr>
                          {/each}
                      </tbody>
                  </table>
              </div>
          {:else}
              <div class="empty-state">
                  <CheckSquare size={48} color="var(--primary)" opacity="0.4"/>
                  <h3>No hay ensayos</h3>
                  <p>No se ha marcado ninguna parte del programa como "Requiere Ensayo".</p>
              </div>
          {/if}
      </div>
  </Panel>
</div>

<style>
  .contenedor-ensayos {
      padding: 20px;
      height: 100%;
      overflow-y: auto;
  }

  .header-ensayos {
      background: var(--bg-card);
      padding: 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
  }

  .header-ensayos h2 {
      margin: 0;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.2rem;
  }

  .badge-contador {
      background: #f97316;
      color: white;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: bold;
  }

  .table-container {
      width: 100%;
      overflow-x: auto;
  }

  table {
      width: 100%;
      border-collapse: collapse;
  }

  th {
      background: var(--bg-secondary);
      padding: 12px 20px;
      text-align: left;
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      font-weight: 700;
      border-bottom: 2px solid var(--border);
  }

  td {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      color: var(--text-main);
  }

  tr:hover {
      background: var(--hover-bg);
  }

  .col-fecha { white-space: nowrap; width: 200px; }
  .fecha-txt { font-weight: 800; color: #ea580c; font-size: 0.95rem; margin-bottom: 4px; }
  .hora-txt { font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; display: flex; align-items: center; gap: 4px; }

  .tema-txt { font-weight: 700; font-size: 0.95rem; color: var(--text-main); margin-bottom: 4px; }
  .orador-txt { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px; }
  .badge-dia { background: var(--bg-body); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border); font-weight: 600; color: var(--text-secondary); }

  .lugar-txt { font-weight: 600; font-size: 0.85rem; color: var(--text-main); display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
  .notas-txt { font-size: 0.85rem; color: var(--text-secondary); font-style: italic; background: var(--bg-body); padding: 8px; border-radius: 6px; border-left: 3px solid var(--border); }

  .empty-state {
      padding: 60px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      color: var(--text-secondary);
  }
  .empty-state h3 { margin: 0; color: var(--text-main); }
  .empty-state p { margin: 0; font-size: 0.9rem; }
</style>