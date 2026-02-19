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
      {historyStore.selectedMoments.length === 1
        ? calendarMode.slice(0, -1)
        : calendarMode} selected
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
