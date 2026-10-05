import type { ViewMode } from "./general";

export interface Route {
  view: ViewMode;
  search: string;
}

const viewModes: readonly ViewMode[] = ["days", "hours", "stats"];

function isViewMode(value: string): value is ViewMode {
  return (viewModes as readonly string[]).includes(value);
}

/**
 * Parse a location hash such as "#/stats?q=github". An extension override page
 * has no server to fall back to for unknown paths, so the route lives in the
 * fragment. Anything unrecognised falls back to the default days view.
 */
export function parseHash(hash: string): Route {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  const queryStart = fragment.indexOf("?");
  const path = queryStart === -1 ? fragment : fragment.slice(0, queryStart);
  const query = queryStart === -1 ? "" : fragment.slice(queryStart + 1);
  const view = path.replace(/^\/+|\/+$/g, "");
  return {
    view: isViewMode(view) ? view : "days",
    search: new URLSearchParams(query).get("q") ?? "",
  };
}

export function formatHash({ view, search }: Route): string {
  const query = search ? `?${new URLSearchParams({ q: search })}` : "";
  return `#/${view}${query}`;
}
