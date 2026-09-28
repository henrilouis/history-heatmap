<script lang="ts">
  import type { HierarchyNode, HierarchyRectangularNode } from "d3-hierarchy";
  import { cubicOut } from "svelte/easing";
  import { prefersReducedMotion } from "svelte/motion";
  import { fade } from "svelte/transition";
  import { Bounds, ChartCore, Html } from "layerchart/html";
  import { Treemap } from "layerchart/hierarchy";
  import "layerchart/core.css";
  import { getFaviconURL } from "../../utils/chrome-api";
  import { hueFor } from "../../utils/general";
  import {
    toVisitHierarchy,
    type VisitTreeNode,
  } from "../../utils/history-stats";

  type Node = HierarchyRectangularNode<VisitTreeNode>;

  let { root }: { root: VisitTreeNode } = $props();

  // Half the gap between tiles. Applied in screen space rather than as treemap
  // padding, which zooming would stretch along with the tiles.
  const INSET = 2;

  const hierarchy = $derived(toVisitHierarchy(root));
  let zoomedId = $state("root");

  // Falls back to the root when the zoomed site disappears, e.g. after a
  // deletion or a search that no longer matches it.
  const zoomed = $derived(
    hierarchy.find((node) => node.data.id === zoomedId) ?? hierarchy,
  );
  const path = $derived(zoomed.ancestors().reverse());
  const pathIds = $derived(new Set(path.map((node) => node.data.id)));

  const motion = $derived(
    prefersReducedMotion.current
      ? { type: "none" as const }
      : { type: "tween" as const, duration: 600, easing: cubicOut },
  );
  const fadeDuration = $derived(prefersReducedMotion.current ? 0 : 300);

  // Children of the zoomed node, plus the siblings along its path, so that
  // neighbouring sites slide out of view while zooming rather than vanish.
  function isVisible(node: Node): boolean {
    return (
      !!node.parent &&
      pathIds.has(node.parent.data.id) &&
      !pathIds.has(node.data.id)
    );
  }

  // Sites have no URL of their own; their most visited page stands in.
  function faviconFor(node: Node): string | undefined {
    if (node.data.kind !== "site") return;
    const url = node.children?.find((page) => page.data.url)?.data.url;
    return url && getFaviconURL(url);
  }

  // Pages share their website's hue, so a site keeps its colour as it zooms
  // into its pages. "Other" tiles stay neutral and need no hue.
  function hueOf(node: Node): number | undefined {
    const site = node.ancestors().find((a) => a.data.kind === "site");
    return site && hueFor(site.data.id);
  }

  function formatVisits(count: number): string {
    return `${count.toLocaleString()} ${count === 1 ? "visit" : "visits"}`;
  }

  function share(
    node: HierarchyNode<VisitTreeNode>,
    of: HierarchyNode<VisitTreeNode> = zoomed,
  ): string {
    return ((node.value ?? 0) / (of.value || 1)).toLocaleString(undefined, {
      style: "percent",
      maximumFractionDigits: 1,
    });
  }

  function describe(node: Node): string {
    return `${node.data.name}: ${formatVisits(node.value ?? 0)} (${share(node)})`;
  }
</script>

