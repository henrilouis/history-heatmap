<script lang="ts">
  import Days from "./Days.svelte";
  import Hours from "./Hours.svelte";
  import SelectionInfo from "./SelectionInfo.svelte";
  import ModeSwitch from "./ModeSwitch.svelte";
  import { historyStore } from "../../stores/history.svelte";
  import type { CalendarMode } from "../../utils/general";

  let calendarMode = $state<CalendarMode>("days");

  function setCalendarMode(mode: CalendarMode) {
    calendarMode = mode;
    historyStore.clearSelection();
  }
</script>

<div class="heatmap-actions">
  <ModeSwitch {calendarMode} {setCalendarMode} />
  <SelectionInfo {calendarMode} />
</div>
{#if calendarMode === "days"}
  <Days
    data={historyStore.byDayWithEmpty}
    selectedMoments={historyStore.selectedMoments}
    onToggleMoment={historyStore.toggleMoment}
  />
{:else}
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
