<script lang="ts">
  import { formatPercent } from "./format";

  let {
    parts,
  }: {
    /** Segments in order; `color` is any CSS colour. */
    parts: { label: string; count: number; color: string }[];
  } = $props();

  const total = $derived(parts.reduce((sum, part) => sum + part.count, 0));
  const shown = $derived(parts.filter((part) => part.count > 0));
</script>

<div class="split" aria-hidden="true">
  {#each shown as part (part.label)}
    <span style:flex-grow={part.count} style:background-color={part.color}
    ></span>
  {/each}
</div>
<ul class="legend">
  {#each shown as part (part.label)}
    <li>
      <span class="swatch" style:background-color={part.color}></span>
      {part.label}
      <span class="share">{formatPercent(part.count / total)}</span>
    </li>
  {/each}
</ul>

<style>
  .split {
    display: flex;
    gap: 0.125rem;
    height: 1rem;
    margin-block-start: 0.5rem;
    overflow: hidden;
    border-radius: var(--el-border-radius);
  }

  .split span {
    min-width: 0.25rem;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.125rem 1rem;
    margin: 0;
    padding: 0;
    font-size: var(--el-font-size);
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .swatch {
    flex-shrink: 0;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 0.25rem;
  }

  .share {
    color: var(--fg-secondary);
  }
</style>
