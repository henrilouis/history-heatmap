import type { HistoryVisit } from "./chrome-api";

// Both inputs are newest-first. Replace only accepted URLs, merging in linear
// time without sorting/copying the full history into intermediate arrays.
export function mergeHistoryVisits(
  history: HistoryVisit[],
  updates: HistoryVisit[],
  urls: ReadonlySet<string>,
): HistoryVisit[] {
  const merged: HistoryVisit[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < history.length || newIndex < updates.length) {
    if (oldIndex < history.length && urls.has(history[oldIndex].url)) {
      oldIndex++;
      continue;
    }
    if (newIndex < updates.length && !urls.has(updates[newIndex].url)) {
      newIndex++;
      continue;
    }
    if (newIndex === updates.length ||
      (oldIndex < history.length &&
        (history[oldIndex].visitTime ?? 0) >= (updates[newIndex].visitTime ?? 0))) {
      merged.push(history[oldIndex++]);
    } else {
      merged.push(updates[newIndex++]);
    }
  }
  return merged;
}
