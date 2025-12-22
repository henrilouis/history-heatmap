<script lang="ts">
  import Search from "./lib/components/Search.svelte";
  import Card from "./lib/components/Card.svelte";
  import Calendar from "./lib/components/Calendar.svelte";
  import MomentContent from "./lib/components/MomentContent.svelte";

  import {
    getHistory,
    groupHistoryByDay,
    fillEmptyDays,
    deleteUrl,
  } from "./lib/utils/chrome-api";

  import { dateTimeFormatOptions } from "./lib/utils/general";

  let history: chrome.history.HistoryItem[] = $state([]);
  let search: string = $state("");
  let filteredHistory: chrome.history.HistoryItem[] = $derived.by(() => {
    if (!search) return history;
    else {
      return history.filter(
        (item) =>
          item.title?.toLowerCase().includes(search.toLowerCase()) ||
          item.url?.toLowerCase().includes(search.toLowerCase())
      );
    }
  });
  let selectedMoments: string[] = $state([]);

  function fetchHistory() {
    getHistory().then((data) => {
      history = data;
    });
  }
  fetchHistory();

  function deleteUrlFromState(url: string) {
    history = history.filter((item) => item.url !== url);
    filteredHistory = filteredHistory.filter((item) => item.url !== url);
  }

  function deleteHistoryUrl(url: string) {
    deleteUrl(url).then(() => {
      deleteUrlFromState(url);
    });
  }
</script>

<header>
  <h1>Visual history</h1>
  <Search bind:value={search} />
</header>
<main>
  <Calendar
    data={fillEmptyDays(groupHistoryByDay(filteredHistory), history)}
    bind:selectedMoments
  />
  <section class="days">
    {#if selectedMoments.length > 0}
      {@const groupedData = groupHistoryByDay(filteredHistory)}
      {#each selectedMoments as date}
        {#if groupedData[date] && groupedData[date].length > 0}
          <Card>
            <MomentContent
              {date}
              items={groupedData[date]}
              {deleteHistoryUrl}
            />
          </Card>
        {:else}
          <Card>
            <h3>
              {new Date(date).toLocaleDateString(
                undefined,
                dateTimeFormatOptions
              )}
            </h3>
            No results for this date
          </Card>
        {/if}
      {/each}
    {:else}
      {#await filteredHistory}
        <Card loading={true} />
        <Card loading={true} />
        <Card loading={true} />
      {:then historyData}
        {#if Object.keys(historyData).length === 0}
          <Card>
            <h3>No results found</h3>
          </Card>
        {:else}
          {#each Object.entries(groupHistoryByDay(historyData)) as [date, items]}
            <Card>
              <MomentContent {date} {items} {deleteHistoryUrl} />
            </Card>
          {/each}
        {/if}
      {:catch error}
        <p>Something went wrong: {error.message}</p>
      {/await}
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
    position: absolute;
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
  .days {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
