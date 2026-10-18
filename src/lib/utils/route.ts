import type { Grouping, ViewMode } from "./general";

export interface Route {
  view: ViewMode;
  search: string;
  grouping: Grouping;
}

const viewModes: readonly ViewMode[] = ["days", "hours", "stats"];

function isViewMode(value: string): value is ViewMode {
  return (viewModes as readonly string[]).includes(value);
}

/**
 * Parse a location hash such as "#/stats?q=github&group=flow". An extension
 * override page has no server to fall back to for unknown paths, so the route
 * lives in the fragment. Anything unrecognised falls back to the default days
 * view, grouped by time.
 */
export function parseHash(hash: string): Route {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  const queryStart = fragment.indexOf("?");
  const path = queryStart === -1 ? fragment : fragment.slice(0, queryStart);
  const query = new URLSearchParams(
    queryStart === -1 ? "" : fragment.slice(queryStart + 1),
  );
  const view = path.replace(/^\/+|\/+$/g, "");
  return {
    view: isViewMode(view) ? view : "days",
    search: query.get("q") ?? "",
    grouping: query.get("group") === "flow" ? "flow" : "time",
  };
}

export function formatHash({ view, search, grouping }: Route): string {
  const query = new URLSearchParams();
  if (search) query.set("q", search);
  if (grouping === "flow") query.set("group", grouping);
  return query.size ? `#/${view}?${query}` : `#/${view}`;
}
