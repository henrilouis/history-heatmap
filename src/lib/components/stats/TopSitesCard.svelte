<script lang="ts">
  import SiteBadge from "./SiteBadge.svelte";
  import StatCard from "./StatCard.svelte";
  import { formatPercent, plural } from "./format";
  import { hueFor } from "../../utils/general";
  import type { TopSite } from "../../utils/insights/highlights";

  let { sites }: { sites: TopSite[] } = $props();

  const [first, ...rest] = $derived(sites);
</script>

{#if first}
  <StatCard
    eyebrow="Your top website"
    span={4}
    hue={hueFor(`site:${first.site}`)}
  >
    <p class="headline">
      <SiteBadge site={first.site} url={first.topUrl} size="large" />
    </p>
    <p class="caption">
      <strong>{plural(first.visits, "visit")}</strong>, or
      {formatPercent(first.share)} of all your browsing.
    </p>
    {#if rest.length}
      <ol class="ranked">
        {#each rest as site, index (site.site)}
          <li>
            <span class="rank">{index + 2}</span>
            <span>
              <SiteBadge site={site.site} url={site.topUrl} />
              <span class="meter" style:--size={site.share / first.share}>
                <span></span>
              </span>
            </span>
            <span class="count">{plural(site.visits, "visit")}</span>
          </li>
        {/each}
      </ol>
    {/if}
  </StatCard>
{/if}
