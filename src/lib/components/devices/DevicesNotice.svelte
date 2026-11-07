<script lang="ts">
  import { devicesStore } from "../../stores/devices.svelte";

  let {
    failed,
  }: {
    /** Whether the first load failed, so there are no tabs to keep showing. */
    failed: boolean;
  } = $props();
</script>

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

<style>
  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
</style>
