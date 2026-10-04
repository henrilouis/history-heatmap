<script lang="ts">
  import BarStrip from "./BarStrip.svelte";
  import StatCard from "./StatCard.svelte";
  import { averageVisits, formatHour } from "./format";
  import type { Rhythm } from "../../utils/insights/rhythm";

  let { rhythm }: { rhythm?: Rhythm } = $props();

  const hours = $derived(
    (rhythm?.hours ?? []).map((value, hour) => ({
      label: `${formatHour(hour)}–${formatHour(hour + 1)}`,
      value,
    })),
  );
</script>

{#if rhythm}
  {@const peak = hours[rhythm.peakHour]}
  <StatCard eyebrow="Your day" span={4}>
    <p class="headline">{formatHour(rhythm.peakHour)}</p>
    <p class="caption">
      is your peak hour, with <strong>{averageVisits(peak.value)}</strong>
      between {peak.label}.
    </p>
    <BarStrip
      bars={hours}
      describe={(bar) => `${bar.label}: ${averageVisits(bar.value)}`}
      tick={(_, hour) => (hour % 3 === 0 ? String(hour).padStart(2, "0") : "")}
    />
  </StatCard>
{/if}
