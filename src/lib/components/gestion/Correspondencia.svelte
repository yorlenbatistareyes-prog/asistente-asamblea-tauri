<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  // --- TIPTAP ---
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  
  // Iconos
  import { 
    Save, Mic, UserCheck, MessageSquare, ArrowLeft, 
    Bold, Italic, List, Eraser, ListOrdered, 
    Undo, Redo, Quote, X, FileText
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  // 1. RECIBIMOS LA SECCIÓN DESDE EL INICIO (Esta es la única que importa)
  export let seccionInicial = 'oradores';

  // --- ESTADO ---
  let tipoActivo = seccionInicial; 
  let editor: Editor | null = null;
  let editorElement: HTMLElement;
  let cargando = false;

  async function cargarPlantilla() {
    cargando = true;
    try {
      const contenido = await invoke('obtener_plantilla', { id: tipoActivo }) as string;
      if (editor) {
        editor.commands.setContent(contenido || `<p>Escriba aquí el modelo de carta para <strong>${tipoActivo}</strong>...</p>`);
      }
    } catch (e) {
      console.error("Error cargando plantilla:", e);
      if (editor) {
        editor.commands.setContent("<p>Error al cargar. Intente nuevamente.</p>");
      }
    } finally {
      cargando = false;
    }
  }

  onMount(() => {
    // Inicialización del Editor
    editor = new Editor({
      element: editorElement,
      extensions: [StarterKit, Underline],
      content: '', 
      editorProps: {
        attributes: { class: 'focus:outline-none' },
      },
    });

    // Cargamos la plantilla única
    cargarPlantilla(); 
  });

  onDestroy(() => {
    if (editor) editor.destroy();
  });

  async function actualizar() {
    if (!editor) return;
    try {
      await invoke('guardar_plantilla', { 
        id: tipoActivo, 
        contenido: editor.getHTML() 
      });
      alert(`✅ Plantilla de ${tipoActivo} guardada correctamente.`);
    } catch (e) {
      alert("Error al guardar: " + e);
    }
  }

  const cmd = (cb: (chain: any) => any) => { 
    if (editor) cb(editor.chain().focus()).run();
  };
</script>

<div class="pagina-correspondencia">
  
  <aside class="sidebar-cartas">
    <button class="btn-volver" on:click={() => dispatch('close')}>
      <ArrowLeft size={18} /> Volver
    </button>

    <div class="indicador-seccion">
      <div class="label-menu">EDITANDO PLANTILLA DE:</div>
      
      <div class="tarjeta-statica">
        {#if tipoActivo === 'oradores'}
            <div class="icon-big oradores"><Mic size={32} /></div>
            <span>ORADORES</span>
        {:else if tipoActivo === 'presidentes'}
            <div class="icon-big presidentes"><UserCheck size={32} /></div>
            <span>PRESIDENTES</span>
        {:else if tipoActivo === 'oraciones'}
            <div class="icon-big oraciones"><MessageSquare size={32} /></div>
            <span>ORACIONES</span>
        {/if}
      </div>
    </div>
  </aside>

  <main class="editor-maestro">
    <header class="header-banner">
      <div class="header-title">
        <FileText size={20}/>
        <h2>Editor de Cartas</h2>
      </div>
      <button class="btn-actualizar" on:click={actualizar}>
        <Save size={16} /> Guardar Cambios
      </button>
    </header>

    <div class="info-texto">
      <h3>
        {#if tipoActivo === 'oradores'} Carta de Asignación para Discursantes {/if}
        {#if tipoActivo === 'presidentes'} Carta de Asignación para Presidentes {/if}
        {#if tipoActivo === 'oraciones'} Carta de Asignación para Oraciones {/if}
      </h3>
      <p>Modifique el modelo base. Este formato se usará automáticamente en todas sus asambleas.</p>
    </div>

    <div class="tiptap-container">
      {#if editor}
        <div class="toolbar-groups">
          
          <div class="group">
            <button on:click={() => cmd(c => c.toggleBold())} class:active={editor.isActive('bold')} title="Negrita"><strong>B</strong></button>
            <button on:click={() => cmd(c => c.toggleItalic())} class:active={editor.isActive('italic')} title="Cursiva"><em>I</em></button>
            <button on:click={() => cmd(c => c.toggleStrike())} class:active={editor.isActive('strike')} title="Tachado"><Eraser size={16}/></button>
            <button on:click={() => cmd(c => c.toggleUnderline())} class:active={editor.isActive('underline')} title="Subrayado"><u>U</u></button>
          </div>

          <div class="group">
            <button on:click={() => cmd(c => c.toggleBlockquote())} title="Cita"><Quote size={16}/></button>
            <button on:click={() => cmd(c => c.toggleBulletList())} title="Lista Puntos"><List size={16}/></button>
            <button on:click={() => cmd(c => c.toggleOrderedList())} title="Lista Números"><ListOrdered size={16}/></button>
          </div>

          <div class="group">
            <button on:click={() => cmd(c => c.undo())} title="Deshacer"><Undo size={16}/></button>
            <button on:click={() => cmd(c => c.redo())} title="Rehacer"><Redo size={16}/></button>
          </div>

          <div class="group wide">
            <select class="selector-marcadores" on:change={(e) => {
              const val = e.currentTarget.value;
              if (val && editor) {
                editor.chain().focus().insertContent(val).run();
                e.currentTarget.value = "";
              }
            }}>
              <option value="">+ Insertar Dato Automático</option>
              <option value="[NOMBRE]">Nombre Hno.</option>
              <option value="[TEMA]">Tema Discurso</option>
              <option value="[FECHA]">Fecha</option>
              <option value="[HORA]">Hora</option>
              <option value="[LUGAR]">Lugar / Salón</option>
            </select>
          </div>

          <button class="btn-clean" on:click={() => cmd(c => c.unsetAllMarks())} title="Limpiar Formato"><X size={16}/></button>
        </div>
      {/if}
      
      <div bind:this={editorElement} class="editor-view"></div>
    </div>
  </main>
</div>

<style>
  .pagina-correspondencia { display: grid; grid-template-columns: 240px 1fr; height: 100vh; background: #fff; }

  /* SIDEBAR */
  .sidebar-cartas { background: #f8fafc; border-right: 1px solid #e2e8f0; padding: 25px; display: flex; flex-direction: column; }
  .btn-volver { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; padding: 10px 15px; border-radius: 8px; color: #64748b; cursor: pointer; font-weight: 600; margin-bottom: 40px; transition: all 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
  .btn-volver:hover { border-color: #cbd5e1; color: #1e293b; transform: translateY(-1px); }

  .indicador-seccion { text-align: center; margin-top: 20px; }
  .label-menu { font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; margin-bottom: 15px; text-transform: uppercase; }
  
  .tarjeta-statica {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 30px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
  }
  .tarjeta-statica span { font-weight: 800; color: #334155; letter-spacing: 1px; }

  .icon-big { width: 60px; height: 60px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .oradores { background: #ecfdf5; color: #10b981; }
  .presidentes { background: #eff6ff; color: #3b82f6; }
  .oraciones { background: #fff7ed; color: #f59e0b; }

  /* EDITOR HEADER */
  .header-banner { background: #0f172a; color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; }
  .header-title { display: flex; align-items: center; gap: 10px; }
  .header-banner h2 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 0.5px; }
  .btn-actualizar { background: #2563eb; border: none; color: white; padding: 8px 20px; border-radius: 6px; cursor: pointer; display: flex; gap: 8px; font-size: 13px; font-weight: 600; transition: background 0.2s; }
  .btn-actualizar:hover { background: #1d4ed8; }

  .info-texto { padding: 25px 40px; border-bottom: 1px solid #f1f5f9; background: #fafafa; }
  .info-texto h3 { margin: 0; font-size: 20px; color: #1e293b; font-weight: 700; }
  .info-texto p { margin: 5px 0 0; font-size: 14px; color: #64748b; }

  /* TOOLBAR */
  .toolbar-groups { background: white; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; padding: 10px 40px; flex-wrap: wrap; gap: 8px; position: sticky; top: 0; z-index: 10; }
  .group { display: flex; align-items: center; border-right: 1px solid #dee2e6; padding-right: 10px; margin-right: 5px; gap: 4px; }
  .group:last-child { border-right: none; }
  
  .group button { background: none; border: 1px solid transparent; padding: 6px; cursor: pointer; color: #475569; font-size: 14px; border-radius: 4px; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; transition: all 0.1s; }
  .group button:hover { background: #f1f5f9; color: #0f172a; }
  .group button.active { background: #e2e8f0; color: #0f172a; border-color: #cbd5e1; }

  .selector-marcadores { border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #0078d4; font-weight: 600; background: #eff6ff; cursor: pointer; outline: none; transition: border 0.2s; min-width: 180px; }
  .selector-marcadores:hover { border-color: #0078d4; }
  .btn-clean { margin-left: auto; background: none; border: none; padding: 8px; cursor: pointer; color: #94a3b8; transition: color 0.2s; }
  .btn-clean:hover { color: #ef4444; }

  /* EDITOR VIEW */
  .editor-view { flex: 1; padding: 50px 60px; overflow-y: auto; max-width: 900px; margin: 0 auto; background: white; min-height: 600px; box-shadow: 0 0 20px rgba(0,0,0,0.02); }
  
  :global(.tiptap) { outline: none; min-height: 100%; font-size: 16px; line-height: 1.7; color: #334155; }
  :global(.tiptap p) { margin-bottom: 1em; }
  :global(.tiptap ul, .tiptap ol) { padding-left: 1.5em; }
  :global(.tiptap blockquote) { border-left: 4px solid #e2e8f0; padding-left: 1em; color: #64748b; font-style: italic; background: #f8fafc; padding: 10px 10px 10px 20px; border-radius: 4px; }
</style>
