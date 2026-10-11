<script lang="ts">
  import { FileText } from 'lucide-svelte';

  export let size = 20;
</script>

<span class="pdf-icon" aria-hidden="true">
  <FileText {size} strokeWidth={1.8} />
  <span class="pdf-badge">PDF</span>
</span>

<style>
  .pdf-icon {
    position: relative;
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
  }

  .pdf-badge {
    position: absolute;
    right: -5px;
    bottom: -2px;
    padding: 1px 2px;
    border-radius: 2px;
    background: #dc2626;
    color: #fff;
    font-size: 6px;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: 0.1px;
  }
</style>
