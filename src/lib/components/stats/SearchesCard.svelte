<script lang="ts">
  import CountUp from "./CountUp.svelte";
  import StatCard from "./StatCard.svelte";
  import { formatPercent, plural } from "./format";
  import type { Searches } from "../../utils/insights/searches";

  let { searches }: { searches: Searches } = $props();

  const engine = $derived(searches.engines[0]);
  const max = $derived(searches.terms[0]?.count ?? 1);
</script>

{#if searches.total}
  <StatCard eyebrow="Your top searches" span={6}>
    <p class="headline">
      <CountUp value={searches.total} />
      {searches.total === 1 ? "search" : "searches"}
    </p>
    <p class="caption">
      for {plural(searches.uniqueTerms, "different thing")}{#if engine},
        {formatPercent(engine.count / searches.total)} of them on
        <strong>{engine.name}</strong>{/if}.
    </p>
    <ol class="ranked terms">
      {#each searches.terms as search, index (search.term)}
        <li>
          <span class="rank">{index + 1}</span>
          <span>
            <a href={search.url} title={`Search for “${search.term}” again`}>
              {search.term}
            </a>
            <span class="meter" style:--size={search.count / max}>
              <span></span>
            </span>
          </span>
          <span class="count">{plural(search.count, "time")}</span>
        </li>
      {/each}
    </ol>
  </StatCard>
{/if}

<style>
  ol.terms {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
    gap: 0.75rem 1.5rem;
  }

  a {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
