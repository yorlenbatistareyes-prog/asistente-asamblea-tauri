<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { User, Users, Phone, Mail, Plus, Save, Upload, Search, Trash2, MapPin } from 'lucide-svelte';
  import { open } from '@tauri-apps/plugin-dialog';

  // --- VARIABLES ---
  let asambleaId = 0; 

  let nombre = "";
  let telefono = "";
  let email = "";
  let idCongregacion: number | null = null;
  let privilegio = ""; 
  
  // Listas
  let personas: any[] = [];
  let congregaciones: any[] = [];
  let terminoBusqueda = "";

  onMount(() => { 
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
        asambleaId = JSON.parse(datosGuardados).id;
        cargarDatos(); 
    } else {
        alert("⚠️ No hay asamblea seleccionada.");
    }
  });

  async function cargarDatos() {
    try {
      personas = await invoke('obtener_personas', { asambleaId });
      congregaciones = await invoke('obtener_congregaciones', { asambleaId });
    } catch (e) { console.error(e); }
  }

  // --- FILTRO REACTIVO ---
  $: listaFiltrada = personas.filter(p => {
    const t = terminoBusqueda.toLowerCase();
    const nombreC = p.nombre_congregacion || "";
    return (
      p.nombre_completo.toLowerCase().includes(t) || 
      nombreC.toLowerCase().includes(t)
    );
  });

  // --- GUARDAR MANUALMENTE ---
  async function guardar() {
    if (!nombre) return alert("Escribe el nombre completo");
    const idCong = idCongregacion ? idCongregacion : 0; 
    
    try {
      await invoke('crear_persona', { 
        asambleaId, 
        nombreCompleto: nombre, 
        genero: "Hombre", 
        privilegios: privilegio,
        idCongregacion: idCong, 
        telefono, 
        email 
      });
      
      nombre = ""; telefono = ""; email = ""; privilegio = ""; idCongregacion = null;
      cargarDatos();
    } catch (e) { alert("Error: " + e); }
  }

  // --- IMPORTAR CSV ---
  async function importarPersonas() {
    try {
      const archivo = await open({ multiple: false, filters: [{ name: 'CSV', extensions: ['csv'] }] });
      if (archivo) {
        const mensaje = await invoke('importar_personas_csv', { 
            asambleaId, 
            rutaArchivo: archivo 
        });
        alert(mensaje);
        cargarDatos(); 
      }
    } catch (e) { alert("Error: " + e); }
  }

  // --- ELIMINAR UNO ---
  async function eliminar(id: number, nombreP: string) {
    if(!confirm(`¿Eliminar a ${nombreP}?`)) return;
    try {
        await invoke('eliminar_persona', { id });
        cargarDatos();
    } catch(e) { alert(e); }
  }

  // --- ELIMINAR TODOS ---
  async function limpiarTodo() {
    if(!confirm("⚠️ ¿ESTÁS SEGURO?\n\nSe borrarán las personas de ESTA asamblea.\nLos discursos asignados quedarán vacíos.")) return;
    try {
        await invoke('limpiar_personas', { asambleaId });
        cargarDatos();
    } catch(e) { alert(e); }
  }
</script>

