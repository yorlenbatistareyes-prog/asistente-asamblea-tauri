<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  // --- STORE DE DATOS Y UTILIDADES PARA EMAIL ---
  import { emailTemplates, marcadoresEmail, cargarPlantillasEmail, guardarPlantillaEmail, type PlantillaEmail as Plantilla } from '$lib/utils/plantillasEmail';

  // --- TIPTAP ---
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  import TextAlign from '@tiptap/extension-text-align';
  import Link from '@tiptap/extension-link';
  import { Color } from '@tiptap/extension-color';
  import { TextStyle } from '@tiptap/extension-text-style';
  import Highlight from '@tiptap/extension-highlight';

  // --- ICONOS ---
  import { 
    FileText, ChevronUp, ChevronDown, PenTool, Upload, Download, RefreshCw,
    X, Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, IndentDecrease, IndentIncrease, Highlighter, Link as LinkIcon, Unlink, Minus,
    Check, Loader2, Cloud, Undo, Redo
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher();

  // --- ESTADO ---
  let editando = false; 
  let plantillaActual: Plantilla | null = null;

  // --- EDITOR ---
  let editor: Editor | null = null;
  let element: HTMLElement; 
  let asuntoInput: HTMLInputElement;
  let saveStatus: 'saved' | 'saving' | 'unsaved' = 'saved';
  let autosaveTimer: any;
  
  // Estados Toolbar
  let isBold = false, isItalic = false, isUnderline = false, isStrike = false;
  let isLink = false, isHighlight = false, isBulletList = false, isOrderedList = false;
  let textAlign = 'left';
  let canUndo = false;
  let canRedo = false;

  function toggle(id: string) {
      emailTemplates.update(items => items.map(p => p.id === id ? { ...p, isOpen: !p.isOpen } : p));
  }

  // --- COMUNICACIÓN CON PADRE ---
  function setModoEdicion(estado: boolean) {
      editando = estado;
      dispatch('cambioModo', estado);
  }

  // --- ABRIR EDITOR ---
  async function abrirEditor(plantilla: Plantilla) {
      // Hacemos una copia del objeto para no mutar el store directamente
      plantillaActual = JSON.parse(JSON.stringify(plantilla));
      
      // Ya no necesitamos cargar desde Rust porque el store ya tiene los datos actualizados.
      // Sin embargo, por si acaso, podemos dejar un comentario.
      
      setModoEdicion(true);
      setTimeout(() => initEditor(), 50);
  }

  function initEditor() {
      if (editor) editor.destroy();

      editor = new Editor({
          element: element,
          extensions: [
              StarterKit, 
              Underline, TextStyle, Color, Highlight.configure({ multicolor: true }),
              Link.configure({ openOnClick: false }), TextAlign.configure({ types: ['heading', 'paragraph'] }),
          ],
          content: plantillaActual?.body || '',
          onUpdate: ({ editor }) => {
              if (plantillaActual) {
                  plantillaActual.body = editor.getHTML();
                  actualizarToolbar();
                  triggerAutosave();
              }
          },
          onSelectionUpdate: () => actualizarToolbar(),
          onTransaction: () => actualizarToolbar()
      });
      actualizarToolbar();
  }

  function actualizarToolbar() {
      if (!editor) return;
      isBold = editor.isActive('bold');
      isItalic = editor.isActive('italic');
      isUnderline = editor.isActive('underline');
      isStrike = editor.isActive('strike');
      isLink = editor.isActive('link');
      isHighlight = editor.isActive('highlight');
      isBulletList = editor.isActive('bulletList');
      isOrderedList = editor.isActive('orderedList');
      
      if (editor.isActive({ textAlign: 'left' })) textAlign = 'left';
      else if (editor.isActive({ textAlign: 'center' })) textAlign = 'center';
      else if (editor.isActive({ textAlign: 'right' })) textAlign = 'right';
      else if (editor.isActive({ textAlign: 'justify' })) textAlign = 'justify';
      else textAlign = 'left';

      canUndo = editor.can().undo();
      canRedo = editor.can().redo();
  }

  // Funciones Toolbar
  const toggleB = () => editor?.chain().focus().toggleBold().run();
  const toggleI = () => editor?.chain().focus().toggleItalic().run();
  const toggleU = () => editor?.chain().focus().toggleUnderline().run();
  const toggleStrike = () => editor?.chain().focus().toggleStrike().run();
  const setAlign = (a: string) => editor?.chain().focus().setTextAlign(a).run();
  const setList = (t: 'bullet'|'ordered') => t==='bullet' ? editor?.chain().focus().toggleBulletList().run() : editor?.chain().focus().toggleOrderedList().run();
  const indent = (d: 'in'|'out') => d==='in' ? editor?.chain().focus().sinkListItem('listItem').run() : editor?.chain().focus().liftListItem('listItem').run();
  const setLink = () => { const url = prompt('URL:'); if(url) editor?.chain().focus().setLink({ href: url }).run(); };
  const unsetLink = () => editor?.chain().focus().unsetLink().run();
  const setHighlight = () => editor?.chain().focus().toggleHighlight().run();
  const setTextColor = () => { const c = prompt('Color (hex):', '#000000'); if(c) editor?.chain().focus().setColor(c).run(); };
  const addLine = () => editor?.chain().focus().setHorizontalRule().run();
  const undo = () => editor?.chain().focus().undo().run();
  const redo = () => editor?.chain().focus().redo().run();

  // Marcadores
  let marcadoresUI = marcadoresEmail.map(grp => ({ ...grp }));
  
  function toggleMarcadorGroup(i: number) {
      marcadoresUI[i].isOpen = !marcadoresUI[i].isOpen;
      marcadoresUI = [...marcadoresUI];
  }

  function insertarMarcador(code: string) {
    // 1. Verificar si el foco está en el input de asunto
    if (document.activeElement === asuntoInput && asuntoInput) {
        // Obtener posición del cursor (manejar null)
        const inicio = asuntoInput.selectionStart ?? 0;
        const fin = asuntoInput.selectionEnd ?? 0;
        const valorActual = asuntoInput.value;
        const nuevoValor = valorActual.substring(0, inicio) + ` ${code} ` + valorActual.substring(fin);
        
        // Actualizar input y store
        asuntoInput.value = nuevoValor;
        if (plantillaActual) {
            plantillaActual.subject = nuevoValor;
        }
        
        // Disparar evento input para activar autosave
        asuntoInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Restaurar cursor después del marcador insertado
        asuntoInput.focus();
        const nuevaPosicion = inicio + code.length + 2;
        asuntoInput.setSelectionRange(nuevaPosicion, nuevaPosicion);
    } 
    // 2. Si no, insertar en el editor (cuerpo)
    else if (editor) {
        editor.chain().focus().insertContent(` ${code} `).run();
        triggerAutosave();
    }
}

    async function guardar(cerrarAlTerminar = false) {
      if (!plantillaActual) return;
      
      // 1. FORZAMOS QUE COJA EL TEXTO DEL EDITOR
      if (editor) {
          plantillaActual.body = editor.getHTML();
      }

      console.log("🚀 ENVIANDO A RUST:", plantillaActual);
      saveStatus = 'saving';

      try {
          // 2. USAR LA FUNCIÓN CENTRALIZADA guardarPlantillaEmail
          await guardarPlantillaEmail(
              plantillaActual.id,
              plantillaActual.subject || '',
              plantillaActual.body || ''
          );

          // 3. La función guardarPlantillaEmail ya actualiza el store, 
          //    pero necesitamos forzar la apertura (isOpen = true) y mantener el estado visual.
          emailTemplates.update(items => items.map(p => 
              p.id === plantillaActual!.id 
                  ? { ...p, isOpen: true } // Mantenemos el isOpen = true después de guardar
                  : p
          ));

          saveStatus = 'saved';
          
          if (cerrarAlTerminar) {
              cerrarEditor();
          }

      } catch (error) {
          console.error("❌ ERROR FATAL:", error);
          alert("ERROR AL GUARDAR:\n" + error); 
          saveStatus = 'unsaved';
      }
  }

  function triggerAutosave() {
      saveStatus = 'unsaved';
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => guardar(false), 1500);
  }

  function cerrarEditor() {
      if (editor) { editor.destroy(); editor = null; }
      clearTimeout(autosaveTimer);
      plantillaActual = null;
      setModoEdicion(false);
  }

    // --- CARGA INICIAL (RECUPERAR DATOS AL ABRIR LA APP) ---
  onMount(async () => {
      await cargarPlantillasEmail();
  });

  onDestroy(() => {
      if (editor) editor.destroy();
  });
