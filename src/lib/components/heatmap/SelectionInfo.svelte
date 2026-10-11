<script lang="ts">
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
  {#if historyStore.selectedMoments.length > 0}
    <span>
      {historyStore.selectedMoments.length}
      {historyStore.selectedMoments.length === 1
        ? calendarMode.slice(0, -1)
        : calendarMode} selected
    </span>
    <button class="button" onclick={() => historyStore.clearSelection()}
      >Clear selection</button
    >
  {/if}
</div>

<style>
  .selection-info {
    display: flex;
    align-items: center;
    justify-content: end;
    gap: 1ch;
    min-block-size: calc(var(--el-line-height) + var(--el-padding-block) * 2);
    margin-block-end: 1rem;
  }
</style>
