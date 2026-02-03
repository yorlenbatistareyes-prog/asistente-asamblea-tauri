<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  // --- MOTOR DEL EDITOR (TIPTAP) ---
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  import TextAlign from '@tiptap/extension-text-align';
  import Subscript from '@tiptap/extension-subscript';
  import Superscript from '@tiptap/extension-superscript';
  
  // --- AQUÍ ESTABA EL ERROR: AHORA LLEVA LLAVES { } ---
  import { TextStyle } from '@tiptap/extension-text-style';
  
  import { Color } from '@tiptap/extension-color';
  import Link from '@tiptap/extension-link';
  import Placeholder from '@tiptap/extension-placeholder';
  import FontFamily from '@tiptap/extension-font-family';

  // --- ICONOS ---
  import { 
    Save, Mic, UserCheck, MessageSquare, ArrowLeft, FileText,
    Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Link as LinkIcon, Palette, Eraser, List, ListOrdered
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();
  export let seccionInicial = 'oradores';

  // --- VARIABLES ---
  let tipoActivo = seccionInicial;
  let element: HTMLElement;
  let editor: Editor;       
  let cargando = false;
  let contenidoCargado = "";

  // --- 1. CARGAR DATOS ---
  async function cargarPlantilla() {
    cargando = true;
    try {
      const respuesta = await invoke('obtener_plantilla', { id: tipoActivo }) as string;
      contenidoCargado = respuesta || `<p>Escriba aquí el modelo de carta para <strong>${tipoActivo.toUpperCase()}</strong>...</p>`;
      if (editor) {
        editor.commands.setContent(contenidoCargado);
      }
    } catch (e) {
      console.error("Error cargando:", e);
      if(editor) editor.commands.setContent("<p style='color:red'>Error al conectar con la base de datos.</p>");
    } finally {
      cargando = false;
    }
  }

  // --- 2. INICIALIZAR EDITOR ---
  onMount(() => {
    editor = new Editor({
      element: element,
      extensions: [
        StarterKit, 
        Underline,
        Subscript,
        Superscript,
        TextStyle, // Ahora esto funcionará correctamente
        Color,
        FontFamily,
        Link.configure({ openOnClick: false }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder: 'Escriba el contenido de la carta...' }),
      ],
      content: '', 
      onTransaction: () => {
        editor = editor; 
      },
    });
    cargarPlantilla();
  });

  onDestroy(() => {
    if (editor) editor.destroy();
  });

  // --- 3. GUARDAR ---
  async function actualizar() {
    if (!editor) return;
    try {
      const htmlFinal = editor.getHTML();
      await invoke('guardar_plantilla', { 
        id: tipoActivo, 
        contenido: htmlFinal 
      });
      alert(`✅ Plantilla de ${tipoActivo.toUpperCase()} guardada correctamente.`);
    } catch (e) {
      alert("Error al guardar: " + e);
    }
  }

  // --- FUNCIONES SEGURAS PARA TYPESCRIPT ---
  function cambiarFuente(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target.value) {
      editor.chain().focus().setFontFamily(target.value).run();
    }
  }

  function cambiarTamano(event: Event) {
    const target = event.target as HTMLSelectElement;
    const val = target.value;
    if (val === 'p') {
      editor.chain().focus().setParagraph().run();
    } else {
      const nivel = parseInt(val) as 1 | 2 | 3; 
      editor.chain().focus().toggleHeading({ level: nivel }).run();
    }
  }

  function cambiarColor(event: Event) {
    const target = event.target as HTMLInputElement;
    editor.chain().focus().setColor(target.value).run();
  }

  function addMarker(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target.value && editor) {
      editor.chain().focus().insertContent(`{{${target.value}}}`).run();
      target.value = ""; 
    }
  }

  function setLink() {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }
</script>

