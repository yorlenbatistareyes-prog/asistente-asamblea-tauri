<script lang="ts">
  import { onMount } from 'svelte';
  import { DB } from '$lib/services/db';
  import { goto } from '$app/navigation';
  import { ask } from "@tauri-apps/plugin-dialog";
  import { appStore, vistaActual } from '$lib/stores/appStore';
  import Configuracion from '$lib/components/gestion/Configuracion.svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  import { MapPin, Plus, Calendar, Trash2, Lectern, X, Globe, Search, User, Upload, Clock } from 'lucide-svelte';
  import CalendarioRango from '$lib/components/ui/CalendarioRango.svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  // DATOS
  let listaAsambleas: any[] = [];
  let mostrarModal = false;
  let editandoFecha = false;

  let form = { 
    tema: "", 
    fechaInicio: null as Date | null, 
    fechaFin: null as Date | null, 
    identificador: "", 
    idioma: "Español",
    // 👇 NUEVOS CAMPOS DE UBICACIÓN
    ciudad: "",
    lugar_nombre: "",
    pais: "",
    direccion: ""
  };

// ESTADOS DE BÚSQUEDA Y FILTRO
  let terminoBusqueda = "";
  let filtroCategoria = "todas"; 
  let ordenamiento = "fecha_desc";

  // --- VARIABLES DEL USUARIO Y RELOJ ---
  let horaActual = "";
  let saludo = "Hola"; 
  let nombreUsuario = "Usuario";
  let fotoUsuario = ""; 
  let mostrarMenuAvatar = false; 
  let fileInput: HTMLInputElement;

  async function cargarNombreUsuario() {
      try {
          const res: any = await invoke('obtener_configuracion_general');
          
          if (!res) return;

          // 1. Si Rust devuelve los datos como texto (String), los convertimos a Objeto
          const config = typeof res === 'string' ? JSON.parse(res) : res;

          // 2. Buscamos el nombre cubriendo todas las variables posibles
          const nombre = config.nombre || config.Nombre || (config.config && config.config.nombre);
          
          if (nombre && nombre.trim() !== "") {
              nombreUsuario = nombre;
          } else if ($appStore && $appStore.usuario && $appStore.usuario !== "Usuario") {
              // 3. Respaldo extra: Si Rust falla, intenta leer del Store global
              nombreUsuario = $appStore.usuario;
          }
      } catch (e) { 
          console.error("Error al pedir el usuario a Rust:", e); 
      }
  }

  function iniciarReloj() { actualizarTiempo(); setInterval(actualizarTiempo, 1000); }
    
  function actualizarTiempo() {
      const ahora = new Date();
      horaActual = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
      const h = ahora.getHours(); 
      saludo = h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
  }

  function manejarCambioFoto(event: Event) {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files.length > 0) {
          const reader = new FileReader();
          reader.onload = (e) => {
              fotoUsuario = e.target?.result as string; 
              localStorage.setItem('fotoPerfil', fotoUsuario); 
          };
          reader.readAsDataURL(input.files[0]); 
      }
  }

  function quitarFoto() {
      fotoUsuario = ""; localStorage.removeItem('fotoPerfil'); 
      if (fileInput) fileInput.value = ""; 
      mostrarMenuAvatar = false; 
  }

  // Función única corregida (Elimina cualquier otra versión de abrirModal)
  async function abrirModal() {
      await cargarTodo();
      // 👇 Añadimos los campos vacíos de ciudad, lugar_nombre, pais y direccion
      form = { tema: "", fechaInicio: null, fechaFin: null, identificador: "", idioma: "Español", ciudad: "", lugar_nombre: "", pais: "", direccion: "" };
      editandoFecha = false; 
      mostrarModal = true;
  }

