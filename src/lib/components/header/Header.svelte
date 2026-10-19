<script lang="ts">
  import ModeSwitch from "./ModeSwitch.svelte";
  import Search from "./Search.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";
  import { historyStore } from "../../stores/history.svelte";
  import { routeStore } from "../../stores/route.svelte";

  const percent = new Intl.NumberFormat(undefined, { style: "percent" });

  const placeholder = $derived.by(() => {
    if (!historyStore.isLoading) return undefined;
    const { completed = 0, total = 0 } = historyStore.progress ?? {};
    // Round down so 100% only shows once every URL has loaded.
    const loaded = total ? Math.floor((completed / total) * 100) / 100 : 0;
    return total
      ? `Loading history… ${percent.format(loaded)}`
      : "Loading history…";
  });

  // The calendar is inert while loading, so announce the load here instead.
  // Errors are announced by their own alert.
  let announcement = $state("");
  $effect(() => {
    if (historyStore.isLoading) announcement = "Loading history…";
    else if (announcement) {
      announcement = historyStore.error ? "" : "History loaded";
    }
  });
</script>

<header>
  <h1>History heatmap</h1>
  <div class="header-main">
    <Search
      value={routeStore.search}
      navigation={routeStore.navigation}
      setSearch={routeStore.setSearch}
      {placeholder}
    />
    <ModeSwitch viewMode={routeStore.view} />
    <p class="visually-hidden" role="status">{announcement}</p>
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

  @media (width >= 43.75rem) {
    h1 {
      display: block;
    }

    header {
      grid-template-columns: auto 1fr auto;
    }
  }

  @media (width >= 56.25rem) {
    header {
      grid-template-columns: 12rem 1fr 12rem;
    }
  }
</style>
