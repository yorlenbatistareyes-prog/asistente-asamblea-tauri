<script lang="ts">
  import { Users, Droplets, Mic, CheckCircle, AlertCircle } from 'lucide-svelte';

  // --- DATOS DE EJEMPLO (Aquí es donde conectarás tus datos reales más adelante) ---
  
  // Totales calculados
  let totalAsistencia = 1250; // Suma de asistencias
  let totalBautismos = 12;    // Suma de bautizados
  let congregacionesReportadas = 8; // De un total de 12, por ejemplo
  let totalCongregaciones = 12;
  
  // Lista de oradores pendientes (Simulación)
  let oradoresPendientes = [
    { nombre: 'Hno. Pérez', tema: 'Discurso 1', estado: 'Pendiente' },
    { nombre: 'Hno. González', tema: 'Simposio A', estado: 'Pendiente' }
  ];

  // Cálculo de porcentaje para barras de progreso (Opcional, visualmente atractivo)
  $: porcentajeReportes = (congregacionesReportadas / totalCongregaciones) * 100;
</script>

<div class="dashboard-container">
  
  <div class="stats-grid">
    
    <div class="card stat-card">
      <div class="icon-wrapper blue">
        <Users size={24} />
      </div>
      <div class="stat-info">
        <span class="label">Asistencia Total</span>
        <span class="value">{totalAsistencia}</span>
        <span class="subtext">Promedio por sesión</span>
      </div>
    </div>

    <div class="card stat-card">
      <div class="icon-wrapper cyan">
        <Droplets size={24} />
      </div>
      <div class="stat-info">
        <span class="label">Bautismos</span>
        <span class="value">{totalBautismos}</span>
        <span class="subtext">Candidatos aprobados</span>
      </div>
    </div>

    <div class="card stat-card">
      <div class="icon-wrapper green">
        <CheckCircle size={24} />
      </div>
      <div class="stat-info">
        <span class="label">Reportes Recibidos</span>
        <span class="value">{congregacionesReportadas} / {totalCongregaciones}</span>
        <div class="progress-bar">
          <div class="fill" style="width: {porcentajeReportes}%"></div>
        </div>
      </div>
    </div>

    <div class="card stat-card warning">
      <div class="icon-wrapper orange">
        <Mic size={24} />
      </div>
      <div class="stat-info">
        <span class="label">Oradores Pendientes</span>
        <span class="value">{oradoresPendientes.length}</span>
        <span class="subtext text-warning">Requieren confirmación</span>
      </div>
    </div>
  </div>

  <div class="details-grid">
    
    <div class="card list-card">
      <div class="card-header">
        <h4><AlertCircle size={18} /> Oradores por Confirmar</h4>
      </div>
      <div class="card-body">
        {#if oradoresPendientes.length > 0}
          <table class="simple-table">
            <thead>
              <tr>
                <th>Orador</th>
                <th>Asignación</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {#each oradoresPendientes as orador}
                <tr>
                  <td>{orador.nombre}</td>
                  <td>{orador.tema}</td>
                  <td><button class="btn-sm">Confirmar</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="empty-msg">Todo está confirmado.</p>
        {/if}
      </div>
    </div>

    <div class="card list-card">
      <div class="card-header">
        <h4>Notas Rápidas / Recordatorios</h4>
      </div>
      <div class="card-body">
        <ul class="task-list">
          <li>Revisar audio en sección C</li>
          <li>Imprimir tarjetas de solapa faltantes</li>
        </ul>
      </div>
    </div>

  </div>
</div>

<style>
  /* APLICANDO VARIABLES GLOBALES DE TEMA */
  .dashboard-container { display: flex; flex-direction: column; gap: 20px; }
  
  /* Grilla de Tarjetas Superiores */
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }

  /* Estilos Generales de Tarjeta */
  .card { 
      background: var(--bg-card); 
      border-radius: 12px; padding: 20px; 
      box-shadow: 0 2px 5px var(--shadow-color); 
      border: 1px solid var(--border-color); 
  }
  
  /* Estilo Específico Tarjetas Stats */
  .stat-card { display: flex; align-items: center; gap: 15px; }
  .icon-wrapper { width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; }
  .icon-wrapper.blue { background-color: #3b82f6; }
  .icon-wrapper.cyan { background-color: #06b6d4; }
  .icon-wrapper.green { background-color: #10b981; }
  .icon-wrapper.orange { background-color: #f59e0b; }
  
  .stat-info { display: flex; flex-direction: column; flex: 1; }
  .stat-info .label { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
  .stat-info .value { font-size: 1.5rem; font-weight: 700; color: var(--text-main); line-height: 1.2; }
  .stat-info .subtext { font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px; }
  .stat-info .text-warning { color: #d97706; font-weight: 600; }

  /* Barra de progreso simple */
  .progress-bar { height: 6px; background: var(--bg-body); border-radius: 3px; margin-top: 8px; overflow: hidden; border: 1px solid var(--border-color); }
  .progress-bar .fill { height: 100%; background: #10b981; }

  /* Grilla de Detalles Inferiores */
  .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
  
  .list-card { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
  .card-header { padding: 15px 20px; border-bottom: 1px solid var(--border-color); background-color: var(--bg-body); }
  .card-header h4 { margin: 0; font-size: 1rem; color: var(--text-main); display: flex; align-items: center; gap: 8px; }
  
  .card-body { padding: 0; }
  
  /* Tabla Simple */
  .simple-table { width: 100%; border-collapse: collapse; }
  .simple-table th { text-align: left; padding: 12px 20px; font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-body); font-weight: 600; }
  .simple-table td { padding: 12px 20px; border-top: 1px solid var(--border-color); font-size: 0.9rem; color: var(--text-main); }
  .btn-sm { padding: 4px 8px; font-size: 0.75rem; border: 1px solid var(--border-color); background: var(--bg-card); border-radius: 4px; cursor: pointer; color: var(--text-main); }
  .btn-sm:hover { background: var(--hover-bg); }

  /* Lista de tareas */
  .task-list { list-style: none; padding: 20px; margin: 0; }
  .task-list li { margin-bottom: 10px; padding-left: 20px; position: relative; color: var(--text-main); }
  .task-list li::before { content: "•"; color: var(--primary); font-weight: bold; position: absolute; left: 0; }
  
  .empty-msg { padding: 20px; text-align: center; color: var(--text-secondary); font-style: italic; }
</style>