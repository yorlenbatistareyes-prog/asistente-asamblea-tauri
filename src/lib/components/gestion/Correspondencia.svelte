<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  // --- TIPTAP: Solo importamos lo BÁSICO y SEGURO para que compile ---
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  
  // NOTA: He quitado TextStyle, Color, Highlight y FontFamily 
  // porque son los que causan el error de compilación. 
  // Podremos añadirlos después cuando el sistema esté estable.

  // Iconos
  import { 
    Save, Mic, UserCheck, MessageSquare, ArrowLeft, 
    Bold, Italic, List, Eraser, ListOrdered, 
    Undo, Redo, Quote, X
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  // --- ESTADO ---
  let tipoActivo = 'oradores'; 
  let editor: Editor | null = null;
  let editorElement: HTMLElement;
  let cargando = false;

  async function cargarPlantilla(tipo: string) {
    cargando = true;
    tipoActivo = tipo;
    try {
      const contenido = await invoke('obtener_plantilla', { id: tipo }) as string;
      if (editor) {
        editor.commands.setContent(contenido);
      }
    } catch (e) {
      console.error("Error cargando plantilla:", e);
      if (editor) {
        editor.commands.setContent("<p>Añada el cuerpo de la carta aquí...</p>");
      }
    } finally {
      cargando = false;
    }
  }

  onMount(() => {
    // Inicialización LIMPIA: Solo extensiones que sabemos que funcionan
    editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Underline,
      ],
      content: '',
      editorProps: {
        attributes: {
          class: 'focus:outline-none',
        },
      },
    });

    cargarPlantilla('oradores'); 
  });

  onDestroy(() => {
    if (editor) {
      editor.destroy();
    }
  });

  async function actualizar() {
    if (!editor) return;
    try {
      await invoke('guardar_plantilla', { 
        id: tipoActivo, 
        contenido: editor.getHTML() 
      });
      alert(`✅ Plantilla de ${tipoActivo} actualizada.`);
    } catch (e) {
      alert("Error al guardar: " + e);
    }
  }

  const cmd = (cb: (chain: any) => any) => { 
    if (editor) {
      cb(editor.chain().focus()).run();
    }
  };
</script>

