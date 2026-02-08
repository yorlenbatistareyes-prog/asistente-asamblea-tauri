<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  
  // Tiptap
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  import TextAlign from '@tiptap/extension-text-align';
  import Link from '@tiptap/extension-link';
  import { Color } from '@tiptap/extension-color';
  import { TextStyle } from '@tiptap/extension-text-style';
  import Highlight from '@tiptap/extension-highlight';

  // Datos
  import { marcadoresGlobales, type Plantilla } from '$lib/stores/plantillas';

  // Iconos
  import { 
    X, FileText, Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, 
    Link as LinkIcon, Unlink, RemoveFormatting, List, ListOrdered, IndentDecrease, IndentIncrease, Highlighter, 
    Minus, Pilcrow, Eye, Code, Undo, Redo, Copy, Clipboard, FileCode, ChevronUp, ChevronDown 
  } from 'lucide-svelte';

  // --- PROPS ---
  export let plantilla: Plantilla; 

  const dispatch = createEventDispatcher();
  let editor: Editor | null = null;
  let element: HTMLElement;
  let showSourceCode = false;
  let subjectInput: HTMLInputElement;
  let activeField: 'subject' | 'body' = 'body';

  // Copia local para editar
  let localPlantilla = { ...plantilla };

  // Marcadores UI
  let marcadoresUI = marcadoresGlobales.map(grp => ({ ...grp }));
  function toggleMarcadorGroup(index: number) {
      marcadoresUI[index].isOpen = !marcadoresUI[index].isOpen;
      marcadoresUI = [...marcadoresUI];
  }

  // Estado del toolbar
  let isBold = false, isItalic = false, isUnderline = false, isStrike = false;
  let isLink = false, isHighlight = false, isBulletList = false, isOrderedList = false, isCodeBlock = false;
  let textAlign = 'left';

  function updateToolbar() {
      if (!editor) return;
      isBold = editor.isActive('bold'); isItalic = editor.isActive('italic'); isUnderline = editor.isActive('underline');
      isStrike = editor.isActive('strike'); isLink = editor.isActive('link'); isHighlight = editor.isActive('highlight');
      isBulletList = editor.isActive('bulletList'); isOrderedList = editor.isActive('orderedList'); isCodeBlock = editor.isActive('codeBlock');
      if (editor.isActive({ textAlign: 'left' })) textAlign = 'left';
      else if (editor.isActive({ textAlign: 'center' })) textAlign = 'center';
      else if (editor.isActive({ textAlign: 'right' })) textAlign = 'right';
      else if (editor.isActive({ textAlign: 'justify' })) textAlign = 'justify';
      else textAlign = 'left';
  }

  onMount(() => {
      editor = new Editor({
          element: element,
          extensions: [
              StarterKit, Underline, TextStyle, Color,
              Highlight.configure({ multicolor: true }),
              Link.configure({ openOnClick: false }),
              TextAlign.configure({ types: ['heading', 'paragraph'] }),
          ],
          content: localPlantilla.body,
          onUpdate: ({ editor }) => {
              localPlantilla.body = editor.getHTML();
              updateToolbar();
          },
          onFocus: () => activeField = 'body',
          onTransaction: () => updateToolbar(),
          onSelectionUpdate: () => updateToolbar()
      });
      updateToolbar();
  });

  onDestroy(() => { if (editor) editor.destroy(); });

  // Inserción
  function insertarMarcador(code: string) {
      if (activeField === 'subject' && subjectInput) {
          const start = subjectInput.selectionStart || 0;
          const end = subjectInput.selectionEnd || 0;
          const text = localPlantilla.subject;
          localPlantilla.subject = text.substring(0, start) + ` ${code} ` + text.substring(end);
          setTimeout(() => {
              subjectInput.focus();
              const newPos = start + code.length + 2;
              subjectInput.setSelectionRange(newPos, newPos);
          }, 0);
      } else {
          if (editor && !showSourceCode) editor.chain().focus().insertContent(` ${code} `).run();
          else localPlantilla.body += ` ${code}`;
      }
  }

  // Funciones Toolbar
  const toggleB = () => editor?.chain().focus().toggleBold().run();
  const toggleI = () => editor?.chain().focus().toggleItalic().run();
  const toggleU = () => editor?.chain().focus().toggleUnderline().run();
  const toggleS = () => editor?.chain().focus().toggleStrike().run();
  const removeF = () => editor?.chain().focus().unsetAllMarks().run();
  const setAlign = (a: string) => editor?.chain().focus().setTextAlign(a).run();
  const setList = (type: 'bullet' | 'ordered') => type === 'bullet' ? editor?.chain().focus().toggleBulletList().run() : editor?.chain().focus().toggleOrderedList().run();
  const indent = (dir: 'in' | 'out') => dir === 'in' ? editor?.chain().focus().sinkListItem('listItem').run() : editor?.chain().focus().liftListItem('listItem').run();
  const toggleH = () => editor?.chain().focus().toggleHighlight().run();
  const setLnk = () => { const url = prompt('URL'); if(url) editor?.chain().focus().setLink({ href: url }).run(); };
  const unsetLnk = () => editor?.chain().focus().unsetLink().run();
  const addLine = () => editor?.chain().focus().setHorizontalRule().run();
  const undo = () => editor?.chain().focus().undo().run();
  const redo = () => editor?.chain().focus().redo().run();
  const copy = () => { if(editor) navigator.clipboard.writeText(editor.getText()); alert("Copiado"); };
  const paste = async () => { try { const t = await navigator.clipboard.readText(); editor?.chain().focus().insertContent(t).run(); } catch(e){} };
  
  // Color
  const setTextColor = () => {
      const color = prompt('Color (hex o nombre):', '#000000');
      if (color) editor?.chain().focus().setColor(color).run();
  };

  function guardar() { dispatch('guardar', localPlantilla); }
  function cancelar() { dispatch('cancelar'); }
