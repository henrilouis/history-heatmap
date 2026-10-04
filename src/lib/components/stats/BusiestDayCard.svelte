<script lang="ts">
  import SiteBadge from "./SiteBadge.svelte";
  import StatCard from "./StatCard.svelte";
  import { formatDay, formatNumber, plural } from "./format";
  import { hueFor } from "../../utils/general";
  import type { BusiestDay } from "../../utils/insights/highlights";

  let { busiest }: { busiest?: BusiestDay } = $props();
</script>

{#if busiest}
  {@const top = busiest.topSite}
  <StatCard eyebrow="Your busiest day" hue={top && hueFor(`site:${top.site}`)}>
    <p class="headline">
      {formatDay(busiest.day, { month: "long", day: "numeric" })}
    </p>
    <p class="caption">
      That {formatDay(busiest.day, { weekday: "long" })} you made
      <strong>{plural(busiest.visits, "visit")}</strong>{#if top},
        {formatNumber(top.visits)} of them on
        <SiteBadge site={top.site} url={top.topUrl} />{/if}.
    </p>
  </StatCard>
{/if}
