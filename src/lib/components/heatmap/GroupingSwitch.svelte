<script lang="ts">
  import { routeStore } from "../../stores/route.svelte";
  import type { Grouping } from "../../utils/general";

  const groupings: { grouping: Grouping; label: string }[] = [
    { grouping: "time", label: "By time" },
    { grouping: "flow", label: "By flow" },
  ];
</script>

<div class="button-group" role="group" aria-label="Group history">
  {#each groupings as { grouping, label } (grouping)}
    <button
      class="button quiet"
      class:selected={routeStore.grouping === grouping}
      aria-pressed={routeStore.grouping === grouping}
      onclick={() => routeStore.setGrouping(grouping)}
    >
      {label}
    </button>
  {/each}
</div>
