<script lang="ts">
  import SiteBadge from "./SiteBadge.svelte";
  import StatCard from "./StatCard.svelte";
  import { plural } from "./format";
  import type { Regular } from "../../utils/insights/discovery";

  let { regulars = [], days }: { regulars?: Regular[]; days: number } =
    $props();
</script>

{#if regulars.length}
  <StatCard eyebrow="Your regulars" span={4}>
    <p class="caption">The websites you came back to on the most days.</p>
    <ol class="ranked">
      {#each regulars as regular, index (regular.site)}
        <li>
          <span class="rank">{index + 1}</span>
          <span>
            <SiteBadge site={regular.site} url={regular.topUrl} />
            <span class="meter" style:--size={regular.days / days}>
              <span></span>
            </span>
          </span>
          <span class="count">
            {regular.days.toLocaleString()} of {plural(days, "day")}
          </span>
        </li>
      {/each}
    </ol>
  </StatCard>
{/if}
