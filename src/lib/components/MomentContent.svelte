<script lang="ts">
  let {
    date,
    items,
    deleteHistoryUrl,
  }: {
    date: string;
    items: chrome.history.HistoryItem[];
    deleteHistoryUrl: (url: string) => void;
  } = $props();

  import { dateTimeFormatOptions } from "../utils/general";
  import { blur } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { getFaviconURL } from "../utils/chrome-api";
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
  {#each items as item, index (item.id)}
    <li
      transition:blur={{ duration: 150 }}
      animate:flip={{ delay: 150, duration: 150 }}
    >
      <time
        >{new Date(item.lastVisitTime).toLocaleTimeString([], {
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        })}</time
      >
      <img
        src={getFaviconURL(new URL(item.url).hostname)}
        alt={`Favicon for ${new URL(item.url).hostname}`}
      />
      <div>
        <a href={item.url}>{item.title}</a>
        <span class="text-secondary">{new URL(item.url).hostname}</span>
      </div>
      <button class="quiet" onclick={() => deleteHistoryUrl(item.url)}
        >Delete</button
      >
    </li>
  {/each}
</ol>

<style>
  ol {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  li {
    font-size: 0.75rem;
    display: grid;
    grid-template-columns: 4rem 16px 1fr auto;
    align-items: center;
    gap: 0.5rem;
    padding-block: 0.25rem;
    &:not(:last-child) {
      border-bottom: var(--el-border-width) solid var(--el-border-color-default);
    }
  }
</style>
