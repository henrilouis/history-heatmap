<script lang="ts">
  let {
    date,
    items,
    deleteHistoryUrl,
  }: {
    date: string;
    items: HistoryVisit[];
    deleteHistoryUrl: (url: string) => void;
  } = $props();

  import { formatMomentKey } from "../../utils/general";
  import { blur } from "svelte/transition";

  import { getFaviconURL, type HistoryVisit } from "../../utils/chrome-api";

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
  <h3>{formatMomentKey(date, items[0]?.visitTime)}</h3>
</header>
<ol>
  {#each items as item (item.visitId)}
    {@const hostname = getHostname(item.url)}
    <li out:blur={{ duration: 150 }}>
      <time
        >{item.visitTime !== undefined
          ? new Date(item.visitTime).toLocaleTimeString([], {
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
        <a href={item.url}>{item.title || item.url}</a>
        <span class="text-secondary">{hostname}</span>
      </div>
      <button
        class="quiet"
        title="Delete every visit to this URL, including visits on other days"
        aria-label={`Delete all visits to ${item.url}, including visits on other days`}
        onclick={() => deleteHistoryUrl(item.url)}>Delete all visits</button
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
