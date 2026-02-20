<script lang="ts">
  import type { Snippet } from "svelte";
  let { children, loading }: { children?: Snippet; loading?: boolean } =
    $props();
</script>

{#if loading}
  <div class="card" style="display:flex; flex-direction: column; gap: 1rem;">
    <div
      class="skeleton"
      style="height:2rem; width:10ch; margin-block-end:1rem"
    ></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
  </div>
{:else}
  <article class="card">{@render children?.()}</article>
{/if}
