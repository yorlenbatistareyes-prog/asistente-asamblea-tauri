<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { goto } from '$app/navigation';
  import { ask } from "@tauri-apps/plugin-dialog";
  import { vistaActual } from '$lib/stores/appStore';
  import Configuracion from '$lib/components/gestion/Configuracion.svelte';
  import { Plus, Calendar, Trash2, Lectern, X, Building, Globe } from 'lucide-svelte';

  // DATOS
  let listaAsambleas: any[] = [];
  let listaLocales: any[] = [];
  let mostrarModal = false;
  let form = { tema: "", fecha: "", local_id: null, identificador: "", idioma: "Español" };

  onMount(() => { cargarTodo(); });

  async function cargarTodo() {
      try {
          const [a, l] = await Promise.all([invoke('obtener_asambleas'), invoke('obtener_locales')]);
          listaAsambleas = a as any[]; listaLocales = l as any[];
      } catch(e) { console.error(e); }
  }

  function abrirModal() {
      form = { tema: "", fecha: "", local_id: null, identificador: "", idioma: "Español" };
      mostrarModal = true;
  }

  async function crear() {
      if(!form.tema) return; // Validación mínima
      
      // 1. Valores por defecto
      let nombreLugar = "Sin asignar";
      let idFinal = null;

      // 2. Lógica de búsqueda segura
      if(form.local_id) {
          // Convertimos a número para asegurar que la búsqueda funcione
          const idBuscado = Number(form.local_id);
          
          // Buscamos el salón en la lista comparando números
          const loc = listaLocales.find((x:any) => x.id === idBuscado);
          
          if(loc) { 
              // Si existe, armamos el texto: "Nombre, Ciudad"
              nombreLugar = loc.nombre; 
              if (loc.ciudad) {
                  nombreLugar += `, ${loc.ciudad}`;
              }
              idFinal = idBuscado; 
          }
      }

      // 3. Enviar al Backend (asegurando que mandamos 'lugar' con el texto correcto)
      await invoke('crear_asamblea', { 
          ...form, 
          lugar: nombreLugar, 
          localId: idFinal 
      });
      
      mostrarModal = false; 
      cargarTodo();
  }

  async function borrar(id: number, e: Event) {
      e.stopPropagation();
      const respuesta = await ask('¿Estás seguro de que deseas eliminar esta asamblea permanentemente?', { 
          title: 'Confirmar eliminación', kind: 'warning', okLabel: 'Eliminar', cancelLabel: 'Cancelar'
      });
      if(respuesta) { await invoke('eliminar_asamblea', { id }); cargarTodo(); }
  }

  function gestionar(item: any) {
      localStorage.setItem('asambleaActiva', JSON.stringify(item));
      goto('/gestion');
  }

  // ESTA FUNCIÓN ES LA CLAVE PARA QUE SALGA EL NOMBRE
  function obtenerNombreLugar(idLocal: any) {
      if (!idLocal) return "Sin asignar";
      
      // Buscamos en la lista de locales (convertimos a texto para asegurar coincidencia)
      const local = listaLocales.find((l: any) => l.id == idLocal);
      
      if (local) {
          // Si tiene ciudad, mostramos "Nombre, Ciudad"
          if (local.ciudad && local.ciudad.trim() !== "") {
              return `${local.nombre}, ${local.ciudad}`;
          }
          return local.nombre;
      }
      return "Salón no encontrado"; // Opcional: podrías poner "Sin asignar" también aquí
  }
</script>

