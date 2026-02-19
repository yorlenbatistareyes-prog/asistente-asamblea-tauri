<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Users, Hash, Map, Plus, Save, Upload, Search, Trash2, X  } from 'lucide-svelte';
  import { open } from '@tauri-apps/plugin-dialog';

  // --- VARIABLES ---
  let asambleaId = 0; 
  
  let nombre = "";
  let circuito = "";
  let numero = "";
  
  interface Congregacion {
    id: number;
    nombre: string;
    circuito?: string;
    numero_congregacion?: string;
  }

  let mostrarModal = false;
  let lista: Congregacion[] = [];
  let terminoBusqueda = "";

  onMount(() => { 
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
        const asamblea = JSON.parse(datosGuardados);
        asambleaId = asamblea.id;
        cargar(); 
    } else {
        alert("⚠️ No hay asamblea seleccionada. Vuelve al inicio.");
    }
  });

  async function cargar() {
    try {
      lista = await invoke('obtener_congregaciones', { asambleaId });
    } catch (e) {
      console.error(e);
      alert("Error al cargar lista: " + e);
    }
  }

  // --- FILTRO REACTIVO ---
  $: listaFiltrada = lista.filter(c => {
    const t = terminoBusqueda.toLowerCase();
    const num = c.numero_congregacion || "";
    const circ = c.circuito || "";
    
    return (
      c.nombre.toLowerCase().includes(t) || 
      num.includes(t) ||
      circ.toLowerCase().includes(t)
    );
  });

  // --- GUARDAR MANUALMENTE ---
  async function guardar() {
    if (!nombre) return alert("Escribe el nombre");
    try {
      await invoke('crear_congregacion', { 
        asambleaId, nombre, circuito, numero 
      });
      
      nombre = ""; circuito = ""; numero = "";
      cargar();
    } catch (e) { alert("Error: " + e); }
  }

  // --- IMPORTAR CSV ---
  async function importarCongregaciones() {
    try {
      const archivo = await open({ multiple: false, filters: [{ name: 'CSV', extensions: ['csv'] }] });
      
      if (archivo) {
        const mensaje = await invoke('importar_congregaciones_csv', { 
            asambleaId, rutaArchivo: archivo 
        });
        alert(mensaje);
        cargar(); 
      }
    } catch (e) { alert("Error: " + e); }
  }

  // --- ELIMINAR ---
  async function eliminar(id: number, nombreCong: string) {
    if(!confirm(`¿Seguro que quieres eliminar "${nombreCong}"?`)) return;

    try {
      await invoke('eliminar_congregacion', { id });
      cargar(); 
    } catch (e) {
      alert("No se pudo eliminar. \n\nPosible causa: Esta congregación tiene personas asignadas.");
    }
  }

  // --- LIMPIAR TODO ---
  async function limpiarTodo() {
    if(!confirm("⚠️ ¡PELIGRO! \n\nSe borrarán las congregaciones de ESTA asamblea.\n¿Estás seguro?")) return;
    
    try {
      await invoke('limpiar_congregaciones', { asambleaId });
      cargar();
    } catch (e) {
      alert("Error al limpiar: " + e);
    }
  }

  function resetFormulario() {
  nombre = "";
  circuito = "";
  numero = "";
}

async function guardarYcerrar() {
  await guardar();  // guardar ya existe y al final recarga la lista
  mostrarModal = false;
}
</script>

