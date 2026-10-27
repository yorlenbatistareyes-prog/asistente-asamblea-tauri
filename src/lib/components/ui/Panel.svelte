<script lang="ts">
  export let padding: string = '20px';
  export let clasesExtra: string = ''; 
  export let sinSombra: boolean = false; 
</script>

<div 
  class="panel-premium {clasesExtra}" 
  style="
    padding: {padding}; 
    box-shadow: {sinSombra ? 'none' : 'var(--shadow-premium)'};
  "
>
  <slot />
</div>

<style>
  .panel-premium {
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    color: var(--text-main);
    transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease;
    
    /* BLOQUE DE BLINDAJE ANDROID */
    width: 100%;
    box-sizing: border-box; /* Crucial: el padding no suma ancho al panel */
    overflow: hidden; 
    position: relative;
  }

  @media (max-width: 768px) {
    .panel-premium {
      /* Si el padding es muy grande, en móvil lo limitamos a 15px o 20px máximo */
      /* Usamos la función 'clamp' para que sea fluido */
      padding: clamp(10px, 4vw, 20px) !important; 
      border-radius: 10px; /* Bordes un pelín más cerrados para que se vea más 'App' */
    }
  }
</style>