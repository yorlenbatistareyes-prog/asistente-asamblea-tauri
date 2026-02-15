<script lang="ts">
  import { onMount } from 'svelte';

  import { appStore, cargarDatosGlobales } from '$lib/stores/appStore';
  import { Lectern, Activity, User } from 'lucide-svelte';
  import Actualizaciones from '$lib/components/ui/Actualizaciones.svelte';

  onMount(async () => {  // 👈 Agrega async aquí
    await cargarDatosGlobales();  // 👈 Ahora sí funciona

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
      <span class="status-label">Sistema Conectado <strong class="tech-stack">(Rust/Tauri)</strong></span>
    </div>
    <span class="separator">|</span>
    <div class="user-status">
      <User size={16} />
      <span>Usuario: <strong>{$appStore.usuario}</strong></span>
    </div>
  </div>

  <div class="status-center">
    <span>Construido y diseñado para Presidentes de Asambleas Regionales</span>
  </div>

  <div class="status-right">
    <div class="stat-item">
      <Lectern size={16} />
      <span>Asambleas: <strong>{$appStore.asambleas.length}</strong></span>
    </div>
    <span class="separator">|</span>
    <div class="version-info">
      <Activity size={14} />
      <span class="app-version">v{$appStore.version}</span>
    </div>
    <span class="separator">|</span>
    <Actualizaciones />
  </div>
</footer>

<style>
  /* === VARIABLES CSS GLOBALES (PARA TODA LA APP) === */
  :global(:root) {
      /* Tema CLARO (Default) */
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

  /* Tema OSCURO */
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

  /* Aplicar estilos base al body globalmente */
  :global(body) { 
      margin: 0; 
      font-family: 'Segoe UI', sans-serif; 
      background: var(--bg-body); 
      color: var(--text-main); 
      transition: background 0.3s, color 0.3s;
  }

  /* Estilos de la barra de estado */
.status-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 35px;
  background-color: #1e293b;
  color: #94a3b8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 15px;
  font-size: 13px;
  z-index: 2000;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.2);
  font-weight: 500;
  letter-spacing: 0.3px;
}

.status-left, .status-right {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1.5;
}

.status-right {
  justify-content: flex-end;
}

.status-center {
  flex: 2;
  text-align: center;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

.dot {
  width: 7px;
  height: 7px;
  background-color: #22c55e;
  border-radius: 50%;
}

.dot.pulse {
  animation: pulse-green 2s infinite;
}

@keyframes pulse-green {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}

.separator {
  margin: 0 10px;
  opacity: 0.3;
  font-weight: 300;
}

.status-bar strong {
  color: #ffffff;
  font-weight: 700;
  margin-left: 4px;
}

.connection-status strong {
  color: #4ade80;
  font-weight: 600;
  margin-left: 5px;
}

.tech-stack {
  color: #4ade80;
  margin-left: 6px;
  font-weight: 600;
}
</style>