<nav class="breadcrumb" aria-label="Treemap zoom level">
  <ol>
    {#each path as node, index (node.data.id)}
      <li>
        {#if index > 0}
          <span class="separator" aria-hidden="true">›</span>
        {/if}
        {#if index < path.length - 1}
          <button class="quiet" onclick={() => (zoomedId = node.data.id)}>
            {node.data.name}
          </button>
        {:else}
          <span aria-current="location">{node.data.name}</span>
          {#if node.parent}
            <span class="text-secondary">
              {formatVisits(node.value ?? 0)} ({share(node, node.parent)})
            </span>
          {/if}
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<div class="treemap" style:--tile-inset="{INSET}px">
  <ChartCore>
    <Html>
      <Treemap {hierarchy} maintainAspectRatio>
        {#snippet children({ nodes })}
          {@const target = nodes.find(
            (node) => node.data.id === zoomed.data.id,
          )}
          <Bounds domain={target} {motion}>
            {#snippet children({ xScale, yScale })}
              {#each nodes.filter(isVisible) as node (node.data.id)}
                {@const x0 = xScale(node.x0)}
                {@const y0 = yScale(node.y0)}
                {@const outerWidth = xScale(node.x1) - x0}
                {@const outerHeight = yScale(node.y1) - y0}
                <!-- Thin tiles get a smaller gap, so they keep half their size
                     and stay inside their own rectangle instead of vanishing. -->
                {@const insetX = Math.min(INSET, outerWidth / 4)}
                {@const insetY = Math.min(INSET, outerHeight / 4)}
                {@const width = outerWidth - 2 * insetX}
                {@const height = outerHeight - 2 * insetY}
                {@const style = `left: ${x0 + insetX}px; top: ${y0 + insetY}px; width: ${width}px; height: ${height}px`}
                {#snippet label()}
                  {@const favicon = faviconFor(node)}
                  <span class="label">
                    <span class="name">
                      {#if favicon}
                        <img src={favicon} alt="" width="16" height="16" />
                      {/if}
                      <span class="name-text">{node.data.name}</span>
                    </span>
                    <span class="count">{formatVisits(node.value ?? 0)}</span>
                  </span>
                {/snippet}
                <!-- Siblings along the zoom path are only there to animate out.
                     Sub-pixel tiles can't be seen or clicked, so skip them too. -->
                <div
                  class="tile-wrapper"
                  {style}
                  style:--tile-hue={hueOf(node)}
                  inert={node.parent?.data.id !== zoomed.data.id ||
                    width < 1 ||
                    height < 1}
                  transition:fade={{ duration: fadeDuration }}
                >
                  {#if node.children}
                    <button
                      class="tile"
                      data-kind={node.data.kind}
                      title={describe(node)}
                      aria-label={`Zoom into ${describe(node)}`}
                      onclick={() => (zoomedId = node.data.id)}
                    >
                      {@render label()}
                    </button>
                  {:else if node.data.url}
                    <a
                      class="tile"
                      data-kind={node.data.kind}
                      href={node.data.url}
                      title={`${describe(node)}\n${node.data.url}`}
                    >
                      {@render label()}
                    </a>
                  {:else}
                    <div
                      class="tile"
                      data-kind={node.data.kind}
                      title={describe(node)}
                    >
                      {@render label()}
                    </div>
                  {/if}
                </div>
              {/each}
            {/snippet}
          </Bounds>
        {/snippet}
      </Treemap>
    </Html>
  </ChartCore>
</div>

<style>
  .breadcrumb ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    margin-block-end: 0.75rem;
    font-size: var(--el-font-size);
    line-height: var(--el-line-height);
  }

  .breadcrumb li {
    display: flex;
    align-items: center;
    gap: 0.5ch;
  }

  .separator {
    color: var(--fg-secondary);
    margin-inline-end: 0.25rem;
  }

  .breadcrumb [aria-current] {
    font-weight: 600;
    padding: var(--el-padding);
    padding-inline-end: 0;
  }

  /* Clip tiles sliding out while zooming, but leave room for the hover and
     focus outline of tiles along the edge. Edge tiles sit INSET inside the
     chart, so the outline only overflows by its extent minus INSET. Clipping
     any further would reveal neighbours, whose edges sit INSET outside the
     chart once zoomed. The padding holds the overflow; the negative margin
     keeps tiles aligned with the surrounding content. */
  .treemap {
    --clip-margin: max(
      0rem,
      var(--el-outline-width-selected) + var(--el-focus-outline-offset) -
        var(--tile-inset)
    );

    height: calc(32rem + 2 * var(--clip-margin));
    margin: calc(-1 * var(--clip-margin));
    padding: var(--clip-margin);
    overflow: clip;
  }

  .tile-wrapper {
    position: absolute;
    container-type: size;
  }

  .tile {
    display: flex;
    width: 100%;
    height: 100%;
    /* Shrinks with thin tiles, which would otherwise grow to fit the padding
       and spill out of their wrapper. */
    padding: min(0.5rem, 25cqmin);
    overflow: hidden;
    color: var(--fg-primary);
    font: inherit;
    font-size: var(--el-font-size);
    line-height: var(--el-line-height);
    text-align: start;
    text-decoration: none;
    /* Same lightness and chroma as --heatmap-color-1, in the website's hue. */
    --tile-bg: light-dark(
      oklch(80% 0.075 var(--tile-hue)),
      oklch(45% 0.075 var(--tile-hue))
    );

    background-color: var(--tile-bg);
    border-radius: 0.75rem;
    corner-shape: var(--el-corner-shape);
    outline-color: var(--el-focus-outline-color);
    outline-width: var(--el-outline-width-selected);
    outline-offset: var(--el-focus-outline-offset);
    transition: all 0.15s ease-in-out;
    transition-property: background-color, outline, box-shadow;

    &[data-kind="other"] {
      --tile-bg: var(--el-bg-default);
    }
  }

  button.tile,
  a.tile {
    cursor: pointer;

    &:hover,
    &:focus-visible {
      outline-style: solid;
    }

    /* Outline and shadow mark hover; keep the global button hover colour off. */
    &:hover {
      background-color: var(--tile-bg);
    }

    /* Keep the tile in place rather than using the global button press scale. */
    &:active {
      scale: none;
    }
  }

  .label {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-weight: 600;
  }

  .name-text {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .name img {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .count {
    color: var(--fg-secondary);
    white-space: nowrap;
  }

  /* Labels in tiny tiles are unreadable; the title tooltip still describes them. */
  @container (width < 3.5rem) or (height < 2.75rem) {
    .label {
      display: none;
    }
  }
</style>
