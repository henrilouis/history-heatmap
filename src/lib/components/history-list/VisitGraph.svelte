<script lang="ts">
  import {
    GRAPH_LANE_WIDTH,
    describeGraphRow,
    trailHue,
    type GraphRow,
    type GraphSegment,
    type NavigationIndex,
  } from "../../utils/history-graph";

  let {
    row,
    width,
    index,
  }: {
    row: GraphRow;
    width: number;
    index: NavigationIndex;
  } = $props();

  const x = (lane: number) => (lane + 1) * GRAPH_LANE_WIDTH;
  const description = $derived(describeGraphRow(row, index));

  function path(segment: GraphSegment): string {
    const start = segment.half === "bottom" ? 20 : 0;
    const end = segment.half === "top" ? 20 : 40;
    const middle = (start + end) / 2;
    return `M ${x(segment.from)} ${start} C ${x(segment.from)} ${middle}, ${x(segment.to)} ${middle}, ${x(segment.to)} ${end}`;
  }
</script>

<span class="visit-graph" role="img" aria-label={description}>
  <svg
    class="tracks"
    viewBox={`0 0 ${width} 40`}
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    {#each row.segments as segment}
      <path
        d={path(segment)}
        style={`--trail-hue: ${trailHue(segment.trail)}`}
      />
    {/each}
  </svg>
  {#if row.later || row.earlier}
    <svg
      class="tracks continuations"
      class:earlier={row.earlier}
      viewBox={`0 0 ${width} 40`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {#if row.later}
        <path
          style={`--trail-hue: ${trailHue(row.trail)}`}
          d={`M ${x(row.lane)} 20 V 0`}
        />
      {/if}
      {#if row.earlier}
        <path
          style={`--trail-hue: ${trailHue(row.trail)}`}
          d={`M ${x(row.lane)} 20 V 40`}
        />
      {/if}
    </svg>
    {#if row.later}
      <span
        class="tunnel-shadow"
        style={`left: ${(x(row.lane) / width) * 100}%`}
        aria-hidden="true"
      ></span>
    {/if}
    {#if row.earlier}
      <span
        class="tunnel-shadow earlier"
        style={`left: ${(x(row.lane) / width) * 100}%`}
        aria-hidden="true"
      ></span>
    {/if}
  {/if}
  <span
    class="graph-node"
    class:reload={row.visit.transition === "reload"}
    style={`left: ${(x(row.lane) / width) * 100}%; --trail-hue: ${trailHue(row.trail)}`}
    aria-hidden="true"
  ></span>
</span>

<style>
  .visit-graph {
    position: relative;
    align-self: stretch;
    min-height: 3rem;
  }
  .tracks {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }
  .continuations.earlier {
    clip-path: inset(0 0 0.0625rem);
  }
  .tunnel-shadow {
    position: absolute;
    top: 0;
    translate: -50% 0;
    width: 3rem;
    height: 0.125rem;
    pointer-events: none;
    background: radial-gradient(
      at top,
      light-dark(rgb(0 0 0 / 0.35), rgb(0 0 0)) 0%,
      transparent 50%
    );
  }
  .tunnel-shadow.earlier {
    top: auto;
    bottom: 0.0625rem;
    rotate: 180deg;
  }
  path,
  .graph-node {
    --trail-color: light-dark(
      oklch(48% 0.16 var(--trail-hue)),
      oklch(76% 0.14 var(--trail-hue))
    );
  }
  path {
    fill: none;
    stroke: var(--trail-color);
    stroke-width: 1.75;
    vector-effect: non-scaling-stroke;
  }
  .graph-node {
    position: absolute;
    top: 50%;
    translate: -50% -50%;
    width: 0.625rem;
    height: 0.625rem;
    border: 0.125rem solid var(--trail-color);
    border-radius: 50%;
    background: var(--trail-color);
    box-shadow: 0 0 0 0.125rem var(--bg-primary);
  }
  .graph-node.reload {
    background: var(--bg-primary);
  }
</style>
