<script lang="ts">
  import Card from "../history-list/Card.svelte";
  import DeviceCard from "./DeviceCard.svelte";
  import type { DeviceGroup } from "../../utils/device-tabs";

  let {
    groups,
    now,
  }: {
    /** Devices matching the search. */
    groups: DeviceGroup[];
    now: number;
  } = $props();
</script>

{#each groups as group (group.key)}
  <DeviceCard {group} {now} />
{:else}
  <Card>
    <h3>No results found</h3>
  </Card>
{/each}
