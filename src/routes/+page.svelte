<script lang="ts">
  import { 
    Plus, MapPin, Calendar, Briefcase, 
    Mail, Mic, UserCheck, MessageSquare, ChevronRight, Settings
  } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import Correspondencia from '$lib/components/gestion/Correspondencia.svelte';

  let vistaActual = 'inicio'; 
  let asambleaCreada = true; 

  let asamblea = {
    tema: "¡Prediquemos las buenas noticias!",
    fecha: "25-27 de Julio, 2025",
    lugar: "Salón de Asambleas Regional",
  };

  const irACorrespondencia = () => vistaActual = 'correspondencia';
  const volverAlInicio = () => vistaActual = 'inicio';

  // --- NUEVA FUNCIÓN AGREGADA ---
  function crearNuevaAsamblea() {
    // Aquí iría la lógica para limpiar la base de datos o archivar la anterior
    const confirmar = confirm("¿Estás seguro de que deseas crear una nueva asamblea? La actual se archivará.");
    if (confirmar) {
        // Por ahora solo un aviso, luego conectaremos con Rust
        alert("Iniciando asistente de nueva asamblea...");
    }
  }
</script>

<div class="main-container">
  {#if vistaActual === 'inicio'}
    <header class="top-bar">
      <h1>Asistente de Asamblea</h1>
      
      <div class="header-actions">
        <button class="btn-nueva" on:click={crearNuevaAsamblea}>
            <Plus size={18} />
            <span>Nueva Asamblea</span>
        </button>
        <button class="btn-config"><Settings size={20} /></button>
      </div>
    </header>

    <div class="dashboard">
      <section class="asamblea-activa">
        <div class="section-header">
          <Briefcase size={18} /> <span>ASAMBLEA EN CURSO</span>
        </div>
        
        <div 
          class="card-hero" 
          on:click={() => goto('/gestion')} 
          on:keydown={(e) => e.key === 'Enter' && goto('/gestion')}
          role="button" 
          tabindex="0"
        >
          <div class="hero-content">
            <span class="status-pill">En Organización</span>
            <h2>{asamblea.tema}</h2>
            <div class="hero-details">
              <span><Calendar size={14} /> {asamblea.fecha}</span>
              <span><MapPin size={14} /> {asamblea.lugar}</span>
            </div>
          </div>
          <button class="btn-manage">Gestionar Datos &rarr;</button>
        </div>
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
  {:else if vistaActual === 'correspondencia'}
    <Correspondencia on:close={volverAlInicio} />
  {/if}
</div>

<style>
  :global(body) { margin: 0; font-family: 'Inter', 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
  .main-container { padding: 40px; max-width: 1200px; margin: 0 auto; }
  
  /* HEADER MEJORADO */
  .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
  .top-bar h1 { font-size: 24px; font-weight: 800; margin: 0; color: #0f172a; }
  
  .header-actions { display: flex; align-items: center; gap: 10px; }

  /* Estilos del nuevo botón */
  .btn-nueva { 
    background-color: #1e293b; 
    color: white; 
    border: none; 
    padding: 8px 14px; 
    border-radius: 8px; 
    font-weight: 600; 
    font-size: 13px; 
    cursor: pointer; 
    display: flex; 
    align-items: center; 
    gap: 8px; 
    transition: background 0.2s;
  }
  .btn-nueva:hover { background-color: #334155; }

  .btn-config { background: white; border: 1px solid #e2e8f0; padding: 8px; border-radius: 8px; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; }
  .btn-config:hover { background: #f1f5f9; color: #334155; }

  /* RESTO DE ESTILOS (Intactos) */
  .dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .section-header { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; margin-bottom: 20px; text-transform: uppercase; }
  .card-hero { background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%); padding: 30px; border-radius: 20px; color: white; cursor: pointer; box-shadow: 0 20px 25px -5px rgba(0, 120, 212, 0.2); transition: transform 0.2s; }
  .card-hero:hover { transform: translateY(-5px); }
  .status-pill { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .card-hero h2 { font-size: 28px; margin: 15px 0; line-height: 1.2; }
  .hero-details { display: flex; flex-direction: column; gap: 8px; opacity: 0.9; font-size: 14px; }
  .hero-details span { display: flex; align-items: center; gap: 8px; }
  .btn-manage { margin-top: 30px; background: white; color: #0078d4; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; width: 100%; }
  .grid-cartas { display: flex; flex-direction: column; gap: 12px; }
  .card-action { background: white; border: 1px solid #e2e8f0; padding: 15px; border-radius: 16px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: all 0.2s; width: 100%; text-align: left; }
  .card-action:hover { border-color: #0078d4; transform: scale(1.01); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
  .card-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .oradores { background: #f0fdf4; color: #16a34a; }
  .presidentes { background: #eff6ff; color: #2563eb; }
  .oraciones { background: #fff7ed; color: #ea580c; }
  .card-text h3 { margin: 0; font-size: 16px; color: #1e293b; }
  .card-text p { margin: 2px 0 0; font-size: 12px; color: #64748b; }
</style>
