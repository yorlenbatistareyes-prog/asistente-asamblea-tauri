<script lang="ts">
  import { guiaUsuario } from '$lib/data/ayuda';
  import Panel from '$lib/components/ui/Panel.svelte';
  import { 
    CircleHelp, ChevronUp, ChevronDown, 
    Monitor, FastForward, Rewind, RotateCcw, Clock,
    Search, Info, Database, Cloud, FolderSync, Save
  } from 'lucide-svelte';
  
  let ayudaItems = guiaUsuario.map((item, id) => ({ ...item, isOpen: false, id }));
  let terminoBusqueda = "";

  $: listaFiltrada = ayudaItems.filter(item => 
      item.title.toLowerCase().includes(terminoBusqueda.toLowerCase()) || 
      item.content.toLowerCase().includes(terminoBusqueda.toLowerCase())
  );

  function procesarTextoMarkdown(texto: string) {
      let procesado = texto.replace(/\n/g, '<br/>');
      procesado = procesado.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return procesado;
  }

  function toggleAyuda(id: number) { 
      const index = ayudaItems.findIndex(item => item.id === id);
      if (index !== -1) { 
          ayudaItems[index].isOpen = !ayudaItems[index].isOpen; 
          ayudaItems = [...ayudaItems]; 
      } 
  }
</script>

