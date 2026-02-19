<script lang="ts">
  import type { CalendarMode } from "../../utils/general";

  let {
    calendarMode,
    setCalendarMode,
  }: {
    calendarMode: CalendarMode;
    setCalendarMode: (mode: CalendarMode) => void;
  } = $props();
</script>

<div class="button-group">
  <button
    class:selected={calendarMode === "day"}
    onclick={() => setCalendarMode("day")}
  >
    Days
  </button>
  <button
    class:selected={calendarMode === "hour"}
    onclick={() => setCalendarMode("hour")}
  >
    Hours
  </button>
</div>
