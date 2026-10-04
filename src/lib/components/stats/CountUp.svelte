<script lang="ts">
  import { untrack } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { formatNumber } from "./format";

  let {
    value,
    format = formatNumber,
  }: { value: number; format?: (value: number) => string } = $props();

  const DURATION = 1200;

  // Counts up once, the first time the number scrolls into view. Afterwards it
  // follows the value directly, e.g. while typing a search.
  let progress = $state(0);

  function countUp(node: HTMLElement) {
    if (
      untrack(() => prefersReducedMotion.current) ||
      typeof IntersectionObserver === "undefined"
    ) {
      progress = 1;
      return;
    }
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION);
        progress = 1 - (1 - t) ** 3;
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }
</script>

<span class="count-up" {@attach countUp}
  ><span aria-hidden="true">{format(value * progress)}</span><span
    class="visually-hidden">{format(value)}</span
  >
</span>

<style>
  .count-up {
    font-variant-numeric: tabular-nums;
  }
</style>
