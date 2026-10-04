<script lang="ts" generics="Bar extends { label: string; value: number }">
  let {
    bars,
    describe,
    tick = () => "",
    tinted = () => false,
    peak,
  }: {
    bars: Bar[];
    /** Accessible description and tooltip of a bar. */
    describe: (bar: Bar) => string;
    /** Short label below a bar; empty to leave it out. */
    tick?: (bar: Bar, index: number) => string;
    /** Bars in a second colour, such as the weekend. */
    tinted?: (bar: Bar, index: number) => boolean;
    /** Highlighted bar; the largest by default. */
    peak?: number;
  } = $props();

  function indexOfMax(values: Bar[]): number {
    let best = 0;
    for (const [i, bar] of values.entries()) {
      if (bar.value > values[best].value) best = i;
    }
    return best;
  }

  const max = $derived(Math.max(0, ...bars.map((bar) => bar.value)));
  const highlighted = $derived(peak ?? indexOfMax(bars));
</script>

<ol class="bar-strip" style:--bars={bars.length}>
  {#each bars as bar, index (bar.label)}
    <li
      data-peak={index === highlighted && bar.value > 0}
      data-tinted={tinted(bar, index)}
      title={describe(bar)}
    >
      <span class="track" aria-hidden="true">
        <span
          class="bar"
          data-empty={bar.value === 0}
          style:--size={max ? bar.value / max : 0}
        ></span>
      </span>
      <span class="tick" aria-hidden="true">{tick(bar, index)}</span>
      <span class="visually-hidden">{describe(bar)}</span>
    </li>
  {/each}
</ol>

<style>
  .bar-strip {
    display: grid;
    grid-template-columns: repeat(var(--bars), minmax(0, 1fr));
    gap: clamp(0.125rem, 1cqi, 0.375rem);
    margin-block-start: 0.5rem;
  }

  li {
    --bar-color: var(--heatmap-color-2);

    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;

    &[data-tinted="true"] {
      --bar-color: oklch(from var(--heatmap-color-2) l c calc(h + 120));
    }

    &[data-peak="true"] {
      --bar-color: var(--heatmap-color-3);
    }

    &[data-peak="true"][data-tinted="true"] {
      --bar-color: oklch(from var(--heatmap-color-3) l c calc(h + 120));
    }
  }

  .track {
    display: flex;
    align-items: flex-end;
    height: 8rem;
  }

  .bar {
    width: 100%;
    height: max(0.125rem, calc(var(--size) * 100%));
    background-color: var(--bar-color);
    border-radius: 0.375rem 0.375rem 0.125rem 0.125rem;
    transform-origin: bottom;

    &[data-empty="true"] {
      background-color: var(--el-bg-default);
    }
  }

  .tick {
    min-height: 1lh;
    color: var(--fg-secondary);
    font-size: 0.6875rem;
    font-variant-numeric: tabular-nums;
    line-height: 1rem;
    text-align: center;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: no-preference) {
    @supports (animation-timeline: view()) {
      .bar {
        animation: grow ease-out both;
        animation-timeline: view();
        animation-range: entry 20% cover 40%;
      }
    }
  }

  @keyframes grow {
    from {
      scale: 1 0;
    }
  }
</style>
