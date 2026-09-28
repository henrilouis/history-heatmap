<script lang="ts">
  import type { ViewMode } from "../../utils/general";

  let {
    viewMode,
    setViewMode,
  }: {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
  } = $props();

  const modes: { mode: ViewMode; label: string }[] = [
    { mode: "days", label: "Days" },
    { mode: "hours", label: "Hours" },
    { mode: "stats", label: "Stats" },
  ];
</script>

<div class="button-group">
  {#each modes as { mode, label } (mode)}
    <button
      class="quiet"
      class:selected={viewMode === mode}
      aria-pressed={viewMode === mode}
      onclick={() => setViewMode(mode)}
    >
      {label}
    </button>
  {/each}
</div>
