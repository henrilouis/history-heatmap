<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import VisitRow from "./VisitRow.svelte";
  import { formatMomentKey, formatTimeRange } from "../../utils/general";
  import { flowTitle } from "../../utils/history-flows";
  import type {
    NavigationIndex,
    layoutNavigation,
  } from "../../utils/history-graph";
  import type { HistoryGroup, HistoryRow } from "../../utils/history-rows";

  let {
    group,
    rows,
    indexes,
    top,
    layout,
    navigation,
    deleteHistoryUrl,
    measure,
  }: {
    group: HistoryGroup;
    rows: HistoryRow[];
    /** Adjacent row indexes of this card to render. */
    indexes: number[];
    /** Offset of the first rendered row from the top of the list. */
    top: number;
    layout: ReturnType<typeof layoutNavigation>;
    navigation: NavigationIndex;
    deleteHistoryUrl: (url: string) => void;
    measure: Attachment<HTMLElement>;
  } = $props();

  const label = $derived(
    group.topic
      ? flowTitle(group.topic)
      : formatMomentKey(group.key, group.items[0]?.visitTime),
  );
  // Flows are not tied to a moment, so they say when they happened.
  const span = $derived.by(() => {
    if (!group.topic) return;
    const { items } = group;
    const visits = `${items.length} ${items.length === 1 ? "visit" : "visits"}`;
    const start = items[items.length - 1]?.visitTime;
    const end = items[0]?.visitTime;
    if (start === undefined || end === undefined) return visits;
    return `${formatTimeRange(start, end)} · ${visits}`;
  });
  // Only the first row of a card is a heading.
  const heading = $derived(
    rows[indexes[0]]?.type === "heading" ? indexes[0] : undefined,
  );
  const visits = $derived(
    indexes.flatMap((index) => {
      const row = rows[index];
      return row?.type === "visit" ? [{ index, row }] : [];
    }),
  );
  const empty = $derived(group.items.length === 0);
</script>

<!-- Rendered rows of one card. Only its first and last rows carry the card's
     vertical padding, so fragments add up to the card's full height. The
     fragment's other edges sit in the overscan, outside the viewport. -->
<article class="card fragment" aria-label={label} style:translate="0 {top}px">
  {#if heading !== undefined}
    <header
      class="heading"
      class:card-end={empty}
      data-index={heading}
      {@attach measure}
    >
      <h3 class:with-span={span}>{label}</h3>
      {#if span}
        <p class="span text-secondary">{span}</p>
      {/if}
      {#if empty}
        No results for this time
      {/if}
    </header>
  {/if}
  <ol style:--graph-width="{layout.widthRem}rem">
    {#each visits as { index, row } (row.key)}
      <VisitRow
        row={layout.rows[row.position]}
        widthRem={layout.widthRem}
        index={navigation}
        {deleteHistoryUrl}
        class={row.position === group.items.length - 1 ? "card-end" : undefined}
        aria-setsize={group.items.length}
        aria-posinset={row.position + 1}
        data-index={index}
        {@attach measure}
      />
    {/each}
  </ol>
</article>

<style>
  .fragment {
    position: absolute;
    inset-inline: 0;
    top: 0;
    padding-block: 0;
  }

  .heading {
    display: flow-root;
    padding-block-start: 1.5rem;
  }

  .heading .with-span {
    margin-block-end: 0.25rem;
  }

  .span {
    margin-block: 0 1.25rem;
    font-size: 0.875rem;
  }

  .fragment :global(.card-end) {
    padding-block-end: 1.5rem;
  }

  .fragment :global(li:not(.card-end)) {
    box-shadow: inset 0 -0.0625rem var(--el-border-color-default);
  }
</style>
