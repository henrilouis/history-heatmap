<script lang="ts">
  import Item from "./Item.svelte";
  import { dateTimeFormatOptions } from "../utils/general";

  type Props = {
    date: string;
    items: chrome.history.HistoryItem[];
  };

  let { date, items }: Props = $props();
</script>

<header>
  <h3>
    {items[0]?.lastVisitTime
      ? new Date(items[0].lastVisitTime).toLocaleDateString(
          undefined,
          dateTimeFormatOptions
        )
      : date}
  </h3>
</header>
<ol>
  {#each items as item}
    <Item
      time={item.lastVisitTime}
      title={item.title}
      url={item.url}
      domain={new URL(item.url).hostname}
    />
  {/each}
</ol>

<style>
  ol {
    list-style: none;
    padding: 0;
    margin: 0;
  }
</style>
