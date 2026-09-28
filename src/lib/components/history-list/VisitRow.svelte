<script lang="ts">
  import type { HTMLLiAttributes } from "svelte/elements";
  import { getFaviconURL } from "../../utils/chrome-api";
  import { toLocalZonedDateTime } from "../../utils/date";
  import type { GraphRow, NavigationIndex } from "../../utils/history-graph";
  import VisitGraph from "./VisitGraph.svelte";

  let {
    row,
    widthRem,
    index,
    deleteHistoryUrl,
    ...rest
  }: {
    row: GraphRow;
    widthRem: number;
    index: NavigationIndex;
    deleteHistoryUrl: (url: string) => void;
  } & HTMLLiAttributes = $props();

  const visit = $derived(row.visit);
  const hostname = $derived(getHostname(visit.url));

  function getHostname(url: string | undefined): string {
    if (!url) return "";
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }
</script>

<li {...rest}>
  <time
    >{visit.visitTime !== undefined
      ? toLocalZonedDateTime(visit.visitTime).toLocaleString([], {
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        })
      : ""}</time
  >
  <VisitGraph {row} {widthRem} {index} />
  <img
    src={visit.url ? getFaviconURL(visit.url) : ""}
    alt={hostname ? `Favicon for ${hostname}` : ""}
    width="16"
    height="16"
  />
  <div class="visit-details">
    <a href={visit.url}>{visit.title || visit.url}</a>
    <span class="text-secondary">{hostname}</span>
  </div>
  <button
    class="quiet delete-visit"
    title="Delete every visit to this URL, including visits on other days"
    aria-label={`Delete all visits to ${visit.url}, including visits on other days`}
    onclick={() => deleteHistoryUrl(visit.url)}>Delete</button
  >
</li>

<style>
  li {
    font-size: 0.75rem;
    display: grid;
    grid-template-columns: 4rem var(--graph-width) 1rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
  }
  a {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
