<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    eyebrow,
    span = 2,
    hue,
    variant = "default",
    children,
  }: {
    /** Short heading above the card's headline. */
    eyebrow: string;
    /** Columns out of six on wide screens. */
    span?: 2 | 3 | 4 | 6;
    /** Tints the card, e.g. with the website's hue from hueFor. */
    hue?: number;
    variant?: "default" | "hero";
    children: Snippet;
  } = $props();
</script>

<article
  class="card stat-card"
  data-span={span}
  data-variant={variant}
  data-tinted={hue !== undefined}
  style:--card-hue={hue}
>
  <h3 class="eyebrow">{eyebrow}</h3>
  {@render children()}
</article>

<style>
  .stat-card {
    --card-hue: var(--heatmap-hue);
    --accent: light-dark(
      oklch(45% 0.2 var(--card-hue)),
      oklch(85% 0.15 var(--card-hue))
    );
    --bar-bg: var(--el-bg-default);

    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    container-type: inline-size;

    &[data-tinted="true"] {
      background-color: light-dark(
        oklch(96% 0.03 var(--card-hue)),
        oklch(32% 0.04 var(--card-hue))
      );
    }

    &[data-variant="hero"] {
      --accent: oklch(100% 0 0);
      --fg-primary: oklch(100% 0 0);
      --fg-secondary: oklch(100% 0 0 / 0.8);
      --bar-bg: oklch(100% 0 0 / 0.2);

      color: var(--fg-primary);
      background: linear-gradient(
        135deg,
        oklch(50% 0.2 var(--card-hue)),
        oklch(42% 0.22 calc(var(--card-hue) + 60))
      );
    }
  }

  .eyebrow {
    margin: 0;
    color: var(--fg-secondary);
    font-size: var(--el-font-size);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .stat-card :global {
    .headline {
      margin: 0;
      color: var(--accent);
      font-size: clamp(1.75rem, 9cqi, 3rem);
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.02em;
      overflow-wrap: anywhere;
    }

    .caption {
      margin: 0;
      color: var(--fg-secondary);
      font-size: 0.875rem;
    }

    .caption strong {
      color: var(--fg-primary);
    }

    .ranked {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-block-start: 0.5rem;
      font-size: 0.875rem;
    }

    .ranked li {
      display: grid;
      grid-template-columns: 1.5rem minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.5rem;
    }

    .rank {
      color: var(--fg-secondary);
      font-variant-numeric: tabular-nums;
      text-align: end;
    }

    .count {
      color: var(--fg-secondary);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .meter {
      display: block;
      height: 0.375rem;
      margin-block-start: 0.25rem;
      overflow: hidden;
      background-color: var(--bar-bg);
      border-radius: var(--el-border-radius);
    }

    .meter > span {
      display: block;
      width: calc(var(--size) * 100%);
      height: 100%;
      background-color: var(--accent);
      border-radius: inherit;
    }
  }

  @container stats (width >= 40rem) {
    [data-span="2"] {
      grid-column: span 2;
    }

    [data-span="3"] {
      grid-column: span 3;
    }

    [data-span="4"] {
      grid-column: span 4;
    }

    [data-span="6"] {
      grid-column: 1 / -1;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    @supports (animation-timeline: view()) {
      .stat-card {
        animation: reveal linear both;
        animation-timeline: view();
        animation-range: entry 0% entry 50%;
      }
    }
  }

  @keyframes reveal {
    from {
      opacity: 0;
      translate: 0 1.5rem;
      scale: 0.97;
    }
  }
</style>
