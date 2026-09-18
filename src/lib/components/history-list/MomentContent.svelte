<script lang="ts">
  let {
    date,
    items,
    navigation,
    deleteHistoryUrl,
  }: {
    date: string;
    items: HistoryVisit[];
    navigation?: NavigationIndex;
    deleteHistoryUrl: (url: string) => void;
  } = $props();

  import { formatMomentKey } from "../../utils/general";
  import { toLocalZonedDateTime } from "../../utils/date";
  import { blur } from "svelte/transition";

  import { getFaviconURL, type HistoryVisit } from "../../utils/chrome-api";
  import {
    indexNavigation,
    layoutNavigation,
    type NavigationIndex,
  } from "../../utils/history-graph";
  import VisitGraph from "./VisitGraph.svelte";

  const index = $derived(navigation ?? indexNavigation(items));
  const graph = $derived(layoutNavigation(items, index));

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
<ol style={`--graph-width: ${graph.width / 16}rem`}>
  {#each graph.rows as row (row.visit.visitId)}
    {@const item = row.visit}
    {@const hostname = getHostname(item.url)}
    <li out:blur={{ duration: 150 }}>
      <time
        >{item.visitTime !== undefined
          ? toLocalZonedDateTime(item.visitTime).toLocaleString([], {
              hour: "numeric",
              minute: "numeric",
              hour12: false,
            })
          : ""}</time
      >
      <VisitGraph {row} width={graph.width} {index} />
      <img
        src={item.url ? getFaviconURL(item.url) : ""}
        alt={hostname ? `Favicon for ${hostname}` : ""}
        width="16"
        height="16"
      />
      <div class="visit-details">
        <a href={item.url}>{item.title || item.url}</a>
        <span class="text-secondary">{hostname}</span>
      </div>
      <button
        class="quiet delete-visit"
        title="Delete every visit to this URL, including visits on other days"
        aria-label={`Delete all visits to ${item.url}, including visits on other days`}
        onclick={() => deleteHistoryUrl(item.url)}>Delete</button
      >
    </li>
  {/each}
</ol>

<style>
  a {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  ol {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  li {
    font-size: 0.75rem;
    display: grid;
    grid-template-columns: 4rem var(--graph-width) 1rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
    &:not(:last-child) {
      box-shadow: inset 0 -0.0625rem var(--el-border-color-default);
    }
  }
  img {
    width: 1rem;
    height: 1rem;
  }
  .visit-details {
    min-width: 0;
    padding-block: 0.375rem;
    overflow-wrap: anywhere;
    display: grid;
    grid-template-columns: 1fr auto;
  }
</style>