{#if $vistaActual === 'inicio'}
    <div class="dashboard">
        <div class="action-bar">
            <h2>Mis Asambleas</h2>
            <button class="btn-new" on:click={abrirModal}><Plus size={18}/> Nueva Asamblea</button>
        </div>

        <div class="list-container">
            <div class="list-header"><Lectern size={20}/> ASAMBLEAS REGISTRADAS</div>
            
            {#if listaAsambleas.length === 0}
                <div class="empty">No hay asambleas. <button on:click={abrirModal}>Crear una</button></div>
            {:else}
                <div class="grid">
                    {#each listaAsambleas as item}
                        <div class="card-blue">
                            <div class="card-header-integrated">
                                <span class="badge-pill">{item.identificador || '000'}</span>
                            </div>

                            <div class="card-content">
                                <div class="text-section">
                                    <h3>"{item.tema}"</h3>
                                    
                                    <div class="info-line">
                                        <Building size={16} class="ico-dark"/> 
                                        <div class="info-col">
                                            <b>{obtenerNombreLugar(item.local_id)}</b>
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
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>

    {#if mostrarModal}
        <div class="modal-bg" on:click|self={()=>mostrarModal=false}>
            <div class="modal">
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
                    <label>Fecha</label><input bind:value={form.fecha} placeholder="Fecha">
                    <label>Lugar</label>
                    <select bind:value={form.local_id}>
                        <option value={null}>-- Seleccionar --</option>
                        {#each listaLocales as l}<option value={l.id}>{l.nombre}</option>{/each}
                    </select>
                </div>
                <div class="modal-foot">
                    <button class="btn-sec" on:click={()=>mostrarModal=false}>Cancelar</button>
                    <button class="btn-pri" on:click={crear}>Crear</button>
                </div>
            </div>
        </div>
    {/if}

{:else}
    <Configuracion on:close={() => vistaActual.set('inicio')} />
{/if}

<style>
    /* ESTILOS GENERALES PÁGINA */
    .dashboard { padding: 30px 40px; }
    .action-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
    .action-bar h2 { margin: 0; font-size: 24px; font-weight: 800; color: var(--text-main); }
    /* BOTÓN NUEVA ASAMBLEA (Color Azul Unificado) */
    .btn-new { 
        background: #1e40af; /* Mismo azul que la etiqueta */
        color: white; 
        border: none; 
        padding: 10px 20px; 
        border-radius: 8px; 
        font-weight: 600; 
        display: flex; 
        gap: 8px; 
        cursor: pointer; 
        transition: background 0.2s; 
        box-shadow: 0 4px 12px rgba(30, 64, 175, 0.25); /* Sombra azul suave */
    }
    .btn-new:hover { 
        background: #1e3a8a; /* Un azul un poco más oscuro al pasar el mouse */
    }
    
    .list-container { background: rgba(255,255,255,0.5); padding: 25px; border-radius: 16px; border: 1px solid var(--border-color); }
    .list-header { font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 20px; display: flex; gap: 8px; align-items: center; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 25px; }
    .empty { text-align: center; color: var(--text-secondary); padding: 40px; }

    /* === TARJETA === */
    .card-blue { 
        background: linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%);
        border-top: 5px solid #1e40af; 
        border-radius: 16px; 
        overflow: hidden; 
        box-shadow: 0 4px 15px rgba(0,0,0,0.05); 
        display: flex; 
        flex-direction: column; 
        transition: transform 0.2s, box-shadow 0.2s; 
        min-height: 220px;
        position: relative;
        border: 1px solid #bfdbfe;
    }
    .card-blue:hover { transform: translateY(-5px); box-shadow: 0 12px 30px rgba(37, 99, 235, 0.2); }

    /* CABECERA */
    .card-header-integrated { 
        border-bottom: 1px solid rgba(30, 58, 138, 0.1);
        padding: 12px 20px; 
        display: flex; 
        align-items: center;
        height: 24px;
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
    .text-section h3 { margin: 0; font-size: 18px; font-weight: 800; line-height: 1.2; color: #0f172a; }
    
    .info-line { display: flex; gap: 12px; align-items: flex-start; }
    .ico-dark { color: #1e3a8a; margin-top: 2px; } 
    .info-col { display: flex; flex-direction: column; }
    .info-col b { font-size: 14px; font-weight: 700; color: #1e293b; } 
    .info-col span { font-size: 11px; color: #475569; font-weight: 600; }

    /* ICONO GRANDE (SÓLIDO PERO FINO) */
    .icon-section {
        color: #1d4ed8; 
        opacity: 1; 
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
    }

    /* PIE */
    .card-hover-footer { 
        padding: 15px 20px; 
        display: flex; 
        gap: 12px; 
        background: rgba(255, 255, 255, 0.8);
        opacity: 0; 
        transform: translateY(10px);
        transition: all 0.3s ease;
        border-top: 1px solid rgba(0,0,0,0.05);
    }
    .card-blue:hover .card-hover-footer { opacity: 1; transform: translateY(0); }

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
    .modal-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(2px); }
    .modal { background: var(--bg-card); width: 400px; padding: 25px; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.4); border: 1px solid var(--border-color); }
    
    .modal-form { display: flex; flex-direction: column; gap: 10px; }
    .modal-form input, select { padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--input-bg); color: var(--text-main); }
    .modal-form label { font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; }
    .modal-foot { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
    .btn-pri { background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
    .btn-sec { background: transparent; border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 6px; cursor: pointer; color: var(--text-secondary); }

  .modal-head { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; /* <--- ESTO ES LA CLAVE. Evita que el botón se estire a lo alto */
    margin-bottom: 20px; 
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-color);
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
    color: var(--text-secondary);
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

</style>