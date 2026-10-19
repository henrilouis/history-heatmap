<script lang="ts">
  import { tick, untrack } from "svelte";
  import {
    createVirtualizer,
    defaultRangeExtractor,
    type Range,
  } from "@tanstack/svelte-virtual";
  import Card from "./Card.svelte";
  import CardFragment from "./CardFragment.svelte";
  import { observeScrollOffset } from "../../utils/dom";
  import { groupByFlow } from "../../utils/history-flows";
  import {
    chunkHistoryRows,
    flattenHistoryGroups,
    type HistoryChunk,
    type HistoryGroup,
    type HistoryRow,
  } from "../../utils/history-rows";
  import { historyStore } from "../../stores/history.svelte";
  import { routeStore } from "../../stores/route.svelte";

  let { scrollElement }: { scrollElement?: HTMLElement } = $props();

  const selected = $derived(historyStore.selectedMoments.length > 0);
  const groups = $derived<HistoryGroup[]>(
    routeStore.grouping === "flow"
      ? groupByFlow(
          selected
            ? historyStore.selectedMoments.flatMap(
                historyStore.getItemsForMoment,
              )
            : historyStore.filtered,
          historyStore.navigation,
        )
      : selected
        ? historyStore.selectedMoments.map((key) => ({
            key,
            items: historyStore.getItemsForMoment(key),
          }))
        : Object.entries(historyStore.byDay).map(([key, items]) => ({
            key,
            items,
          })),
  );
  const rows = $derived(flattenHistoryGroups(groups));
  const rowIndexes = $derived(new Map(rows.map((row, i) => [row.key, i])));

  const rem =
    typeof document === "undefined"
      ? 16
      : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  // Visits and headings are measured once rendered; these only place rows that
  // have not been rendered yet. Gaps are never rendered, so keep them exact.
  // The first and last row of a card also carry its 1.5rem vertical padding.
  function estimateSize(
    row: HistoryRow | undefined,
    currentGroups: HistoryGroup[],
  ): number {
    if (!row) return 0;
    if (row.type === "gap") return 1 * rem;
    const visits = currentGroups[row.group].items.length;
    // A flow's heading adds a line with its time span.
    if (row.type === "heading")
      return (
        ((visits ? 4.5 : 6) + (currentGroups[row.group].topic ? 1.625 : 0)) *
        rem
      );
    return (row.position === visits - 1 ? 3.625 : 2.125) * rem;
  }

  let listEl = $state<HTMLElement>();
  let scrollMargin = $state(0);
  $effect(() => {
    if (!listEl || !scrollElement) return;
    return observeScrollOffset(listEl, scrollElement, (offset) => {
      scrollMargin = offset;
    });
  });

  // A focused row stays mounted after scrolling away, so keyboard focus is
  // not lost to the page when its row leaves the rendered range.
  let focused: { key: string; index: number } | undefined;
  function rangeExtractor(range: Range): number[] {
    const indexes = defaultRangeExtractor(range);
    const index = focused && rowIndexes.get(focused.key);
    if (index === undefined || indexes.includes(index)) return indexes;
    return [...indexes, index].toSorted((a, b) => a - b);
  }

  const virtualizer = createVirtualizer<HTMLElement, HTMLElement>({
    count: 0,
    getScrollElement: () => null,
    estimateSize: () => 0,
    overscan: 10,
    rangeExtractor,
  });

  $effect(() => {
    const current = rows;
    const currentGroups = groups;
    const margin = scrollMargin;
    const element = scrollElement ?? null;
    untrack(() => $virtualizer).setOptions({
      count: current.length,
      // New functions per list, so cached positions are recomputed even when
      // the number of rows stays the same.
      getItemKey: (index) => current[index]?.key ?? index,
      estimateSize: (index) => estimateSize(current[index], currentGroups),
      getScrollElement: () => element,
      scrollMargin: margin,
    });
  });

  const measure = (element: HTMLElement) => {
    untrack(() => $virtualizer).measureElement(element);
  };

  const items = $derived(
    new Map($virtualizer.getVirtualItems().map((item) => [item.index, item])),
  );
  // Fragments are matched to the previous render's so rendered rows, above
  // all the focused one, keep their elements while the range moves.
  let previousChunks: HistoryChunk[] = [];
  const chunks = $derived.by(() => {
    previousChunks = chunkHistoryRows(
      rows,
      groups,
      [...items.keys()],
      previousChunks,
      focused?.key,
    );
    return previousChunks;
  });

  function trackFocus(event: FocusEvent) {
    const row = (event.target as Element).closest<HTMLElement>("[data-index]");
    const index = Number(row?.dataset.index);
    const key = rows[index]?.key;
    focused = key === undefined ? undefined : { key, index };
  }

  function releaseFocus(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (next && !listEl?.contains(next)) focused = undefined;
  }

  // Deleting a visit removes its row, and with it the focused button. Move
  // focus to the visit that took its place instead of losing it to the page.
  $effect(() => {
    // Read first: `focused` is not reactive, so this is what reruns the effect.
    const indexes = rowIndexes;
    if (!focused || indexes.has(focused.key)) return;
    const { index: previous } = focused;
    focused = undefined;
    if (document.activeElement && document.activeElement !== document.body)
      return;
    const next = nearestVisit(rows, previous);
    if (next === undefined) return;
    untrack(() => $virtualizer).scrollToIndex(next);
    void tick().then(() =>
      listEl
        ?.querySelector<HTMLElement>(`[data-index="${next}"] .delete-visit`)
        ?.focus(),
    );
  });

  function nearestVisit(
    currentRows: HistoryRow[],
    from: number,
  ): number | undefined {
    if (currentRows.length === 0) return;
    for (
      let i = Math.min(from, currentRows.length - 1);
      i < currentRows.length;
      i++
    )
      if (currentRows[i].type === "visit") return i;
    for (let i = Math.min(from, currentRows.length) - 1; i >= 0; i--)
      if (currentRows[i].type === "visit") return i;
  }
</script>

<section class="moments">
  {#if !selected && historyStore.isLoading}
    <Card loading={true} />
    <Card loading={true} />
    <Card loading={true} />
  {:else if groups.length === 0}
    <Card>
      <h3>No results found</h3>
    </Card>
  {:else}
    <div
      class="virtual-list"
      bind:this={listEl}
      style:height="{$virtualizer.getTotalSize()}px"
      onfocusin={trackFocus}
      onfocusout={releaseFocus}
    >
      {#each chunks as chunk (chunk.key)}
        {@const group = groups[chunk.group]}
        <CardFragment
          {group}
          {rows}
          indexes={chunk.indexes}
          top={(items.get(chunk.indexes[0])?.start ?? 0) - scrollMargin}
          deleteHistoryUrl={historyStore.removeUrl}
          {measure}
        />
      {/each}
    </div>
  {/if}
</section>

<style>
  .moments {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .virtual-list {
    position: relative;

    /* Rows are placed by the virtualizer, which corrects for size changes
       above the viewport itself. */
    overflow-anchor: none;
  }
</style>
