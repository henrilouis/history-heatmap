<script lang="ts">
  import { historyStore } from "../../stores/history.svelte";
  import type { CalendarMode } from "../../utils/general";

  let {
    calendarMode,
  }: {
    calendarMode: CalendarMode;
  } = $props();
</script>

{#if historyStore.selectedMoments.length > 0}
  <div class="selection-info">
    <span>
      {historyStore.selectedMoments.length}
      {calendarMode}{historyStore.selectedMoments.length > 1 ? "s" : ""} selected
    </span>
    <button onclick={() => historyStore.clearSelection()}
      >Clear selection</button
    >
  </div>
{/if}

<style>
  .selection-info {
    display: flex;
    align-items: center;
    gap: 1ch;
  }
</style>
