<script lang="ts">
  let {
    time,
    title,
    url,
    domain,
    deleteHistoryUrl,
  }: {
    time: number;
    title: string;
    url: string;
    domain: string;
    deleteHistoryUrl: (url: string) => void;
  } = $props();
</script>

<li transition:blur animate:flip={{ duration: 200 }}>
  <time
    >{new Date(time).toLocaleTimeString([], {
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    })}</time
  >
  <img src={getFaviconURL(domain)} alt={`Favicon for ${domain}`} />
  <div>
    <a href={url}>{title}</a>
    <span class="text-secondary">{domain}</span>
  </div>
  <button class="quiet" onclick={() => deleteHistoryUrl(url)}>Delete</button>
</li>

<style>
  li {
    font-size: 0.75rem;
    display: grid;
    grid-template-columns: 4rem 16px 1fr auto;
    align-items: center;
    gap: 0.5rem;
    padding-block: 0.25rem;
    &:not(:last-child) {
      border-bottom: var(--el-border-width) solid var(--el-border-color-default);
    }
  }
</style>
