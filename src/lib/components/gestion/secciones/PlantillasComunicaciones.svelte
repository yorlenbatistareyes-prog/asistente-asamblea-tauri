<script lang="ts">
 import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import { save } from '@tauri-apps/plugin-dialog';
  import { writeTextFile } from '@tauri-apps/plugin-fs';
  
  import { Mail, MessageCircle, FileText, ChevronDown, ChevronUp, Download, Upload } from 'lucide-svelte';
  
  import PlantillasCorreos from './PlantillasCorreos.svelte';
  import PlantillasWhatsapp from './PlantillasWhatsapp.svelte';
  import PlantillasCartas from './PlantillasCartas.svelte';

  // --- STORES Y SERVICIOS PARA IMPORTACIÓN GLOBAL ---
  import { emailTemplates, guardarPlantillaEmail } from '$lib/utils/plantillasEmail';
  import { whatsAppTemplates, guardarPlantillaWhatsApp } from '$lib/utils/plantillasWhatsApp';
  import { cartasStore } from '$lib/stores/cartas';
  import { DB } from '$lib/services/db';

  const dispatch = createEventDispatcher();
  let canalActivo: 'correo' | 'whatsapp' | 'cartas' = 'correo';
  let mostrarExcepciones = false;

  const canales = [
    { id: 'correo', title: 'Plantillas de correo', icon: Mail },
    { id: 'whatsapp', title: 'Plantillas de WhatsApp', icon: MessageCircle },
    { id: 'cartas', title: 'Cartas imprimibles', icon: FileText }
  ] as const;

  function reenviarCambioModo(event: CustomEvent<boolean>) {
    dispatch('cambioModo', event.detail);
  }

  // --- FUNCIONES GLOBALES ---
  async function exportarTodo() {
      try {
          // Recopilamos todos los datos actuales
          const correos = get(emailTemplates).map(p => ({ id: p.id, subject: p.subject || '', body: p.body || '' }));
          const whatsapp = get(whatsAppTemplates).map(p => ({ id: p.id, body: p.body || '' }));
          const cartas = get(cartasStore).map(p => ({ id: p.id, body: p.html || '' }));

          const data = {
              tipo: 'comunicaciones_todas',
              correos,
              whatsapp,
              cartas
          };

          const filePath = await save({
              defaultPath: 'RAssembly_Comunicaciones_Completas.json',
              filters: [{ name: 'Copia de Seguridad JSON', extensions: ['json'] }]
          });

          if (filePath) {
              await writeTextFile(filePath, JSON.stringify(data, null, 2));
              alert("Todas las plantillas se han exportado correctamente.");
          }
      } catch (error) {
          console.error("Error al exportar todo:", error);
          alert("Hubo un error al exportar las plantillas.");
      }
  }

  async function importarTodo(event: Event) {
      const input = event.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;

      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = async (e) => {
          try {
              const contenido = JSON.parse(e.target?.result as string);
              if (contenido.tipo !== 'comunicaciones_todas') {
                  alert("Error: El archivo no es una copia de seguridad válida de comunicaciones.");
                  return;
              }

              // 1. Restaurar Correos
              if (contenido.correos) {
                  for (const c of contenido.correos) {
                      await guardarPlantillaEmail(c.id, c.subject, c.body);
                  }
              }
              // 2. Restaurar WhatsApp
              if (contenido.whatsapp) {
                  for (const w of contenido.whatsapp) {
                      await guardarPlantillaWhatsApp(w.id, w.body);
                  }
              }
              // 3. Restaurar Cartas y sincronizar su store
              if (contenido.cartas) {
                  for (const c of contenido.cartas) {
                      await DB.guardarPlantillaCarta(c.id, c.body);
                  }
                  cartasStore.update(store => {
                      contenido.cartas.forEach((cn: any) => {
                          const index = store.findIndex(item => item.id === cn.id);
                          if (index !== -1) store[index].html = cn.body;
                          else store.push({ id: cn.id, html: cn.body });
                      });
                      return store;
                  });
              }

              alert("Todas las comunicaciones se han restaurado con éxito.");
          } catch (error) {
              console.error(error);
              alert("Error al procesar el archivo de respaldo.");
          } finally {
              input.value = '';
          }
      };
      reader.readAsText(file);
  }
</script>

