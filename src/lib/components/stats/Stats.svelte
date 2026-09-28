<script lang="ts">
  import Card from "../history-list/Card.svelte";
  import VisitTreemap from "./VisitTreemap.svelte";
  import { historyStore } from "../../stores/history.svelte";
  import { buildVisitTree } from "../../utils/history-stats";

  const tree = $derived(buildVisitTree(historyStore.filtered));
</script>

<section class="stats">
  {#if historyStore.isLoading}
    <Card loading={true} />
  {:else if tree.totalVisits === 0}
    <Card>
      <h3>No results found</h3>
    </Card>
  {:else}
    <Card>
      <header>
        <h3>Visits by website</h3>
        <p class="text-secondary">
          {tree.totalVisits.toLocaleString()}
          {tree.totalVisits === 1 ? "visit" : "visits"} across
          {tree.siteCount.toLocaleString()}
          {tree.siteCount === 1 ? "website" : "websites"}. Select a website to
          see its pages.
        </p>
      </header>
      <VisitTreemap root={tree.root} />
    </Card>
  {/if}
</section>

<style>
  .stats {
    margin-block-start: 1rem;
  }

  header p {
    margin-block: 0 0.5rem;
    font-size: var(--el-font-size);
  }

  h3 {
    margin-block-end: 0.25rem;
  }
</style>
