<script lang="ts">
  import { guiaUsuario } from '$lib/data/ayuda';
  import Panel from '$lib/components/ui/Panel.svelte';
  import { 
    CircleHelp, ChevronUp, ChevronDown, 
    Monitor, FastForward, Rewind, RotateCcw, Clock 
  } from 'lucide-svelte';
  
  // Estado para los acordeones
  let ayudaItems = guiaUsuario.map(item => ({ ...item, isOpen: false }));

  function toggleAyuda(index: number) { 
      if (ayudaItems[index]) { 
          ayudaItems[index].isOpen = !ayudaItems[index].isOpen; 
          ayudaItems = [...ayudaItems]; 
      } 
  }
</script>

<div class="help-container">
    
    <Panel padding="25px" clasesExtra="monitor-guide-card-override">
        <div class="guide-header">
            <h3><Monitor size={20} /> Control de Tiempo del Monitor</h3>
        </div>
        
        <p class="intro-text">
            El Monitor en Vivo sigue la hora real. Si el programa se adelanta o atrasa, usa los controles manuales para ajustar el tiempo y mantener sincronizada la pantalla.
        </p>

        <div class="help-grid">
            <div class="help-item">
                <div class="icon-box green"><FastForward size={20} /></div>
                <div class="text-box">
                    <strong>(+) Adelantar</strong>
                    <p>Úsalo si el programa va <em>rápido</em>. Suma minutos para mostrar la siguiente parte antes.</p>
                </div>
            </div>

            <div class="help-item">
                <div class="icon-box red"><Rewind size={20} /></div>
                <div class="text-box">
                    <strong>(-) Atrasar</strong>
                    <p>Úsalo si el programa va <em>lento</em>. Resta minutos para retener la parte actual.</p>
                </div>
            </div>

            <div class="help-item">
                <div class="icon-box yellow"><RotateCcw size={20} /></div>
                <div class="text-box">
                    <strong>Clic en Número Central</strong>
                    <p>Si está amarillo (ej: <strong>+5m</strong>), haz clic para volver a la <strong>Hora Real (0m)</strong>.</p>
                </div>
            </div>
        </div>
        
        <div class="tip-box">
            <Clock size={16} />
            <span><strong>Tip:</strong> Resetea el tiempo al volver del almuerzo para sincronizar todo.</span>
        </div>
    </Panel>

    <div class="divider"></div>

    <h3><CircleHelp size={18}/> Preguntas Frecuentes</h3>
    
    <Panel padding="0" clasesExtra="panel-acordeon-override">
        <div class="accordion-list">
            {#each ayudaItems as item, i}
                <div class="accordion-item">
                    <button class="accordion-header" on:click={() => toggleAyuda(i)}>
                        <div class="acc-title"><CircleHelp size={16} class="ayuda-icon" /> {item.title}</div>
                        {#if item.isOpen}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                    </button>
                    {#if item.isOpen}
                        <div class="accordion-body"><p class="help-text-content">{item.content}</p></div>
                    {/if}
                </div>
            {/each}
        </div>
    </Panel>
</div>

<style>
 .help-container { max-width: 900px; margin: 0 auto; padding-bottom: 40px; }

  /* --- GUÍA MONITOR (Heredando el Panel) --- */
  :global(.monitor-guide-card-override) {
      margin-bottom: 30px !important;
  }
  
  .guide-header h3 { display: flex; align-items: center; gap: 10px; margin: 0 0 15px 0; color: var(--text-main); font-size: 1.1rem; }
  .intro-text { color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px; line-height: 1.5; }

  .help-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
  .help-item {
      background: var(--bg-body); border: 1px solid var(--border);
      border-radius: 10px; padding: 15px;
      display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px;
      transition: border 0.2s;
  }
  .help-item:hover { border-color: var(--primary); }
  
  .icon-box { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
  .icon-box.green { background: #10b981; }
  .icon-box.red { background: #ef4444; }
  .icon-box.yellow { background: #f59e0b; }

  .text-box strong { display: block; color: var(--text-main); font-size: 0.9rem; margin-bottom: 5px; }
  .text-box p { font-size: 0.8rem; color: var(--text-secondary); line-height: 1.3; margin: 0; }

  .tip-box {
      margin-top: 20px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 10px 15px; border-radius: 8px; display: flex; align-items: center; gap: 10px;
      color: var(--primary); font-size: 0.85rem;
  }

  .divider { height: 1px; background: var(--border); margin: 30px 0; }
  h3 { color: var(--text-main); display: flex; align-items: center; gap: 10px; margin-bottom: 15px; font-size: 1.1rem; }

  /* --- ACORDEONES (Heredando el Panel) --- */
  :global(.panel-acordeon-override) {
      overflow: hidden !important; /* Para que las esquinas del acordeón no se salgan del panel */
  }

  .accordion-list { width: 100%; }
  .accordion-item { border-bottom: 1px solid var(--border); background: var(--bg-card); }
  .accordion-item:last-child { border-bottom: none; }
  
  .accordion-header { 
      width: 100%; display: flex; justify-content: space-between; align-items: center;
      padding: 15px 20px; background: transparent; border: none; cursor: pointer; 
      color: var(--text-main); font-weight: 500; font-size: 14px;
      transition: background 0.2s;
  }
  .accordion-header:hover { background: var(--hover-bg); color: var(--primary); }
  
  .acc-title { display: flex; align-items: center; gap: 10px; text-align: left; }
  
  /* Color especial para el icono de interrogación de las preguntas */
  :global(.ayuda-icon) { color: var(--primary); opacity: 0.8; flex-shrink: 0; }
  .accordion-header:hover :global(.ayuda-icon) { opacity: 1; }
  
  .accordion-body { 
      padding: 20px 25px; /* Un poquito más de espacio lateral para que el texto respire */
      background: rgba(128, 128, 128, 0.12); /* Gris transparente muy sutil y elegante */
      border-top: 1px solid var(--border); 
      color: var(--text-main); /* Texto principal para que sea más fácil de leer */
      font-size: 0.9rem; 
      line-height: 1.6; 
      /* Esta sombra interior da el efecto de que el panel se hunde ligeramente */
      box-shadow: inset 0 3px 6px -4px rgba(0, 0, 0, 0.25); 
  }

  .help-text-content { margin: 0; }

  @media (max-width: 700px) {
      .help-grid { grid-template-columns: 1fr; }
  }
</style>