</script>

<div class="editor-layout">
    <div class="editor-main">
        <div class="editor-header-bar">
            <div class="title-wrap"><FileText size={18}/> <span>{localPlantilla.title}</span></div>
            <button class="btn-close-editor" on:click={cancelar}><X size={18}/></button>
        </div>
        
        <div class="editor-form">
            <label>Asunto / Referencia</label>
            <input type="text" class="input-subject" bind:value={localPlantilla.subject} bind:this={subjectInput} on:focus={() => activeField = 'subject'} />
            
            <label>Contenido</label>
            <div class="toolbar-ribbon" on:click={() => { if(editor) editor.commands.focus(); activeField='body'; }}>
                <div class="toolbar-row">
                    <button class="tool-btn" class:active={isBold} on:click={toggleB}><Bold size={16}/></button>
                    <button class="tool-btn" class:active={isItalic} on:click={toggleI}><Italic size={16}/></button>
                    <button class="tool-btn" class:active={isUnderline} on:click={toggleU}><UnderlineIcon size={16}/></button>
                    <button class="tool-btn" class:active={isStrike} on:click={toggleS}><RemoveFormatting size={16}/></button>
                    <div class="sep"></div>
                    <button class="tool-btn" class:active={textAlign === 'left'} on:click={() => setAlign('left')}><AlignLeft size={16}/></button>
                    <button class="tool-btn" class:active={textAlign === 'center'} on:click={() => setAlign('center')}><AlignCenter size={16}/></button>
                    <button class="tool-btn" class:active={textAlign === 'right'} on:click={() => setAlign('right')}><AlignRight size={16}/></button>
                    <div class="sep"></div>
                    <button class="tool-btn" class:active={isBulletList} on:click={() => setList('bullet')}><List size={16}/></button>
                    <button class="tool-btn" class:active={isOrderedList} on:click={() => setList('ordered')}><ListOrdered size={16}/></button>
                    <div class="sep"></div>
                    <button class="tool-btn" on:click={() => indent('out')}><IndentDecrease size={16}/></button>
                    <button class="tool-btn" on:click={() => indent('in')}><IndentIncrease size={16}/></button>
                    <div class="sep"></div>
                    <button class="tool-btn" on:click={setTextColor}><div class="color-indicator">A</div></button>
                    <button class="tool-btn" class:active={isHighlight} on:click={toggleH}><Highlighter size={16}/></button>
                    <div class="sep"></div>
                    <button class="tool-btn" class:active={isLink} on:click={setLnk}><LinkIcon size={16}/></button>
                    <button class="tool-btn" on:click={unsetLnk}><Unlink size={16}/></button>
                    <button class="tool-btn" on:click={addLine}><Minus size={16}/></button>
                </div>
                <div class="toolbar-row">
                   <button class="tool-btn" title="Párrafo"><Pilcrow size={16}/></button>
                   <button class="tool-btn" class:active={!showSourceCode} on:click={() => showSourceCode = false}><Eye size={16}/></button>
                   <button class="tool-btn" class:active={showSourceCode} on:click={() => showSourceCode = !showSourceCode}><FileCode size={16}/></button>
                   <div class="sep"></div>
                   <button class="tool-btn" on:click={undo}><Undo size={16}/></button>
                   <button class="tool-btn" on:click={redo}><Redo size={16}/></button>
                   <div class="sep"></div>
                   <button class="tool-btn" on:click={copy}><Copy size={16}/></button>
                   <button class="tool-btn" on:click={paste}><Clipboard size={16}/></button>
                </div>
            </div>
            
            {#if showSourceCode}
                <textarea class="source-code-view" bind:value={localPlantilla.body} on:focus={() => activeField='body'}></textarea>
            {:else}
                <div class="editor-container" bind:this={element}></div>
            {/if}
        </div>

        <div class="editor-footer-actions">
            <button class="btn-cancelar-editor" on:click={cancelar}>Deshacer</button>
            <button class="btn-guardar-editor" on:click={guardar}>Guardar</button>
        </div>
    </div>

    <div class="editor-sidebar">
        <div class="sidebar-title">Marcadores de posición</div>
        <div class="markers-accordion">
            {#each marcadoresUI as group, i}
                <div class="marker-group-item">
                    <button class="marker-header" on:click={() => toggleMarcadorGroup(i)}>
                        <span>{group.category}</span>
                        {#if group.isOpen}<ChevronUp size={14}/>{:else}<ChevronDown size={14}/>{/if}
                    </button>
                    {#if group.isOpen}
                        <div class="marker-content">
                            {#each group.items as item}
                                <button class="marker-pill" on:click={() => insertarMarcador(item.code)} title={item.label}>
                                    <div class="marker-content-row"><span class="m-label">{item.label}</span></div>
                                    {#if item.desc}<div class="marker-row-desc">{item.desc}</div>{/if}
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

<style>
  /* ESTILOS DEL EDITOR (Copiados y adaptados) */
  .editor-layout { display: grid; grid-template-columns: 1fr 300px; gap: 20px; height: 100%; }
  .editor-main { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
  .editor-header-bar { background: var(--bg-secondary); padding: 10px 20px; border-bottom: 1px solid var(--border-color); font-weight: 600; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--text-main); }
  .title-wrap { display: flex; align-items: center; gap: 8px; }
  .btn-close-editor { background: none; border: none; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px; }
  .btn-close-editor:hover { background: var(--hover-bg); color: var(--text-main); }
  
  .editor-form { padding: 20px; flex: 1; display: flex; flex-direction: column; gap: 10px; overflow-y: hidden; }
  .editor-form label { font-weight: 700; font-size: 13px; color: var(--text-secondary); margin-top: 10px; }
  .input-subject { padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--input-bg); color: var(--text-main); font-size: 14px; }
  
  .toolbar-ribbon { background: var(--bg-secondary); border: 1px solid var(--border-color); border-bottom: none; border-radius: 4px 4px 0 0; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
  .toolbar-row { display: flex; gap: 2px; align-items: center; flex-wrap: wrap; }
  
  .tool-btn { background: none; border: 1px solid transparent; padding: 4px; cursor: pointer; color: var(--text-secondary); border-radius: 3px; display: flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; }
  .tool-btn:hover { background: var(--hover-bg); color: var(--text-main); }
  .tool-btn.active { background: #dbeafe; border-color: #bfdbfe; color: var(--primary); }
  :global(html.dark-theme) .tool-btn.active { background: #1e3a8a; border-color: #1e40af; }
  .sep { width: 1px; height: 18px; background: var(--border-color); margin: 0 4px; }
  .color-indicator { font-weight: 900; font-family: serif; border-bottom: 3px solid #d32f2f; line-height: 12px; }

  .editor-container { flex: 1; padding: 15px; border: 1px solid var(--border-color); border-radius: 0 0 4px 4px; background: var(--input-bg); color: var(--text-main); overflow-y: auto; cursor: text; }
  .source-code-view { flex: 1; padding: 15px; border: 1px solid var(--border-color); border-radius: 0 0 4px 4px; background: #1e1e1e; color: #d4d4d4; font-family: monospace; resize: none; }
  
  :global(.ProseMirror) { height: 100%; outline: none; }
  :global(.ProseMirror p) { margin-top: 0; margin-bottom: 0.5em; }

  .editor-footer-actions { padding: 15px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; background: var(--bg-card); }
  .btn-cancelar-editor { background: #e2580c; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .btn-guardar-editor { background: #e2580c; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }

  .editor-sidebar { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
  .sidebar-title { padding: 15px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); font-weight: 600; color: var(--text-main); font-size: 14px; }
  .markers-accordion { overflow-y: auto; flex: 1; }
  .marker-group-item { border-bottom: 1px solid var(--border-color); }
  .marker-header { width: 100%; display: flex; justify-content: space-between; padding: 10px 15px; background: transparent; border: none; cursor: pointer; text-align: left; font-size: 13px; color: var(--text-main); font-weight: 500; }
  .marker-header:hover { background: var(--hover-bg); }
  .marker-content { background: var(--bg-body); padding: 5px 0; }
  .marker-pill { display: block; width: 100%; text-align: left; padding: 8px 15px; border: none; background: transparent; font-size: 11px; cursor: pointer; color: var(--text-main); border-bottom: 1px solid rgba(0,0,0,0.03); }
  .marker-pill:last-child { border-bottom: none; }
  .marker-pill:hover { background: var(--hover-bg); }
  .marker-content-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
  .m-label { font-weight: 600; color: var(--text-main); }
  .marker-row-desc { font-size: 10px; color: var(--text-secondary); font-style: italic; margin-bottom: 2px; }
  .m-code { font-size: 10px; color: var(--primary); font-family: monospace; background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 3px; width: fit-content; }
</style>