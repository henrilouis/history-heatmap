<script lang="ts">
  import Search from "./lib/components/Search.svelte";
  import Card from "./lib/components/Card.svelte";
  import DayCalendar from "./lib/components/DayCalendar.svelte";
  import HourCalendar from "./lib/components/HourCalendar.svelte";
  import MomentContent from "./lib/components/MomentContent.svelte";
  import { historyStore } from "./lib/stores/history.svelte";
  import { formatMomentKey } from "./lib/utils/general";

  historyStore.fetch();
  let searchValue = $state("");

  type CalendarMode = "day" | "hour";
  let calendarMode = $state<CalendarMode>("day");

  function setCalendarMode(mode: CalendarMode) {
    calendarMode = mode;
    historyStore.clearSelection();
  }

  // Sync search input to store
  $effect(() => {
    historyStore.setSearch(searchValue);
  });
</script>

<header>
  <h1>Visual history</h1>
  <Search bind:value={searchValue} />
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
</header>
{#if historyStore.error}
  <div class="error-banner" role="alert">
    <span>{historyStore.error}</span>
    <button onclick={() => historyStore.fetch()}>Retry</button>
  </div>
{/if}
<main>
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

  <section class="days">
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

      {#each historyStore.selectedMoments as momentKey}
        {@const items = historyStore.getItemsForMoment(momentKey)}
        {#if items.length > 0}
          <Card>
            <MomentContent
              date={momentKey}
              {items}
              deleteHistoryUrl={historyStore.removeUrl}
            />
          </Card>
        {:else}
          <Card>
            <h3>{formatMomentKey(momentKey)}</h3>
            No results for this time
          </Card>
        {/if}
      {/each}
    {:else if historyStore.isLoading}
      <Card loading={true} />
      <Card loading={true} />
      <Card loading={true} />
    {:else if historyStore.filtered.length === 0}
      <Card>
        <h3>No results found</h3>
      </Card>
    {:else}
      {#each Object.entries(historyStore.byDay) as [date, items]}
        <Card>
          <MomentContent
            {date}
            {items}
            deleteHistoryUrl={historyStore.removeUrl}
          />
        </Card>
      {/each}
    {/if}
  </section>
</main>

<style>
  header {
    position: sticky;
    top: 0;
    background-color: var(--bg-secondary);
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
  }
  h1 {
    margin: 0;
    font-size: 1.375rem;
    display: none;
  }
  @media (min-width: 840px) {
    h1 {
      display: block;
    }
  }
  main {
    padding: 0 1rem 1rem 1rem;
    margin-inline: auto;
    max-width: 60rem;
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 1ch;
  }
  .days {
    display: flex;
    flex-direction: column;
    gap: 1rem;
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
