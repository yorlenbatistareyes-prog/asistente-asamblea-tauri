<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore, cargarDatosGlobales } from '$lib/stores/appStore';
  import { Lectern, Activity, User } from 'lucide-svelte';
  import Actualizaciones from '$lib/components/ui/Actualizaciones.svelte';

  onMount(async () => {
    await cargarDatosGlobales();

    const temaGuardado = localStorage.getItem('temaApp') || 'sistema';
    aplicarTema(temaGuardado);

    window.addEventListener('cambiarTemaGlobal', (e: any) => {
      aplicarTema(e.detail.tema);
    });

    window.addEventListener('storage', () => {
      const nuevoTema = localStorage.getItem('temaApp');
      if (nuevoTema) aplicarTema(nuevoTema);
    });
  });

  function aplicarTema(modo: string) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const esOscuroSistema = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (modo === 'oscuro' || (modo === 'sistema' && esOscuroSistema)) {
      root.classList.add('dark-theme');
    } else {
      root.classList.remove('dark-theme');
    }
  }
</script>

<slot />

<footer class="status-bar">
  <div class="status-left">
    <div class="connection-status">
      <span class="dot pulse"></span>
      <span class="status-label hide-mobile">Sistema Conectado</span> 
      <strong class="tech-stack hide-mobile">(Rust/Tauri)</strong>
    </div>
    
    <span class="separator">|</span>
    
    <div class="user-status">
      <User size={14} />
      <span class="hide-mobile">Usuario:</span> 
      <strong class="text-truncate">{$appStore.usuario}</strong>
    </div>
  </div>

  <div class="status-center">
    <span>Construido y diseñado para Presidentes de Asambleas Regionales</span>
  </div>

  <div class="status-right">
    <div class="stat-item">
      <Lectern size={14} />
      <span class="hide-mobile">Asambleas:</span>
      <strong>{$appStore.asambleas.length}</strong>
    </div>
    
    <span class="separator">|</span>
    
    <div class="version-info">
      <Activity size={14} />
      <span class="app-version">v{$appStore.version}</span>
    </div>
    
    <span class="separator">|</span>
    
    <div class="update-box">
      <Actualizaciones />
    </div>
  </div>
</footer>

<style>
  /* === VARIABLES CSS GLOBALES === */
  :global(:root) {
      --bg-body: #f8fafc;
      --bg-card: #ffffff;
      --bg-secondary: #f1f5f9;
      --text-main: #1e293b;
      --text-secondary: #64748b;
      --border-color: #e2e8f0;
      --primary: #0078d4;
      --input-bg: #ffffff;
      --shadow-color: rgba(0,0,0,0.05);
      --hover-bg: #e2e8f0;
  }

  :global(html.dark-theme) {
      --bg-body: #0f172a;       
      --bg-card: #1e293b;       
      --bg-secondary: #334155;  
      --text-main: #f8fafc;     
      --text-secondary: #cbd5e1; 
      --border-color: #334155;  
      --primary: #3b82f6;       
      --input-bg: #1e293b;
      --shadow-color: rgba(0,0,0,0.3);
      --hover-bg: #334155;
  }

  :global(body) { 
      margin: 0; 
      font-family: 'Segoe UI', sans-serif; 
      background: var(--bg-body); 
      color: var(--text-main); 
      transition: background 0.3s, color 0.3s;
  }

  /* === BARRA DE ESTADO === */
  .status-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 32px;
    background-color: #1e293b;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 12px;
    font-size: 12px;
    z-index: 2000;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.2);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
  }

  .status-left, .status-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1; 
  }

  .status-right {
    justify-content: flex-end;
  }

  .status-center {
    flex: 2;
    text-align: center;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .connection-status, .user-status, .stat-item, .version-info {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dot {
    width: 6px;
    height: 6px;
    background-color: #22c55e;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dot.pulse {
    animation: pulse-green 2s infinite;
  }

  @keyframes pulse-green {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
  }

  .separator {
    color: rgba(255,255,255,0.2);
    margin: 0 2px;
  }

  strong {
    color: #f1f5f9;
    font-weight: 600;
  }

  .tech-stack {
    color: #4ade80;
  }

  .text-truncate {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
    vertical-align: bottom;
  }

  /* === RESPONSIVE === */
  
  /* 1. Ocultar texto central en pantallas medianas */
  @media (max-width: 900px) {
    .status-center { display: none; }
  }

 /* 2. MODO MÓVIL (Pantallas Pequeñas) */
@media (max-width: 650px) {
  .hide-mobile { display: none; }
  
  .status-bar { padding: 0 8px; }
  .status-left, .status-right { gap: 8px; }
  .text-truncate { max-width: 80px; }

  /* Botón de actualizar */
  .update-box :global(button) {
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    width: 28px !important;
    height: 28px !important;
    padding: 0 !important;
    background-color: var(--primary) !important;
    border: none !important;
    border-radius: 4px !important;
    font-size: 0 !important;
  }

  /* El span que envuelve al SVG también debe centrar */
  .update-box :global(button span) {
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    width: 100% !important;
    height: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    line-height: 1 !important;
  }

  /* El SVG dentro del botón */
  .update-box :global(button svg) {
    display: block !important;
    width: 18px !important;
    height: 18px !important;
    color: white !important;
    stroke: white !important;
    stroke-width: 2.5 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
}

/* Para pantallas extremadamente pequeñas (menos de 400px) */
@media (max-width: 400px) {
  .update-box :global(button) {
    width: 24px !important;
    height: 24px !important;
  }
  .update-box :global(button svg) {
    width: 14px !important;
    height: 14px !important;
    stroke-width: 2 !important;
  }
}

</style>