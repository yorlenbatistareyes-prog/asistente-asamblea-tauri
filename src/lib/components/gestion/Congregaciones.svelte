<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Users, Hash, Map, Plus, Save, Upload, Search, Trash2 } from 'lucide-svelte';
  import { open } from '@tauri-apps/plugin-dialog';

  // --- VARIABLES ---
  let asambleaId = 0; // <--- AQUÍ GUARDAMOS EL ID DE LA ASAMBLEA ACTUAL
  
  let nombre = "";
  let circuito = "";
  let numero = "";
  
  interface Congregacion {
    id: number;
    nombre: string;
    circuito?: string;
    numero_congregacion?: string;
  }

  let lista: Congregacion[] = [];
  let terminoBusqueda = "";

  onMount(() => { 
    // 1. RECUPERAR ID DE LA ASAMBLEA ACTIVA
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
        const asamblea = JSON.parse(datosGuardados);
        asambleaId = asamblea.id;
        console.log("Gestionando congregaciones para asamblea ID:", asambleaId);
        cargar(); 
    } else {
        alert("⚠️ No hay asamblea seleccionada. Vuelve al inicio.");
    }
  });

  async function cargar() {
    try {
      // 2. ENVIAR EL ID A RUST
      // Nota: Tauri convierte automáticamente 'asambleaId' (JS) a 'asamblea_id' (Rust)
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
      // Enviamos asambleaId para que se guarde en la lista correcta
      await invoke('crear_congregacion', { 
        asambleaId, 
        nombre, 
        circuito, 
        numero 
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
        // Enviamos asambleaId para importar SOLO en esta asamblea
        const mensaje = await invoke('importar_congregaciones_csv', { 
            asambleaId, 
            rutaArchivo: archivo 
        });
        alert(mensaje);
        cargar(); 
      }
    } catch (e) { alert("Error: " + e); }
  }

  // --- ELIMINAR UNA CONGREGACIÓN ---
  // (Este no cambia porque elimina por ID único de fila)
  async function eliminar(id: number, nombreCong: string) {
    if(!confirm(`¿Seguro que quieres eliminar "${nombreCong}"?`)) return;

    try {
      await invoke('eliminar_congregacion', { id });
      cargar(); 
    } catch (e) {
      alert("No se pudo eliminar. \n\nPosible causa: Esta congregación tiene personas asignadas.");
    }
  }

  // --- LIMPIAR TODA LA LISTA ---
  async function limpiarTodo() {
    if(!confirm("⚠️ ¡PELIGRO! \n\nSe borrarán las congregaciones de ESTA asamblea.\n¿Estás seguro?")) return;
    
    try {
      // Solo limpiamos las de esta asamblea
      await invoke('limpiar_congregaciones', { asambleaId });
      cargar();
    } catch (e) {
      alert("Error al limpiar: " + e);
    }
  }
</script>

<div class="contenedor-cong">
  
  <div class="toolbar">
    <div class="busqueda">
      <Search size={18} color="#64748b"/>
      <input type="text" bind:value={terminoBusqueda} placeholder="Buscar..." />
    </div>
    
    <button class="btn-danger" on:click={limpiarTodo} title="Borrar lista de esta asamblea">
        <Trash2 size={16}/> Limpiar Lista
    </button>

    <button class="btn-importar" on:click={importarCongregaciones}>
      <Upload size={16}/> Importar CSV
    </button>
  </div>

  <div class="card-form">
    <h3><Plus size={18}/> Registrar Manualmente</h3>
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
    <div class="footer-form">
        <button on:click={guardar}><Save size={16}/> Guardar</button>
    </div>
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
        <div class="vacio">No hay congregaciones en esta asamblea.</div>
      {/each}
    </div>
  </div>
</div>

<style>
  .contenedor-cong { display: flex; flex-direction: column; gap: 15px; height: 100%; }
  
  .toolbar { display: flex; gap: 10px; background: white; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; align-items: center; }
  .busqueda { display: flex; align-items: center; gap: 8px; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; flex: 1; }
  .busqueda input { border: none; background: transparent; outline: none; width: 100%; font-size: 14px; }
  
  .btn-importar { background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; gap: 5px; align-items: center; font-weight: 500; font-size: 13px; }
  .btn-importar:hover { background: #059669; }

  .btn-danger { background: #fee2e2; color: #ef4444; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; gap: 5px; align-items: center; font-weight: 500; font-size: 13px; }
  .btn-danger:hover { background: #fecaca; }

  .card-form { background: white; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; }
  .card-form h3 { margin: 0 0 10px 0; font-size: 14px; color: #0078d4; display: flex; gap: 5px; align-items: center; }
  
  .grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; margin-bottom: 10px; }
  
  input { width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 13px; }
  label { font-size: 11px; font-weight: bold; color: #64748b; display: block; margin-bottom: 4px; }
  
  .footer-form { display: flex; justify-content: flex-end; }
  button { background: #0078d4; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; gap: 5px; align-items: center; font-weight: 500; }
  button:hover { background: #0064b1; }

  .icon-input { position: relative; }
  .icon-input input { padding-left: 28px; }
  .icon-input :global(.ico) { position: absolute; left: 8px; top: 10px; color: #94a3b8; }

  .lista { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: white; border-radius: 8px; border: 1px solid #e2e8f0; }
  .header-lista { padding: 10px; border-bottom: 1px solid #e2e8f0; }
  .lista h4 { margin: 0; color: #334155; font-size: 13px; }

  .tabla-header { display: grid; grid-template-columns: 2fr 1fr 1fr 60px; padding: 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; }
  
  .tabla-scroll { flex: 1; overflow-y: auto; }

  .fila { display: grid; grid-template-columns: 2fr 1fr 1fr 60px; padding: 10px; border-bottom: 1px solid #f1f5f9; align-items: center; font-size: 13px; }
  
  .nombre { display: flex; gap: 8px; align-items: center; font-weight: 500; color: #1e293b; }
  .tag { background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 4px; font-size: 11px; display: inline-block; width: fit-content; border: 1px solid #bae6fd; }
  .num { color: #64748b; font-family: monospace; font-weight: 600; }
  .vacio { padding: 40px; text-align: center; color: #94a3b8; font-style: italic; }

  .acciones { display: flex; justify-content: center; }
  .btn-icon-delete { background: transparent; color: #94a3b8; border: none; padding: 5px; cursor: pointer; border-radius: 4px; }
  .btn-icon-delete:hover { background: #fee2e2; color: #ef4444; }
</style>