<div class="layout">
  
  <aside class="sidebar">
    <button class="btn-volver" on:click={() => dispatch('close')}>
      <ArrowLeft size={18} /> Volver
    </button>

    <div class="menu-info">
      <div class="label-menu">EDITANDO:</div>
      <div class="icon-box">
        {#if tipoActivo === 'oradores'} <Mic size={32} /> {/if}
        {#if tipoActivo === 'presidentes'} <UserCheck size={32} /> {/if}
        {#if tipoActivo === 'oraciones'} <MessageSquare size={32} /> {/if}
      </div>
      <span class="titulo-seccion">{tipoActivo.toUpperCase()}</span>
    </div>
  </aside>

  <main>
    <header>
      <div class="titulo-header">
        <FileText size={20}/>
        <h2>Editor de Cartas</h2>
      </div>
      <button class="btn-save" on:click={actualizar}>
        <Save size={16} /> Guardar Cambios
      </button>
    </header>

    <div class="workspace">
      <div class="editor-container">
        
        {#if editor}
          <div class="toolbar">
              <div class="group">
                  <button on:click={() => editor.chain().focus().setTextAlign('left').run()} class:active={editor.isActive({ textAlign: 'left' })}><AlignLeft size={16}/></button>
                  <button on:click={() => editor.chain().focus().setTextAlign('center').run()} class:active={editor.isActive({ textAlign: 'center' })}><AlignCenter size={16}/></button>
                  <button on:click={() => editor.chain().focus().setTextAlign('right').run()} class:active={editor.isActive({ textAlign: 'right' })}><AlignRight size={16}/></button>
                  <button on:click={() => editor.chain().focus().setTextAlign('justify').run()} class:active={editor.isActive({ textAlign: 'justify' })}><AlignJustify size={16}/></button>
              </div>
              <div class="separator"></div>

              <div class="group inputs">
                  <select class="native-select font-family" on:change={cambiarFuente}>
                      <option value="" selected>Fuente</option>
                      <option value="serif">Serif</option>
                      <option value="monospace">Monospace</option>
                      <option value="cursive">Cursive</option>
                  </select>
                  <select class="native-select font-size" on:change={cambiarTamano}>
                      <option value="p">Normal</option>
                      <option value="1">H1</option>
                      <option value="2">H2</option>
                  </select>
              </div>
              <div class="separator"></div>

              <div class="group">
                  <button on:click={() => editor.chain().focus().toggleBold().run()} class:active={editor.isActive('bold')}><Bold size={16} strokeWidth={2.5}/></button>
                  <button on:click={() => editor.chain().focus().toggleItalic().run()} class:active={editor.isActive('italic')}><Italic size={16}/></button>
                  <button on:click={() => editor.chain().focus().toggleUnderline().run()} class:active={editor.isActive('underline')}><UnderlineIcon size={16}/></button>
                  <button on:click={() => editor.chain().focus().toggleStrike().run()} class:active={editor.isActive('strike')}><Strikethrough size={16}/></button>
              </div>
              <div class="separator"></div>

              <div class="group">
                <div class="color-wrapper" title="Color de texto">
                    <input type="color" on:input={cambiarColor} value={editor.getAttributes('textStyle').color || '#000000'} />
                    <Palette size={16} />
                </div>
               </div>
               <div class="separator"></div>

              <div class="group">
                  <button on:click={() => editor.chain().focus().toggleBulletList().run()} class:active={editor.isActive('bulletList')}><List size={16}/></button>
                  <button on:click={() => editor.chain().focus().toggleOrderedList().run()} class:active={editor.isActive('orderedList')}><ListOrdered size={16}/></button>
              </div>

              <div class="group ml-auto">
                  <select on:change={addMarker} class="marker-select">
                      <option value="" disabled selected>Marcadores</option>
                      <option value="Nombre">Nombre</option>
                      <option value="Fecha">Fecha</option>
                      <option value="Congregacion">Congregación</option>
                      <option value="Direccion">Dirección</option>
                  </select>
              </div>
          </div>
        {/if}

        <div class="editor-content" bind:this={element}></div>
      
      </div>
    </div>
  </main>
</div>

<style>
  /* LAYOUT */
  .layout { display: grid; grid-template-columns: 240px 1fr; height: 100vh; background: #f3f4f6; font-family: 'Segoe UI', sans-serif; }
  
  /* SIDEBAR */
  .sidebar { background: white; padding: 20px; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; align-items: center; }
  .btn-volver { align-self: flex-start; background: white; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; gap: 5px; color: #64748b; margin-bottom: 40px; }
  .btn-volver:hover { background: #f1f5f9; color: black; }
  
  .menu-info { text-align: center; }
  .label-menu { font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; margin-bottom: 15px; }
  .icon-box { width: 70px; height: 70px; background: #eff6ff; color: #2563eb; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
  .titulo-seccion { font-weight: 800; color: #334155; font-size: 14px; letter-spacing: 1px; }

  /* MAIN */
  main { display: flex; flex-direction: column; height: 100%; }
  header { background: #1e293b; color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; }
  .titulo-header { display: flex; align-items: center; gap: 10px; }
  h2 { margin: 0; font-size: 18px; font-weight: 600; }
  
  .btn-save { background: #2563eb; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; display: flex; gap: 8px; font-weight: 600; transition: background 0.2s; }
  .btn-save:hover { background: #1d4ed8; }

  .workspace { flex: 1; padding: 30px; overflow-y: auto; display: flex; justify-content: center; }

  /* EDITOR CONTAINER */
  .editor-container {
    width: 100%; max-width: 950px; background: white; border-radius: 8px; 
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; overflow: hidden; height: fit-content; min-height: 600px;
  }

  /* TOOLBAR */
  .toolbar {
    display: flex; align-items: center; background: #f8fafc; padding: 8px 12px;
    border-bottom: 1px solid #e2e8f0; gap: 6px; flex-wrap: wrap; position: sticky; top: 0; z-index: 10;
  }
  .group { display: flex; align-items: center; gap: 2px; }
  .separator { width: 1px; height: 24px; background: #cbd5e1; margin: 0 6px; }
  .ml-auto { margin-left: auto; }

  .toolbar button {
    width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
    background: transparent; border: 1px solid transparent; border-radius: 4px;
    color: #475569; cursor: pointer; transition: all 0.2s;
  }
  .toolbar button:hover { background-color: #e2e8f0; color: #0f172a; }
  .toolbar button.active { background-color: #dbeafe; color: #1e40af; border-color: #93c5fd; }

  /* INPUTS */
  .native-select { height: 30px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 0 4px; font-size: 13px; color: #334155; outline: none; cursor: pointer; background: white; }
  .font-family { width: 100px; } .font-size { width: 80px; }
  
  .marker-select { height: 30px; border: 1px solid #bfdbfe; background: #eff6ff; color: #2563eb; font-weight: 600; border-radius: 4px; padding: 0 10px; outline: none; cursor: pointer; font-size: 13px; }
  
  .color-wrapper { position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; }
  .color-wrapper:hover { background-color: #e2e8f0; }
  .color-wrapper input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

  .editor-content { flex: 1; padding: 40px 50px; outline: none; font-size: 16px; line-height: 1.6; color: #1e293b; min-height: 500px; cursor: text; }

  :global(.ProseMirror) { outline: none; min-height: 100%; }
  :global(.ProseMirror p) { margin-bottom: 0.8em; }
  :global(.ProseMirror blockquote) { border-left: 3px solid #cbd5e1; padding-left: 1rem; color: #64748b; font-style: italic; }
  :global(.ProseMirror ul, .ProseMirror ol) { padding-left: 1.5rem; }
  :global(.ProseMirror a) { color: #2563eb; text-decoration: underline; cursor: pointer; }
  :global(.ProseMirror p.is-editor-empty:first-child::before) { color: #94a3b8; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
</style>