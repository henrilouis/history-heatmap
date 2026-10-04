<script lang="ts">
  import CountUp from "./CountUp.svelte";
  import SiteBadge from "./SiteBadge.svelte";
  import StatCard from "./StatCard.svelte";
  import { plural } from "./format";
  import type { Discovery } from "../../utils/insights/discovery";

  let { discovery }: { discovery?: Discovery } = $props();
</script>

{#if discovery?.newPagesOnKnownSites}
  <StatCard eyebrow="Digging deeper">
    <p class="headline">
      <CountUp value={discovery.newPagesOnKnownSites} />
      new {discovery.newPagesOnKnownSites === 1 ? "page" : "pages"}
    </p>
    <p class="caption">
      found on websites you already knew, out of
      {plural(discovery.pages, "page")} in total. Your deepest dives:
    </p>
    <ol class="ranked">
      {#each discovery.deepDives as dive, index (dive.site)}
        <li>
          <span class="rank">{index + 1}</span>
          <SiteBadge site={dive.site} url={dive.topUrl} />
          <span class="count">{plural(dive.newPages, "new page")}</span>
        </li>
      {/each}
    </ol>
  </StatCard>
{/if}
