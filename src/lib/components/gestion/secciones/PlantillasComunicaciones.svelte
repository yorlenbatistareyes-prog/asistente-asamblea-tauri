<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Mail, MessageCircle, FileText, ChevronDown, ChevronUp } from 'lucide-svelte';
  import PlantillasCorreos from './PlantillasCorreos.svelte';
  import PlantillasWhatsapp from './PlantillasWhatsapp.svelte';
  import PlantillasCartas from './PlantillasCartas.svelte';

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
</script>

<div class="comunicaciones-page">
  <header class="comunicaciones-heading">
    <span class="eyebrow">CONFIGURACIÓN</span>
    <h2>Comunicaciones</h2>
    <p>La aplicación elige cada plantilla automáticamente. Edita solo los mensajes que quieras personalizar.</p>
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
</style>
