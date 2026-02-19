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
    class:selected={calendarMode === "days"}
    onclick={() => setCalendarMode("days")}
  >
    Days
  </button>
  <button
    class:selected={calendarMode === "hours"}
    onclick={() => setCalendarMode("hours")}
  >
    Hours
  </button>
</div>
