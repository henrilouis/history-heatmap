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

<!-- Links, so each view has its own URL, history entry, and new-tab support. -->
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
