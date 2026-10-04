<script lang="ts">
  import BarStrip from "./BarStrip.svelte";
  import CountUp from "./CountUp.svelte";
  import StatCard from "./StatCard.svelte";
  import { plural } from "./format";
  import type { Discovery } from "../../utils/insights/discovery";

  let { discovery }: { discovery?: Discovery } = $props();

  /** Websites visited on at least this many days count as regulars. */
  const REGULAR_DAYS = 8;

  const regulars = $derived(
    (discovery?.loyalty ?? [])
      .filter((bucket) => bucket.min >= REGULAR_DAYS)
      .reduce((sum, bucket) => sum + bucket.sites, 0),
  );
  const bars = $derived(
    (discovery?.loyalty ?? []).map((bucket) => ({
      ...bucket,
      value: bucket.sites,
    })),
  );
</script>

{#if discovery}
  <StatCard eyebrow="Coming back">
    <p class="headline">
      <CountUp value={regulars} />
      {regulars === 1 ? "regular" : "regulars"}
    </p>
    <p class="caption">
      {regulars === 1 ? "website" : "websites"} you visited on {REGULAR_DAYS}
      days or more. How many days you visited each website:
    </p>
    <BarStrip
      {bars}
      peak={-1}
      describe={(bar) => `${bar.label}: ${plural(bar.sites, "website")}`}
      tick={(bar) => bar.label.replace(/ days?$/, "")}
    />
  </StatCard>
{/if}
