<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  import TextAlign from '@tiptap/extension-text-align';
  import { 
    Save, Calendar, MapPin, Bookmark, Clock, Info, 
    AlignLeft, Bold, Italic, Underline as UnderIcon, List, 
    AlignCenter, Eraser, Building, Users, Plus, X 
  } from 'lucide-svelte';

  // --- VARIABLES DE EVENTO ---
  let asambleaId: number | null = null;
  let tema = "";
  let fecha = "";
  
  // --- LÓGICA DE SALONES ---
  let locales: any[] = [];
  let idLocal: number | null = null; 
  let localDetalle: any = null;      

  // --- VARIABLES DE ENSAYOS ---
  let ensayoLugar = "";
  let ensayoFecha = "";
  let ensayoHora = "";
  let jwStreamStudio = false;
  let instruccionesEsp = ""; 

  // --- MODAL CREAR SALÓN ---
  let mostrarModalSalon = false;
  let nuevoSalon = { nombre: "", direccion: "", capacidad: 0 };

  // --- TIPTAP ---
  let elementRecorridos: HTMLElement;
  let elementNotas: HTMLElement;
  let editorRecorridos: Editor;
  let editorNotas: Editor;
  let htmlRecorridos = "";
  let htmlNotas = "";

  const ejecutar = (editor: Editor, cb: (chain: any) => any) => {
    if (editor) cb(editor.chain().focus()).run();
  };

  onMount(async () => {
    try {
      await cargarLocales();
      const asamblea = await invoke('obtener_asamblea_activa') as any;
      
      if (asamblea) {
        asambleaId = asamblea.id;
        tema = asamblea.tema || "";
        fecha = asamblea.fecha || "";
        idLocal = asamblea.local_id || null;
        ensayoLugar = asamblea.ensayo_lugar || "";
        ensayoFecha = asamblea.ensayo_fecha || "";
        ensayoHora = asamblea.ensayo_hora || "";
        instruccionesEsp = asamblea.instrucciones_esp || "";
        jwStreamStudio = asamblea.jw_stream_studio === 1;
        htmlRecorridos = asamblea.recorridos_info || "";
        htmlNotas = asamblea.ensayo_notas || "";
      }
      initEditors();
    } catch (error) { console.error(error); }
  });

  async function cargarLocales() {
      locales = await invoke('obtener_locales') as any[];
  }

  // --- REACTIVIDAD ---
  $: if (idLocal && locales.length > 0) {
      localDetalle = locales.find(l => l.id === idLocal);
  } else {
      localDetalle = null;
  }

  // --- FUNCIÓN PARA QUITAR EL SALÓN ---
  function quitarSeleccion() {
    idLocal = null; 
  }

  function initEditors() {
      editorRecorridos = new Editor({
        element: elementRecorridos,
        extensions: [StarterKit, Underline, TextAlign.configure({ types: ['heading', 'paragraph'] })],
        content: htmlRecorridos, 
        onUpdate: ({ editor }) => { htmlRecorridos = editor.getHTML(); }
      });

      editorNotas = new Editor({
        element: elementNotas,
        extensions: [StarterKit, Underline, TextAlign.configure({ types: ['heading', 'paragraph'] })],
        content: htmlNotas,
        onUpdate: ({ editor }) => { htmlNotas = editor.getHTML(); }
      });
  }

  onDestroy(() => {
    editorRecorridos?.destroy();
    editorNotas?.destroy();
  });

  async function guardarNuevoSalon() {
      if(!nuevoSalon.nombre) return alert("Falta el nombre");
      try {
          await invoke('crear_local', { ...nuevoSalon });
          await cargarLocales();
          const recienCreado = locales.find(l => l.nombre === nuevoSalon.nombre);
          if (recienCreado) idLocal = recienCreado.id;
          nuevoSalon = { nombre: "", direccion: "", capacidad: 0 };
          mostrarModalSalon = false;
      } catch(e) { alert(e); }
  }

  async function guardar() {
    try {
      await invoke('guardar_info_evento', {
        id: asambleaId, tema, fecha, localId: idLocal,
        ensayoLugar, ensayoFecha, ensayoHora, ensayoNotas: htmlNotas,
        recorridosInfo: htmlRecorridos, instruccionesEsp, esJwStream: jwStreamStudio
      });
      alert("✅ Configuración guardada correctamente");
    } catch (e) { alert("❌ Error al guardar: " + e); }
  }
