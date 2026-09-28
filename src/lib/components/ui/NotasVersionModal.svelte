<script lang="ts">
  import { X, Sparkles, PartyPopper } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  
  export let version = "";
  export let fecha = "";
  export let mensaje = "";
  export let cambios: { tipo: string, texto: string }[] = [];
  
  const dispatch = createEventDispatcher();
</script>

<div class="modal-backdrop">
  <div class="modal-novedades">
    <div class="header-novedades">
      <div class="badge-version">Versión {version}</div>
      <button class="btn-close" on:click={() => dispatch('cerrar')} title="Cerrar"><X size={20}/></button>
    </div>
    
    <div class="body-novedades">
      <div class="icono-celebracion">
        <PartyPopper size={48} color="var(--primary, #3b82f6)" />
      </div>
      <h2>Notas de la versión</h2>
      <p class="fecha">{fecha}</p>
      <p class="mensaje-general">{mensaje}</p>
      
      <div class="lista-cambios">
        {#each cambios as cambio}
          <div class="item-cambio">
            <span class="emoji-tipo">{cambio.tipo}</span>
            <span class="texto-cambio">{cambio.texto}</span>
          </div>
        {/each}
      </div>
    </div>
    
    <div class="footer-novedades">
      <button class="btn-primary-novedades" on:click={() => dispatch('cerrar')}>
        ¡Entendido! <Sparkles size={16} />
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.65);
    display: flex; justify-content: center; align-items: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
    padding: 20px; box-sizing: border-box;
  }

  .modal-novedades {
    background: var(--bg-card, #ffffff);
    width: 100%; max-width: 500px;
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    overflow: hidden;
    animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .header-novedades {
    display: flex; justify-content: space-between; align-items: center;
    padding: 15px 20px;
  }

  .badge-version {
    background: rgba(var(--primary-rgb, 59, 130, 246), 0.1);
    color: var(--primary, #3b82f6);
    padding: 4px 12px; border-radius: 20px;
    font-size: 13px; font-weight: 700;
  }

  .btn-close {
    background: none; border: none; cursor: pointer; color: var(--text-sec, #6b7280);
    transition: transform 0.2s;
  }
  .btn-close:hover { transform: scale(1.1); color: var(--accent-danger, #ef4444); }

  .body-novedades { padding: 0 30px 20px 30px; text-align: center; }
  .icono-celebracion { margin-bottom: 15px; }
  .body-novedades h2 { margin: 0 0 5px 0; font-size: 22px; color: var(--text-main, #111827); }
  .fecha { margin: 0 0 15px 0; font-size: 13px; color: var(--text-sec, #6b7280); font-weight: 600; }
  .mensaje-general { font-size: 15px; color: var(--text-main, #374151); margin-bottom: 25px; line-height: 1.5; }

  .lista-cambios {
    text-align: left; background: var(--bg-body, #f3f4f6);
    padding: 20px; border-radius: 12px; display: flex; flex-direction: column; gap: 12px;
    max-height: 250px; overflow-y: auto;
  }

  .item-cambio { display: flex; gap: 12px; align-items: flex-start; }
  .emoji-tipo { font-size: 18px; line-height: 1.2; }
  .texto-cambio { font-size: 14px; color: var(--text-main, #374151); line-height: 1.4; }

  .footer-novedades { padding: 20px 30px; border-top: 1px solid var(--border, #e5e7eb); display: flex; justify-content: center; }

  .btn-primary-novedades {
    background: var(--primary, #3b82f6); color: white; border: none; padding: 12px 24px; border-radius: 8px;
    font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;
    transition: all 0.2s; width: 100%; justify-content: center;
  }
  .btn-primary-novedades:hover { opacity: 0.9; transform: translateY(-2px); }

  @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
</style>