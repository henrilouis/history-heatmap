<script lang="ts">
  import { onMount } from "svelte";
  import Card from "../history-list/Card.svelte";
  import DeviceList from "./DeviceList.svelte";
  import DevicesNotice from "./DevicesNotice.svelte";
  import DevicesPermission from "./DevicesPermission.svelte";
  import { devicesStore } from "../../stores/devices.svelte";
  import { routeStore } from "../../stores/route.svelte";
  import { openSyncSettings } from "../../utils/chrome-api";
  import { filterDeviceGroups } from "../../utils/device-tabs";

  onMount(devicesStore.connect);

  // Keeps "Updated 5 minutes ago" current between refreshes.
  let now = $state(Date.now());
  onMount(() => {
    const interval = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(interval);
  });
  $effect(() => {
    void devicesStore.groups;
    now = Date.now();
  });

  const status = $derived.by(() => {
    if (devicesStore.access === "denied") return "permission";
    if (!devicesStore.groups) return devicesStore.error ? "failed" : "loading";
    return devicesStore.groups.length ? "devices" : "empty";
  });
  const groups = $derived(
    filterDeviceGroups(devicesStore.groups ?? [], routeStore.search),
  );
</script>

<section class="devices">
  {#if devicesStore.error && status !== "permission"}
    <DevicesNotice failed={status === "failed"} />
  {/if}
  {#if status === "permission"}
    <DevicesPermission />
  {:else if status === "loading"}
    <Card loading={true} />
  {:else if status === "empty"}
    <Card>
      <h3>No tabs from other devices</h3>
      <p class="text-secondary">
        Tabs open in Chrome on your other devices appear here when you're signed
        in and syncing open tabs.
      </p>
      <button class="button" onclick={openSyncSettings}
        >Open sync settings</button
      >
    </Card>
  {:else if status === "devices"}
    <DeviceList {groups} {now} />
  {/if}
</section>

<style>
  .devices {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-block-start: 1rem;
  }

  h3 {
    margin-block-end: 0.25rem;
  }

  p {
    margin-block: 0 1rem;
  }
</style>
