<script lang="ts">
  import CountUp from "./CountUp.svelte";
  import StatCard from "./StatCard.svelte";
  import { plural } from "./format";
  import { RECENT_DAYS, type Discovery } from "../../utils/insights/discovery";

  let { discovery }: { discovery?: Discovery } = $props();

  // One unit per day wide and 100 units high; the SVG stretches to fit.
  const curve = $derived.by(() => {
    const values = discovery?.curve ?? [];
    const max = values.at(-1) || 1;
    const points = values
      .map((value, day) => `${day},${(100 - (value / max) * 100).toFixed(2)}`)
      .join("L");
    return {
      days: values.length,
      line: `M${points}`,
      area: `M0,100L${points}L${values.length - 1},100Z`,
    };
  });
</script>

{#if discovery}
  <StatCard eyebrow="Discovery curve">
    <p class="headline">
      <CountUp value={discovery.sites} />
      {discovery.sites === 1 ? "website" : "websites"}
    </p>
    <p class="caption">
      discovered over {plural(curve.days, "day")},
      <strong>{discovery.recentSites.toLocaleString()}</strong> of them in the
      last {RECENT_DAYS} days.
    </p>
    {#if curve.days > 1}
      <svg
        viewBox="0 0 {curve.days - 1} 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path class="area" d={curve.area} />
        <path class="line" d={curve.line} />
      </svg>
    {/if}
  </StatCard>
{/if}

<style>
  svg {
    width: 100%;
    height: 6rem;
    margin-block-start: auto;
    overflow: visible;
  }

  .area {
    fill: oklch(from var(--heatmap-color-2) l c h / 0.25);
  }

  .line {
    fill: none;
    stroke: var(--heatmap-color-3);
    stroke-width: 0.1875rem;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
</style>
