<script lang="ts">
  import { openClearBrowsingData } from "../../utils/chrome-api";
</script>

<button
  onclick={openClearBrowsingData}
  aria-label="Delete browsing data"
  title="Delete browsing data"
  class="button clear-browsing-data"
>
  <!-- Lucide "trash-2" icon (ISC license): https://lucide.dev -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M10 11v6"></path>
    <path d="M14 11v6"></path>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
    <path d="M3 6h18"></path>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
</button>

<style>
  .clear-browsing-data {
    display: grid;
    place-items: center;
    height: calc(var(--el-line-height) + calc(var(--el-padding-block) * 2));
    padding-block: 0;
    padding-inline: calc(var(--el-padding-block) - 0.0625rem);
  }
</style>
