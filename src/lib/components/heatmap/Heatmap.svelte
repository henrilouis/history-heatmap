<script lang="ts">
  import Days from "./Days.svelte";
  import Hours from "./Hours.svelte";
  import SelectionInfo from "./SelectionInfo.svelte";
  import ModeSwitch from "./ModeSwitch.svelte";
  import { historyStore } from "../../stores/history.svelte";
  import type { ViewMode } from "../../utils/general";

  let { viewMode }: { viewMode: ViewMode } = $props();
</script>

<div class="heatmap-actions">
  <ModeSwitch {viewMode} />
  {#if viewMode !== "stats"}
    <SelectionInfo calendarMode={viewMode} />
  {/if}
</div>
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

<style>
  .heatmap-actions {
    display: flex;
    justify-content: space-between;
  }
</style>
