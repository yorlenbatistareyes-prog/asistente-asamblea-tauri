<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Users, Hash, Map, Plus, Save, Upload, Search, Trash2, X  } from 'lucide-svelte';
  import { open, confirm } from '@tauri-apps/plugin-dialog';
  import Panel from '$lib/components/ui/Panel.svelte';

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
    // Congelamos el código hasta que el usuario decida
    const estaSeguro = await confirm(`¿Seguro que quieres eliminar "${nombreCong}"?`, {
        title: 'Confirmar Eliminación',
        kind: 'warning'
    });

    // Si le da a cancelar, abortamos
    if (!estaSeguro) return;

    try {
      await invoke('eliminar_congregacion', { id });
      cargar(); 
    } catch (e) {
      alert("No se pudo eliminar. \n\nPosible causa: Esta congregación tiene personas asignadas.");
    }
  }

  // --- LIMPIAR TODO ---
  async function limpiarTodo() {
    // Diálogo nativo de Tauri
    const estaSeguro = await confirm(
        "⚠️ ¡PELIGRO! \n\nSe borrarán las congregaciones de ESTA asamblea.\n¿Estás seguro?", 
        {
            title: 'Peligro: Limpiar Congregaciones',
            kind: 'warning'
        }
    );
    
    // Si cancela, no borramos nada
    if (!estaSeguro) return;
    
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
  
  <Panel padding="15px" clasesExtra="toolbar">
    <div class="busqueda">
      <Search size={18} strokeWidth={2} />
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

 </Panel>

  <Panel padding="0" clasesExtra="lista-panel">
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
 </Panel>

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
/* ===== ESTILOS MEJORADOS PARA CONGREGACIONES ===== */

/* CONTENEDOR PRINCIPAL */
.contenedor-cong { 
  display: flex; 
  flex-direction: column; 
  gap: 15px; 
  height: 100%; 
}

/* ===== TOOLBAR MEJORADO ===== */
:global(.toolbar) { 
  display: flex; 
  gap: 10px; 
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 20px; /* Separación con la lista */
}

/* BARRA DE BÚSQUEDA - Más ancha y fina con lupa */
.busqueda { 
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-body);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  flex: 1;
  min-width: 300px;
  height: 32px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.busqueda:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.busqueda :global(svg) {
  color: var(--text-secondary) !important;
  width: 18px !important;
  height: 18px !important;
  flex-shrink: 0;
  opacity: 1;
  display: block;
}

.busqueda:focus-within :global(svg) {
  color: var(--primary) !important;
}

.busqueda input {
  border: none;
  background: transparent;
  outline: none;
  width: 100%;
  font-size: 13px;
  color: var(--text-main);
  height: 100%;
}

.busqueda input::placeholder {
  color: var(--text-secondary);
  font-style: italic;
}

/* BOTONES */
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
  height: 36px;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-importar { 
  background: #10b981; 
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
  height: 36px;
  transition: all 0.2s ease;
}

.btn-importar:hover { 
  background: #059669;
  transform: translateY(-1px);
}

.btn-danger { 
  background: #fee2e2; 
  color: #ef4444; 
  border: 1px solid #fecaca; 
  padding: 8px 12px; 
  border-radius: 6px; 
  cursor: pointer; 
  display: flex; 
  gap: 5px; 
  align-items: center; 
  font-weight: 500; 
  font-size: 13px;
  height: 36px;
  transition: all 0.2s ease;
}

.btn-danger:hover { 
  background: #fecaca;
  transform: translateY(-1px);
}

/* ===== LISTA DE CONGREGACIONES - MÁS DEFINIDA Y ELEVADA ===== */
/* ===== LISTA DE CONGREGACIONES ===== */
:global(.lista-panel) { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  overflow: hidden; /* Esto mantiene las esquinas redondeadas */
}

.header-lista { 
  padding: 15px; 
  border-bottom: 1px solid var(--border);
  background: var(--bg-body); /* Un gris sutil para diferenciar el encabezado */
}

.lista h4 { 
  margin: 0; 
  color: var(--text-main); 
  font-size: 14px;
  font-weight: 600;
}

.tabla-header { 
  display: grid; 
  grid-template-columns: 2fr 1fr 1fr 80px; 
  padding: 12px 15px; 
  background: var(--bg-body); 
  border-bottom: 2px solid var(--border); 
  font-size: 11px; 
  font-weight: 700; 
  color: var(--text-secondary); 
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tabla-scroll { 
  flex: 1; 
  overflow-y: auto;
  background: var(--bg-card);
}

/* ===== FILAS/TARJETAS MEJORADAS ===== */
.fila { 
  display: grid; 
  grid-template-columns: 2fr 1fr 1fr 80px; 
  padding: 14px 15px; 
  border-bottom: 1px solid var(--border); /* Usar variable global */
  align-items: center; 
  font-size: 13px; 
  background: var(--bg-card); /* Usar variable para modo oscuro */
  transition: all 0.2s ease;
  position: relative;
}

.fila:hover {
  background: var(--hover-bg); /* Variable global de hover */
  transform: translateX(2px);
}

.fila:hover::before {
  opacity: 1;
}

/* Nombre con mejor estilo */
.nombre { 
  display: flex; 
  gap: 8px; 
  align-items: center; 
  font-weight: 600; 
  color: var(--text-main);
}

.nombre :global(svg) {
  color: var(--primary);
  flex-shrink: 0;
}

/* Tag de circuito mejorado */
.tag { 
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(14, 165, 233, 0.08));
  color: #0284c7;
  padding: 4px 10px; 
  border-radius: 6px; 
  font-size: 11px; 
  font-weight: 600;
  display: inline-block; 
  width: fit-content; 
  border: 1px solid rgba(14, 165, 233, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(14, 165, 233, 0.1);
}

/* Número mejorado */
.num { 
  color: var(--text-secondary); 
  font-family: 'Courier New', monospace; 
  font-weight: 700;
  font-size: 12px;
  background: var(--bg-body);
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

/* Estado vacío */
.vacio {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.empty-icon {
  opacity: 0.3;
  margin-bottom: 10px;
}

.vacio small {
  font-size: 12px;
  opacity: 0.7;
  max-width: 400px;
  line-height: 1.5;
}

/* Acciones */
.acciones { 
  display: flex; 
  justify-content: center;
  gap: 5px;
}

.btn-icon-delete { 
  background: transparent; 
  color: var(--text-secondary); 
  border: none; 
  padding: 6px; 
  cursor: pointer; 
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon-delete:hover { 
  background: #fee2e2; 
  color: #ef4444;
  transform: scale(1.1);
}

/* ===== MODAL ===== */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  width: 480px;
  max-width: 90vw;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  color: var(--text-main);
  font-weight: 600;
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
}

.btn-close:hover {
  background: var(--hover-bg);
  color: var(--text-main);
  transform: rotate(90deg);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

/* Grid del formulario */
.grid { 
  display: grid; 
  grid-template-columns: 1fr; 
  gap: 15px; 
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label { 
  font-size: 12px; 
  font-weight: 600; 
  color: var(--text-secondary); 
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

input { 
  width: 100%; 
  padding: 10px 12px; 
  border: 1px solid var(--border); 
  border-radius: 6px; 
  box-sizing: border-box; 
  font-size: 14px; 
  background: var(--input-bg); 
  color: var(--text-main);
  transition: all 0.2s ease;
}

input:focus { 
  border-color: var(--primary); 
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.icon-input { 
  position: relative; 
}

.icon-input input { 
  padding-left: 34px; 
}

.icon-input :global(.ico) { 
  position: absolute; 
  left: 10px; 
  top: 12px; 
  color: var(--text-secondary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-cancel:hover {
  background: var(--hover-bg);
  border-color: var(--text-secondary);
}

.btn-save { 
  background: var(--primary); 
  color: white; 
  border: none; 
  padding: 10px 20px; 
  border-radius: 6px; 
  cursor: pointer; 
  display: flex; 
  gap: 6px; 
  align-items: center; 
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-save:hover { 
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* ===== SCROLLBAR PERSONALIZADO ===== */
.tabla-scroll::-webkit-scrollbar {
  width: 8px;
}

.tabla-scroll::-webkit-scrollbar-track {
  background: var(--bg-body);
  border-radius: 4px;
}

.tabla-scroll::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
  transition: background 0.2s ease;
}

.tabla-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>