<div class="help-container">
    
    <!-- 1. GUÍA DEL MONITOR -->
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
                    <p>Si está amarillo, haz clic para volver a la <strong>Hora Real (0m)</strong>.</p>
                </div>
            </div>
        </div>
        <div class="tip-box">
            <Clock size={16} />
            <span><strong>Tip:</strong> Resetea el tiempo al volver del almuerzo para sincronizar todo.</span>
        </div>
    </Panel>

    <!-- 2. GUÍA DE RESPALDOS Y SINCRONIZACIÓN (VERSIÓN DETALLADA) -->
    <div class="section-title-wrapper">
        <Database size={24} color="var(--primary)" />
        <h2>Métodos de Respaldo y Sincronización</h2>
    </div>

    <!-- Método 1: Servidor Web -->
    <Panel padding="25px" clasesExtra="method-panel panel-purple">
        <div class="method-header">
            <div class="icon-box purple"><Cloud size={20} /></div>
            <h4>1. Sincronización Automática (Servidor Web)</h4>
        </div>
        <div class="method-body">
            <p>Este método permite una sincronización instantánea mediante un servidor web administrado. Es ideal para un flujo colaborativo rápido entre múltiples dispositivos en tiempo real.</p>
            
            <p><strong>Para activar y configurar este método, siga estos pasos:</strong></p>
            <ol class="method-steps">
                <li>Diríjase a la sección <strong>'Datos'</strong> dentro del menú de <strong>Configuración</strong>.</li>
                <li>Localice el apartado de <strong>Sincronización por Servidor</strong>.</li>
                <li>Active la opción de sincronización e introduzca la dirección de su servidor o las credenciales necesarias (según la configuración de su equipo).</li>
                <li>Una vez establecida la comunicación, el indicador de estado cambiará a <strong>'Vinculado'</strong>.</li>
            </ol>

            <ul class="method-list">
                <li><strong>Funcionamiento:</strong> Al realizar cualquier cambio en la aplicación, RAssembly se comunica automáticamente con el servidor para actualizar la base de datos de los demás auxiliares al instante.</li>
                <li><strong>Nota de privacidad:</strong> En este método, los datos transitan por un servidor externo (aunque de forma segura).</li>
            </ul>
        </div>
    </Panel>

    <!-- Método 2: Carpeta Compartida (Nube Privada) -->
    <Panel padding="25px" clasesExtra="method-panel panel-blue">
        <div class="method-header">
            <div class="icon-box blue"><FolderSync size={20} /></div>
            <h4>2. Carpeta Compartida (Drive / OneDrive)</h4>
        </div>
        <div class="method-body">
            <p>En la sección <strong>'Datos'</strong> puede vincular una carpeta raíz de servicios en la nube para compartir y sincronizar su información entre dispositivos manteniendo el 100% de la privacidad en su propia nube.</p>
            
            <p><strong>Para vincular y configurar la carpeta, siga estos pasos:</strong></p>
            <ol class="method-steps">
                <li>Diríjase a la sección <strong>'Datos'</strong> dentro del menú de <strong>Configuración</strong>.</li>
                <li>Localice el apartado de <strong>Carpeta de Sincronización</strong> y pulse el botón para seleccionar el directorio.</li>
                <li>Elija en el explorador de archivos la carpeta raíz de su servicio (por ejemplo, Google Drive o OneDrive). Todos los auxiliares deben apuntar a esta misma carpeta compartida.</li>
                <li>Una vez seleccionada, el estado cambiará a <strong>'Vinculado'</strong>.</li>
            </ol>

            <p>Una vez configurada, cualquier cambio en la aplicación se empaquetará, se cifrará de forma segura (AES-256) mediante una 'Llave Invisible' en segundo plano tras unos segundos de inactividad, y se guardará como un archivo <code>.rassembly</code>. También dispone de botones para <strong>'Restaurar Manual'</strong> y <strong>'Sincronizar Ahora'</strong>.</p>
        </div>
    </Panel>

    <!-- Método 3: Respaldo Manual Local -->
    <Panel padding="25px" clasesExtra="method-panel panel-green">
        <div class="method-header">
            <div class="icon-box dark-green"><Save size={20} /></div>
            <h4>3. Respaldo Manual Local (.sqlite)</h4>
        </div>
        <div class="method-body">
            <p>En la sección <strong>'Datos'</strong> encontrará las herramientas tradicionales para proteger su información de forma totalmente desconectada (offline).</p>
            <ul class="method-list">
                <li><strong>Respaldar datos:</strong> Genera y guarda una copia de seguridad completa de su base de datos actual (formato <code>.sqlite</code>) en cualquier lugar de su computadora.</li>
                <li><strong>Restaurar datos:</strong> Le permite cargar un archivo <code>.sqlite</code> previo. Tenga en cuenta que esta acción reemplazará permanentemente los datos actuales de la aplicación.</li>
                <li><strong>Limpiar todo:</strong> Elimina toda la información registrada en la aplicación para comenzar desde cero (restablecimiento de fábrica).</li>
            </ul>
        </div>
    </Panel>

    <div class="divider"></div>

    <!-- 3. PREGUNTAS FRECUENTES -->
    <div class="faq-header">
        <h3><CircleHelp size={18}/> Preguntas Frecuentes</h3>
        <div class="busqueda-wrapper">
            <Search size={16} class="icono-buscar" />
            <input 
                type="text" 
                bind:value={terminoBusqueda} 
                placeholder="Buscar temas..." 
            />
        </div>
    </div>
    
    <Panel padding="0" clasesExtra="panel-acordeon-override">
        <div class="accordion-list">
            {#each listaFiltrada as item}
                <div class="accordion-item">
                    <button class="accordion-header" on:click={() => toggleAyuda(item.id)}>
                        <div class="acc-title"><CircleHelp size={16} class="ayuda-icon" /> {item.title}</div>
                        {#if item.isOpen}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                    </button>
                    {#if item.isOpen}
                        <div class="accordion-body"><p class="help-text-content">{@html procesarTextoMarkdown(item.content)}</p></div>
                    {/if}
                </div>
            {:else}
                <div class="estado-vacio">
                    <Info size={32} color="var(--text-sec)" />
                    <p>No se encontraron respuestas para "{terminoBusqueda}".</p>
                </div>
            {/each}
        </div>
    </Panel>
</div>

<style>
 .help-container { max-width: 900px; margin: 0 auto; padding-bottom: 40px; }

 /* --- GUÍA MONITOR --- */
 :global(.monitor-guide-card-override) { margin-bottom: 40px !important; }
 
 .guide-header h3 { display: flex; align-items: center; gap: 10px; margin: 0 0 15px 0; color: var(--text-main); font-size: 1.1rem; }
 .intro-text { color: var(--text-sec); font-size: 0.9rem; margin-bottom: 20px; line-height: 1.5; }

 .help-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
 .help-item {
     background: var(--bg-body); border: 1px solid var(--border);
     border-radius: 10px; padding: 15px;
     display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px;
     transition: border 0.2s;
 }
 .help-item:hover { border-color: var(--primary); }
 
 .icon-box { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;}
 .icon-box.green { background: #10b981; }
 .icon-box.red { background: #ef4444; }
 .icon-box.yellow { background: #f59e0b; }
 .icon-box.purple { background: #8b5cf6; }
 .icon-box.blue { background: #3b82f6; }
 .icon-box.dark-green { background: #059669; }

 .text-box strong { display: block; color: var(--text-main); font-size: 0.9rem; margin-bottom: 5px; }
 .text-box p { font-size: 0.8rem; color: var(--text-sec); line-height: 1.3; margin: 0; }

 .tip-box {
     margin-top: 20px; background: rgba(var(--primary-rgb, 59, 130, 246), 0.1); 
     border: 1px solid rgba(var(--primary-rgb, 59, 130, 246), 0.3);
     padding: 10px 15px; border-radius: 8px; display: flex; align-items: center; gap: 10px;
     color: var(--primary); font-size: 0.85rem;
 }

 /* --- GUÍAS DE MÉTODOS DE RESPALDO DETALLADOS --- */
 .section-title-wrapper {
     display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
 }
 .section-title-wrapper h2 {
     margin: 0; font-size: 1.3rem; color: var(--text-main); font-weight: 700;
 }

 :global(.method-panel) { margin-bottom: 20px !important; }
 
 .method-header {
     display: flex; align-items: center; gap: 15px; margin-bottom: 15px;
     padding-bottom: 15px; border-bottom: 1px solid var(--border);
 }
 .method-header h4 { margin: 0; font-size: 1.1rem; color: var(--text-main); }
 
 .method-body p {
     font-size: 0.95rem; color: var(--text-sec); line-height: 1.6; margin: 0 0 15px 0;
 }
 .method-body p strong { color: var(--text-main); }
 .method-body code {
     background: var(--bg-body); padding: 2px 6px; border-radius: 4px; 
     font-size: 0.85rem; border: 1px solid var(--border);
 }

 .method-list, .method-steps {
     margin: 0 0 15px 0; padding-left: 20px;
     font-size: 0.95rem; color: var(--text-sec); line-height: 1.6;
 }
 .method-list li, .method-steps li { margin-bottom: 8px; }
 .method-list li strong, .method-steps li strong { color: var(--text-main); }

 .divider { height: 1px; background: var(--border); margin: 40px 0; }
 
 /* --- ENCABEZADO FAQ Y BUSCADOR --- */
 .faq-header { 
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; 
 }
 .faq-header h3 { 
    color: var(--text-main); display: flex; align-items: center; gap: 10px; margin: 0; font-size: 1.1rem; 
 }
 
 .busqueda-wrapper {
    position: relative; display: flex; align-items: center; width: 250px;
 }
 .icono-buscar { position: absolute; left: 12px; color: var(--text-sec); }
 .busqueda-wrapper input {
    width: 100%; padding: 8px 12px 8px 35px; border: 1px solid var(--border);
    border-radius: 6px; background: var(--bg-card); color: var(--text-main);
    font-size: 0.9rem; transition: all 0.2s ease;
 }
 .busqueda-wrapper input:focus {
    outline: none; border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb, 59, 130, 246), 0.15);
 }

 /* --- ACORDEONES --- */
 :global(.panel-acordeon-override) { overflow: hidden !important; }

 .accordion-list { width: 100%; }
 .accordion-item { border-bottom: 1px solid var(--border); background: var(--bg-card); }
 .accordion-item:last-child { border-bottom: none; }
 
 .accordion-header { 
     width: 100%; display: flex; justify-content: space-between; align-items: center;
     padding: 15px 20px; background: transparent; border: none; cursor: pointer; 
     color: var(--text-main); font-weight: 500; font-size: 14px; transition: background 0.2s;
 }
 .accordion-header:hover { background: var(--hover-bg); color: var(--primary); }
 
 .acc-title { display: flex; align-items: center; gap: 10px; text-align: left; }
 :global(.ayuda-icon) { color: var(--primary); opacity: 0.8; flex-shrink: 0; }
 .accordion-header:hover :global(.ayuda-icon) { opacity: 1; }
 
 .accordion-body { 
     padding: 20px 25px; background: rgba(128, 128, 128, 0.12); 
     border-top: 1px solid var(--border); color: var(--text-main); 
     font-size: 0.9rem; line-height: 1.6; box-shadow: inset 0 3px 6px -4px rgba(0, 0, 0, 0.25); 
 }
 .help-text-content { margin: 0; }
 .accordion-body :global(strong) { color: var(--text-main); font-weight: 600; }

 .estado-vacio {
     display: flex; flex-direction: column; align-items: center;
     padding: 40px 20px; color: var(--text-sec); gap: 10px;
 }
 .estado-vacio p { margin: 0; font-size: 0.9rem; }

 /* =========================================================
   DISEÑO RESPONSIVO
   ========================================================= */
 @media (max-width: 700px) {
     .help-grid { grid-template-columns: 1fr; }
     .faq-header { flex-direction: column; align-items: flex-start; gap: 15px; }
     .busqueda-wrapper { width: 100%; }
 }

@media (max-width: 768px) {
    .help-container { padding: 10px; }
    :global(.monitor-guide-card-override), :global(.method-panel) { padding: 15px !important; margin-bottom: 15px !important; }
    .help-grid { grid-template-columns: 1fr; gap: 12px; }
    .help-item { flex-direction: row; text-align: left; align-items: flex-start; padding: 15px; }
    .icon-box { min-width: 45px; height: 45px; }
    .text-box strong { font-size: 1rem; }
    .text-box p { font-size: 0.85rem; }
    .tip-box { flex-direction: column; text-align: center; padding: 15px; }
    
    .method-header { flex-direction: column; text-align: center; gap: 10px; }
    .method-body p, .method-list, .method-steps { font-size: 0.9rem; }
    
    .accordion-header { padding: 18px 15px; }
    .acc-title { font-size: 13px; line-height: 1.4; }
    .accordion-body { padding: 15px; font-size: 14px; }
}

/* --- FONDOS TENUES PARA LAS TARJETAS DE RESPALDO --- */
 :global(.panel-purple) {
     background-color: rgba(139, 92, 246, 0.04) !important;
     border-color: rgba(139, 92, 246, 0.2) !important;
 }
 :global(.panel-blue) {
     background-color: rgba(59, 130, 246, 0.04) !important;
     border-color: rgba(59, 130, 246, 0.2) !important;
 }
 :global(.panel-green) {
     background-color: rgba(5, 150, 105, 0.04) !important;
     border-color: rgba(5, 150, 105, 0.2) !important;
 }
</style>