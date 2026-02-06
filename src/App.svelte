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

  let colorScheme = $state<"light" | "dark">(
    window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );

  const darkModeMql = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = (e: MediaQueryListEvent) => {
    colorScheme = e.matches ? "dark" : "light";
  };
  darkModeMql.addEventListener("change", listener);

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

<div
  class={{
    wrapper: true,
    dark: colorScheme === "dark",
    light: colorScheme === "light",
  }}
>
  <header>
    <h1>History heatmap</h1>
    <Search bind:value={searchValue} />
    <button
      onclick={() => (colorScheme = colorScheme === "dark" ? "light" : "dark")}
      aria-label={colorScheme === "light"
        ? "Switch to dark mode"
        : "Switch to light mode"}
      id="theme-toggle-button"
    >
      <div class="icon-wrapper">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2"></path>
          <path d="M12 20v2"></path>
          <path d="m4.93 4.93 1.41 1.41"></path>
          <path d="m17.66 17.66 1.41 1.41"></path>
          <path d="M2 12h2"></path>
          <path d="M20 12h2"></path>
          <path d="m6.34 17.66-1.41 1.41"></path>
          <path d="m19.07 4.93-1.41 1.41"></path>
        </svg>
      </div>
    </button>
  </header>
  {#if historyStore.error}
    <div class="error-banner" role="alert">
      <span>{historyStore.error}</span>
      <button onclick={() => historyStore.fetch()}>Retry</button>
    </div>
  {/if}
  <main>
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
    </section>
  </main>
</div>

<style>
  .wrapper {
    color: var(--fg-primary);
    background-color: var(--bg-secondary);
    overflow-y: hidden;
    height: 100%;
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

  #theme-toggle-button {
    position: relative;
    overflow: hidden;
    height: 2.5rem;
    & .icon-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: transform 0.3s ease-in-out;
      transform: translateY(-2.5rem);
      & svg {
        transition: rotate 0.3s ease-in-out;
      }
      & svg:last-child {
        rotate: 360deg;
      }
    }
  }
  .dark #theme-toggle-button {
    & .icon-wrapper {
      transform: translateY(0);
      & svg:last-child {
        rotate: 0deg;
      }
    }
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
