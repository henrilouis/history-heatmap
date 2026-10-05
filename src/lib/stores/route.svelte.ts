import type { ViewMode } from "../utils/general";
import { formatHash, parseHash } from "../utils/route";

// The extension replaces chrome://history with index.html, which has no server
// fallback for other paths, so routes live in the hash: "#/stats?q=github".
const initial = parseHash(location.hash);
let view = $state<ViewMode>(initial.view);
let search = $state(initial.search);

function syncFromLocation(): void {
  const route = parseHash(location.hash);
  view = route.view;
  search = route.search;
}

/**
 * Follow back/forward and link navigation. View links are plain anchors, so
 * switching views pushes a history entry without any code here.
 */
function connect(): () => void {
  syncFromLocation();
  window.addEventListener("hashchange", syncFromLocation);
  window.addEventListener("popstate", syncFromLocation);
  return () => {
    window.removeEventListener("hashchange", syncFromLocation);
    window.removeEventListener("popstate", syncFromLocation);
  };
}

function hrefFor(target: ViewMode): string {
  return formatHash({ view: target, search });
}

/**
 * Keep the search in the URL without adding a history entry per keystroke, so
 * Back returns to the previous view rather than replaying the typing.
 */
function setSearch(query: string): void {
  if (query === search) return;
  search = query;
  history.replaceState(history.state, "", formatHash({ view, search }));
}

export const routeStore = {
  get view() {
    return view;
  },
  get search() {
    return search;
  },
  connect,
  hrefFor,
  setSearch,
};