function manejarSeleccionFinal() {
      editandoFecha = false;
  }

  function formatearRangoSimple(inicio: Date | null, fin: Date | null): string {
    if (!inicio || !fin) return "Seleccionar fechas...";
    const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${inicio.toLocaleDateString('es-ES', opciones)} - ${fin.toLocaleDateString('es-ES', opciones)}, ${inicio.getFullYear()}`;
  }

// Carga inicial
  onMount(() => { 
      cargarTodo(); 
      cargarNombreUsuario();
      fotoUsuario = localStorage.getItem('fotoPerfil') || "";
      iniciarReloj(); 
  });
  
  $: if ($vistaActual === 'inicio') { cargarTodo(); }
  $: if ($appStore) { cargarNombreUsuario(); } // Recarga el nombre si hay cambios globales

  async function cargarTodo() {
      try {
          // 👈 Ahora solo pedimos las asambleas, sin los locales
          const a = await DB.obtenerAsambleas();
          listaAsambleas = a as any[]; 
      } catch(e) { console.error(e); }
  }

  // --- TRADUCTOR DE FECHAS A PRUEBA DE RANGOS (TypeScript) ---
  function obtenerTiempoSeguro(fechaStr: string, usarFin: boolean = false): number {
      if (!fechaStr) return 0;
      
      // 1. Separamos el rango si tiene el formato "YYYY-MM-DD a YYYY-MM-DD"
      const partesFecha = fechaStr.split(' a ');
      
      // 2. Elegimos qué parte usar (Inicio por defecto, Fin si lo pedimos y existe)
      let fechaObjetivo = partesFecha[0];
      if (usarFin && partesFecha.length > 1) {
          fechaObjetivo = partesFecha[1];
      }
      
      fechaObjetivo = fechaObjetivo.trim();

      // 3. Descomponemos para forzar hora LOCAL y evitar desfases
      const partes = fechaObjetivo.split(/[\/\-]/);
      if (partes.length === 3) {
          let y: number, m: number, d: number;
          if (partes[0].length === 4) {
              y = parseInt(partes[0], 10);
              m = parseInt(partes[1], 10) - 1;
              d = parseInt(partes[2], 10);
          } else {
              d = parseInt(partes[0], 10);
              m = parseInt(partes[1], 10) - 1;
              y = parseInt(partes[2], 10);
              if (y < 2000) y += 2000;
          }
          return new Date(y, m, d).getTime();
      }
      
      let t = new Date(fechaObjetivo).getTime();
      return isNaN(t) ? 0 : t;
  }

  // LÓGICA REACTIVA: Filtra y ordena las asambleas
  $: asambleasFiltradas = listaAsambleas
      .filter((a: any) => {
          // 1. FILTRO DE CATEGORÍA ("activas")
          if (filtroCategoria === 'activas') {
              if (!a.fecha) return false;

              // Para saber si está activa, comprobamos su fecha de FIN
              const timeFinAsamblea = obtenerTiempoSeguro(a.fecha, true); 
              
              if (timeFinAsamblea > 0) {
                  const hoy = new Date();
                  hoy.setHours(0, 0, 0, 0); 
                  const tiempoHoy = hoy.getTime();

                  // Si la fecha de fin ya pasó, la ocultamos
                  if (timeFinAsamblea < tiempoHoy) return false;
              } else {
                  return false;
              }
          }

          // 2. FILTRO DE TEXTO (Buscador)
          if (!terminoBusqueda) return true;
          const tb = terminoBusqueda.toLowerCase();
          return (
              (a.tema && a.tema.toLowerCase().includes(tb)) ||
              (a.fecha && a.fecha.toLowerCase().includes(tb)) ||
              (a.identificador && a.identificador.toLowerCase().includes(tb))
          );
      })
      .sort((a: any, b: any) => {
          // Para ORDENAR, usamos siempre la fecha de INICIO
          const timeA = obtenerTiempoSeguro(a.fecha, false);
          const timeB = obtenerTiempoSeguro(b.fecha, false);

          if (ordenamiento === 'fecha_desc') return timeB - timeA;
          if (ordenamiento === 'fecha_asc') return timeA - timeB;
          if (ordenamiento === 'tema_az') return (a.tema || "").localeCompare(b.tema || "");
          
          if (ordenamiento === 'proximas') {
              if (timeA === 0) return 1;
              if (timeB === 0) return -1;
              
              const hoy = new Date();
              hoy.setHours(0, 0, 0, 0);
              const tiempoHoy = hoy.getTime();

              // Usamos el fin para saber de qué lado de "hoy" están
              const finA = obtenerTiempoSeguro(a.fecha, true);
              const finB = obtenerTiempoSeguro(b.fecha, true);

              const aEsActiva = finA >= tiempoHoy;
              const bEsActiva = finB >= tiempoHoy;

              if (aEsActiva && !bEsActiva) return -1; // Futuras/Activas van primero
              if (!aEsActiva && bEsActiva) return 1;

              if (aEsActiva && bEsActiva) {
                  // Ambas son futuras: la más cercana a hoy va primero
                  return timeA - timeB; 
              } else {
                  // Ambas son pasadas: la que pasó más recientemente va primero
                  return timeB - timeA; 
              }
          }
          return 0;
      });


  async function crear() {
      try {
          if(!form.tema || !form.fechaInicio || !form.fechaFin) {
              alert("Debes escribir el tema y seleccionar el rango de fechas en el calendario.");
              return;
          }
          
          const y1 = form.fechaInicio.getFullYear();
          const m1 = String(form.fechaInicio.getMonth() + 1).padStart(2, '0');
          const d1 = String(form.fechaInicio.getDate()).padStart(2, '0');
          const fechaInicioStr = `${y1}-${m1}-${d1}`;

          const y2 = form.fechaFin.getFullYear();
          const m2 = String(form.fechaFin.getMonth() + 1).padStart(2, '0');
          const d2 = String(form.fechaFin.getDate()).padStart(2, '0');
          const fechaFinStr = `${y2}-${m2}-${d2}`;

          const fechaUnida = `${fechaInicioStr} a ${fechaFinStr}`;

          // Construimos el texto del lugar uniendo lo que el usuario escribió
          let nombreLugar = form.lugar_nombre || "Sin asignar";
          if (form.ciudad) nombreLugar += `, ${form.ciudad}`;

          // 👈 Usamos DB.crearAsamblea con los nuevos datos
          await DB.crearAsamblea({ 
              tema: form.tema,
              fecha: fechaUnida, 
              identificador: form.identificador,
              idioma: form.idioma,
              lugar: nombreLugar, 
              localId: null // Ya no usamos IDs
          });
          
          mostrarModal = false; 
          cargarTodo();
          
          // ¡Ya no necesitamos llamar a dispararSincronizacionLocal() aquí!

      } catch (error) {
          console.error("Error desde Rust:", error);
          alert("No se pudo crear la asamblea. Error: " + error);
      }
  }
  
  async function borrar(id: number, e: Event) {
      e.stopPropagation();
      const respuesta = await ask('¿Estás seguro de que deseas eliminar esta asamblea permanentemente?', { 
          title: 'Confirmar eliminación', kind: 'warning', okLabel: 'Eliminar', cancelLabel: 'Cancelar'
      });
      if(respuesta) { 
          // 👈 Usamos DB.eliminarAsamblea
          await DB.eliminarAsamblea(id); 
          cargarTodo(); 
      }
  }

  function gestionar(item: any) {
      localStorage.setItem('asambleaActiva', JSON.stringify(item));
      goto('/gestion');
  }

  function volverDeConfiguracion() {
  const rutaAnterior = localStorage.getItem('rutaAnterior');
  if (rutaAnterior) {
    localStorage.removeItem('rutaAnterior');
    goto(rutaAnterior);
  } else {
    vistaActual.set('inicio');
  }
}

</script>

{#if $vistaActual === 'inicio'}
    <div class="dashboard">

        <div class="bienvenida-jw">
            <input type="file" accept="image/*" style="display: none;" bind:this={fileInput} on:change={manejarCambioFoto} />

            <div class="perfil-jw" on:click|stopPropagation={() => mostrarMenuAvatar = !mostrarMenuAvatar}>
                <div class="avatar-jw">
                    {#if fotoUsuario}
                        <img src={fotoUsuario} alt="Perfil" class="foto-perfil-jw" />
                    {:else}
                        <User size={20} />
                    {/if}
                </div>
                <div class="saludo-jw">
                    {saludo}, <strong>{nombreUsuario}</strong>
                </div>

                {#if mostrarMenuAvatar}
                    <div class="dropdown-avatar" on:click|stopPropagation>
                        <button class="menu-item" on:click={() => { fileInput.click(); mostrarMenuAvatar = false; }}>
                            <Upload size={16} /> Cambiar foto
                        </button>
                        {#if fotoUsuario}
                            <div class="dropdown-separator"></div>
                            <button class="menu-item text-red" on:click={quitarFoto}>
                                <Trash2 size={16} /> Quitar foto
                            </button>
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="reloj-jw">
                <span>{horaActual}</span>
            </div>
        </div>


        <div class="header-principal">
            <div class="textos-header">
                <h2>Listas de asambleas</h2>
                <p class="subtitulo-header">Administrar todas las asambleas en un solo lugar.</p>
            </div>

            <button class="btn-new" on:click={abrirModal}><Plus size={18}/> Añadir Asamblea</button>
        </div>

        <div class="controles-busqueda">
            <div class="search-box">
                <Search size={18} class="icon-search"/>
                <input 
                    type="text" 
                    placeholder="Buscar asambleas por nombre, año, mes o tema..." 
                    bind:value={terminoBusqueda}>
            </div>
    
            <div class="filtros-box">
                <select class="filter-select" bind:value={filtroCategoria}>
                    <option value="todas">Todas las asambleas</option>
                    <option value="activas">Asambleas activas</option>
                </select>
        
                <select class="filter-select" bind:value={ordenamiento}>
                    <option value="proximas">Ordenar por próximas (Recomendado)</option>
                    <option value="fecha_desc">Fecha (De futuras a antiguas)</option>
                    <option value="fecha_asc">Fecha (De antiguas a futuras)</option>
                    <option value="tema_az">Ordenar por tema (A-Z)</option>
                </select>
            </div>
    </div>

{#if asambleasFiltradas.length === 0}
    <div class="empty">
        {#if terminoBusqueda}
            No se encontraron asambleas con la búsqueda "{terminoBusqueda}".
        {:else}
            No hay asambleas registradas. <button class="btn-empty" on:click={abrirModal}>Crear una</button>
        {/if}
    </div>
{:else}
    <div class="grid">
        {#each asambleasFiltradas as item}
            <Panel padding="0" clasesExtra="tarjeta-asamblea">
                <div class="card-header-integrated">
                    <span class="badge-pill">{item.identificador || '000'}</span>
                </div>

                <div class="card-content">
                    <div class="text-section">
                        <h3>"{item.tema}"</h3>
                        
                        <div class="info-line">
                            <MapPin size={16} class="ico-dark"/> 
                            <div class="info-col">
                                <b>{item.lugar || 'Sin asignar'}</b>
                                <span>Ubicación</span>
                            </div>
                        </div>

                        <div class="info-line">
                            <Calendar size={16} class="ico-dark"/> 
                            <div class="info-col">
                                <b>{item.fecha}</b>
                                <span>Fecha</span>
                            </div>
                        </div>

                        <div class="info-line">
                            <Globe size={16} class="ico-dark"/> 
                            <div class="info-col">
                                <b>{item.idioma || 'Español'}</b>
                                <span>Idioma</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="icon-section">
                        <Lectern size={78} strokeWidth={0.3} />
                    </div>
                </div>

                <div class="card-hover-footer">
                    <button class="btn-trash" on:click={(e)=>borrar(item.id, e)} title="Eliminar">
                        <Trash2 size={18}/>
                    </button>
                    <button class="btn-manage-blue" on:click={()=>gestionar(item)}>
                        Gestionar Asamblea &rarr;
                    </button>
                </div>
            </Panel>
        {/each}
    </div>
{/if}
        </div>

    {#if mostrarModal}
        <div class="modal-bg" on:click|self={()=>mostrarModal=false}>
            <Panel padding="25px" clasesExtra="modal-ancho">
                <div class="modal-head">
                    <h3>Nueva Asamblea</h3>
                    <button class="btn-close-text" on:click={() => mostrarModal = false}>
                        Cerrar
                    </button>
                </div>

                <div class="modal-form">
                    <div style="display: flex; gap: 15px;">
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                            <label>Identificador</label>
                            <input bind:value={form.identificador} placeholder="Ej: 2026-A">
                        </div>
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                            <label>Idioma</label>
                            <select bind:value={form.idioma}>
                                <option>Español</option>
                                <option>LSC</option>
                                <option>Inglés</option>
                                <option>Francés</option>
                            </select>
                        </div>
                    </div>
                    <label>Tema</label><input bind:value={form.tema} placeholder="Tema de la asamblea">
                    <div style="display: flex; flex-direction: column; gap: 8px;">
    <label>FECHAS DE LA ASAMBLEA (INICIO Y FIN)</label>
    
    {#if editandoFecha}
        <div class="contenedor-calendario-desplegado">
            <CalendarioRango 
                bind:fechaInicio={form.fechaInicio} 
                bind:fechaFin={form.fechaFin}
                on:seleccionar={manejarSeleccionFinal}
                on:cancelar={() => editandoFecha = false}
            />
        </div>
    {:else}
        <div class="campo-falso-input" on:click={() => editandoFecha = true} role="button" tabindex="0">
            <Calendar size={18} class="ico-azul"/>
            <span class={!form.fechaInicio ? 'placeholder' : ''}>
                {formatearRangoSimple(form.fechaInicio, form.fechaFin)}
            </span>
        </div>
    {/if}
</div>
                    <div class="ubicacion-card">
                        <h4 class="ubicacion-titulo">Detalles de la ubicación</h4>
                        
                        <div style="display: flex; gap: 15px; margin-bottom: 10px;">
                            <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                                <label>Ciudad</label>
                                <input bind:value={form.ciudad} placeholder="Ej: Holguín">
                            </div>
                            <div style="flex: 2; display: flex; flex-direction: column; gap: 5px;">
                                <label>Nombre del lugar</label>
                                <input bind:value={form.lugar_nombre} placeholder="Ej: Salón de Asambleas Holguín">
                            </div>
                        </div>

                        <div style="display: flex; gap: 15px;">
                            <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                                <label>País</label>
                                <input bind:value={form.pais} placeholder="Ej: Cuba">
                            </div>
                            <div style="flex: 2; display: flex; flex-direction: column; gap: 5px;">
                                <label>Dirección</label>
                                <input bind:value={form.direccion} placeholder="Dirección exacta">
                            </div>
                        </div>
                    </div>

                </div>

                <div class="modal-foot">
                    <button class="btn-sec" on:click={()=>mostrarModal=false}>Cancelar</button>
                    <button class="btn-pri" on:click={crear}>Crear</button>
                </div>
            </Panel>
        </div>
    {/if}

{:else}
    <Configuracion on:close={volverDeConfiguracion} />
{/if}

<style>
    /* ESTILOS GENERALES PÁGINA */
    .dashboard { padding: 10px 40px 30px 40px; }
    .action-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
    .action-bar h2 { margin: 0; font-size: 24px; font-weight: 800; color: var(--text-main); }
    /* BOTÓN NUEVA ASAMBLEA (Color Azul Unificado) */
    .btn-new { 
        background: var(--primary); 
        color: white; 
        border: none; 
        padding: 10px 20px; 
        border-radius: 8px; 
        font-weight: 600; 
        display: flex; 
        gap: 8px; 
        cursor: pointer; 
        transition: filter 0.2s; 
        box-shadow: var(--shadow-sm);
    }
    .btn-new:hover { filter: brightness(0.9); }

    /* Encabezado de la lista (ahora independiente) */
.list-header {
    font-size: 11px;
    font-weight: 800;
    color: var(--text-sec);
    text-transform: uppercase;
    margin-bottom: 20px;
    display: flex;
    gap: 8px;
    align-items: center;
}

/* Grid de tarjetas */
.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 25px;
}

/* Ajuste del mensaje vacío para que no tenga fondo extra */
.empty {
    text-align: center;
    color: var(--text-sec);
    padding: 40px;
    background: transparent; /* Asegura que no herede fondo */
    border: none;
    box-shadow: none;
}
    /* === TARJETA === */
   :global(.tarjeta-asamblea) { 
        border-top: 5px solid var(--primary) !important;
        display: flex; 
        flex-direction: column; 
        min-height: 220px;
        position: relative;
        transition: transform 0.3s ease, box-shadow 0.3s ease !important;
    }
    :global(.tarjeta-asamblea:hover) {
        transform: translateY(-6px);
        box-shadow: var(--shadow-premium) !important;
    }

    /* CABECERA */
    .card-header-integrated { 
        border-bottom: 1px solid var(--border);
        padding: 18px 20px; /* Aumentamos el padding para hacerla más ancha/alta */
        display: flex; 
        align-items: center;
        background-color: rgba(0, 0, 0, 0.06);
    }

    .badge-pill { 
        background: #1e40af; 
        color: white; 
        padding: 4px 12px; 
        border-radius: 20px; 
        font-size: 11px; 
        font-weight: 700; 
        letter-spacing: 0.5px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    /* CUERPO */
    .card-content { 
        padding: 25px; 
        flex: 1; 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        gap: 15px;
    }

    /* TEXTO NEGRO */
   .text-section { display: flex; flex-direction: column; gap: 15px; flex: 1; }
    .text-section h3 { margin: 0; font-size: 18px; font-weight: 800; line-height: 1.2; color: var(--text-main); }
    
    .info-line { display: flex; gap: 12px; align-items: flex-start; }
    .ico-dark { color: var(--primary); margin-top: 2px; } 
    .info-col { display: flex; flex-direction: column; }
    .info-col b { font-size: 14px; font-weight: 700; color: var(--text-main); } 
    .info-col span { font-size: 11px; color: var(--text-sec); font-weight: 600; }

    .icon-section {
        color: var(--primary); 
        opacity: 0.8; 
        display: flex;
        align-items: center;
        justify-content: center;
    }

  /* PIE */
    .card-hover-footer { 
        padding: 15px 20px; 
        display: flex; 
        gap: 12px; 
        background: var(--bg-body); 
        border-top: 1px solid var(--border);
        opacity: 0; 
        transform: translateY(10px);
        transition: all 0.3s ease;
    }
    :global(.tarjeta-asamblea:hover) .card-hover-footer { opacity: 1; transform: translateY(0); }

    /* BOTONES */
    .btn-trash { 
        background: #fee2e2; color: #ef4444; border: 1px solid #fecaca; width: 44px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;
    }
    .btn-trash:hover { background: #ef4444; color: white; }

    .btn-manage-blue { 
        flex: 1; background: #1e40af; color: white; border: none; padding: 10px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; transition: transform 0.2s, background 0.2s; box-shadow: 0 4px 10px rgba(30, 64, 175, 0.3);
    }
    .btn-manage-blue:hover { transform: scale(1.02); background: #1e3a8a; }

    /* MODAL */
    /* === MODAL CENTRADO PERFECTO === */
    .modal-bg { 
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.6); z-index: 9999; 
        display: flex; justify-content: center; 
        align-items: center; /* 👈 Esto lo baja y lo centra verticalmente */
        padding: 20px;
        backdrop-filter: blur(2px); 
    }
    
    :global(.modal-ancho) { 
        width: 720px !important; 
        max-width: 95vw; 
        max-height: 90vh; /* 👈 Evita que sea más alto que tu pantalla */
        overflow-y: auto; /* 👈 Agrega barra de scroll interna si la pantalla es bajita */
        display: flex; flex-direction: column; gap: 10px; 
    }
    
    .modal-form { display: flex; flex-direction: column; gap: 10px; }
    .modal-form input, select { padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text-main); }
    .modal-form label { font-size: 11px; font-weight: 700; color: var(--text-sec); text-transform: uppercase; }
    .modal-foot { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
    .btn-pri { background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
    .btn-sec { background: transparent; border: 1px solid var(--border); padding: 8px 16px; border-radius: 6px; cursor: pointer; color: var(--text-sec); }

  .modal-head { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; /* <--- ESTO ES LA CLAVE. Evita que el botón se estire a lo alto */
    margin-bottom: 20px; 
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
}
    /* Botón Cerrar: Rectángulo pequeño y ajustado al texto */
/* Botón Cerrar: Pequeño y ajustado */
.btn-close-text {
    /* FORZAR TAMAÑO */
    width: fit-content !important;  /* Solo el ancho del texto */
    height: auto !important;        /* Altura automática */
    padding: 4px 8px !important;    /* Relleno muy pequeño */
    margin: 0 !important;
    
    /* ESTÉTICA */
    background: transparent;
    border: 1px solid transparent;  /* Borde invisible */
    border-radius: 4px;
    
    /* TEXTO */
    color: var(--text-sec);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-close-text:hover {
    background: #f1f5f9;            /* Fondo gris muy claro */
    border-color: #cbd5e1;          /* Borde gris visible */
    color: #0f172a;                 /* Texto oscuro */
}

/* --- NUEVOS ESTILOS HEADER Y BUSCADOR --- */
.header-principal { 
    display: flex; 
    justify-content: space-between; 
    align-items: flex-start; 
    margin-bottom: 20px;
}
.textos-header h2 { 
    margin: 0; 
    font-size: 26px; 
    font-weight: 800; 
    color: var(--text-main); 
}
.subtitulo-header {
    margin: 4px 0 0 0;
    font-size: 14px;
    color: var(--text-sec);
}

.controles-busqueda {
    display: flex;
    gap: 18px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 30px;
}

.search-box {
    flex: 1;
    min-width: 280px;
    display: flex;
    align-items: center;

    background: var(--bg-card);
    border-radius: 14px;
    padding: 0 16px;

    /* 👇 LEVANTADO REAL */
    border: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow:
        0 6px 12px rgba(0,0,0,0.06),
        0 1px 2px rgba(0,0,0,0.08);

    transition: all 0.15s ease;
}

.search-box:focus-within {
    transform: translateY(-1px);
    box-shadow:
        0 10px 18px rgba(0,0,0,0.08),
        0 2px 4px rgba(0,0,0,0.1);
}

.icon-search { color: var(--text-sec); }
.search-box input {
    width: 100%;
    border: none;
    background: transparent;
    padding: 12px 10px;
    font-size: 14px;
    color: var(--text-main);
    outline: none;
}

.filtros-box { display: flex; gap: 10px; }

.filter-select {
    padding: 12px 16px;
    border-radius: 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;

    background: var(--bg-card);
    color: var(--text-main);

    /* 👇 MISMO LEVANTADO NÍTIDO */
    border: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow:
        0 6px 12px rgba(0,0,0,0.06),
        0 1px 2px rgba(0,0,0,0.08);

    transition: all 0.15s ease;
}

.filter-select:hover {
    transform: translateY(-1px);
    box-shadow:
        0 10px 18px rgba(0,0,0,0.08),
        0 2px 4px rgba(0,0,0,0.1);
}

.filter-select:focus {
    outline: none;
    border-color: rgba(30,64,175,0.35);
}

.btn-empty { background: transparent; border: none; color: #1e40af; font-weight: bold; cursor: pointer; text-decoration: underline; font-size: 15px; padding: 0;}

.campo-fecha-finalizada {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 15px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        cursor: pointer;
        transition: border-color 0.2s;
    }
    .campo-fecha-finalizada:hover {
        border-color: #3b82f6;
    }
    .campo-fecha-finalizada span {
        flex: 1;
        font-weight: 600;
        color: #1e293b;
        font-size: 14px;
    }
    .btn-editar-fecha {
        background: #eff6ff;
        color: #2563eb;
        border: none;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
    }
    .ico-azul { color: #2563eb; }

    .campo-selector-fecha {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 15px;
        background: var(--input-bg, #ffffff);
        border: 1px solid var(--border, #cbd5e1);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .campo-selector-fecha:hover {
        border-color: var(--primary, #3b82f6);
        background: #f8fafc;
    }

    .campo-selector-fecha span {
        flex: 1;
        font-size: 14px;
        color: var(--text-main, #1e293b);
        font-weight: 500;
    }

    .campo-selector-fecha .placeholder {
        color: #94a3b8;
    }

    .contenedor-calendario-flotante {
        display: flex;
        flex-direction: column;
        gap: 10px;
        animation: slideDown 0.2s ease-out;
    }

    .btn-cancelar-flotante {
        align-self: flex-end;
        background: transparent;
        border: none;
        color: #64748b;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
    }

    .ico-azul { color: #2563eb; }
    .ico-search-fecha { color: #94a3b8; }

    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }

.campo-falso-input {
        background: #ffffff;
        border: 1px solid #d1d5db; /* Gris de tus otros inputs */
        border-radius: 6px;
        padding: 10px 15px;
        height: 42px; /* Altura estándar de tus campos */
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .campo-falso-input:hover {
        border-color: #3b82f6; /* Azul al pasar el ratón */
        background: #f9fafb;
    }

    .campo-falso-input span {
        flex: 1;
        font-size: 14px;
        color: #1e293b;
        font-weight: 500;
    }

    .campo-falso-input .placeholder {
        color: #94a3b8; /* Gris estilo placeholder */
    }

    .ico-azul { color: #2563eb; }

    .contenedor-calendario-desplegado {
        animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
    }

   /* =========================================================
   DISEÑO RESPONSIVO (PANTALLA DE INICIO: WINDOWS + ANDROID)
   ========================================================= */

@media (max-width: 768px) {
    /* 1. MÁRGENES GENERALES MÁS COMPACTOS */
    .dashboard { padding: 5px 15px 15px 15px; }

    /* 2. CABECERA: APILAR TÍTULO Y BOTÓN */
    .header-principal {
        flex-direction: column;
        gap: 15px;
    }
    
    .btn-new {
        width: 100%; /* Botón gigante fácil de tocar */
        justify-content: center;
        height: 48px;
    }

    /* 3. BUSCADOR Y FILTROS: APILADO TOTAL ANTIDESBORDES (¡AQUÍ ESTÁ LA MAGIA!) */
    .controles-busqueda {
        flex-direction: column;
        align-items: stretch;
        gap: 15px;
        width: 100%;
    }
    
    .filtros-box {
        flex-direction: column; /* Apilamos los selectores */
        width: 100%;
        gap: 12px;
    }

    .search-box {
        min-width: 0 !important; /* Matamos los 280px fijos que rompían el teléfono */
        width: 100%;
        height: 48px;
    }

    .filter-select {
        width: 100%; /* Que ocupen exactamente el ancho disponible */
        max-width: 100%;
        height: 48px;
        text-overflow: ellipsis; /* Si el texto es largo, pone "..." */
    }

    /* 4. LA CUADRÍCULA DE TARJETAS (ARREGLO DEL "DESASTRE") */
    .grid {
        grid-template-columns: 1fr; /* 1 sola columna que ocupa el 100% de la pantalla */
        gap: 15px;
    }

    /* 5. AJUSTES DENTRO DE LA TARJETA */
    .card-content {
        padding: 15px;
    }
    
    .text-section h3 {
        font-size: 16px; /* Título un pelín más pequeño */
    }
    
    .icon-section {
        display: none; /* Ocultamos el icono del atril gigante en móviles */
    }

    /* 6. BOTONES INFERIORES SIEMPRE VISIBLES (Sin necesidad de Hover) */
    .card-hover-footer {
        opacity: 1 !important; /* Siempre visibles en el teléfono */
        transform: translateY(0) !important;
        padding: 12px 15px;
    }
    
    .btn-trash {
        min-width: 48px;
        min-height: 48px; /* Botón de papelera seguro de tocar */
    }
    
    .btn-manage-blue {
        min-height: 48px;
    }

    /* 7. MODAL DE NUEVA ASAMBLEA ADAPTADO AL TELÉFONO */
    :global(.modal-ancho) {
        width: 95vw !important; 
        max-height: 85vh !important; /* 👈 Evita que se encaje, dejando aire arriba y abajo */
        overflow-y: auto !important; /* 👈 Activa el scroll interno si la pantalla es muy pequeña */
        padding: 15px !important;
    }

    /* Hacemos que TODOS los campos (incluyendo los de ubicación) se apilen hacia abajo */
    .modal-form div[style*="display: flex"] {
        flex-direction: column !important;
        gap: 10px !important;
    }

    .modal-foot {
        flex-direction: column-reverse; /* El botón de crear arriba, cancelar abajo */
        gap: 10px;
    }
    
    .btn-pri, .btn-sec {
        width: 100%;
        height: 48px;
    }
}

/* === ESTILOS DEL PANEL DE BIENVENIDA === */
    .bienvenida-jw {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 15px; /* 👈 Antes 35px o 40px, ahora 15px para acercar las listas */
        margin-top: 0px;     /* 👈 Pegado arriba */
        position: relative;
    }

    .perfil-jw {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        cursor: pointer;
        padding: 6px 16px;
        border-radius: 30px;
        transition: background 0.2s;
    }
    .perfil-jw:hover { background: rgba(0,0,0,0.04); }

    .avatar-jw {
        width: 32px;
        height: 32px;
        background: var(--primary);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .foto-perfil-jw { width: 100%; height: 100%; object-fit: cover; }

    .saludo-jw {
        font-size: 18px;
        color: var(--text-main);
    }
    .saludo-jw strong { font-weight: 700; }

    .reloj-jw {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-main);
        font-size: 15px;
        margin-top: -10px; /* 👈 El truco está aquí: un valor negativo lo pega al saludo */
        font-weight: 900; 
    }

    /* Menú desplegable */
    .dropdown-avatar {
        position: absolute;
        top: 45px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        min-width: 160px;
        z-index: 100;
        display: flex; flex-direction: column;
    }
    .menu-item {
        padding: 12px 15px; background: none; border: none;
        display: flex; align-items: center; gap: 10px;
        font-size: 13px; font-weight: 500; color: var(--text-main);
        cursor: pointer; transition: background 0.2s; text-align: left;
    }
    .menu-item:hover { background: rgba(0,0,0,0.05); }
    .menu-item.text-red { color: #ef4444; }
    .dropdown-separator { height: 1px; background: var(--border); margin: 0; }

    /* === TARJETA DE UBICACIÓN EN EL MODAL === */
    .ubicacion-card {
        background: #f8fafc;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 15px 18px;
        margin-top: 5px;
    }
    
    .ubicacion-titulo {
        margin: 0 0 15px 0;
        font-size: 12px;
        color: var(--text-sec);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    /* Soporte para modo oscuro (opcional) */
    :global(.dark-theme) .ubicacion-card {
        background: rgba(255,255,255,0.02);
    }

</style>