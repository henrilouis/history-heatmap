<script lang="ts">
  let { setSearch }: { setSearch: (query: string) => void } = $props();
  let timer: ReturnType<typeof setTimeout>;
  const oninput = (e: Event) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      setSearch((e.target as HTMLInputElement).value);
    }, 750);
  };
</script>

<input type="search" placeholder="Search..." {oninput} name="Search history" />

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
    margin-inline: auto;
    transition: all 0.15s ease-in-out;
    transition-property: border, outline, background-color;
    &:hover {
      background-color: var(--field-bg-hover);
      border-color: var(--el-border-color-hover);
    }
    &:focus-visible {
      outline-style: solid;
      outline-color: var(--el-focus-outline-color);
      outline-width: var(--el-focus-outline-width);
      outline-offset: var(--el-focus-outline-offset);
    }
    &::-webkit-search-cancel-button {
      cursor: pointer;
      margin: 0;
      padding: 0.75rem;
      opacity: 1;
    }
  }
</style>
