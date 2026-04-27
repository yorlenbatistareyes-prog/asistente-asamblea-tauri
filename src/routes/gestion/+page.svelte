<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { oradoresPendientes } from '$lib/stores/gestion';
  import VistaPrograma from '$lib/components/gestion/VistaPrograma.svelte';
  import RegistroOradores from '$lib/components/gestion/RegistroOradores.svelte';
  import ListaOradores from '$lib/components/gestion/ListaOradores.svelte';
  
  // --- COMPONENTES ---
  import Oficina from '$lib/components/gestion/Oficina.svelte';
  import Resumen from '$lib/components/gestion/Resumen.svelte';
  import Congregaciones from '$lib/components/gestion/Congregaciones.svelte';
  import Personas from '$lib/components/gestion/Personas.svelte';
  import Comite from '$lib/components/gestion/Comite.svelte';
  import InfoEvento from '$lib/components/gestion/InfoEvento.svelte';
  import Programa from '$lib/components/gestion/Programa.svelte';
  import Ensayos from '$lib/components/gestion/Ensayos.svelte'
  import { setResumen } from '$lib/stores/gestion';
  import { vistaActual } from '$lib/stores/appStore';

  // --- IMPORTAMOS LOS ICONOS ---
  import { 
      User, Users, ArrowLeft, Bookmark, Mic2, 
      ClipboardList, Briefcase, LayoutDashboard, 
      ChevronDown, Building2 
  } from 'lucide-svelte';
  
  import Icon from 'mdi-svelte';
  import { IconosMDI } from '$lib/data/iconosMDI';

  // --- ESTADO ---
  let seccionActiva = 'inicio';
  let asambleaActual: any = {};
  let mostrarMenuMas = false; // Controla el dropdown "Más"

  $: if ($vistaActual && $vistaActual !== seccionActiva) {
      seccionActiva = $vistaActual;
  }

  onMount(async () => {
    // Cierra el menú "Más" si haces clic en cualquier otra parte de la pantalla
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (mostrarMenuMas && !target.closest('.tab-mas-container')) {
            mostrarMenuMas = false;
        }
    };
    window.addEventListener('click', handleClickOutside);

    // Recuperar el nombre de la asamblea activa para mostrarlo en el menú
    const data = localStorage.getItem('asambleaActiva');
    if (data) {
        asambleaActual = JSON.parse(data);
    }

    // Validar si la asamblea guardada existe realmente en la base
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

    // Intentar inicializar los datos del resumen
    const resumenRaw = localStorage.getItem('resumen');
    if (resumenRaw) {
      try {
        setResumen(JSON.parse(resumenRaw));
      } catch (e) {
        setResumen({ totalAsistencia: 1250, totalBautismos: 12, congregacionesReportadas: 8, totalCongregaciones: 12 });
      }
    } else {
      setResumen({ totalAsistencia: 1250, totalBautismos: 12, congregacionesReportadas: 8, totalCongregaciones: 12 });
    }

    // Cargar oradores pendientes para el resumen
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

    // Limpieza del listener al desmontar
    return () => window.removeEventListener('click', handleClickOutside);
  });

  function cambiarSeccion(nuevaSeccion: string) {
    seccionActiva = nuevaSeccion;
    vistaActual.set(nuevaSeccion); // 👈 Ahora el menú y el store están sincronizados
    mostrarMenuMas = false; 
  }

</script>

