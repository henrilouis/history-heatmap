<script lang="ts">
  import CountUp from "./CountUp.svelte";
  import SiteBadge from "./SiteBadge.svelte";
  import StatCard from "./StatCard.svelte";
  import { formatDay } from "./format";
  import type { Streaks } from "../../utils/insights/highlights";

  let { streaks }: { streaks?: Streaks } = $props();

  const shortDate: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
</script>

{#if streaks && streaks.longest.length > 1}
  <StatCard eyebrow="Longest streak">
    <p class="headline"><CountUp value={streaks.longest.length} /> days</p>
    <p class="caption">
      in a row with at least one visit, from
      {formatDay(streaks.longest.start, shortDate)} to
      {formatDay(streaks.longest.end, shortDate)}.
      {#if streaks.current > 1}
        You're on a <strong>{streaks.current}-day</strong> streak right now.
      {/if}
    </p>
    {#if streaks.site}
      <p class="caption">
        <SiteBadge site={streaks.site.site} url={streaks.site.topUrl} />
        was visited <strong>{streaks.site.length} days</strong> straight.
      </p>
    {/if}
  </StatCard>
{/if}
