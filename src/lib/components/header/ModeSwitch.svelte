<script lang="ts">
  import { routeStore } from "../../stores/route.svelte";
  import type { ViewMode } from "../../utils/general";

  let { viewMode }: { viewMode: ViewMode } = $props();

  const modes: { mode: ViewMode; label: string }[] = [
    { mode: "days", label: "Days" },
    { mode: "hours", label: "Hours" },
    { mode: "stats", label: "Stats" },
  ];
</script>

<!--
  Links, so each view gets a history entry (back/forward, reload) and new-tab
  support. Chrome shows chrome://history in the address bar and hides the hash,
  so these routes are internal to the extension page, not shareable links.
-->
<nav class="button-group" aria-label="View">
  {#each modes as { mode, label } (mode)}
    <a
      class="button quiet"
      class:selected={viewMode === mode}
      href={routeStore.hrefFor(mode)}
      aria-current={viewMode === mode ? "page" : undefined}
    >
      {label}
    </a>
  {/each}
</nav>
