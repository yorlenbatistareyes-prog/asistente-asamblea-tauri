<script lang="ts">
  import { guiaUsuario } from '$lib/data/ayuda';
  import Panel from '$lib/components/ui/Panel.svelte';
  import { 
    CircleHelp, ChevronUp, ChevronDown, 
    Monitor, FastForward, Rewind, RotateCcw, Clock, CloudSync 
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

    <div class="sync-help-container">
    <div class="section-title">
        <CloudSync size={24} />
        <h3>Sincronización de Asambleas</h3>
    </div>

    <Panel padding="20px" clasesExtra="sync-panel">
        <h4>¿Cómo funciona la sincronización?</h4>
        <p>RAssembly almacena todos tus datos localmente en tu dispositivo. Para compartir asambleas, utilizamos una carpeta sincronizada en la nube (como Google Drive o OneDrive). <strong>RAssembly nunca envía datos a un servidor externo.</strong></p>
        <ul class="sync-list">
            <li>Tus datos siempre están en tus dispositivos y en la carpeta elegida.</li>
            <li>Si realizas cambios, el archivo de la asamblea se actualiza automáticamente en la nube.</li>
            <li>La encriptación AES-256 asegura que nadie pueda leer tus archivos sin la clave.</li>
        </ul>
    </Panel>

    <Panel padding="20px" clasesExtra="sync-panel">
        <h4>Configurar la sincronización (Windows / Android)</h4>
        <ol class="steps-list">
            <li><strong>Preparar Nube:</strong> Instala la app de Google Drive o OneDrive en tu equipo y asegúrate de haber iniciado sesión.</li>
            <li><strong>Seleccionar Carpeta:</strong> En RAssembly, ve a <em>Configuración > Datos</em> y haz clic en "Elegir carpeta sincronizada".</li>
            <li><strong>Vincular:</strong> Selecciona la carpeta de la nube que desees usar. Todos los dispositivos deben apuntar a la misma carpeta.</li>
        </ol>
    </Panel>

    <Panel padding="20px" clasesExtra="sync-panel">
        <h4>Compartir con el equipo de oficina</h4>
        <p>Para trabajar en equipo, todos los auxiliares deben tener acceso a la misma carpeta:</p>
        <ul class="sync-list">
            <li>Comparte la carpeta desde tu aplicación de nube (Drive/OneDrive) con los correos de tus colaboradores.</li>
            <li>Cada auxiliar debe realizar la configuración de "Elegir carpeta sincronizada" en su propio dispositivo.</li>
            <li>Al "Exportar a la nube", el archivo aparecerá en los dispositivos de los demás en cuestión de segundos.</li>
        </ul>
    </Panel>
</div>

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

  /* =========================================================
   DISEÑO RESPONSIVO (SECCIÓN AYUDA: WINDOWS + ANDROID)
   ========================================================= */

@media (max-width: 768px) {
    /* 1. MÁRGENES Y CONTENEDOR */
    .help-container {
        padding: 10px;
    }

    :global(.monitor-guide-card-override) {
        padding: 15px !important;
    }

    /* 2. LA REJILLA DE AYUDA (ADELANTAR/ATRASAR) */
    .help-grid {
        grid-template-columns: 1fr; /* Una columna para que el texto no se vea apretado */
        gap: 12px;
    }

    .help-item {
        flex-direction: row; /* Icono a la izquierda, texto a la derecha */
        text-align: left;
        align-items: flex-start;
        padding: 15px;
    }

    .icon-box {
        min-width: 45px; /* Evitamos que el icono se encoja */
        height: 45px;
    }

    .text-box strong {
        font-size: 1rem;
    }

    .text-box p {
        font-size: 0.85rem;
    }

    /* 3. CAJA DE TIP/CONSEJO */
    .tip-box {
        flex-direction: column;
        text-align: center;
        padding: 15px;
    }

    /* 4. ACORDEONES (PREGUNTAS FRECUENTES) */
    .accordion-header {
        padding: 18px 15px; /* Más área de toque para el dedo */
    }

    .acc-title {
        font-size: 13px;
        line-height: 1.4;
    }

    .accordion-body {
        padding: 15px;
        font-size: 14px; /* Un pelín más grande para leer sin cansar la vista */
    }
}

.sync-logic-container { display: flex; flex-direction: column; gap: 12px; margin-top: 15px; }
.sync-step { display: flex; align-items: flex-start; gap: 15px; }
.step-num { 
    background: var(--primary); color: white; width: 26px; height: 26px; 
    border-radius: 50%; display: flex; align-items: center; justify-content: center; 
    font-weight: 800; font-size: 0.8rem; flex-shrink: 0; 
}
.step-text { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.4; }

.sync-help-container { 
        display: flex; flex-direction: column; gap: 20px; 
        max-width: 800px; margin: 0 auto;
    }

    .section-title { 
        display: flex; align-items: center; gap: 12px; 
        color: #92400e; margin-bottom: 10px;
    }

    /* Estilo del Panel Amarillento */
    :global(.sync-panel) {
        background: #fffdf2 !important;
        border: 1px solid #fde68a !important;
    }

    h4 {
        margin: 0 0 12px 0;
        font-size: 1rem;
        color: #78350f;
        border-bottom: 2px solid #fde68a;
        padding-bottom: 8px;
    }

    p { font-size: 0.9rem; color: #451a03; line-height: 1.5; margin: 0 0 10px 0; }

    .sync-list, .steps-list {
        margin: 0; padding-left: 20px;
        font-size: 0.85rem;
        color: #451a03;
        line-height: 1.6;
    }

    .sync-list li { margin-bottom: 6px; }
    .steps-list li { margin-bottom: 8px; font-weight: 500; }

</style>