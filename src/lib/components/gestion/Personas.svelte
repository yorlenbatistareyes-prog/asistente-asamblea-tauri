<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { User, Users, Phone, Mail, Plus, Save, Upload, Search, Trash2, MapPin, X } from 'lucide-svelte';
  import { open, confirm } from '@tauri-apps/plugin-dialog';
  import Panel from '$lib/components/ui/Panel.svelte';

  // --- VARIABLES ---
  let asambleaId = 0; 
  let asambleaIdentificador = "";
  let mostrarModal = false;

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
        const asamblea = JSON.parse(datosGuardados);
        asambleaId = asamblea.id;
        asambleaIdentificador = asamblea.identificador || "Sin ID"; 
        cargarDatos(); 
    } else {
        alert("⚠️ No hay asamblea seleccionada.");
    }
  });

  async function cargarDatos() {
    try {
      // Usamos desestructuración para asegurar que las variables se actualicen correctamente
      const resPersonas = await invoke('obtener_personas', { asambleaId });
      const resCongs = await invoke('obtener_congregaciones', { asambleaId });
      
      personas = [...(resPersonas as any[])];
      congregaciones = [...(resCongs as any[])];
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
      sexo: "M",
      privilegios: privilegio,
      idCongregacion: idCong, 
      telefono, 
      email 
    });
    
    resetFormulario();  // ← AGREGAR ESTA LÍNEA
    await cargarDatos();
  } catch (e) { alert("Error: " + e); }
  }

  function resetFormulario() {
  nombre = "";
  telefono = "";
  email = "";
  privilegio = "";
  idCongregacion = null;
}

async function guardarYcerrar() {
  await guardar();
  mostrarModal = false;
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
        
        // Pequeño retraso para que la base de datos termine de procesar y Svelte refresque la lista
        setTimeout(async () => {
            await cargarDatos();
        }, 300);
      }
    } catch (e) { alert("Error: " + e); }
  }

  // --- ELIMINAR UNO ---
  async function eliminar(id: number, nombreP: string) {
    // El "await" congela el código hasta que el usuario hace clic
    const estaSeguro = await confirm(`¿Estás seguro de eliminar a ${nombreP}?`, { 
        title: 'Confirmar Eliminación', 
        kind: 'warning' 
    });
    
    // Si presiona cancelar (false), abortamos la operación
    if (!estaSeguro) return; 

    try {
        await invoke('eliminar_persona', { id });
        await cargarDatos();
    } catch(e) { alert(e); }
  }

  // --- ELIMINAR TODOS ---
  async function limpiarTodo() {
    // Diálogo nativo de advertencia que pausa la ejecución
    const estaSeguro = await confirm(
        "⚠️ ¿ESTÁS SEGURO?\n\nSe borrarán las personas de ESTA asamblea.\nLos discursos asignados quedarán vacíos.", 
        { 
            title: 'Peligro: Limpiar Lista Completa', 
            kind: 'warning' 
        }
    );
    
    // Si presiona cancelar o cierra la ventana, abortamos
    if (!estaSeguro) return; 

    try {
        await invoke('limpiar_personas', { asambleaId });
        await cargarDatos();
    } catch(e) { alert(e); }
  }
</script>

