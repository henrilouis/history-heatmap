<script lang="ts">
  import Search from "./Search.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";
  import { historyStore } from "../../lib/stores/history.svelte";
</script>

<header>
  <h1>History heatmap</h1>
  <Search onSearch={historyStore.setSearch} />
  <div class="header-end">
    <ThemeToggle />
  </div>
</header>

<style>
  header {
    position: sticky;
    top: 0;
    background-color: var(--bg-secondary);
    display: grid;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    grid-template-columns: 1fr auto;
    transition: box-shadow 0.3s;
    @container scroll-container scroll-state(scrollable: top) {
      box-shadow: var(--shadow-1);
    }
  }
  h1 {
    margin: 0;
    font-size: 1.375rem;
    display: none;
  }
  .header-end {
    display: flex;
    justify-content: end;
  }
  @media (min-width: 600px) {
    h1 {
      display: block;
    }
    header {
      grid-template-columns: auto 1fr auto;
    }
  }
  @media (min-width: 900px) {
    header {
      grid-template-columns: 12rem 1fr 12rem;
    }
  }
</style>
