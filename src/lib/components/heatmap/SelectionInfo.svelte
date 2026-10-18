<script lang="ts">
  import GroupingSwitch from "./GroupingSwitch.svelte";
  import { historyStore } from "../../stores/history.svelte";
  import type { CalendarMode } from "../../utils/general";

  let {
    calendarMode,
  }: {
    calendarMode: CalendarMode;
  } = $props();
</script>

<!-- Always rendered so its reserved height keeps the list from jumping. -->
<div class="selection-info">
  <GroupingSwitch />
  {#if historyStore.selectedMoments.length > 0}
    <div class="selection">
      <span>
        {historyStore.selectedMoments.length}
        {historyStore.selectedMoments.length === 1
          ? calendarMode.slice(0, -1)
          : calendarMode} selected
      </span>
      <button class="button" onclick={() => historyStore.clearSelection()}
        >Clear selection</button
      >
    </div>
  {/if}
</div>

<style>
  .selection-info,
  .selection {
    display: flex;
    align-items: center;
    gap: 1ch;
  }

  .selection-info {
    justify-content: space-between;
    flex-wrap: wrap;
    margin-block: 1rem;
  }

  .selection {
    margin-inline-start: auto;
  }
</style>
