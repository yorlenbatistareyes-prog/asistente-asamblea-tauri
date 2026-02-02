<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core'; // Importante para hablar con Rust
  import { MapPin, Users, Plus, Save } from 'lucide-svelte';

  // Variables para el formulario
  let nombre = "";
  let direccion = "";
  let capacidad = 0;

  // Lista donde guardaremos los locales que vienen de la base de datos
  let listaLocales: any[] = [];

  // Al cargar la pantalla, pedimos la lista a Rust
  onMount(() => {
    cargarLocales();
  });

  async function cargarLocales() {
    try {
      listaLocales = await invoke('obtener_locales');
    } catch (error) {
      console.error("Error cargando locales:", error);
    }
  }

  async function guardarLocal() {
    if (!nombre) return alert("El nombre es obligatorio");

    try {
      await invoke('crear_local', { nombre, direccion, capacidad });
      // Limpiamos el formulario
      nombre = ""; direccion = ""; capacidad = 0;
      // Recargamos la lista para ver el nuevo
      cargarLocales();
    } catch (error) {
      alert("Error guardando: " + error);
    }
  }
</script>

<div class="contenedor-locales">
  
  <div class="tarjeta-form">
    <h3><Plus size={18} /> Registrar Nuevo Salón</h3>
    
    <div class="form-grid">
      <div class="campo">
        <label>Nombre del Salón / Local</label>
        <input type="text" bind:value={nombre} placeholder="Ej: Salón de Asambleas Guanabacoa" />
      </div>

      <div class="campo">
        <label>Dirección</label>
        <div class="input-icono">
          <MapPin size={16} class="icono" />
          <input type="text" bind:value={direccion} placeholder="Calle, Número, Reparto..." />
        </div>
      </div>

      <div class="campo corto">
        <label>Capacidad</label>
        <div class="input-icono">
          <Users size={16} class="icono" />
          <input type="number" bind:value={capacidad} placeholder="0" />
        </div>
      </div>
    </div>

    <button class="btn-guardar" on:click={guardarLocal}>
      <Save size={16} /> Guardar Local
    </button>
  </div>

  <div class="lista-titulo">
    <h3>Salones Registrados ({listaLocales.length})</h3>
  </div>

  <div class="grid-locales">
    {#each listaLocales as local}
      <div class="tarjeta-local">
        <div class="local-icon">
          <MapPin size={24} color="#0078d4" />
        </div>
        <div class="local-info">
          <h4>{local.nombre}</h4>
          <p class="dir">{local.direccion || "Sin dirección"}</p>
          <span class="capacidad">Capacidad: {local.capacidad} personas</span>
        </div>
      </div>
    {:else}
      <p class="vacio">No hay locales registrados aún.</p>
    {/each}
  </div>

</div>

<style>
  .contenedor-locales { padding: 0; display: flex; flex-direction: column; gap: 30px; }
  
  /* Estilos Formulario */
  .tarjeta-form { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
  .tarjeta-form h3 { margin-top: 0; display: flex; align-items: center; gap: 10px; color: #334155; }
  
  .form-grid { display: grid; grid-template-columns: 2fr 2fr 1fr; gap: 15px; margin-bottom: 20px; }
  
  label { display: block; font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 5px; }
  input { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
  input:focus { outline: none; border-color: #0078d4; ring: 2px solid #e0f2fe; }

  .input-icono { position: relative; }
  .input-icono input { padding-left: 35px; }
  /* Usamos :global para los iconos dentro de svelte */
  .input-icono :global(.icono) { position: absolute; left: 10px; top: 10px; color: #94a3b8; }

  .btn-guardar { background: #0078d4; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; margin-left: auto; }
  .btn-guardar:hover { background: #0064b1; }

  /* Estilos Lista */
  .grid-locales { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; }
  
  .tarjeta-local { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; display: flex; gap: 15px; align-items: flex-start; }
  .local-icon { background: #f0f9ff; padding: 10px; border-radius: 50%; }
  
  .local-info h4 { margin: 0 0 5px 0; color: #1e293b; font-size: 16px; }
  .dir { margin: 0 0 10px 0; color: #64748b; font-size: 13px; }
  .capacidad { background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
</style>
