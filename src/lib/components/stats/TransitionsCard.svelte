<script lang="ts">
  import CountUp from "./CountUp.svelte";
  import SplitBar from "./SplitBar.svelte";
  import StatCard from "./StatCard.svelte";
  import { formatPercent, plural } from "./format";
  import type { TransitionSummary } from "../../utils/insights/highlights";

  let { transitions }: { transitions: TransitionSummary } = $props();

  const parts = $derived(
    [
      {
        label: "Clicked a link",
        phrase: "came from clicking a link",
        count: transitions.clicked,
        color: "var(--heatmap-color-3)",
      },
      {
        label: "Typed in the address bar",
        phrase: "started in the address bar",
        count: transitions.typed,
        color: "var(--heatmap-color-2)",
      },
      {
        label: "Opened a bookmark",
        phrase: "came from a bookmark",
        count: transitions.bookmarked,
        color: "var(--heatmap-color-4)",
      },
      {
        label: "Reloaded",
        phrase: "were reloads",
        count: transitions.reloaded,
        color: "var(--heatmap-color-1)",
      },
      {
        label: "Other",
        phrase: "came from redirects, forms and other ways",
        count: transitions.other,
        color: "var(--heatmap-color-0)",
      },
    ].sort((a, b) => b.count - a.count),
  );
  const top = $derived(parts[0]);
</script>

{#if transitions.known}
  <StatCard eyebrow="How you get around">
    <p class="headline">
      <CountUp value={top.count / transitions.known} format={formatPercent} />
    </p>
    <p class="caption">
      of your visits {top.phrase}. You typed in the address bar
      <strong>{plural(transitions.typed, "time")}</strong>.
    </p>
    <SplitBar {parts} />
  </StatCard>
{/if}
