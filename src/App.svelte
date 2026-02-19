<script lang="ts">
  import Search from "./lib/components/Search.svelte";
  import DayCalendar from "./lib/components/DayCalendar.svelte";
  import HourCalendar from "./lib/components/HourCalendar.svelte";
  import HistoryList from "./lib/components/HistoryList.svelte";
  import ThemeToggle from "./lib/components/ThemeToggle.svelte";
  import { historyStore } from "./lib/stores/history.svelte";

  historyStore.fetch();

  type CalendarMode = "day" | "hour";
  let calendarMode = $state<CalendarMode>("day");

  function setCalendarMode(mode: CalendarMode) {
    calendarMode = mode;
    historyStore.clearSelection();
  }

  let colorScheme = $state<"light" | "dark">("light");
</script>

<div
  class={{
    wrapper: true,
    dark: colorScheme === "dark",
    light: colorScheme === "light",
  }}
>
  <header>
    <h1>History heatmap</h1>
    <Search onSearch={historyStore.setSearch} />
    <div class="header-end">
      <ThemeToggle bind:colorScheme />
    </div>
  </header>
  {#if historyStore.error}
    <div class="error-banner" role="alert">
      <span>{historyStore.error}</span>
      <button onclick={() => historyStore.fetch()}>Retry</button>
    </div>
  {/if}
  <main>
    <div class="calendar-actions">
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
    </div>
    {#if calendarMode === "day"}
      <DayCalendar
        data={historyStore.byDayWithEmpty}
        selectedMoments={historyStore.selectedMoments}
        onToggleMoment={historyStore.toggleMoment}
      />
    {:else}
      <HourCalendar
        data={historyStore.byDayAndHourWithEmpty}
        selectedMoments={historyStore.selectedMoments}
        onToggleMoment={historyStore.toggleMoment}
      />
    {/if}

    <HistoryList {calendarMode} />
  </main>
</div>

<style>
  .wrapper {
    color: var(--fg-primary);
    background-color: var(--bg-secondary);
    overflow-y: hidden;
    height: 100%;
    overflow-y: scroll;
    container-type: scroll-state;
    container-name: scroll-container;
  }
  .dark {
    color-scheme: only dark;
  }
  .light {
    color-scheme: only light;
  }
  header {
    position: sticky;
    top: 0;
    background-color: var(--bg-secondary);
    display: grid;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    grid-template-columns: 1fr auto;
    transition: box-shadow 0.3s;
    @container scroll-container scroll-state(scrollable: top) {
      box-shadow: var(--shadow-1);
    }
  }
  h1 {
    margin: 0;
    font-size: 1.375rem;
    display: none;
  }
  .header-end {
    display: flex;
    justify-content: end;
  }

  @media (min-width: 600px) {
    h1 {
      display: block;
    }
    header {
      grid-template-columns: auto 1fr auto;
    }
  }
  @media (min-width: 900px) {
    header {
      grid-template-columns: 12rem 1fr 12rem;
    }
  }
  main {
    padding: 0 1rem 1rem 1rem;
    margin-inline: auto;
    max-width: 60rem;
  }
  .calendar-actions {
    display: flex;
    justify-content: space-between;
  }
  .selection-info {
    display: flex;
    align-items: center;
    gap: 1ch;
  }
  .error-banner {
    background-color: var(--error-bg, #4a1515);
    color: var(--error-text, #ff6b6b);
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .error-banner button {
    background: transparent;
    border: 1px solid currentColor;
    color: inherit;
    padding: 0.25rem 0.75rem;
    border-radius: var(--el-border-radius, 4px);
    cursor: pointer;
  }
  .error-banner button:hover {
    background: rgba(255, 255, 255, 0.1);
  }
</style>