<div class="contenedor">
  
  <div class="toolbar">
    <div class="busqueda">
      <Search size={18} color="var(--text-secondary)"/>
      <input type="text" bind:value={terminoBusqueda} placeholder="Buscar persona..." />
    </div>
    
    <button class="btn-danger" on:click={limpiarTodo} title="Borrar todas las personas">
        <Trash2 size={16}/> Limpiar Lista
    </button>

    <button class="btn-importar" on:click={importarPersonas}>
      <Upload size={16}/> Importar CSV
    </button>
  </div>

  <div class="card-form">
    <h3><Plus size={18}/> Nuevo Registro</h3>
    <div class="grid">
      <div class="campo">
        <label for="nombre_input">Nombre Completo</label>
        <div class="icon-input">
            <User size={14} class="ico"/>
            <input id="nombre_input" type="text" bind:value={nombre} placeholder="Nombre y Apellidos" />
        </div>
      </div>

      <div class="campo">
        <label for="cong_select">Congregación</label>
       <div class="icon-input">
          <MapPin size={14} class="ico"/>
          <select id="cong_select" bind:value={idCongregacion}>
              <option value={0}>-- Sin Asignación / Superintendente --</option>
              {#each congregaciones as cong}
                  <option value={cong.id}>{cong.nombre}</option>
              {/each}
          </select>
       </div>
      </div>

      <div class="campo">
        <label for="priv_select">Privilegio</label>
        <select id="priv_select" bind:value={privilegio}>
            <option value="">Publicador</option>
            <option value="Anciano">Anciano</option>
            <option value="Siervo Ministerial">Siervo Ministerial</option>
            <option value="Precursor">Precursor</option>
        </select>
      </div>

      <div class="campo">
        <label for="tel_input">Teléfono</label>
        <div class="icon-input">
            <Phone size={14} class="ico"/>
            <input id="tel_input" type="text" bind:value={telefono} placeholder="+53..." />
        </div>
      </div>
      <div class="campo">
        <label for="email_input">Email (jwpub.org)</label>
        <div class="icon-input">
            <Mail size={14} class="ico"/>
            <input id="email_input" type="email" bind:value={email} placeholder="correo@jwpub.org" />
        </div>
      </div>
    </div>
    <div class="footer-form">
        <button on:click={guardar} class="btn-save"><Save size={16}/> Guardar</button>
    </div>
  </div>

  <div class="lista">
    <div class="header-lista">
        <h4>Personas Registradas (Asamblea #{asambleaId}) - Total: {listaFiltrada.length}</h4>
    </div>
    
    <div class="tabla-header">
      <span>Nombre</span>
      <span>Congregación</span>
      <span>Privilegio</span>
      <span style="text-align: center;">Acción</span>
    </div>
    
    <div class="tabla-scroll">
      {#each listaFiltrada as p}
        <div class="fila">
           <div class="col-nombre">
             <span class="txt-nombre">{p.nombre_completo}</span>
             <span class="txt-sub">{p.telefono || '-'} {p.email ? `• ${p.email}` : ''}</span>
           </div>
           <span class="tag-cong">{p.nombre_congregacion || 'Sin Asignar'}</span>
          <span class="tag-priv">{p.privilegios || 'Publicador'}</span>
          
          <div class="acciones">
            <button class="btn-icon-delete" on:click={() => eliminar(p.id, p.nombre_completo)} title="Eliminar">
                <Trash2 size={16} />
            </button>
          </div>
        </div>
      {:else}
        <div class="vacio">No hay personas registradas en esta asamblea.</div>
      {/each}
    </div>
  </div>
</div>

<style>
  /* APLICANDO VARIABLES GLOBALES DE TEMA */
  .contenedor { display: flex; flex-direction: column; gap: 15px; height: 100%; }
  
  .toolbar { 
      display: flex; gap: 10px; 
      background: var(--bg-card); 
      padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); 
      align-items: center; 
  }
  .busqueda { 
      display: flex; align-items: center; gap: 8px; 
      background: var(--bg-body); 
      padding: 8px 12px; border-radius: 6px; flex: 1; border: 1px solid var(--border-color);
  }
  .busqueda input { border: none; background: transparent; outline: none; width: 100%; font-size: 14px; color: var(--text-main); }
  
  .btn-importar { background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; gap: 5px; align-items: center; font-weight: 500; font-size: 13px; margin-left: auto;}
  .btn-importar:hover { background: #059669; }

  .btn-danger { background: #fee2e2; color: #ef4444; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; gap: 5px; align-items: center; font-weight: 500; font-size: 13px; }
  .btn-danger:hover { background: #fecaca; }

  .card-form { background: var(--bg-card); padding: 15px; border-radius: 10px; border: 1px solid var(--border-color); }
  .card-form h3 { margin: 0 0 10px 0; font-size: 14px; color: var(--primary); display: flex; gap: 5px; align-items: center; }
  
  .grid { display: grid; grid-template-columns: 2fr 2fr 1fr 1fr; gap: 15px; margin-bottom: 10px; }
  
  input, select { 
      width: 100%; padding: 8px 10px; 
      border: 1px solid var(--border-color); 
      border-radius: 6px; box-sizing: border-box; font-size: 13px; height: 35px;
      background: var(--input-bg); color: var(--text-main);
  }
  input:focus, select:focus { border-color: var(--primary); outline: none; }

  label { font-size: 11px; font-weight: bold; color: var(--text-secondary); display: block; margin-bottom: 4px; }
  
  .footer-form { display: flex; justify-content: flex-end; }
  .btn-save { background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; gap: 5px; align-items: center; font-weight: 500; }
  .btn-save:hover { opacity: 0.9; }

  .icon-input { position: relative; }
  .icon-input input, .icon-input select { padding-left: 28px; }
  .icon-input :global(.ico) { position: absolute; left: 8px; top: 10px; color: var(--text-secondary); }

  .lista { 
      flex: 1; display: flex; flex-direction: column; overflow: hidden; 
      background: var(--bg-card); 
      border-radius: 8px; border: 1px solid var(--border-color); 
  }
  .header-lista { padding: 10px; border-bottom: 1px solid var(--border-color); }
  .lista h4 { margin: 0; color: var(--text-main); font-size: 13px; }

  .tabla-header { 
      display: grid; grid-template-columns: 2fr 2fr 1fr 60px; padding: 10px; 
      background: var(--bg-body); 
      border-bottom: 1px solid var(--border-color); 
      font-size: 12px; font-weight: bold; color: var(--text-secondary); text-transform: uppercase; 
  }
  
  .tabla-scroll { flex: 1; overflow-y: auto; }

  .fila { 
      display: grid; grid-template-columns: 2fr 2fr 1fr 60px; padding: 10px; 
      border-bottom: 1px solid var(--border-color); 
      align-items: center; font-size: 13px; 
      background: var(--bg-card);
  }
  .fila:hover { background: var(--hover-bg); }
  
  .col-nombre { display: flex; flex-direction: column; }
  .txt-nombre { font-weight: 600; color: var(--text-main); }
  .txt-sub { font-size: 11px; color: var(--text-secondary); }

  .tag-cong { color: var(--text-secondary); font-weight: 500; }
  .tag-priv { 
      background: var(--bg-body); color: var(--text-secondary); 
      padding: 2px 8px; border-radius: 4px; font-size: 11px; width: fit-content; 
      border: 1px solid var(--border-color);
  }

  .vacio { padding: 40px; text-align: center; color: var(--text-secondary); font-style: italic; }

  .acciones { display: flex; justify-content: center; }
  .btn-icon-delete { background: transparent; color: var(--text-secondary); border: none; padding: 5px; cursor: pointer; border-radius: 4px; }
  .btn-icon-delete:hover { background: #fee2e2; color: #ef4444; }
</style>