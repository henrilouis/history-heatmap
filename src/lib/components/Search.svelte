<script lang="ts">
  let { value = $bindable() }: { value: string } = $props();
  let timer: ReturnType<typeof setTimeout>;
  const oninput = (e: Event) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      value = (e.target as HTMLInputElement).value;
    }, 750);
  };

  // To do: have an override making the search always light style and ajust accordingly.
  // It's ok if it attracts more attention.
</script>

<input type="search" placeholder="Search..." {oninput} />

<style>
  input[type="search"] {
    background-color: var(--field-bg-default);
    border: var(--el-border-width) solid var(--el-border-color-default);
    border-radius: var(--el-border-radius);
    corner-shape: var(--el-corner-shape);
    padding: var(--el-padding);
    padding-inline-end: 0;
    max-width: 32rem;
    width: 100%;
    font-size: var(--el-font-size);
    line-height: var(--el-line-height);
    &:hover {
      background-color: var(--field-bg-hover);
      border-color: var(--el-border-color-hover);
    }
    &:focus-visible {
      outline-color: var(--el-focus-outline-color);
      outline-width: var(--el-focus-outline-width);
      outline-offset: var(--el-focus-outline-offset);
      outline-style: solid;
    }
    &::-webkit-search-cancel-button {
      cursor: pointer;
      margin: 0;
      padding: 0.75rem;
      opacity: 1;
    }
  }
</style>
