<script lang="ts">
  import Card from "../history-list/Card.svelte";
  import DeviceCard from "./DeviceCard.svelte";
  import { devicesStore } from "../../stores/devices.svelte";
  import type { DeviceGroup } from "../../utils/device-tabs";

  let {
    groups,
    failed,
    now,
  }: {
    /** Devices matching the search. */
    groups: DeviceGroup[];
    /** Whether the first load failed, so there are no tabs to keep showing. */
    failed: boolean;
    now: number;
  } = $props();
</script>

{#if devicesStore.error}
  <!-- A failed refresh keeps the tabs already shown. -->
  <div class="notice" role={failed ? "alert" : "status"}>
    <span
      >{failed
        ? devicesStore.error
        : "Couldn't refresh tabs from other devices."}</span
    >
    <button
      class="button"
      disabled={devicesStore.isLoading}
      onclick={devicesStore.refresh}>Retry</button
    >
  </div>
{/if}
{#each groups as group (group.key)}
  <DeviceCard {group} {now} />
{:else}
  {#if !failed}
    <Card>
      <h3>No results found</h3>
    </Card>
  {/if}
{/each}

<style>
  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
</style>
