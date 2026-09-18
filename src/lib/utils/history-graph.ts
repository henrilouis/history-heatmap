import type { HistoryVisit } from "./chrome-api";

export type NavigationIndex = ReturnType<typeof indexNavigation>;

// Shared across cards and built from unfiltered history: a hidden intermediate
// visit must never turn into an invented direct connection.
export function indexNavigation(history: HistoryVisit[]) {
  const visits = new Map(history.map((visit) => [visit.visitId, visit]));
  const parents = new Map<string, string>();
  const children = new Map<string, string[]>();

  for (const visit of history) {
    const parent = visits.get(visit.referringVisitId ?? "0");
    if (
      !parent ||
      parent.visitId === visit.visitId ||
      (parent.visitTime !== undefined &&
        visit.visitTime !== undefined &&
        parent.visitTime > visit.visitTime)
    )
      continue;
    parents.set(visit.visitId, parent.visitId);
    const siblings = children.get(parent.visitId);
    if (siblings) siblings.push(visit.visitId);
    else children.set(parent.visitId, [visit.visitId]);
  }

  return { visits, parents, children, trails: indexTrails(history, parents) };
}

// Iterative, memoized traversal also handles long trails without recursion.
function indexTrails(history: HistoryVisit[], parents: Map<string, string>) {
  const trails = new Map<string, string>();
  for (const visit of history) {
    if (trails.has(visit.visitId)) continue;
    const path = new Set<string>();
    let id = visit.visitId;
    while (!trails.has(id) && !path.has(id)) {
      path.add(id);
      const parent = parents.get(id);
      if (!parent) break;
      id = parent;
    }
    const trail = trails.get(id) ?? id;
    for (const member of path) trails.set(member, trail);
  }

  return trails;
}

export type GraphSegment = {
  from: number;
  to: number;
  half: "top" | "bottom" | "full";
  trail: string;
};

export type GraphRow = {
  visit: HistoryVisit;
  lane: number;
  trail: string;
  segments: GraphSegment[];
  earlier: number;
  later: number;
};

// Reserve one extra lane for nodes when all connection lanes are occupied.
// Dense/long connections use explicit endpoint markers rather than expanding
// the graph indefinitely or drawing overlapping, ambiguous lines.
const CONNECTION_LANES = 5;
const MAX_EDGE_ROWS = 80;
export const GRAPH_LANE_WIDTH = 14;

type OpenLane = { target: number; trail: string } | undefined;

function connectIncoming(row: GraphRow, position: number, lanes: OpenLane[]) {
  const incoming = lanes.findIndex((edge) => edge?.target === position);
  const free = lanes.findIndex((edge) => !edge);
  row.lane = incoming !== -1 ? incoming : free === -1 ? CONNECTION_LANES : free;

  for (const [lane, edge] of lanes.entries()) {
    if (!edge) continue;
    const endsHere = edge.target === position;
    row.segments.push({
      from: lane,
      to: endsHere ? row.lane : lane,
      half: endsHere ? "top" : "full",
      trail: edge.trail,
    });
    if (endsHere) lanes[lane] = undefined;
  }
}

export function layoutNavigation(
  items: HistoryVisit[],
  index: NavigationIndex,
) {
  const positions = new Map(items.map((visit, row) => [visit.visitId, row]));
  const lanes: OpenLane[] = Array.from({
    length: CONNECTION_LANES,
  });
  const rows: GraphRow[] = items.map((visit) => ({
    visit,
    lane: 0,
    trail: index.trails.get(visit.visitId) ?? visit.visitId,
    segments: [],
    earlier: 0,
    later: (index.children.get(visit.visitId) ?? []).filter(
      (child) => !positions.has(child),
    ).length,
  }));
  let laneCount = 1;

  for (const [position, row] of rows.entries()) {
    connectIncoming(row, position, lanes);
    laneCount = Math.max(laneCount, row.lane + 1);

    const parent = index.parents.get(row.visit.visitId);
    if (!parent) continue;
    const target = positions.get(parent);
    if (
      target !== undefined &&
      target > position &&
      target - position <= MAX_EDGE_ROWS &&
      row.lane < CONNECTION_LANES
    ) {
      lanes[row.lane] = { target, trail: row.trail };
      row.segments.push({
        from: row.lane,
        to: row.lane,
        half: "bottom",
        trail: row.trail,
      });
    } else {
      row.earlier++;
      if (target !== undefined) rows[target].later++;
    }
  }

  return { rows, width: (laneCount + 1) * GRAPH_LANE_WIDTH };
}

export function trailHue(trail: string): number {
  let hash = 0;
  for (let i = 0; i < trail.length; i++) {
    hash = (hash * 31 + trail.charCodeAt(i)) | 0;
  }
  // Spread neighboring numeric visit IDs around the color wheel.
  return ((((hash % 360) * 137.508) % 360) + 360) % 360;
}

export function describeGraphRow(
  row: GraphRow,
  index: NavigationIndex,
): string {
  const { visit } = row;
  const type =
    visit.transition === "reload"
      ? "Reload or restored page"
      : visit.transition === "link"
        ? "Link navigation"
        : (visit.transition?.replaceAll("_", " ") ?? "Visit");
  const parentId = index.parents.get(visit.visitId);
  const parent = parentId ? index.visits.get(parentId) : undefined;
  const details = [type];
  if (parent) details.push(`From: ${parent.title || parent.url}`);
  else details.push("No recorded referrer available");
  const children = index.children.get(visit.visitId)?.length ?? 0;
  if (children)
    details.push(`Led to ${children} ${children === 1 ? "visit" : "visits"}`);
  if (row.earlier || row.later) {
    details.push(
      "Tunnel shadows: connections outside this view or condensed to keep the graph compact",
    );
  }
  return details.join(". ");
}
