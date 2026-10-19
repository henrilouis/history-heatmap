<script lang="ts">
  import Days from "./Days.svelte";
  import Hours from "./Hours.svelte";
  import SelectionInfo from "./SelectionInfo.svelte";
  import { historyStore } from "../../stores/history.svelte";
  import { placeholderDays, placeholderHours } from "../../utils/chrome-api";
  import type { ViewMode } from "../../utils/general";

  let { viewMode }: { viewMode: ViewMode } = $props();

  // Refreshes keep showing the current calendar; only a first load has none.
  const loading = $derived(
    historyStore.isLoading &&
      Object.keys(historyStore.byDayWithEmpty).length === 0,
  );
</script>

<!-- Remount when loading ends so the real calendar scrolls to its newest day. -->
{#key loading}
  {#if viewMode === "days"}
    <Days
      data={loading ? placeholderDays() : historyStore.byDayWithEmpty}
      {loading}
      selectedMoments={historyStore.selectedMoments}
      onToggleMoment={historyStore.toggleMoment}
    />
  {:else if viewMode === "hours"}
    <Hours
      data={loading ? placeholderHours() : historyStore.byDayAndHourWithEmpty}
      {loading}
      selectedMoments={historyStore.selectedMoments}
      onToggleMoment={historyStore.toggleMoment}
    />
  {/if}
{/key}
{#if viewMode !== "stats"}
  <SelectionInfo calendarMode={viewMode} />
{/if}