<div class="pagina-correspondencia">
  <aside class="sidebar-cartas">
    <button class="btn-volver" on:click={() => dispatch('close')}>
      <ArrowLeft size={18} /> Volver al Inicio
    </button>

    <div class="menu-items">
      <div class="label-menu">SECCIONES DE CARTA</div>
      <button class:active={tipoActivo === 'oradores'} on:click={() => cargarPlantilla('oradores')}>
        <div class="icon-box oradores"><Mic size={18} /></div> 
        <span>Oradores</span>
      </button>
      <button class:active={tipoActivo === 'presidentes'} on:click={() => cargarPlantilla('presidentes')}>
        <div class="icon-box presidentes"><UserCheck size={18} /></div> 
        <span>Presidentes</span>
      </button>
      <button class:active={tipoActivo === 'oraciones'} on:click={() => cargarPlantilla('oraciones')}>
        <div class="icon-box oraciones"><MessageSquare size={18} /></div> 
        <span>Oraciones</span>
      </button>
    </div>
  </aside>

  <main class="editor-maestro">
    <header class="header-banner">
      <h2>EDITOR DE LA CARTA DE ASIGNACIÓN</h2>
      <button class="btn-actualizar" on:click={actualizar}>
        <Save size={16} /> Actualizar Plantilla
      </button>
    </header>

    <div class="info-texto">
      <h3>Contenido de la carta de asignación</h3>
      <p>Añada solo el cuerpo de la carta en este lugar.</p>
    </div>

    <div class="tiptap-container">
      {#if editor}
        <div class="toolbar-groups">
          
          <div class="group">
            <button on:click={() => cmd(c => c.toggleBold())} class:active={editor.isActive('bold')}><strong>B</strong></button>
            <button on:click={() => cmd(c => c.toggleItalic())} class:active={editor.isActive('italic')}><em>I</em></button>
            <button on:click={() => cmd(c => c.toggleStrike())} class:active={editor.isActive('strike')}><Eraser size={16}/></button>
            <button on:click={() => cmd(c => c.toggleUnderline())} class:active={editor.isActive('underline')}><u>U</u></button>
          </div>

          <div class="group">
            <button on:click={() => cmd(c => c.toggleBlockquote())} title="Cita"><Quote size={16}/></button>
            <button on:click={() => cmd(c => c.toggleBulletList())} title="Lista"><List size={16}/></button>
            <button on:click={() => cmd(c => c.toggleOrderedList())} title="Lista Núm"><ListOrdered size={16}/></button>
          </div>

          <div class="group">
            <button on:click={() => cmd(c => c.undo())} title="Deshacer"><Undo size={16}/></button>
            <button on:click={() => cmd(c => c.redo())} title="Rehacer"><Redo size={16}/></button>
          </div>

          <div class="group">
            <select class="selector-marcadores" on:change={(e) => {
              const val = e.currentTarget.value;
              if (val && editor) {
                editor.chain().focus().insertContent(val).run();
                e.currentTarget.value = "";
              }
            }}>
              <option value="">Marcadores</option>
              <option value="[NOMBRE]">Nombre</option>
              <option value="[TEMA]">Tema</option>
              <option value="[FECHA]">Fecha</option>
              <option value="[HORA]">Hora</option>
              <option value="[LUGAR]">Lugar</option>
            </select>
          </div>

          <button class="btn-clean" on:click={() => cmd(c => c.unsetAllMarks())} title="Limpiar"><X size={16}/></button>
        </div>
      {/if}
      
      <div bind:this={editorElement} class="editor-view"></div>
    </div>
  </main>
</div>

<style>
  .pagina-correspondencia { display: grid; grid-template-columns: 260px 1fr; height: 100vh; background: #fff; }

  /* SIDEBAR */
  .sidebar-cartas { background: #f8fafc; border-right: 1px solid #e2e8f0; padding: 25px; }
  .btn-volver { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; color: #64748b; cursor: pointer; font-weight: 600; margin-bottom: 30px; }

  .label-menu { font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; margin-bottom: 10px; }
  .menu-items { display: flex; flex-direction: column; gap: 5px; }
  .menu-items button { display: flex; align-items: center; gap: 12px; padding: 10px; width: 100%; border-radius: 8px; border: none; background: none; cursor: pointer; color: #475569; font-weight: 600; text-align: left;}
  .menu-items button.active { background: #e2e8f0; color: #1e293b; }
  .icon-box { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
  .oradores { background: #ecfdf5; color: #10b981; }
  .presidentes { background: #eff6ff; color: #3b82f6; }
  .oraciones { background: #fff7ed; color: #f59e0b; }

  /* EDITOR HEADER */
  .header-banner { background: #2d5a4c; color: white; padding: 15px 25px; display: flex; justify-content: space-between; align-items: center; }
  .header-banner h2 { margin: 0; font-size: 22px; font-weight: 400; letter-spacing: 0.5px; }
  .btn-actualizar { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 6px 15px; border-radius: 4px; cursor: pointer; display: flex; gap: 8px; font-size: 13px; }

  .info-texto { padding: 20px 25px; border-bottom: 1px solid #f1f5f9; }
  .info-texto h3 { margin: 0; font-size: 16px; color: #1e293b; }
  .info-texto p { margin: 4px 0 0; font-size: 14px; color: #64748b; }

  /* TOOLBAR */
  .toolbar-groups { background: #f8f9fa; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; padding: 4px 10px; flex-wrap: wrap; }
  .group { display: flex; align-items: center; border-right: 1px solid #dee2e6; padding: 4px 8px; gap: 2px; }
  .group button { background: none; border: none; padding: 5px 8px; cursor: pointer; color: #495057; font-size: 13px; border-radius: 4px; display: flex; align-items: center; gap: 4px; }
  .group button:hover { background: #e9ecef; }
  .group button.active { background: #dee2e6; color: #000; }

  .selector-marcadores { border: 1px solid #ced4da; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #0078d4; font-weight: bold; background: white; cursor: pointer; }
  .btn-clean { margin-left: auto; background: none; border: none; padding: 8px; cursor: pointer; color: #adb5bd; }

  .editor-view { flex: 1; padding: 30px 40px; overflow-y: auto; }
  :global(.tiptap) { outline: none; min-height: 100%; font-size: 16px; line-height: 1.6; }
</style>
