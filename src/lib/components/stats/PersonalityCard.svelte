<script lang="ts">
  import StatCard from "./StatCard.svelte";
  import type { Personality } from "../../utils/insights/personality";

  let { personality }: { personality?: Personality } = $props();
</script>

{#if personality}
  <StatCard eyebrow="Your browsing personality" span={2} hue={290}>
    <p class="headline">
      {personality.time.name}
      <span class="plus">& {personality.style.name}</span>
    </p>
    <dl>
      {#each [personality.time, personality.style] as trait (trait.name)}
        <div>
          <dt>{trait.name}</dt>
          <dd class="caption">{trait.reason}</dd>
        </div>
      {/each}
    </dl>
  </StatCard>
{/if}

<style>
  .plus {
    display: block;
    font-size: 0.6em;
    font-weight: 700;
  }

  dl {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0.5rem 0 0;
  }

  dt {
    font-size: 0.875rem;
    font-weight: 600;
  }

  dd {
    margin: 0;
  }
</style>
