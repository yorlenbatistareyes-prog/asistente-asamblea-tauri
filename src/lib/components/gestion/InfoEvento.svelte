<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  import TextAlign from '@tiptap/extension-text-align';
  import { 
    Save, Calendar, MapPin, Bookmark, Clock, Info, Monitor, 
    AlignLeft, Bold, Italic, Underline as UnderIcon, List, ListOrdered, 
    AlignCenter, AlignRight, Eraser 
  } from 'lucide-svelte';

  // --- VARIABLES DE EVENTO ---
  let asambleaId: number | null = null;
  let tema = "";
  let fecha = "";
  let idLocal = ""; // Importante: String vacío por defecto para el <select>
  let locales: any[] = [];

  // --- VARIABLES DE ENSAYOS ---
  let ensayoLugar = "";
  let ensayoFecha = "";
  let ensayoHora = "";
  let jwStreamStudio = false;
  let instruccionesEsp = ""; 

  // --- CONFIGURACIÓN TIPTAP ---
  let elementRecorridos: HTMLElement;
  let elementNotas: HTMLElement;
  let editorRecorridos: Editor;
  let editorNotas: Editor;

  let htmlRecorridos = "";
  let htmlNotas = "";

  // Función auxiliar para ejecutar comandos sin errores de tipo
  const ejecutar = (editor: Editor, cb: (chain: any) => any) => {
    if (editor) cb(editor.chain().focus()).run();
  };

  onMount(async () => {
    try {
      // 1. Cargar la lista de locales (necesario para el desplegable)
      locales = await invoke('obtener_locales') as any[];

      // 2. Obtener la asamblea activa (la recién creada o la última visitada)
      const asamblea = await invoke('obtener_asamblea_activa') as any;
      
      if (asamblea) {
        asambleaId = asamblea.id;
        tema = asamblea.tema || "";
        fecha = asamblea.fecha || "";
        
        // --- CORRECCIÓN CLAVE PARA NUEVA ASAMBLEA ---
        // Si es nueva, local_id viene como null. Lo convertimos a "" para que el select muestre "Seleccionar..."
        // Si ya tiene local, lo convertimos a string para que el binding funcione.
        idLocal = (asamblea.local_id !== null && asamblea.local_id !== undefined) 
                  ? asamblea.local_id.toString() 
                  : "";

        ensayoLugar = asamblea.ensayo_lugar || "";
        ensayoFecha = asamblea.ensayo_fecha || "";
        ensayoHora = asamblea.ensayo_hora || "";
        instruccionesEsp = asamblea.instrucciones_esp || "";
        
        // Conversión de entero SQLite (1/0) a booleano JS (true/false)
        jwStreamStudio = asamblea.jw_stream_studio === 1;

        // Aseguramos que los editores reciban al menos un string vacío, nunca null
        htmlRecorridos = asamblea.recorridos_info || "";
        htmlNotas = asamblea.ensayo_notas || "";
      }

      // 3. Inicializar Editores (Solo después de cargar los datos)
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

    } catch (error) {
      console.error("Error al cargar InfoEvento:", error);
      alert("Ocurrió un error al cargar los datos de la asamblea.");
    }
  });

  onDestroy(() => {
    editorRecorridos?.destroy();
    editorNotas?.destroy();
  });

  async function guardar() {
    try {
      await invoke('guardar_info_evento', {
        id: asambleaId,
        tema, 
        fecha,
        // Si idLocal es "", enviamos null a la base de datos
        localId: idLocal ? parseInt(idLocal) : null, 
        ensayoLugar, 
        ensayoFecha, 
        ensayoHora,
        ensayoNotas: htmlNotas,
        recorridosInfo: htmlRecorridos,
        instruccionesEsp,
        esJwStream: jwStreamStudio
      });
      alert("✅ Configuración guardada correctamente");
    } catch (e) { 
      console.error(e);
      alert("❌ Error al guardar: " + e); 
    }
  }
</script>

<div class="contenedor">
  <div class="card-config">
    <div class="header-card">
      <h3><Bookmark size={18}/> Información del Evento</h3>
      <button class="btn-save" on:click={guardar}><Save size={18}/> Guardar Todo</button>
    </div>
    
    <div class="formulario grid-2">
      <div class="campo full"><label>Tema</label><input type="text" bind:value={tema} /></div>
      <div class="campo"><label><Calendar size={14}/> Fecha</label><input type="text" bind:value={fecha} /></div>
      <div class="campo">
        <label><MapPin size={14}/> Lugar</label>
        <select bind:value={idLocal}>
          {#each locales as l}<option value={l.id}>{l.nombre}</option>{/each}
        </select>
      </div>
    </div>
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
      <div class="campo"><label>Lugar Ensayo</label><input type="text" bind:value={ensayoLugar} /></div>
      <div class="campo"><label>Fecha</label><input type="date" bind:value={ensayoFecha} /></div>
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

<style>
  .contenedor { display: flex; flex-direction: column; gap: 20px; }
  .card-config { background: white; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; }
  .header-card, .header-ensayo { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 15px; }
  .full { grid-column: span 2; }
  .mt-20 { margin-top: 20px; }
  
  label { display: flex; gap: 8px; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 8px; }
  input, select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; box-sizing: border-box; }

  /* TIPTAP STYLES */
  .tiptap-frame { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
  .toolbar { background: #f8fafc; padding: 6px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 4px; }
  .toolbar button { background: white; border: 1px solid #e2e8f0; padding: 6px; border-radius: 4px; cursor: pointer; color: #475569; }
  .toolbar button.active { background: #dbeafe; color: #2563eb; border-color: #3b82f6; }
  .editor-content { min-height: 100px; padding: 12px; }
  :global(.tiptap:focus) { outline: none; }

  .stream-check { display: flex; align-items: center; gap: 10px; margin-top: 20px; padding: 15px; background: #eff6ff; border-radius: 8px; cursor: pointer; border: 1px solid #bfdbfe; }
  .btn-save { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; display: flex; gap: 8px; font-weight: 600; margin-left: auto;}
</style>