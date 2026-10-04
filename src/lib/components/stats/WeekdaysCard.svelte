<script lang="ts">
  import BarStrip from "./BarStrip.svelte";
  import StatCard from "./StatCard.svelte";
  import { averageVisits, formatWeekday } from "./format";
  import type { Rhythm } from "../../utils/insights/rhythm";

  let { rhythm }: { rhythm?: Rhythm } = $props();

  const weekdays = $derived(
    (rhythm?.weekdays ?? []).map((value, weekday) => ({
      label: formatWeekday(weekday),
      short: formatWeekday(weekday, "short"),
      value,
    })),
  );
</script>

{#if rhythm}
  {@const peak = weekdays[rhythm.peakWeekday]}
  {@const quiet = weekdays[rhythm.quietestWeekday]}
  <StatCard eyebrow="Your week">
    <p class="headline">{peak.label}</p>
    <p class="caption">
      is your busiest day, with <strong>{averageVisits(peak.value)}</strong>.
      {#if quiet && quiet !== peak}
        {quiet.label} is the quietest, with {averageVisits(quiet.value)}.
      {/if}
    </p>
    <BarStrip
      bars={weekdays}
      describe={(bar) => `${bar.label}: ${averageVisits(bar.value)}`}
      tick={(bar) => bar.short}
      tinted={(_, weekday) => weekday >= 5}
    />
  </StatCard>
{/if}