<div class="comunicaciones-page">
<header class="comunicaciones-heading">
    <div class="heading-text">
      <h2>Comunicaciones</h2>
      <p>La aplicación elige cada plantilla automáticamente. Edita solo los mensajes que quieras personalizar.</p>
    </div>
    
    <div class="global-actions">
      <input type="file" id="import-all-comms" accept=".json" style="display: none;" on:change={importarTodo} />
      <button class="btn-global" title="Restaurar copia de seguridad" on:click={() => document.getElementById('import-all-comms')?.click()}>
        <Download size={16} /> Importar Todo
      </button>
      <button class="btn-global primary" title="Crear copia de seguridad" on:click={exportarTodo}>
        <Upload size={16} /> Exportar Todo
      </button>
    </div>
  </header>

  <nav class="channel-tabs" aria-label="Tipo de plantilla">
    {#each canales as canal (canal.id)}
      <button
        class:active={canalActivo === canal.id}
        on:click={() => canalActivo = canal.id}
      >
        <svelte:component this={canal.icon} size={16} />
        <span>{canal.title}</span>
      </button>
    {/each}
  </nav>

  {#if canalActivo === 'correo'}
    <section class="template-section">
      <header class="section-heading">
        <h3>Plantillas de correo</h3>
        <p>Mensajes para asignaciones, recordatorios, contacto y avisos generales.</p>
      </header>
      <PlantillasCorreos
        templateIds={['programa_individual', 'programa_recordatorio', 'contacto_orador', 'registro_orador', 'masivo_general', 'masivo_recordatorio']}
        on:cambioModo={reenviarCambioModo}
      />
      <button class="advanced-toggle" on:click={() => mostrarExcepciones = !mostrarExcepciones}>
        <span>
          <strong>Opciones avanzadas</strong>
          <small>Plantillas diferentes para Oficina, Comité y Departamentos</small>
        </span>
        {#if mostrarExcepciones}<ChevronUp size={18} />{:else}<ChevronDown size={18} />{/if}
      </button>
      {#if mostrarExcepciones}
        <PlantillasCorreos templateIds={['oficina', 'comite', 'departamentos']} on:cambioModo={reenviarCambioModo} />
      {/if}
    </section>
  {:else if canalActivo === 'whatsapp'}
    <section class="template-section">
      <header class="section-heading">
        <h3>Plantillas de WhatsApp</h3>
        <p>Un solo mensaje para informar al orador de su asignación y, si corresponde, del ensayo.</p>
      </header>
      <PlantillasWhatsapp
        templateIds={['programa_recordatorio', 'contacto_orador', 'registro_orador']}
        on:cambioModo={reenviarCambioModo}
      />
      <button class="advanced-toggle" on:click={() => mostrarExcepciones = !mostrarExcepciones}>
        <span>
          <strong>Opciones avanzadas</strong>
          <small>Plantillas para Oficina, Comité y Departamentos</small>
        </span>
        {#if mostrarExcepciones}<ChevronUp size={18} />{:else}<ChevronDown size={18} />{/if}
      </button>
      {#if mostrarExcepciones}
        <PlantillasWhatsapp templateIds={['oficina', 'comite', 'departamentos']} on:cambioModo={reenviarCambioModo} />
      {/if}
    </section>
  {:else}
    <section class="template-section">
      <header class="section-heading">
        <h3>Cartas imprimibles</h3>
        <p>Documentos PDF para discursos, presidentes y asignaciones de oración.</p>
      </header>
      <PlantillasCartas on:cambioModo={reenviarCambioModo} />
    </section>
  {/if}
</div>

<style>
  .comunicaciones-page {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding-bottom: 24px;
  }

  .comunicaciones-heading h2 {
    margin: 5px 0 6px;
    color: var(--text-main);
    font-size: 24px;
  }

  .comunicaciones-heading p,
  .section-heading p {
    margin: 0;
    color: var(--text-sec);
    line-height: 1.55;
  }

  .eyebrow {
    color: var(--primary);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .09em;
  }

  .channel-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 12px;
  }

  .channel-tabs button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 13px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-card);
    color: var(--text-sec);
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
  }

  .channel-tabs button.active {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 8%, var(--bg-card));
    color: var(--primary);
  }

  .template-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-heading h3 {
    margin: 0 0 4px;
    color: var(--text-main);
    font-size: 18px;
  }

  .advanced-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 15px;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-card);
    color: var(--text-main);
    text-align: left;
    cursor: pointer;
  }

  .advanced-toggle span {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .advanced-toggle small {
    color: var(--text-sec);
    font-size: 12px;
    line-height: 1.4;
  }

  @media (max-width: 760px) {
    .comunicaciones-heading h2 {
      font-size: 21px;
    }

    .channel-tabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .channel-tabs button {
      justify-content: center;
      min-width: 0;
      padding: 0 7px;
      font-size: 11px;
    }
  }

  .comunicaciones-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
  }

  .heading-text h2 {
    margin: 5px 0 6px;
    color: var(--text-main);
    font-size: 24px;
  }

  .global-actions {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }

  .btn-global {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-card);
    color: var(--text-main);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-global:hover {
    background: var(--hover-bg);
    border-color: var(--text-sec);
  }

  .btn-global.primary {
    background: var(--primary);
    border-color: var(--primary);
    color: white;
  }

  .btn-global.primary:hover {
    background: var(--primary-hover);
    border-color: var(--primary-hover);
  }

  @media (max-width: 760px) {
    .comunicaciones-heading {
      flex-direction: column;
    }
    
    .global-actions {
      width: 100%;
    }

    .btn-global {
      flex: 1;
      justify-content: center;
    }
  }
</style>
