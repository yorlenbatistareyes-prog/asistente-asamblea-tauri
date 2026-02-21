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
    overflow: hidden; 
  }
</style>