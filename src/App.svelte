<script lang="ts">
  import Heatmap from "./lib/components/heatmap/Heatmap.svelte";
  import HistoryList from "./lib/components/HistoryList.svelte";
  import { historyStore } from "./lib/stores/history.svelte";
  import { themeStore } from "./lib/stores/theme.svelte";
  import Header from "./lib/components/Header.svelte";

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
    overflow-y: hidden;
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
  .error-banner {
    background-color: var(--error-bg, #4a1515);
    color: var(--error-text, #ff6b6b);
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .error-banner button {
    background: transparent;
    border: 1px solid currentColor;
    color: inherit;
    padding: 0.25rem 0.75rem;
    border-radius: var(--el-border-radius, 4px);
    cursor: pointer;
  }
  .error-banner button:hover {
    background: rgba(255, 255, 255, 0.1);
  }
</style>
