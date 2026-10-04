<script lang="ts">
  import CountUp from "./CountUp.svelte";
  import StatCard from "./StatCard.svelte";
  import { formatDuration, formatTimestamp, plural } from "./format";
  import { hueFor } from "../../utils/general";
  import { siteForUrl } from "../../utils/history-stats";
  import type { RabbitHole } from "../../utils/insights/highlights";

  let { hole }: { hole?: RabbitHole } = $props();

  const when = $derived(
    hole?.start.visitTime === undefined
      ? ""
      : ` on ${formatTimestamp(hole.start.visitTime, { month: "short", day: "numeric" })}`,
  );
  const took = $derived(
    hole?.duration ? ` in ${formatDuration(hole.duration)}` : "",
  );
</script>

{#if hole}
  <StatCard
    eyebrow="Deepest rabbit hole"
    hue={hueFor(`site:${siteForUrl(hole.start.url)}`)}
  >
    <p class="headline"><CountUp value={hole.visits} /> pages deep</p>
    <p class="caption">
      Starting from
      <a href={hole.start.url} title={hole.start.url}>
        {hole.start.title || hole.start.url}</a
      >{when}, you followed links across
      {plural(hole.sites, "website")}{took}.
    </p>
  </StatCard>
{/if}
