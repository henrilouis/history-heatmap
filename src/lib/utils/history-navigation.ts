import type { HistoryVisit } from "./chrome-api";

export type NavigationIndex = ReturnType<typeof indexNavigation>;

// Built from unfiltered history: a hidden intermediate visit must never split
// a trail, or turn into an invented direct connection.
export function indexNavigation(history: HistoryVisit[]) {
  const visits = new Map(history.map((visit) => [visit.visitId, visit]));
  const parents = new Map<string, string>();

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
  }

  return { visits, trails: indexTrails(history, parents) };
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
