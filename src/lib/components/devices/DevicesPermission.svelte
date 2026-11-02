<script lang="ts">
  import Card from "../history-list/Card.svelte";
  import { devicesStore } from "../../stores/devices.svelte";
</script>

<Card>
  <h3>Tabs from other devices</h3>
  <p class="text-secondary">
    See the tabs open in Chrome on your other signed-in devices. History heatmap
    needs permission to read them.
  </p>
  {#if devicesStore.error}
    <p role="alert">{devicesStore.error}</p>
  {/if}
  <button class="button" onclick={devicesStore.requestAccess}
    >Show tabs from other devices</button
  >
</Card>

<style>
  h3 {
    margin-block-end: 0.25rem;
  }

  p {
    margin-block: 0 1rem;
  }
</style>
