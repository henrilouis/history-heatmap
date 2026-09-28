/**
 * Report the offset of `element` from the top of the scrollable content of
 * `root`, now and whenever it may have moved: when anything before it
 * resizes, or when elements are added or removed along the way.
 */
export function observeScrollOffset(
  element: HTMLElement,
  root: HTMLElement,
  onChange: (offset: number) => void,
): () => void {
  let offset: number | undefined;
  const measure = () => {
    const next =
      element.getBoundingClientRect().top -
      root.getBoundingClientRect().top +
      root.scrollTop;
    if (next !== offset) onChange((offset = next));
  };

  const resizes = new ResizeObserver(measure);
  const mutations = new MutationObserver(() => {
    observe();
    measure();
  });
  function observe() {
    resizes.disconnect();
    mutations.disconnect();
    resizes.observe(root);
    for (let node = element; node !== root;) {
      const parent = node.parentElement;
      if (!parent) break;
      for (let sibling = node.previousElementSibling; sibling;) {
        resizes.observe(sibling);
        sibling = sibling.previousElementSibling;
      }
      mutations.observe(parent, { childList: true });
      node = parent;
    }
  }

  observe();
  measure();
  return () => {
    resizes.disconnect();
    mutations.disconnect();
  };
}
