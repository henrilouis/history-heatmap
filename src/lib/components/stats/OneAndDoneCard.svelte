<script lang="ts">
  import CountUp from "./CountUp.svelte";
  import SplitBar from "./SplitBar.svelte";
  import StatCard from "./StatCard.svelte";
  import { formatPercent, plural } from "./format";
  import type { Discovery } from "../../utils/insights/discovery";

  let { discovery }: { discovery?: Discovery } = $props();

  const placed = $derived(
    discovery ? discovery.oneTimeSites + discovery.returningSites : 0,
  );
</script>

{#if discovery && placed}
  <StatCard eyebrow="One and done">
    <p class="headline">
      <CountUp value={discovery.oneTimeSites / placed} format={formatPercent} />
    </p>
    <p class="caption">
      of the {plural(placed, "website")} you visited, you only visited on a single
      day. You came back to the other
      <strong>{discovery.returningSites.toLocaleString()}</strong>.
    </p>
    <SplitBar
      parts={[
        {
          label: "One day only",
          count: discovery.oneTimeSites,
          color: "var(--heatmap-color-2)",
        },
        {
          label: "Came back",
          count: discovery.returningSites,
          color: "var(--heatmap-color-3)",
        },
      ]}
    />
  </StatCard>
{/if}