<div class="layout-gestion">
  
  <nav class="top-nav">
      
      <div class="nav-izq">
          <div class="texto-logo">
              <h3>Asamblea Regional</h3>
              <span class="subtitulo">{asambleaActual.tema || 'Panel de Control'}</span>
          </div>
      </div>

      <div class="nav-centro">
          <button class="tab-btn" class:activo={seccionActiva === 'inicio'} on:click={() => cambiarSeccion('inicio')}>
              <span class="txt-tab">Panel de control</span>
          </button>

          <button class="tab-btn" class:activo={seccionActiva === 'info_evento'} on:click={() => cambiarSeccion('info_evento')}>
              <span class="txt-tab">Información de la asamblea</span>
          </button>

          <button class="tab-btn" class:activo={seccionActiva === 'comite'} on:click={() => cambiarSeccion('comite')}>
              <span class="txt-tab">Responsabilidades</span>
          </button>

          <button class="tab-btn" class:activo={seccionActiva === 'programa'} on:click={() => cambiarSeccion('programa')}>
              <span class="txt-tab">Programa</span>
          </button>

          <button class="tab-btn" class:activo={seccionActiva === 'ensayos'} on:click={() => cambiarSeccion('ensayos')}>
              <span class="txt-tab">Ensayos</span>
          </button>

          <button class="tab-btn" class:activo={seccionActiva === 'oficina'} on:click={() => cambiarSeccion('oficina')}>
              <span class="txt-tab">Oficina</span>
          </button>

          <div class="tab-mas-container">
              <button class="tab-btn btn-mas" 
                      class:activo={['congregaciones', 'personas'].includes(seccionActiva)} 
                      on:click|stopPropagation={() => mostrarMenuMas = !mostrarMenuMas}>
                  <span class="txt-tab">Más</span> <ChevronDown size={14} />
              </button>

              {#if mostrarMenuMas}
                  <div class="dropdown-mas" on:click|stopPropagation>
                      <button class="dropdown-item" class:activo={seccionActiva === 'congregaciones'} on:click={() => cambiarSeccion('congregaciones')}>
                          Congregaciones
                      </button>
                      <button class="dropdown-item" class:activo={seccionActiva === 'personas'} on:click={() => cambiarSeccion('personas')}>
                          Personas
                      </button>
                  </div>
              {/if}
          </div>
      </div>

      <div class="nav-der">
          <a href="/" class="btn-salir" title="Salir al Inicio">
              <ArrowLeft size={16} /> <span class="txt-salir">Salir</span>
          </a>
      </div>
  </nav>

  <main class="contenido">
    <div class="area-trabajo">
      {#if seccionActiva === 'inicio'} <Resumen /> {/if}
      {#if seccionActiva === 'info_evento'} <InfoEvento /> {/if}
      {#if seccionActiva === 'congregaciones'} <Congregaciones /> {/if}
      {#if seccionActiva === 'personas'} <Personas /> {/if}
      {#if seccionActiva === 'comite'} <Comite /> {/if}
      {#if seccionActiva === 'programa'} <Programa /> {/if}
      {#if seccionActiva === 'oficina'} <Oficina /> {/if}
      {#if seccionActiva === 'vista_programa'} <VistaPrograma /> {/if}
      {#if seccionActiva === 'ensayos'} <Ensayos /> {/if} 
      {#if seccionActiva === 'oficina'} <Oficina /> {/if}
      {#if seccionActiva === 'registro_oradores'} <RegistroOradores /> {/if}
      {#if seccionActiva === 'lista_oradores'} <ListaOradores /> {/if}
    </div>
  </main>

</div>

<style>
  /* ========================================================
     VARIABLES GLOBALES Y RESET
     ======================================================== */
  :global(body) { 
      margin: 0; 
      font-family: 'Segoe UI', sans-serif; 
      overflow: hidden; 
  }
  
  .layout-gestion { 
      display: flex; 
      flex-direction: column; /* Cambiamos a columna para el nav superior */
      height: 100vh; 
      width: 100vw;
      background-color: var(--bg-body); 
      color: var(--text-main);          
  }

  /* ========================================================
     TOP NAV (BARRA SUPERIOR)
     ======================================================== */
  /* ========================================================
     TOP NAV (BARRA SUPERIOR FIJA)
     ======================================================== */
  .top-nav {
      position: sticky; /* 👈 ESTO MANTIENE LA BARRA PEGADA ARRIBA */
      top: 0;           /* 👈 EXACTAMENTE EN EL BORDE SUPERIOR */
      z-index: 1000;    /* 👈 Z-INDEX ALTO PARA QUE NADA LE PASE POR ENCIMA */
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: var(--bg-card);
      border-bottom: 1px solid var(--border);
      padding: 0 20px;
      height: 60px;
      flex-shrink: 0;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05); /* Le di una sombra un poquito más visible */
  }

  /* --- SECCIÓN IZQUIERDA (Logo) --- */
  .nav-izq { 
      width: 220px;     /* 👈 Ancho fijo para hacer de contrapeso */
      flex-shrink: 0;   /* 👈 Evita que se encoja y aplaste las pestañas */
      display: flex; 
      align-items: center; 
      justify-content: flex-start;
  }
  
  .texto-logo { display: flex; flex-direction: column; }
  .texto-logo h3 { margin: 0; color: var(--primary); font-weight: 800; font-size: 1rem; }
  .subtitulo { font-size: 11px; color: var(--text-sec); opacity: 0.8; margin-top: 2px; }

  /* --- SECCIÓN CENTRAL (Pestañas) --- */
  .nav-centro {
      flex: 1; /* 👈 Toma todo el espacio sobrante en el medio */
      display: flex;
      align-items: center;
      gap: 5px;
      height: 100%;
      justify-content: center; /* 👈 Centrado perfecto garantizado */
      overflow-x: auto;            
      white-space: nowrap;         
      -webkit-overflow-scrolling: touch; 
      scrollbar-width: none;       
  }
  
  /* Oculta barra de scroll en Chrome/Safari/Edge */
  .nav-centro::-webkit-scrollbar {
      display: none; 
  }

  .tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: transparent;
      border: none;
      color: var(--text-sec);
      font-size: 14px;
      font-weight: 500;
      height: 100%;
      padding: 0 15px;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      transition: all 0.2s ease;
      white-space: nowrap;
  }

  .tab-btn:hover { 
      color: var(--text-main); 
      background: rgba(0,0,0,0.02); 
  }

  .tab-btn.activo {
      color: var(--primary);
      border-bottom-color: var(--primary);
      font-weight: 600;
      background: rgba(40, 110, 180, 0.05);
  }

  /* --- CONTENEDOR DROPDOWN "MÁS" --- */
  .tab-mas-container { 
      position: relative; 
      height: 100%; 
  }

  .btn-mas { 
      padding-right: 10px; 
  }

 .dropdown-mas {
      position: fixed; /* 👈 CAMBIADO de absolute a fixed */
      top: 60px;       /* 👈 Justo debajo de la barra */
      left: 50%;
      transform: translateX(-50%);
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
      min-width: 200px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 9999; 
  }

  .dropdown-item {
      display: flex; 
      align-items: center; 
      gap: 12px;
      background: transparent; 
      border: none; 
      width: 100%;
      text-align: left; 
      padding: 10px 12px; 
      font-size: 14px;
      color: #4b5563; 
      border-radius: 6px; 
      cursor: pointer; 
      transition: background 0.2s;
  }
  .dropdown-item:hover { 
      background: #f3f4f6; 
      color: #111827; 
  }
  .dropdown-item.activo { 
      background: rgba(40, 110, 180, 0.08); 
      color: #286eb4; 
      font-weight: 600; 
  }

  /* --- SECCIÓN DERECHA (Salir) --- */
  .nav-der { 
      width: 220px;     /* 👈 Mismo ancho exacto que la izquierda */
      flex-shrink: 0;
      display: flex; 
      align-items: center; 
      justify-content: flex-end; 
  }

  .btn-salir {
      display: flex; 
      align-items: center; 
      gap: 8px;
      background: transparent; 
      border: 1px solid var(--border);
      color: var(--text-sec); 
      padding: 8px 16px;
      border-radius: 8px; 
      font-size: 13px; 
      font-weight: 600;
      text-decoration: none; 
      transition: all 0.2s;
  }
  .btn-salir:hover {
      background: rgba(239, 68, 68, 0.08);
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.3);
  }

  /* ========================================================
     CONTENIDO PRINCIPAL
     ======================================================== */
  .contenido { 
      flex: 1; 
      display: flex; 
      flex-direction: column; 
      background-color: var(--bg-body); 
      overflow: hidden; 
  }
  
  .area-trabajo { 
      padding: 0; /* Quité el padding global para que los componentes lo manejen a su gusto (ej. Comite.svelte ya tiene sus márgenes) */
      flex: 1; 
      overflow-y: auto; 
  }

/* =========================================================
     DISEÑO RESPONSIVO (PANTALLAS PEQUEÑAS)
     ========================================================= */
  @media (max-width: 950px) {
      .top-nav { padding: 0 10px; }
      .nav-izq { display: none; } 
      
      .nav-centro {
          justify-content: flex-start; /* 👈 Solo en móviles se va a la izquierda */
      }
      
      .nav-der { width: auto; } /* 👈 Le quitamos el ancho fijo al botón de salir */
      .txt-salir { display: none; } 
      .btn-salir { padding: 8px; }
  }
</style>