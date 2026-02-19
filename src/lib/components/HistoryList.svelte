<script lang="ts">
  import Card from "./Card.svelte";
  import MomentContent from "./MomentContent.svelte";
  import { formatMomentKey } from "../utils/general";
  import { historyStore } from "../stores/history.svelte";

  let {
    calendarMode,
  }: {
    calendarMode: "day" | "hour";
  } = $props();

  const ITEMS_PER_PAGE = 10;
  let visibleCount = $state(ITEMS_PER_PAGE);
  let sentinelEl = $state<HTMLDivElement | null>(null);

  // Reset visible count when data changes
  $effect(() => {
    historyStore.byDay;
    historyStore.search;
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

  const visibleEntries = $derived(
    Object.entries(historyStore.byDay).slice(0, visibleCount),
  );

  const hasMore = $derived(
    visibleCount < Object.keys(historyStore.byDay).length,
  );
</script>

<section class="days">
  {#if historyStore.selectedMoments.length > 0}
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

    {#if hasMore}
      <div bind:this={sentinelEl} class="load-more-sentinel">
        <Card loading={true} />
      </div>
    {/if}
  {/if}
</section>

<style>
  .days {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
