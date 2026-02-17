<script lang="ts">
  import { guiaUsuario } from '$lib/data/ayuda';
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
    
    <div class="monitor-guide-card">
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
    </div>

    <div class="divider"></div>

    <h3><CircleHelp size={18}/> Preguntas Frecuentes</h3>
    
    <div class="accordion-list">
        {#each ayudaItems as item, i}
            <div class="accordion-item">
                <button class="accordion-header" on:click={() => toggleAyuda(i)}>
                    <div class="acc-title">{item.title}</div>
                    {#if item.isOpen}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                </button>
                {#if item.isOpen}
                    <div class="accordion-body"><p class="help-text-content">{item.content}</p></div>
                {/if}
            </div>
        {/each}
    </div>
</div>

<style>
  .help-container { max-width: 900px; margin: 0 auto; padding-bottom: 40px; }

  /* ESTILOS GUÍA MONITOR */
  .monitor-guide-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 30px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.03);
  }
  .guide-header h3 { display: flex; align-items: center; gap: 10px; margin: 0 0 15px 0; color: var(--text-main); font-size: 1.1rem; }
  .intro-text { color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px; line-height: 1.5; }

  .help-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
  .help-item {
      background: var(--bg-body); border: 1px solid var(--border-color);
      border-radius: 10px; padding: 15px;
      display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px;
  }
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

  .divider { height: 1px; background: var(--border-color); margin: 30px 0; }
  h3 { color: var(--text-main); display: flex; align-items: center; gap: 10px; margin-bottom: 15px; font-size: 1.1rem; }

  /* ACORDEONES */
  .accordion-list { border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
  .accordion-item { border-bottom: 1px solid var(--border-color); background: var(--bg-card); }
  .accordion-item:last-child { border-bottom: none; }
  .accordion-header { width: 100%; display: flex; justify-content: space-between; padding: 15px; background: var(--bg-card); border: none; cursor: pointer; color: var(--text-main); font-weight: 500; }
  .accordion-header:hover { background: var(--bg-body); }
  .accordion-body { padding: 15px; background: var(--bg-body); border-top: 1px solid var(--border-color); color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5; }
</style>