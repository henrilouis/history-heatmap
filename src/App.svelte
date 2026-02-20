<script lang="ts">
  import Heatmap from "./lib/components/heatmap/Heatmap.svelte";
  import HistoryList from "./lib/components/history-list/HistoryList.svelte";
  import { historyStore } from "./lib/stores/history.svelte";
  import { themeStore } from "./lib/stores/theme.svelte";
  import Header from "./lib/components/header/Header.svelte";

  historyStore.fetch();
</script>

<div class={["wrapper", themeStore.colorScheme]}>
  <Header />
  {#if historyStore.error}
    <div class="error-banner" role="alert">
      <span>{historyStore.error}</span>
      <button onclick={() => historyStore.fetch()}>Retry</button>
    </div>
  {/if}
  <main>
    <Heatmap />
    <HistoryList />
  </main>
</div>

<style>
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
    padding: 0 1rem 1rem 1rem;
    margin-inline: auto;
    max-width: 60rem;
  }
</style>
