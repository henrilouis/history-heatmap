<script lang="ts">
  import Days from "./Days.svelte";
  import Hours from "./Hours.svelte";
  import SelectionInfo from "./SelectionInfo.svelte";
  import { historyStore } from "../../stores/history.svelte";
  import type { ViewMode } from "../../utils/general";

  let { viewMode }: { viewMode: ViewMode } = $props();
</script>

{#if viewMode === "days"}
  <Days
    data={historyStore.byDayWithEmpty}
    selectedMoments={historyStore.selectedMoments}
    onToggleMoment={historyStore.toggleMoment}
  />
{:else if viewMode === "hours"}
  <Hours
    data={historyStore.byDayAndHourWithEmpty}
    selectedMoments={historyStore.selectedMoments}
    onToggleMoment={historyStore.toggleMoment}
  />
{/if}
{#if viewMode !== "stats"}
  <SelectionInfo calendarMode={viewMode} />
{/if}
