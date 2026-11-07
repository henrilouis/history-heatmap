<script lang="ts">
  import { getFaviconURL } from "../../utils/chrome-api";
  import { formatSyncedAgo, type DeviceGroup } from "../../utils/device-tabs";

  let { group, now }: { group: DeviceGroup; now: number } = $props();

  const count = $derived(
    `${group.tabs.length} ${group.tabs.length === 1 ? "tab" : "tabs"}`,
  );

  function hostname(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }
</script>

<article class="card" aria-label={group.name}>
  <h3>{group.name}</h3>
  <p class="text-secondary">
    {#if group.lastModified}
      Updated {formatSyncedAgo(group.lastModified, now)} ·
    {/if}
    {count}
  </p>
  <ol>
    {#each group.tabs as tab (tab.key)}
      <li>
        <img src={getFaviconURL(tab.url)} alt="" width="16" height="16" />
        <div class="tab-details">
          <a href={tab.url}>{tab.title}</a>
          <span class="text-secondary">{hostname(tab.url)}</span>
        </div>
      </li>
    {/each}
  </ol>
</article>

<style>
  h3 {
    margin-block-end: 0.25rem;
  }

  p {
    margin-block: 0 1.25rem;
    font-size: 0.875rem;
  }

  li {
    font-size: 0.75rem;
    display: grid;
    grid-template-columns: 1rem minmax(0, 1fr);
    align-items: center;
    gap: 0.5rem;
    padding-block: 0.25rem;

    &:not(:last-child) {
      border-bottom: var(--el-border-width) solid var(--el-border-color-default);
    }
  }

  img {
    width: 1rem;
    height: 1rem;
  }

  .tab-details {
    min-width: 0;
    padding-block: 0.375rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.5rem;
  }

  a {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
