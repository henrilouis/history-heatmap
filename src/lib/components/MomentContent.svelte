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

  import { formatMomentKey } from "../utils/general";
  import { blur } from "svelte/transition";

  import { getFaviconURL } from "../utils/chrome-api";

  function getHostname(url: string | undefined): string {
    if (!url) return "";
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }
</script>

<header>
  <h3>{formatMomentKey(date, items[0]?.lastVisitTime)}</h3>
</header>
<ol>
  {#each items as item, index (item.id)}
    {@const hostname = getHostname(item.url)}
    <li out:blur={{ duration: 150 }}>
      <time
        >{item.lastVisitTime
          ? new Date(item.lastVisitTime).toLocaleTimeString([], {
              hour: "numeric",
              minute: "numeric",
              hour12: false,
            })
          : ""}</time
      >
      <img
        src={item.url ? getFaviconURL(item.url) : ""}
        alt={hostname ? `Favicon for ${hostname}` : ""}
        style="width: 16px"
      />
      <div>
        <a href={item.url}>{item.title}</a>
        <span class="text-secondary">{hostname}</span>
      </div>
      <button
        class="quiet"
        onclick={() => {
          item.url ? deleteHistoryUrl(item.url) : null;
        }}>Delete</button
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
