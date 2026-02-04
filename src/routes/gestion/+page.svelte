<script lang="ts">
  // --- IMPORTAMOS LOS NUEVOS ICONOS AQUÍ ---
  import { 
    Users, 
    Home, 
    ArrowLeft, 
    Bookmark, 
    Mail,
    BookUser,  // Para Registro de Personas (Libro de usuarios)
    UserCog,   // Para Comité y Admin (Gestión/Administración)
    Mic2       // Para Programa y Oradores (Micrófono)
  } from 'lucide-svelte';
  
  // --- COMPONENTES ---
  import Resumen from '$lib/components/gestion/Resumen.svelte';
  import Congregaciones from '$lib/components/gestion/Congregaciones.svelte';
  import Personas from '$lib/components/gestion/Personas.svelte';
  import Comite from '$lib/components/gestion/Comite.svelte';
  import InfoEvento from '$lib/components/gestion/InfoEvento.svelte';
  import Programa from '$lib/components/gestion/Programa.svelte';

  // Controla qué sección vemos
  let seccionActiva = 'inicio';

  function cambiarSeccion(nuevaSeccion: string) {
    seccionActiva = nuevaSeccion;
  }
</script>

<div class="layout-gestion">
  
  <aside class="sidebar">
    <div class="logo-area">
      <h3>Asamblea Regional</h3>
      <p class="subtitulo">Panel de Control</p>
    </div>

    <nav class="menu">
      <button class:activo={seccionActiva === 'inicio'} on:click={() => cambiarSeccion('inicio')}>
        <Home size={20} /> Inicio / Resumen
      </button>

      <button 
        class:activo={seccionActiva === 'info_evento'} 
        on:click={() => cambiarSeccion('info_evento')}
      >
        <Bookmark size={20} />
        <span>Información Evento</span>
      </button>

      <button class:activo={seccionActiva === 'congregaciones'} on:click={() => cambiarSeccion('congregaciones')}>
        <Users size={20} /> Congregaciones
      </button>

      <button class:activo={seccionActiva === 'personas'} on:click={() => cambiarSeccion('personas')}>
        <BookUser size={20} /> Registro de Personas
      </button>

      <button class:activo={seccionActiva === 'comite'} on:click={() => cambiarSeccion('comite')}>
        <UserCog size={20} /> Comité y Admin.
      </button>

      <button class:activo={seccionActiva === 'programa'} on:click={() => cambiarSeccion('programa')}>
        <Mic2 size={20} /> Programa y Oradores
      </button>

    </nav>

    <div class="footer-sidebar">
      <a href="/" class="btn-salir">
        <ArrowLeft size={18} /> Salir
      </a>
    </div>
  </aside>

  <main class="contenido">
    
    <header>
      <h2>
        {#if seccionActiva === 'inicio'} Resumen General {/if}
        {#if seccionActiva === 'info_evento'} Información del Evento {/if} 
        
        {#if seccionActiva === 'congregaciones'} Gestión de Congregaciones {/if}
        {#if seccionActiva === 'personas'} Registro de Hermanos {/if}
        {#if seccionActiva === 'comite'} Comité de Asamblea {/if}
        {#if seccionActiva === 'programa'} Programa {/if}
      </h2>
    </header>

    <div class="area-trabajo">
      
      {#if seccionActiva === 'inicio'}
        <Resumen />
      {/if}
      
      {#if seccionActiva === 'info_evento'}
        <InfoEvento />
      {/if}

      {#if seccionActiva === 'congregaciones'}
        <Congregaciones />
      {/if}

      {#if seccionActiva === 'personas'}
        <Personas />
      {/if}

      {#if seccionActiva === 'comite'}
        <Comite />
      {/if}

      {#if seccionActiva === 'programa'}
        <Programa />
      {/if}

    </div>

  </main>
</div>

<style>
  :global(body) { margin: 0; font-family: 'Segoe UI', sans-serif; }
  .layout-gestion { display: flex; height: 100vh; background-color: #f3f4f6; }

  /* Sidebar */
  .sidebar { width: 260px; background-color: white; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; }
  .logo-area { padding: 24px; border-bottom: 1px solid #f3f4f6; }
  .logo-area h3 { margin: 0; color: #0078d4; }
  .subtitulo { margin: 0; font-size: 12px; color: #9ca3af; }

  .menu { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; gap: 5px; }
  .menu button { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; border: none; background: none; text-align: left; cursor: pointer; color: #4b5563; border-radius: 8px; font-size: 14px; font-weight: 500; transition: background 0.2s; }
  .menu button:hover { background-color: #f3f4f6; }
  .menu button.activo { background-color: #eff6ff; color: #0078d4; font-weight: 600; }

  .footer-sidebar { padding: 20px; border-top: 1px solid #f3f4f6; }
  .btn-salir { text-decoration: none; color: #64748b; display: flex; align-items: center; gap: 8px; font-size: 14px; transition: color 0.2s; }
  .btn-salir:hover { color: #1e293b; }

  /* Contenido */
  .contenido { flex: 1; display: flex; flex-direction: column; }
  header { background: white; padding: 20px 30px; border-bottom: 1px solid #e5e7eb; }
  header h2 { margin: 0; font-size: 1.2rem; color: #1f2937; }
  .area-trabajo { padding: 30px; flex: 1; overflow-y: auto; }
</style>