</script>

<div class="contenedor">
  
  <div class="card-config">
    <div class="header-card">
      <h3><Bookmark size={18}/> Información del Evento</h3>
      <button class="btn-save" on:click={guardar}><Save size={18}/> Guardar Todo</button>
    </div>
    
    <div class="formulario grid-2">
      <div class="campo full"><label>Tema</label><input type="text" bind:value={tema} class="input-big"/></div>
      <div class="campo"><label><Calendar size={14}/> Fecha</label><input type="text" bind:value={fecha} /></div>
      
      <div class="campo">
        <label><MapPin size={14}/> Salón de Asambleas</label>
        
        <div class="selector-salon">
            <select bind:value={idLocal}>
                <option value={null}>-- Seleccionar Salón --</option>
                {#each locales as l}<option value={l.id}>{l.nombre}</option>{/each}
            </select>
            <button class="btn-plus" on:click={() => mostrarModalSalon = true} title="Crear Nuevo Salón"><Plus size={16}/></button>
        </div>
      </div>
    </div>

    {#if localDetalle}
        <div class="salon-info-card">
            
            <button class="btn-close-card" on:click={quitarSeleccion} title="Quitar este salón">
                <X size={16} />
            </button>

            <div class="icon-building"><Building size={24}/></div>
            <div class="info-text">
                <span class="l-nombre">{localDetalle.nombre}</span>
                <span class="l-dir">{localDetalle.direccion || 'Sin dirección registrada'}</span>
            </div>
            
            <div class="info-cap">
                <Users size={16}/>
                <span>{localDetalle.capacidad || 0}</span>
                <small>asientos</small>
            </div>
        </div>
    {/if}
  </div>

  <div class="card-config mt-20">
    <div class="header-ensayo">
      <Clock size={20} color="#2563eb"/>
      <h4>Programación de Ensayos y Recorridos</h4>
    </div>

    <div class="editor-block">
      <label><AlignLeft size={14}/> Walkthrough information (Recorridos)</label>
      <div class="tiptap-frame">
        {#if editorRecorridos}
          <div class="toolbar">
            <button type="button" on:click={() => ejecutar(editorRecorridos, c => c.toggleBold())} class:active={editorRecorridos.isActive('bold')}><Bold size={14}/></button>
            <button type="button" on:click={() => ejecutar(editorRecorridos, c => c.toggleBulletList())} class:active={editorRecorridos.isActive('bulletList')}><List size={14}/></button>
            <button type="button" on:click={() => ejecutar(editorRecorridos, c => c.setTextAlign('center'))} class:active={editorRecorridos.isActive({ textAlign: 'center' })}><AlignCenter size={14}/></button>
          </div>
        {/if}
        <div bind:this={elementRecorridos} class="editor-content"></div>
      </div>
    </div>

    <div class="grid-3 mt-20">
      <div class="campo"><label>Lugar Ensayo (Si es distinto)</label><input type="text" bind:value={ensayoLugar} placeholder="Ej: Mismo Salón" /></div>
      <div class="campo"><label>Fecha Ensayo</label><input type="date" bind:value={ensayoFecha} /></div>
      <div class="campo"><label>Hora</label><input type="time" bind:value={ensayoHora} /></div>
    </div>

    <div class="editor-block mt-20">
      <label><Info size={14}/> General rehearsal information (Notas)</label>
      <div class="tiptap-frame">
        {#if editorNotas}
          <div class="toolbar">
            <button type="button" on:click={() => ejecutar(editorNotas, c => c.toggleBold())}><Bold size={14}/></button>
            <button type="button" on:click={() => ejecutar(editorNotas, c => c.toggleUnderline())}><UnderIcon size={14}/></button>
            <button type="button" on:click={() => ejecutar(editorNotas, c => c.toggleBulletList())}><List size={14}/></button>
            <button type="button" on:click={() => ejecutar(editorNotas, c => c.unsetAllMarks())}><Eraser size={14}/></button>
          </div>
        {/if}
        <div bind:this={elementNotas} class="editor-content"></div>
      </div>
    </div>

    <label class="stream-check">
      <input type="checkbox" bind:checked={jwStreamStudio} />
      <span>Transmitir por <strong>JW Stream Studio</strong></span>
    </label>
  </div>
</div>

{#if mostrarModalSalon}
    <div class="modal-backdrop">
        <div class="modal">
            <div class="modal-header"><h3>Nuevo Salón</h3><button on:click={() => mostrarModalSalon = false}><X size={18}/></button></div>
            <div class="modal-body">
                <label>Nombre</label><input type="text" bind:value={nuevoSalon.nombre} placeholder="Ej: Salón Cotorro"/>
                <label>Dirección</label><input type="text" bind:value={nuevoSalon.direccion} placeholder="Calle..."/>
                <label>Capacidad</label><input type="number" bind:value={nuevoSalon.capacidad}/>
                <button class="btn-create" on:click={guardarNuevoSalon}>Crear y Asignar</button>
            </div>
        </div>
    </div>
{/if}

<style>
  .contenedor { display: flex; flex-direction: column; gap: 20px; padding-bottom: 40px; }
  .card-config { background: white; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; }
  .header-card, .header-ensayo { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 15px; }
  .full { grid-column: span 2; }
  .mt-20 { margin-top: 20px; }
  
  label { display: flex; gap: 8px; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 8px; }
  input, select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; box-sizing: border-box; font-size: 14px; }
  .input-big { font-size: 16px; font-weight: 600; color: #1e293b; }

  .selector-salon { display: flex; gap: 8px; }
  .btn-plus { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; width: 42px; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; }
  .btn-plus:hover { background: #e2e8f0; color: #2563eb; }

  /* --- TARJETA --- */
  .salon-info-card { 
      position: relative; 
      margin-top: 25px; /* Un poco más de margen arriba para el botón flotante */
      background: #f8fafc; 
      border: 1px solid #e2e8f0; 
      border-radius: 10px; 
      padding: 15px; 
      display: flex; 
      align-items: center; 
      gap: 15px;
  }
  
  /* --- BOTÓN DE CERRAR CORREGIDO --- */
  .btn-close-card {
      position: absolute;
      /* Lo sacamos un poco de la tarjeta con valores negativos */
      top: -12px;
      right: -12px;
      z-index: 100; /* Asegura que esté encima de todo */
      
      background: #ef4444; /* Rojo sólido para que se vea bien */
      color: white;       
      border: 2px solid white; /* Borde blanco para separarlo visualmente */
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
  }
  .btn-close-card:hover {
      background: #dc2626;
      transform: scale(1.1);
  }

  .icon-building { background: white; padding: 10px; border-radius: 8px; color: #2563eb; border: 1px solid #e2e8f0; }
  .info-text { flex: 1; display: flex; flex-direction: column; }
  .l-nombre { font-weight: 700; color: #1e293b; font-size: 15px; }
  .l-dir { font-size: 13px; color: #64748b; margin-top: 2px; }
  
  /* RECUADRO DE CAPACIDAD */
  .info-cap { 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      background: white; 
      padding: 5px 15px; 
      border-radius: 8px; 
      border: 1px solid #e2e8f0; 
      color: #0f172a; 
      /* Añadido margen derecho por seguridad, aunque el botón ya está fuera */
      margin-right: 5px;
  }
  .info-cap span { font-weight: 800; font-size: 16px; }
  .info-cap small { font-size: 10px; color: #94a3b8; text-transform: uppercase; }

  .tiptap-frame { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
  .toolbar { background: #f8fafc; padding: 6px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 4px; }
  .toolbar button { background: white; border: 1px solid #e2e8f0; padding: 6px; border-radius: 4px; cursor: pointer; color: #475569; }
  .toolbar button.active { background: #dbeafe; color: #2563eb; border-color: #3b82f6; }
  .editor-content { min-height: 100px; padding: 12px; }
  :global(.tiptap:focus) { outline: none; }

  .stream-check { display: flex; align-items: center; gap: 10px; margin-top: 20px; padding: 15px; background: #eff6ff; border-radius: 8px; cursor: pointer; border: 1px solid #bfdbfe; }
  .btn-save { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; display: flex; gap: 8px; font-weight: 600; margin-left: auto;}

  .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
  .modal { background: white; width: 350px; padding: 20px; border-radius: 12px; }
  .modal-header { display: flex; justify-content: space-between; margin-bottom: 15px; } .modal-header h3 { margin: 0; } .modal-header button { border: none; background: none; cursor: pointer; }
  .modal-body { display: flex; flex-direction: column; gap: 10px; }
  .btn-create { background: #0078d4; color: white; padding: 10px; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px; font-weight: 600; }
</style>
