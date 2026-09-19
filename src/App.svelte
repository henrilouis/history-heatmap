<script lang="ts">
  import { onMount } from "svelte";
  import Heatmap from "./lib/components/heatmap/Heatmap.svelte";
  import HistoryList from "./lib/components/history-list/HistoryList.svelte";
  import { historyStore } from "./lib/stores/history.svelte";
  import { themeStore } from "./lib/stores/theme.svelte";
  import Header from "./lib/components/header/Header.svelte";

  onMount(historyStore.connect);
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === "Escape") historyStore.clearSelection();
  }}
/>

<div class={["wrapper", themeStore.colorScheme]}>
  <Header />
  {#if historyStore.error}
    <div class="error-banner" role="alert">
      <span>{historyStore.error}</span>
      <button
        disabled={historyStore.isLoading}
        onclick={() => historyStore.fetch()}>Retry</button
      >
    </div>
  {/if}
  {#if historyStore.syncError}
    <div class="loading-status" role="status">
      <span>{historyStore.syncError}</span>
      <button
        disabled={historyStore.isLoading}
        onclick={() => historyStore.fetch()}>Refresh history</button
      >
    </div>
  {/if}

  <main>
    <Heatmap />
    <HistoryList />
  </main>
</div>

<style>
  .loading-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
  }

  .wrapper {
    color: var(--fg-primary);
    background-color: var(--bg-secondary);
    height: 100%;
    overflow-y: scroll;
    container-type: scroll-state;
    container-name: scroll-container;
  }
  .dark {
    color-scheme: only dark;
  }
  .light {
    color-scheme: only light;
  }

  main {
    padding: 1rem;
    margin-inline: auto;
    max-width: 60rem;
  }
</style>