<div class="contenedor-cong">
  
  <div class="toolbar">
    <div class="busqueda">
      <Search size={18} color="var(--text-secondary)"/>
      <input type="text" bind:value={terminoBusqueda} placeholder="Buscar congregación (nombre, número, circuito)" />
    </div>

    <button class="btn-primary" on:click={() => mostrarModal = true} title="Añadir nueva congregación">
       <Plus size={16}/> Añadir Congregación
    </button>

    <button class="btn-importar" on:click={importarCongregaciones}>
      <Upload size={16}/> Importar CSV
    </button>

    <button class="btn-danger" on:click={limpiarTodo} title="Borrar lista de esta asamblea">
        <Trash2 size={16}/> Limpiar Lista
    </button>

  </div>

  <div class="lista">
    <div class="header-lista">
        <h4>Congregaciones (Asamblea #{asambleaId}) - Total: {listaFiltrada.length}</h4>
    </div>
    
    <div class="tabla-header">
      <span>Nombre</span>
      <span>Circuito</span>
      <span>Número</span>
      <span style="text-align: center;">Acción</span>
    </div>
    
    <div class="tabla-scroll">
      {#each listaFiltrada as cong}
        <div class="fila">
          <span class="nombre"><Users size={14}/> {cong.nombre}</span>
          <span class="tag">{cong.circuito || '-'}</span>
          <span class="num">#{cong.numero_congregacion || '?'}</span>
          
          <div class="acciones">
            <button class="btn-icon-delete" on:click={() => eliminar(cong.id, cong.nombre)} title="Eliminar">
                <Trash2 size={16} />
            </button>
          </div>
        </div>
      {:else}
        <div class="vacio">No hay congregaciones añadidas</div>
        <small>Puede añadirlas con el botón "Nueva Congregación" 
          o importando un archivo CSV.</small>
      {/each}
    </div>
  </div>

  {#if mostrarModal}
  <div class="modal-backdrop" on:click|self={() => { mostrarModal = false; resetFormulario(); }}>
    <div class="modal">
      <div class="modal-header">
        <h3><Plus size={18}/> Nueva Congregación</h3>
        <button class="btn-close" on:click={() => { mostrarModal = false; resetFormulario(); }}>
          <X size={18}/>
        </button>
      </div>
      <div class="modal-body">
        <div class="grid">
          <div class="campo">
            <label>Nombre</label>
            <input type="text" bind:value={nombre} placeholder="Ej: Reparto Eléctrico" />
          </div>
          <div class="campo">
            <label>Circuito</label>
            <div class="icon-input">
              <Map size={14} class="ico"/>
              <input type="text" bind:value={circuito} placeholder="Ej: CA-15" />
            </div>
          </div>
          <div class="campo">
            <label>Número</label>
            <div class="icon-input">
              <Hash size={14} class="ico"/>
              <input type="text" bind:value={numero} placeholder="Ej: 12345" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" on:click={() => { mostrarModal = false; resetFormulario(); }}>Cancelar</button>
          <button class="btn-save" on:click={guardarYcerrar}>Guardar</button>
        </div>
      </div>
    </div>
  </div>
{/if}
</div>

<style>
  /* APLICANDO VARIABLES GLOBALES DE TEMA */
  .contenedor-cong { display: flex; flex-direction: column; gap: 15px; height: 100%; }
  
  .toolbar { 
  display: flex; 
  gap: 10px; 
  background: var(--bg-card); 
  padding: 10px; 
  border-radius: 8px; 
  border: 1px solid var(--border-color); 
  align-items: center; 
  flex-wrap: wrap; /* Permite que los botones bajen si no hay espacio */
}


  .busqueda input { border: none; background: transparent; outline: none; width: 100%; font-size: 14px; color: var(--text-main); }
  
  .btn-importar { background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; gap: 5px; align-items: center; font-weight: 500; font-size: 13px; }
  .btn-importar:hover { background: #059669; }

  .btn-danger { background: #fee2e2; color: #ef4444; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; gap: 5px; align-items: center; font-weight: 500; font-size: 13px; }
  .btn-danger:hover { background: #fecaca; }

  .card-form { background: var(--bg-card); padding: 15px; border-radius: 10px; border: 1px solid var(--border-color); }
  .card-form h3 { margin: 0 0 10px 0; font-size: 14px; color: var(--primary); display: flex; gap: 5px; align-items: center; }
  
  .grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; margin-bottom: 10px; }
  
  input { 
      width: 100%; padding: 8px 10px; 
      border: 1px solid var(--border-color); 
      border-radius: 6px; box-sizing: border-box; font-size: 13px; 
      background: var(--input-bg); color: var(--text-main);
  }
  input:focus { border-color: var(--primary); outline: none; }

  label { font-size: 11px; font-weight: bold; color: var(--text-secondary); display: block; margin-bottom: 4px; }
  
  .footer-form { display: flex; justify-content: flex-end; }
  .btn-save { background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; gap: 5px; align-items: center; font-weight: 500; }
  .btn-save:hover { opacity: 0.9; }

  .icon-input { position: relative; }
  .icon-input input { padding-left: 28px; }
  .icon-input :global(.ico) { position: absolute; left: 8px; top: 10px; color: var(--text-secondary); }

  .lista { 
      flex: 1; display: flex; flex-direction: column; overflow: hidden; 
      background: var(--bg-card); 
      border-radius: 8px; border: 1px solid var(--border-color); 
  }
  .header-lista { padding: 10px; border-bottom: 1px solid var(--border-color); }
  .lista h4 { margin: 0; color: var(--text-main); font-size: 13px; }

  .tabla-header { 
      display: grid; grid-template-columns: 2fr 1fr 1fr 60px; padding: 10px; 
      background: var(--bg-body); 
      border-bottom: 1px solid var(--border-color); 
      font-size: 12px; font-weight: bold; color: var(--text-secondary); text-transform: uppercase; 
  }
  
  .tabla-scroll { flex: 1; overflow-y: auto; }

  .fila { 
      display: grid; grid-template-columns: 2fr 1fr 1fr 60px; padding: 10px; 
      border-bottom: 1px solid var(--border-color); 
      align-items: center; font-size: 13px; 
      background: var(--bg-card);
  }
  .fila:hover { background: var(--hover-bg); }
  
  .nombre { display: flex; gap: 8px; align-items: center; font-weight: 500; color: var(--text-main); }
  .tag { background: rgba(14, 165, 233, 0.1); color: var(--primary); padding: 2px 8px; border-radius: 4px; font-size: 11px; display: inline-block; width: fit-content; border: 1px solid rgba(14, 165, 233, 0.3); }
  .num { color: var(--text-secondary); font-family: monospace; font-weight: 600; }
  .vacio { padding: 40px; text-align: center; color: var(--text-secondary); font-style: italic; }

  .acciones { display: flex; justify-content: center; }
  .btn-icon-delete { background: transparent; color: var(--text-secondary); border: none; padding: 5px; cursor: pointer; border-radius: 4px; }
  .btn-icon-delete:hover { background: #fee2e2; color: #ef4444; }

  .btn-primary {
  background: var(--primary);
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  gap: 5px;
  align-items: center;
  font-weight: 500;
  font-size: 13px;
}
.btn-primary:hover {
  opacity: 0.9;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.modal {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 20px;
  width: 450px;
  max-width: 90vw;
  box-shadow: 0 10px 25px var(--shadow-color);
  border: 1px solid var(--border-color);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  color: var(--text-main);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
  border-top: 1px solid var(--border-color);
  padding-top: 15px;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.btn-cancel:hover {
  background: var(--hover-bg);
}

.busqueda { 
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-body);
  padding: 8px 12px;          /* Mismo padding que los botones */
  border-radius: 6px;
  border: 1px solid var(--border-color); /* Borde fino definido */
  flex: 1;                     /* Ocupa el espacio restante */
  transition: box-shadow 0.2s, border-color 0.2s;
  min-height: 40px;            /* Altura mínima para igualar botones */
  box-sizing: border-box;
}

/* Asegurar que la lupa se vea bien */
.busqueda :global(svg) {
  color: var(--text-secondary);
  width: 18px;
  height: 18px;
  transition: color 0.2s;
}

.busqueda:focus-within :global(svg) {
  color: var(--primary); /* Cambia al enfocar */
}

.busqueda:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.busqueda input {
  border: none;
  background: transparent;
  outline: none;
  width: 100%;
  font-size: 14px;
  color: var(--text-main);
}

.busqueda input::placeholder {
  color: var(--text-secondary);
  font-style: italic;
}

.vacio {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.empty-icon {
  opacity: 0.4;
  margin-bottom: 10px;
}

.vacio small {
  font-size: 12px;
  opacity: 0.7;
}

.busqueda :global(svg) {
  color: var(--text-secondary);
  transition: color 0.2s;
}

.busqueda:focus-within :global(svg) {
  color: var(--primary);
}

.vacio {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.empty-icon {
  opacity: 0.4;
  margin-bottom: 10px;
}

.vacio small {
  font-size: 12px;
  opacity: 0.7;
}

.busqueda :global(svg) {
  color: var(--text-secondary);
  width: 18px;      /* Ajusta tamaño si es necesario */
  height: 18px;
}

.busqueda:focus-within :global(svg) {
  color: var(--primary); /* Cambia a color primario al enfocar */
}

.ml-auto {
  margin-left: auto;
}
</style>