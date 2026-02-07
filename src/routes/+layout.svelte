<script lang="ts">
  import { onMount } from 'svelte';

  onMount(() => {
    // Al cargar cualquier página, verificamos el tema guardado
    const temaGuardado = localStorage.getItem('temaApp') || 'sistema';
    aplicarTema(temaGuardado);
    
    // Escuchar el evento que dispara el botón del engranaje (Para cambio inmediato)
    window.addEventListener('cambiarTemaGlobal', (e: any) => {
        aplicarTema(e.detail.tema);
    });

    // Escuchar cambios desde otras pestañas del navegador (Opcional pero útil)
    window.addEventListener('storage', () => {
        const nuevoTema = localStorage.getItem('temaApp');
        if(nuevoTema) aplicarTema(nuevoTema);
    });
  });

  function aplicarTema(modo: string) {
      // Protección para evitar errores si se ejecuta en servidor (SSR)
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
</style>