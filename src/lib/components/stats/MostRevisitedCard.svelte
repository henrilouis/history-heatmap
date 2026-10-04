<script lang="ts">
  import CountUp from "./CountUp.svelte";
  import SiteBadge from "./SiteBadge.svelte";
  import StatCard from "./StatCard.svelte";
  import { hueFor } from "../../utils/general";
  import type { UrlStats } from "../../utils/insights/aggregate";

  let { page }: { page?: UrlStats } = $props();
</script>

{#if page}
  <StatCard eyebrow="Most revisited page" hue={hueFor(`site:${page.site}`)}>
    <p class="headline"><CountUp value={page.visits} />×</p>
    <p class="caption">
      you opened
      <a href={page.url} title={page.url}>{page.title || page.url}</a>
      on <SiteBadge site={page.site} url={page.url} />.
    </p>
  </StatCard>
{/if}
