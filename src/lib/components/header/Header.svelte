<script lang="ts">
  import ModeSwitch from "./ModeSwitch.svelte";
  import Search from "./Search.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";
  import { historyStore } from "../../stores/history.svelte";
  import { routeStore } from "../../stores/route.svelte";
</script>

<header>
  <h1>History heatmap</h1>
  <div class="header-main">
    {#if historyStore.isLoading}
      <div class="loading-status" role="status">
        <span>
          {#if historyStore.progress}
            Loading visits: {historyStore.progress.completed.toLocaleString()}
            of
            {historyStore.progress.total.toLocaleString()} URLs
          {:else}
            Searching history…
          {/if}
        </span>
        <progress
          aria-label="History URLs loaded"
          max={historyStore.progress?.total || 1}
          value={historyStore.progress?.completed}
        ></progress>
        <button class="button" onclick={historyStore.cancelFetch}>Cancel</button
        >
      </div>
    {:else}
      <Search
        value={routeStore.search}
        navigation={routeStore.navigation}
        setSearch={routeStore.setSearch}
      />
      <ModeSwitch viewMode={routeStore.view} />
    {/if}
  </div>
  <div class="header-end">
    <ThemeToggle />
  </div>
</header>

<style>
  header {
    position: sticky;
    top: 0.5rem;
    backdrop-filter: blur(0.75rem);
    display: grid;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem;
    margin: 0.5rem;
    grid-template-columns: 1fr auto;
    border-radius: var(--cn-border-radius);
    corner-shape: var(--cn-corner-shape);
    transition: box-shadow 0.3s;
    z-index: 2;
    @container scroll-container scroll-state(scrollable: top) {
      box-shadow: var(--shadow-1);
    }
  }
  h1 {
    margin: 0;
    font-size: 1.25rem;
    display: none;
  }
  .header-main {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-width: 0;
  }
  .header-end {
    display: flex;
    justify-content: end;
  }
  .loading-status {
    flex: 1 1 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }
  @media (min-width: 43.75rem) {
    h1 {
      display: block;
    }
    header {
      grid-template-columns: auto 1fr auto;
    }
  }
  @media (min-width: 56.25rem) {
    header {
      grid-template-columns: 12rem 1fr 12rem;
    }
  }
</style>
