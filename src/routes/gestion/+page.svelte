<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { oradoresPendientes } from '$lib/stores/gestion';
  import Oficina from '$lib/components/gestion/Oficina.svelte';

  // --- IMPORTAMOS LOS ICONOS ---
  import { User, Users, ArrowLeft, Bookmark, BookUser, UserCog, Mic2, PanelLeftClose, PanelLeftOpen,
    IdCard, UserCheck, ListChecks, ClipboardList, Network, Layers, Key, HeartHandshake, 
    Workflow, Briefcase, LayoutDashboard, UsersRound } from 'lucide-svelte';
  
  // --- COMPONENTES ---
  import Resumen from '$lib/components/gestion/Resumen.svelte';
  import Congregaciones from '$lib/components/gestion/Congregaciones.svelte';
  import Personas from '$lib/components/gestion/Personas.svelte';
  import Comite from '$lib/components/gestion/Comite.svelte';
  import InfoEvento from '$lib/components/gestion/InfoEvento.svelte';
  import Programa from '$lib/components/gestion/Programa.svelte';
  import { setResumen } from '$lib/stores/gestion';

  // Controla qué sección vemos
  let seccionActiva = 'inicio';
  let asambleaActual: any = {};
  
  // NUEVO: Controla si el sidebar está encogido
  let colapsado = false;

  onMount(async () => {

    // Recuperar el nombre de la asamblea activa para mostrarlo en el menú
    const data = localStorage.getItem('asambleaActiva');
    if (data) {
        asambleaActual = JSON.parse(data);
    }

    // PASO 8: Validar si la asamblea guardada existe realmente en la base
if (asambleaActual?.id) {
    try {
        const existe = await invoke('obtener_asamblea_por_id', { id: asambleaActual.id });
        if (!existe) {
            console.warn("Asamblea guardada ya no existe. Limpiando localStorage...");
            localStorage.removeItem('asambleaActiva');
            asambleaActual = null;
        }
    } catch (e) {
        console.warn("Error validando asamblea activa:", e);
        localStorage.removeItem('asambleaActiva');
        asambleaActual = null;
    }
}
    // Intentar inicializar los datos del resumen desde localStorage
    const resumenRaw = localStorage.getItem('resumen');
    if (resumenRaw) {
      try {
        const parsed = JSON.parse(resumenRaw);
        setResumen(parsed);
      } catch (e) {
        // si falla parsing, cargamos valores por defecto
        setResumen({ totalAsistencia: 1250, totalBautismos: 12, congregacionesReportadas: 8, totalCongregaciones: 12 });
      }
    } else {
      // Valores por defecto para la primera carga
      setResumen({ totalAsistencia: 1250, totalBautismos: 12, congregacionesReportadas: 8, totalCongregaciones: 12 });
    }

    // Cargar oradores pendientes para el resumen (cargar 3 días)
    (async () => {
      try {
        const dias = ['Viernes', 'Sábado', 'Domingo'];
        const pendientes: any[] = [];
        await Promise.all(dias.map(async (dia) => {
          try {
            const res = await invoke('obtener_programa_dia', { asambleaId: asambleaActual?.id || (JSON.parse(data || '{}').id), dia }) as any[];
            res.forEach(p => {
              if (p.nombre_orador && (!p.estado || p.estado !== 'Confirmado')) {
                pendientes.push({ id: p.id, nombre: p.nombre_orador, tema: p.tema, estado: p.estado || 'Pendiente' });
              }
            });
          } catch (e) { console.warn('No se pudo cargar programa dia', dia, e); }
        }));
        oradoresPendientes.set(pendientes);
      } catch (e) { console.warn('Error cargando oradores pendientes', e); }
    })();
  });

  function cambiarSeccion(nuevaSeccion: string) {
    seccionActiva = nuevaSeccion;
  }

  // NUEVO: Función para alternar el menú
  function toggleSidebar() {
    colapsado = !colapsado;
  }
</script>