</script>

{#if !editando}
    <div class="mail-templates-container">
        <div class="accordion-list">
            {#each $emailTemplates as plantilla (plantilla.id)}
                <div class="accordion-item">
                    <button class="accordion-header" on:click={() => toggle(plantilla.id)}>
                        <div class="acc-title"><FileText size={16}/> {plantilla.title}</div>
                        {#if plantilla.isOpen}<ChevronUp size={16}/>{:else}<ChevronDown size={16}/>{/if}
                    </button>
                    {#if plantilla.isOpen}
                        <div class="accordion-body-template">
                            <div class="preview-group">
                                <label>Asunto</label>
                                <input type="text" value={plantilla.subject || '(Sin asunto)'} readonly class="preview-input"/>
                            </div>
                            <div class="preview-group">
                                <label>Cuerpo</label>
                                <div class="preview-textarea">
                                    {@html plantilla.body || '<span style="color:var(--text-secondary); font-style:italic;">(Sin contenido...)</span>'}
                                </div>
                            </div>
                            <div class="template-actions">
                                <button class="btn-template-action left" on:click={() => abrirEditor(plantilla)}><PenTool size={14}/> Editar</button>
                                <div class="group-center">
                                    <button class="btn-template-action"><Upload size={14}/> Exportar plantilla</button>
                                    <button class="btn-template-action"><Download size={14}/> Importar plantilla</button>
                                </div>
                                <button class="btn-template-action right"><RefreshCw size={14}/> Restablecer a los valores predeterminados</button>
                            </div>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </div>

{:else if plantillaActual}
    <div class="editor-layout-wrapper">
        <div class="editor-main">
            <div class="editor-header-bar">
                <div class="title-wrap">
                    <FileText size={18}/> <span>Editando: {plantillaActual.title}</span>
                    <div class="autosave-badge">
                        {#if saveStatus === 'saved'}
                            <span class="status-pill saved"><Check size={12}/> Guardado</span>
                        {:else if saveStatus === 'saving'}
                            <span class="status-pill saving"><Loader2 size={12} class="spin"/> Guardando...</span>
                        {:else}
                            <span class="status-pill unsaved"><Cloud size={12}/> Sin guardar</span>
                        {/if}
                    </div>
                </div>
                <button class="btn-close-header" on:click={cerrarEditor}><X size={18}/></button>
            </div>

            <div class="editor-form-area">
                <div class="input-group-top">
                    <label>Asunto</label>
                    <input type="text" class="input-subject" bind:this={asuntoInput} bind:value={plantillaActual.subject} on:input={triggerAutosave} />
                </div>

                <div class="editor-wrapper-box">
                    <label>Contenido</label>
                    <div class="toolbar-ribbon">
                        <button class="tool-btn" class:active={isBold} on:click={toggleB} title="Negrita"><Bold size={16}/></button>
                        <button class="tool-btn" class:active={isItalic} on:click={toggleI} title="Cursiva"><Italic size={16}/></button>
                        <button class="tool-btn" class:active={isUnderline} on:click={toggleU} title="Subrayado"><UnderlineIcon size={16}/></button>
                        <button class="tool-btn" class:active={isStrike} on:click={toggleStrike} title="Tachado"><span style="text-decoration: line-through;">S</span></button>
                        <div class="sep"></div>
                        
                        <button class="tool-btn" class:active={textAlign==='left'} on:click={() => setAlign('left')}><AlignLeft size={16}/></button>
                        <button class="tool-btn" class:active={textAlign==='center'} on:click={() => setAlign('center')}><AlignCenter size={16}/></button>
                        <button class="tool-btn" class:active={textAlign==='right'} on:click={() => setAlign('right')}><AlignRight size={16}/></button>
                        <button class="tool-btn" class:active={textAlign==='justify'} on:click={() => setAlign('justify')}><AlignJustify size={16}/></button>
                        <div class="sep"></div>

                        <button class="tool-btn" class:active={isBulletList} on:click={() => setList('bullet')}><List size={16}/></button>
                        <button class="tool-btn" class:active={isOrderedList} on:click={() => setList('ordered')}><ListOrdered size={16}/></button>
                        <div class="sep"></div>

                        <button class="tool-btn" on:click={() => indent('out')}><IndentDecrease size={16}/></button>
                        <button class="tool-btn" on:click={() => indent('in')}><IndentIncrease size={16}/></button>
                        <div class="sep"></div>

                        <button class="tool-btn" on:click={setTextColor} title="Color Texto"><span style="border-bottom: 2px solid red; font-weight:bold;">A</span></button>
                        <button class="tool-btn" class:active={isHighlight} on:click={setHighlight} title="Resaltar"><Highlighter size={16}/></button>
                        <div class="sep"></div>

                        <button class="tool-btn" class:active={isLink} on:click={setLink}><LinkIcon size={16}/></button>
                        <button class="tool-btn" on:click={unsetLink}><Unlink size={16}/></button>
                        <button class="tool-btn" on:click={addLine}><Minus size={16}/></button>
                        <div class="sep"></div>

                        <button class="tool-btn" on:click={undo} disabled={!canUndo} title="Deshacer"><Undo size={16}/></button>
                        <button class="tool-btn" on:click={redo} disabled={!canRedo} title="Rehacer"><Redo size={16}/></button>
                    </div>

                    <div class="editor-container" bind:this={element}></div>
                </div>
            </div>

            <div class="editor-footer">
                <button class="btn-cancel" on:click={cerrarEditor}>Cancelar</button>
                <button class="btn-save" on:click={() => guardar(true)}>Guardar y Cerrar</button>
            </div>
        </div>

        <div class="editor-sidebar">
            <div class="sidebar-header">Marcadores de posición</div>
            <div class="markers-list">
                {#each marcadoresUI as group, i}
                    <div class="marker-group">
                        <button class="marker-group-btn" on:click={() => toggleMarcadorGroup(i)}>
                            <span>{group.category}</span>
                            {#if group.isOpen}<ChevronUp size={14}/>{:else}<ChevronDown size={14}/>{/if}
                        </button>
                        {#if group.isOpen}
                            <div class="marker-content">
                                {#each group.items as item}
                                    <button class="marker-pill" on:click={() => insertarMarcador(item.code)} on:mousedown|preventDefault={() => {}} title={item.label}>
                                        <div class="marker-content-row"><span class="m-label">{item.label}</span></div>
                                        {#if item.desc}
                                            <div class="marker-row-desc">{item.desc}</div>
                                        {/if}
                                        <div class="m-code">{item.code}</div>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </div>
{/if}

<style>
  /* --- ESTILOS GENERALES (LISTA) --- */
  .accordion-list { border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; margin-bottom: 30px; }
  .accordion-item { border-bottom: 1px solid var(--border-color); background: var(--bg-card); }
  .accordion-header { width: 100%; display: flex; justify-content: space-between; padding: 12px 15px; background: var(--bg-card); border: none; cursor: pointer; color: var(--text-main); }
  .acc-title { display: flex; align-items: center; gap: 10px; }
  .accordion-body-template { padding: 25px; background: var(--bg-body); border-top: 1px solid var(--border-color); }
  /* 1. Estilo simple para el INPUT (Asunto) */
  .preview-input { 
      width: 100%; 
      padding: 10px; 
      border: 1px solid var(--border-color); 
      border-radius: 4px; 
      background: var(--bg-card); 
      color: var(--text-main); 
      margin-bottom: 10px; 
      box-sizing: border-box;
  }

  /* 2. Estilo ROBUSTO para el TEXTAREA (Cuerpo del correo) */
  .preview-textarea {
      /* Estructura */
      display: block;
      width: 100%;
      box-sizing: border-box; /* Clave para que no se desborde */
      padding: 15px;
      margin-bottom: 15px;
      
      /* Scroll y tamaño */
      min-height: 100px;
      max-height: 400px;
      overflow-y: auto;
      overflow-x: hidden !important; /* Prohibido scroll horizontal */

      /* Apariencia */
      background: #ffffff; /* Los correos se ven mejor en fondo blanco (o usa var(--bg-card) si prefieres) */
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: #1e293b; /* Texto oscuro para legibilidad */
      font-size: 14px;
      line-height: 1.6;

      /* MAGIA DE AJUSTE DE TEXTO */
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
  }

  /* 3. Reglas para el contenido HTML interno (Párrafos, Listas, etc.) */
  .preview-textarea :global(*) {
      max-width: 100% !important;
      white-space: pre-wrap !important;
      word-break: break-word !important;
      overflow-wrap: anywhere !important;
  }

  /* Arreglo extra para que las listas no pierdan los puntos */
  .preview-textarea :global(ul), 
  .preview-textarea :global(ol) {
      padding-left: 20px;
      margin: 10px 0;
  }
  
  .preview-textarea :global(p) {
      margin-bottom: 0.8em;
  }
  .btn-template-action { background: #5f1d22; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; display: flex; gap: 5px; }
  .group-center { display: flex; gap: 10px; }
  .template-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }

  /* --- ESTILOS DEL EDITOR (MODO EDICIÓN) --- */
  
  /* Layout Principal más alto para evitar el "amontonado" */
  .editor-layout-wrapper { display: grid; grid-template-columns: 1fr 280px; gap: 20px; height: calc(100vh - 200px); min-height: 600px; margin-bottom: 40px; }
  
  .editor-main { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
  
  .editor-header-bar { padding: 12px 20px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
  .title-wrap { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--text-main); font-size: 15px; }
  .autosave-badge { margin-left: 15px; }
  .status-pill { font-size: 11px; padding: 3px 8px; border-radius: 12px; display: flex; gap: 5px; align-items: center; font-weight: 500; }
  .status-pill.saved { background: rgba(16, 185, 129, 0.15); color: #10b981; }
  .status-pill.saving { background: rgba(234, 88, 12, 0.15); color: #ea580c; }
  .status-pill.unsaved { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
  .btn-close-header { background: none; border: none; cursor: pointer; color: var(--text-secondary); }
  .btn-close-header:hover { color: var(--text-main); }

  /* Ajustes de espacio en el formulario */
  .editor-form-area { padding: 25px; flex: 1; display: flex; flex-direction: column; overflow: hidden; gap: 15px; }
  
  .input-group-top label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
  .input-subject { width: 100%; padding: 12px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-main); border-radius: 6px; box-sizing: border-box; font-size: 14px; }

  /* Wrapper flexible para el área de contenido */
  .editor-wrapper-box { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
  .editor-wrapper-box label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }

  /* Toolbar */
  .toolbar-ribbon { display: flex; gap: 4px; padding: 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-bottom: none; border-radius: 6px 6px 0 0; flex-wrap: wrap; }
  .tool-btn { background: none; border: 1px solid transparent; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 4px; color: var(--text-secondary); cursor: pointer; }
  .tool-btn:hover { background: var(--hover-bg); color: var(--text-main); }
  .tool-btn.active { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border-color: rgba(59, 130, 246, 0.3); }
  .tool-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .sep { width: 1px; height: 20px; background: var(--border-color); margin: 0 4px; }

  /* Tiptap Container: Ocupa todo el espacio restante */
  .editor-container { flex: 1; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-main); border-radius: 0 0 6px 6px; overflow-y: auto; padding: 20px; cursor: text; min-height: 250px; }
  
  :global(.ProseMirror) { height: 100%; outline: none; }
  :global(.ProseMirror p) { margin-top: 0; margin-bottom: 0.8em; line-height: 1.5; }
  :global(.ProseMirror ul, .ProseMirror ol) { padding-left: 20px; margin: 10px 0; }

  .editor-footer { padding: 15px 25px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); }
  .btn-cancel { background: #4b5563; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .btn-save { background: #ea580c; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .btn-save:hover { background: #c2410c; }

  /* Sidebar Marcadores */
  .editor-sidebar { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
  .sidebar-header { padding: 15px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); font-weight: 600; color: var(--text-main); font-size: 14px; }
  .markers-list { overflow-y: auto; flex: 1; }
  .marker-group { border-bottom: 1px solid var(--border-color); }
  .marker-group-btn { width: 100%; padding: 12px 15px; display: flex; justify-content: space-between; background: transparent; border: none; color: var(--text-main); cursor: pointer; font-size: 13px; font-weight: 500; }
  .marker-group-btn:hover { background: var(--hover-bg); }
  .marker-content { background: var(--bg-body); padding: 5px 0; }
  
  /* ESTILOS DE MARCADOR DETALLADO */
  .marker-pill { display: block; width: 100%; padding: 10px 15px; text-align: left; background: none; border: none; cursor: pointer; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.02); }
  .marker-pill:hover { background: var(--hover-bg); }
  .marker-content-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
  .m-label { font-size: 12px; font-weight: 600; color: var(--text-main); }
  .marker-row-desc { font-size: 11px; color: var(--text-secondary); font-style: italic; margin-bottom: 4px; opacity: 0.8; }
  .m-code { font-size: 10px; font-family: monospace; color: #3b82f6; background: rgba(59,130,246,0.1); padding: 3px 6px; border-radius: 4px; width: fit-content; }
</style>