<div class="contenedor">
  
  <Panel padding="15px" clasesExtra="toolbar">
    <div class="busqueda">
      <Search size={18} strokeWidth={2} />
      <input type="text" bind:value={terminoBusqueda} placeholder="Buscar persona..." />
    </div>

    <button class="btn-primary" on:click={() => mostrarModal = true} title="Añadir nueva persona">
     <Plus size={16}/> Añadir Persona
    </button>

    <button class="btn-importar" on:click={importarPersonas}>
      <Upload size={16}/> Importar CSV
    </button>

    <button class="btn-danger" on:click={limpiarTodo} title="Borrar todas las personas">
        <Trash2 size={16}/> Limpiar Lista
    </button>

  </Panel>

  <Panel padding="0" clasesExtra="lista-panel">
    <div class="header-lista">
        <h4>Personas Registradas (Asamblea {asambleaIdentificador}) - Total: {listaFiltrada.length}</h4>
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
 </Panel>

  {#if mostrarModal}
  <div class="modal-backdrop" on:click|self={() => { mostrarModal = false; resetFormulario(); }}>
    <div class="modal">
      <div class="modal-header">
        <h3><Plus size={18}/> Nueva Persona</h3>
        <button class="btn-close" on:click={() => { mostrarModal = false; resetFormulario(); }}>
          <X size={18}/>
        </button>
      </div>
      <div class="modal-body">
        <div class="grid-modal">
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
        <div class="modal-footer">
          <button class="btn-cancel" on:click={() => { mostrarModal = false; resetFormulario(); }}>Cancelar</button>
          <button class="btn-save" on:click={guardarYcerrar}><Save size={16}/> Guardar</button>
        </div>
      </div>
    </div>
  </div>
  {/if}
</div>

<style>
/* ===== ESTILOS MEJORADOS PARA PERSONAS ===== */

/* CONTENEDOR PRINCIPAL */
.contenedor { 
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
  margin-bottom: 20px;
}

/* BARRA DE BÚSQUEDA - Más ancha y fina con lupa visible */
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
  border-width: 1.5px;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Asegurar que el icono SVG sea visible */
.busqueda :global(svg) {
  color: var(--text-secondary) !important;
  width: 18px !important;
  height: 18px !important;
  min-width: 18px;
  min-height: 18px;
  flex-shrink: 0;
  opacity: 1 !important;
  display: block !important;
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

/* ===== FORMULARIO ===== */
.card-form { 
  background: var(--bg-card); 
  padding: 15px; 
  border-radius: 10px; 
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card-form h3 { 
  margin: 0 0 15px 0; 
  font-size: 16px; 
  color: var(--primary); 
  display: flex; 
  gap: 5px; 
  align-items: center;
  font-weight: 600;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label { 
  font-size: 11px; 
  font-weight: 600; 
  color: var(--text-secondary); 
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

input, select { 
  width: 100%; 
  padding: 8px 10px; 
  border: 1px solid var(--border); 
  border-radius: 6px; 
  box-sizing: border-box; 
  font-size: 13px; 
  height: 35px;
  background: var(--input-bg); 
  color: var(--text-main);
  transition: all 0.2s ease;
}

input:focus, select:focus { 
  border-color: var(--primary); 
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.icon-input { 
  position: relative; 
}

.icon-input input, .icon-input select { 
  padding-left: 28px; 
}

.icon-input :global(.ico) { 
  position: absolute; 
  left: 8px; 
  top: 10px; 
  color: var(--text-secondary);
}

.footer-form { 
  display: flex; 
  justify-content: flex-end; 
}

.btn-save { 
  background: var(--primary); 
  color: white; 
  border: none; 
  padding: 8px 16px; 
  border-radius: 6px; 
  cursor: pointer; 
  display: flex; 
  gap: 5px; 
  align-items: center; 
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-save:hover { 
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* ===== LISTA DE PERSONAS - MÁS DEFINIDA Y ELEVADA ===== */
:global(.lista-panel) { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  overflow: hidden; 
}

.header-lista { 
  padding: 15px; 
  border-bottom: 1px solid var(--border);
  background: transparent;
}

.lista h4 { 
  margin: 0; 
  color: var(--text-main); 
  font-size: 14px;
  font-weight: 600;
}

.tabla-header { 
  display: grid; 
  grid-template-columns: 2fr 2fr 1fr 80px; 
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
  grid-template-columns: 2fr 2fr 1fr 80px; 
  padding: 14px 15px; 
  border-bottom: 1px solid var(--border); 
  align-items: center; 
  font-size: 13px; 
  background: transparent; /* Ahora hereda el color del Panel */
  transition: all 0.2s ease;
  position: relative;
}

.fila::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--primary);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.fila:hover {
  background: var(--hover-bg); /* Variable global */
  transform: translateX(2px);
}

.fila:hover::before {
  opacity: 1;
}

/* Columna de nombre mejorada */
.col-nombre { 
  display: flex; 
  flex-direction: column;
  gap: 4px;
}

.txt-nombre { 
  font-weight: 600; 
  color: var(--text-main);
}

.txt-sub { 
  font-size: 11px; 
  color: var(--text-secondary);
  opacity: 0.8;
}

/* Tag de congregación mejorado */
.tag-cong { 
  color: var(--text-secondary); 
  font-weight: 500;
  font-size: 13px;
}

/* Tag de privilegio mejorado */
.tag-priv { 
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(14, 165, 233, 0.05));
  color: #0284c7; 
  padding: 4px 10px; 
  border-radius: 6px; 
  font-size: 11px; 
  font-weight: 600;
  width: fit-content; 
  border: 1px solid rgba(14, 165, 233, 0.25);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 4px rgba(14, 165, 233, 0.08);
}

/* Estado vacío */
.vacio { 
  padding: 60px 20px; 
  text-align: center; 
  color: var(--text-secondary); 
  font-style: italic;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: 14px;
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
  width: 550px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
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

.grid-modal { 
  display: grid; 
  grid-template-columns: 1fr 1fr;
  gap: 15px; 
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
</style>