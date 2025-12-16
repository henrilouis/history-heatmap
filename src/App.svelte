<script lang="ts">
  import Search from "./lib/components/Search.svelte";
  import Card from "./lib/components/Card.svelte";
  import Calendar from "./lib/components/Calendar.svelte";
  import MomentContent from "./lib/components/MomentContent.svelte";

  import { getHistoryByDay, type HistoryByDay } from "./lib/utils/chrome-api";

  import { dateTimeFormatOptions } from "./lib/utils/general";

  let search: string = $state("");
  let selectedMoments: string[] = $state([]);
</script>

<header>
  <h1>Visual history</h1>
  <Search bind:value={search} />
</header>
<main>
  <Calendar data={getHistoryByDay(search, true)} bind:selectedMoments />
  <section class="days">
    {#if selectedMoments.length > 0}
      {#await getHistoryByDay(search, true)}
        <Card loading={true} />
        <Card loading={true} />
        <Card loading={true} />
      {:then historyData}
        {#each selectedMoments as date}
          {#if historyData[date] && historyData[date].length > 0}
            <Card>
              <MomentContent {date} items={historyData[date]} />
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
      {/await}
    {:else}
      {#await getHistoryByDay(search)}
        <Card loading={true} />
        <Card loading={true} />
        <Card loading={true} />
      {:then historyData}
        {#if Object.keys(historyData).length === 0}
          <Card>
            <h3>No results found</h3>
          </Card>
        {:else}
          {#each Object.entries(historyData) as [date, items]}
            {#if items.length > 0}
              <Card>
                <MomentContent {date} {items} />
              </Card>
            {/if}
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
