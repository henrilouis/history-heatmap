<script lang="ts">
  import { getFaviconURL } from "../../utils/chrome-api";

  let {
    site,
    url,
    size = "small",
  }: {
    site: string;
    /** A page on the website, for its favicon. */
    url: string;
    size?: "small" | "large";
  } = $props();
</script>

<span class="site-badge" data-size={size} title={site}>
  <img src={getFaviconURL(url)} alt="" width="16" height="16" />
  <span class="name">{site}</span>
</span>

<style>
  .site-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
    max-width: 100%;
    font-weight: 600;
    vertical-align: bottom;
  }

  img {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [data-size="large"] {
    gap: 0.625rem;

    img {
      width: 2rem;
      height: 2rem;
      padding: 0.25rem;
      background-color: oklch(100% 0 0);
      border-radius: 0.5rem;
      corner-shape: var(--el-corner-shape);
    }
  }
</style>
