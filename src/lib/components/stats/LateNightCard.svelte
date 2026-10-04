<script lang="ts">
  import SiteBadge from "./SiteBadge.svelte";
  import StatCard from "./StatCard.svelte";
  import { formatPercent, plural } from "./format";
  import { hueFor } from "../../utils/general";
  import type { LateNight } from "../../utils/insights/highlights";

  let { late }: { late?: LateNight } = $props();
</script>

{#if late}
  <StatCard eyebrow="After midnight" hue={hueFor(`site:${late.site}`)}>
    <p class="headline">
      <SiteBadge site={late.site} url={late.topUrl} size="large" />
    </p>
    <p class="caption">
      kept you up: <strong>{formatPercent(late.visits / late.total)}</strong> of
      your {plural(late.total, "visit")} between 00:00 and 04:00 went here.
    </p>
  </StatCard>
{/if}
