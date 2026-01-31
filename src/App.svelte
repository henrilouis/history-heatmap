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

  // Infinite scroll state
  const ITEMS_PER_PAGE = 10;
  let visibleCount = $state(ITEMS_PER_PAGE);
  let sentinelEl = $state<HTMLDivElement | null>(null);

  // Reset visible count when data changes
  $effect(() => {
    // Track dependencies
    historyStore.byDay;
    searchValue;
    // Reset to initial count
    visibleCount = ITEMS_PER_PAGE;
  });

  $effect(() => {
    if (!sentinelEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const totalItems = Object.keys(historyStore.byDay).length;
          if (visibleCount < totalItems) {
            visibleCount = Math.min(visibleCount + ITEMS_PER_PAGE, totalItems);
          }
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinelEl);
    return () => observer.disconnect();
  });

  // Get visible entries
  const visibleEntries = $derived(
    Object.entries(historyStore.byDay).slice(0, visibleCount),
  );

  const hasMore = $derived(
    visibleCount < Object.keys(historyStore.byDay).length,
  );

  // Sync search input to store
  $effect(() => {
    historyStore.setSearch(searchValue);
  });
</script>

<header>
  <h1>History heatmap</h1>
  <div class="search">
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
  </div>
</header>
<nav>
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
</nav>
<main>
  {#if historyStore.error}
    <div class="error-banner" role="alert">
      <span>{historyStore.error}</span>
      <button onclick={() => historyStore.fetch()}>Retry</button>
    </div>
  {/if}
  <section class="days">
    <div class="days-inner">
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
        {#each visibleEntries as [date, items]}
          <Card>
            <MomentContent
              {date}
              {items}
              deleteHistoryUrl={historyStore.removeUrl}
            />
          </Card>
        {/each}

        <!-- Sentinel element for infinite scroll -->
        {#if hasMore}
          <div bind:this={sentinelEl} class="load-more-sentinel">
            <Card loading={true} />
          </div>
        {/if}
      {/if}
    </div>
  </section>
</main>

<style>
  nav {
    height: 100%;
    overflow-y: hidden;
  }
  h1 {
    font-size: 1.375rem;
  }

  .search {
    display: flex;
  }
  .button-group {
  }
  header {
    width: 100%;
    padding: 1rem 1rem 0;
    grid-column: 1 / -1;
    display: flex;
  }
  main {
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 1rem;
    height: 100%;
    overflow-y: hidden;
  }

  .days {
    overflow-y: auto;
    padding: 0 1rem 1rem 0;
  }
  .days-inner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-inline: auto;
    max-width: 60rem;
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