<div class="layout-gestion">
  
  <aside class="sidebar" class:colapsado={colapsado}>
    
    <div class="logo-area">
      <div class="header-acciones">
          <button class="btn-toggle" on:click={toggleSidebar} title={colapsado ? "Expandir menú" : "Contraer menú"}>
              {#if colapsado}
                  <PanelLeftOpen size={25} />
              {:else}
                  <PanelLeftClose size={25} />
              {/if}
          </button>
      </div>
      
      <div class="texto-logo">
          <h3>Asamblea Regional</h3>
          <p class="subtitulo">{asambleaActual.tema || 'Panel de Control'}</p>
      </div>
    </div>

    <nav class="menu">
      <button class:activo={seccionActiva === 'inicio'} on:click={() => cambiarSeccion('inicio')} title="Inicio / Resumen">
        <LayoutDashboard size={20} class="icono-nav" /> <span class="texto-menu">Inicio/Estadísticas</span>
      </button>

      <button class:activo={seccionActiva === 'info_evento'} on:click={() => cambiarSeccion('info_evento')} title="Información Evento">
        <Bookmark size={20} class="icono-nav" /> <span class="texto-menu">Detalles de la Asamblea</span>
      </button>

      <button class:activo={seccionActiva === 'congregaciones'} on:click={() => cambiarSeccion('congregaciones')} title="Congregaciones">
        <Users size={20} class="icono-nav" /> <span class="texto-menu">Congregaciones</span>
      </button>

      <button class:activo={seccionActiva === 'personas'} on:click={() => cambiarSeccion('personas')} title="Personas">
        <User size={20} class="icono-nav" /> <span class="texto-menu">Personas</span>
      </button>

      <button class:activo={seccionActiva === 'comite'} on:click={() => cambiarSeccion('comite')} title="Responsabilidades">
        <UserCog size={20} class="icono-nav" /> <span class="texto-menu">Responsabilidades</span>
      </button>

      <button class:activo={seccionActiva === 'programa'} on:click={() => cambiarSeccion('programa')} title="Programa">
        <Mic2 size={20} class="icono-nav" /> <span class="texto-menu">Programa</span>
      </button>

      <button class:activo={seccionActiva === 'oficina'} on:click={() => cambiarSeccion('oficina')} title="Oficina">
        <Briefcase size={20} class="icono-nav" /> <span class="texto-menu">Oficina</span>
      </button>

    </nav>

    <div class="footer-sidebar">
      <a href="/" class="btn-salir" title="Salir al Inicio">
        <ArrowLeft size={18} class="icono-nav" /> <span class="texto-menu">Salir al Inicio</span>
      </a>
    </div>
  </aside>

  <main class="contenido">
    
    <header>
      <h2>
        {#if seccionActiva === 'inicio'} Resumen General {/if}
        {#if seccionActiva === 'info_evento'} Detalles de la Asamblea {/if} 
        {#if seccionActiva === 'congregaciones'} Gestión de Congregaciones {/if}
        {#if seccionActiva === 'personas'} Registro de Hermanos {/if}
        {#if seccionActiva === 'comite'} Responsabilidades {/if}
        {#if seccionActiva === 'programa'} Programa {/if}
        {#if seccionActiva === 'oficina'} Oficina {/if}
      </h2>
    </header>

    <div class="area-trabajo">
      
      {#if seccionActiva === 'inicio'} <Resumen /> {/if}
      {#if seccionActiva === 'info_evento'} <InfoEvento /> {/if}
      {#if seccionActiva === 'congregaciones'} <Congregaciones /> {/if}
      {#if seccionActiva === 'personas'} <Personas /> {/if}
      {#if seccionActiva === 'comite'} <Comite /> {/if}
      {#if seccionActiva === 'programa'} <Programa /> {/if}
      {#if seccionActiva === 'oficina'} <Oficina /> {/if}

    </div>

  </main>
</div>

<style>
  /* APLICANDO VARIABLES GLOBALES DE TEMA */
  :global(body) { margin: 0; font-family: 'Segoe UI', sans-serif; overflow: hidden; } /* Evita scroll doble en la app entera */
  
  .layout-gestion { 
      display: flex; height: 100vh; width: 100vw;
      background-color: var(--bg-body); 
      color: var(--text-main);          
      transition: background 0.3s, color 0.3s;
  }

  /* --- SIDEBAR --- */
  .sidebar { 
      width: 260px; /* ANCHO NORMAL */
      background-color: var(--bg-card); 
      border-right: 1px solid var(--border-color); 
      display: flex; flex-direction: column; 
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); /* Transición súper suave */
      overflow-x: hidden; /* CRUCIAL: Para que el texto no se asome al achicar */
      flex-shrink: 0; /* Evita que flexbox lo aplaste sin permiso */
  }
  
  .logo-area { 
      padding: 20px 24px; 
      border-bottom: 1px solid var(--border-color); 
      display: flex;
      flex-direction: column;
      gap: 15px;
  }

  .header-acciones {
      display: flex;
      align-items: center;
      justify-content: flex-end; /* Pone el botón a la derecha */
  }

  .btn-toggle {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, color 0.2s;
  }

  .btn-toggle:hover {
      background: var(--hover-bg);
      color: var(--primary);
  }

  .texto-logo {
      display: flex;
      flex-direction: column;
      transition: opacity 0.2s;
      white-space: nowrap; /* Evita que el texto baje de línea */
  }

  .texto-logo h3 { margin: 0; color: var(--primary); font-weight: 800; font-size: 1.1rem;}
  .subtitulo { margin: 5px 0 0; font-size: 12px; color: var(--text-secondary); opacity: 0.8; }

  .menu { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; gap: 5px; }
  
  .menu button { 
      display: flex; align-items: center; width: 100%; 
      padding: 12px 14px; border: none; background: none; 
      text-align: left; cursor: pointer;
      gap: 16px; 
      color: var(--text-secondary); 
      border-radius: 8px; font-size: 14px; font-weight: 500; 
      transition: all 0.2s; 
      white-space: nowrap; /* CRUCIAL para el colapso */
  }

    /* svelte-ignore css-unused-selector */
    :global(.icono-nav) {
      min-width: 20px; /* Mantiene el icono cuadrado sin aplastarse */
      margin-right: 16px;
      flex-shrink: 0;
    }
  
  .texto-menu {
      transition: opacity 0.2s;
  }

  .menu button:hover { 
      background-color: var(--hover-bg); 
      color: var(--text-main); 
  }
  
  .menu button.activo { 
      background-color: var(--bg-secondary); 
      color: var(--primary); 
      font-weight: 600; 
  }

  /* --- FOOTER DEL SIDEBAR (PROFESIONAL) --- */
  
  .footer-sidebar {
      padding: 20px 10px; /* Un poco más de aire */
      padding-bottom: 55px;
      border-top: 1px solid var(--border-color);
      /* Opcional: un fondo muy sutil para separar el footer */
      background-color: rgba(0, 0, 0, 0.02); 
  }
  
  .btn-salir { 
      text-decoration: none; 
      color: var(--text-secondary); 
      display: flex; align-items: center;
      padding: 12px 14px; border-radius: 8px;
      font-size: 14px; font-weight: 500;
      transition: all 0.2s; 
      white-space: nowrap;
  }
  .btn-salir { 
      display: flex; 
      align-items: center;
      justify-content: flex-start;
      
      width: 100%;
      box-sizing: border-box; /* 👈 CORRECCIÓN 2: Evita que el padding desborde el botón hacia la derecha */
      padding: 12px 14px; /* 👈 CORRECCIÓN 3: Igualamos el padding interno al de los botones del menú */
      
      background-color: var(--bg-body); 
      border: 1px solid var(--border-color); 
      border-radius: 12px; 
      
      text-decoration: none; 
      color: var(--text-main); 
      font-size: 14px; 
      font-weight: 600; 
      
      transition: all 0.2s ease-in-out; 
      white-space: nowrap;
  }

  /* Efecto HOVER (Cuando pasas el ratón) */
  .btn-salir:hover { 
      background-color: var(--bg-secondary); 
      border-color: var(--primary); 
      color: var(--primary); 
      transform: translateY(-2px); 
      box-shadow: 0 4px 12px rgba(0,0,0,0.08); 
  }

  /* Ajuste para que el icono tenga el color correcto en hover */
    /* svelte-ignore css-unused-selector */
    :global(.btn-salir:hover .icono-nav) {
      color: var(--primary);
    }

  /* --- ESTILOS CUANDO ESTÁ COLAPSADO --- */

  /* --- AJUSTE PARA CUANDO ESTÁ COLAPSADO --- */
  .sidebar.colapsado .btn-salir {
      justify-content: center; 
      padding-left: 0;  /* Quitamos paddings laterales para centrar el icono perfecto */
      padding-right: 0;
  }
  
  .sidebar.colapsado {
      width: 72px; /* Solo espacio para iconos */
  }

  .sidebar.colapsado .header-acciones {
      justify-content: center; /* Centra el botón de toggle */
  }

  .sidebar.colapsado .texto-logo {
      opacity: 0;
      pointer-events: none;
      height: 0; /* Oculta totalmente el espacio del título */
      overflow: hidden;
  }

  .sidebar.colapsado .texto-menu {
      opacity: 0;
      pointer-events: none;
      display: none;
  }

    /* svelte-ignore css-unused-selector */
    :global(.sidebar.colapsado .icono-nav) {
      margin-right: 0; /* Quita el margen derecho para que el icono quede en el centro del botón */
    }

  .sidebar.colapsado .menu button,
  .sidebar.colapsado .btn-salir {
      justify-content: center;
      padding: 12px;
      padding-right: 0; /* Centra el icono en el botón encogido */
  }


  /* --- RESPONSIVIDAD AUTOMÁTICA --- */
  /* Si la ventana se hace menor a 900px, colapsamos automáticamente */
  @media (max-width: 900px) {
      .sidebar { width: 72px; }
      .header-acciones { justify-content: center; }
      .texto-logo, .texto-menu { opacity: 0; pointer-events: none; height: 0; }
      /* svelte-ignore css-unused-selector */
      :global(.icono-nav) { margin-right: 0; }
      .menu button, .btn-salir { justify-content: center; }
  }


  /* Contenido */
  .contenido { flex: 1; display: flex; flex-direction: column; background-color: var(--bg-body); overflow: hidden; }
  
  header { 
      background: var(--bg-card); 
      padding: 20px 30px; 
      border-bottom: 1px solid var(--border-color); 
      flex-shrink: 0;
  }
  
  header h2 { margin: 0; font-size: 1.2rem; color: var(--text-main); }
  
  .area-trabajo { padding: 30px; flex: 1; overflow-y: auto; }
</style>