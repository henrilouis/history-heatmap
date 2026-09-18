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
        {#if row.later}
            <path
                class="continuation"
                style={`--trail-hue: ${trailHue(row.trail)}`}
                d={`M ${x(row.lane)} 16 V 4 m -3 3 l 3 -3 l 3 3`}
            />
        {/if}
        {#if row.earlier}
            <path
                class="continuation"
                style={`--trail-hue: ${trailHue(row.trail)}`}
                d={`M ${x(row.lane)} 24 V 36 m -3 -3 l 3 3 l 3 -3`}
            />
        {/if}
    </svg>
    <span
        class="graph-node"
        class:reload={row.visit.transition === "reload"}
        style={`left: ${x(row.lane)}px; --trail-hue: ${trailHue(row.trail)}`}
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
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
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
        width: 10px;
        height: 10px;
        border: 2px solid var(--trail-color);
        border-radius: 50%;
        background: var(--trail-color);
        box-shadow: 0 0 0 2px var(--bg-primary);
    }
    .graph-node.reload {
        background: var(--bg-primary);
    }
</style>
