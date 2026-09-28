import type { HistoryVisit } from "./chrome-api";

/** A day or hour of visits, displayed as one card. */
export type HistoryGroup = { key: string; items: HistoryVisit[] };

/**
 * One row of the virtualized history list. Cards are flattened into rows so a
 * single busy day renders only the visits near the viewport; gaps separate
 * consecutive cards.
 */
export type HistoryRow =
  | { type: "gap"; key: string }
  | { type: "heading"; key: string; group: number }
  | { type: "visit"; key: string; group: number; position: number };

export function flattenHistoryGroups(groups: HistoryGroup[]): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const [group, { key, items }] of groups.entries()) {
    if (group > 0) rows.push({ type: "gap", key: `gap:${key}` });
    rows.push({ type: "heading", key: `heading:${key}`, group });
    for (const [position, visit] of items.entries()) {
      rows.push({
        type: "visit",
        key: `visit:${key}:${visit.visitId}`,
        group,
        position,
      });
    }
  }
  return rows;
}

/** Rendered rows of one card that sit next to each other in the list. */
export type HistoryChunk = {
  key: string;
  group: number;
  indexes: number[];
  /** Row keys, to match fragments across renders when row indexes shift. */
  rowKeys: Set<string>;
};

/**
 * Split rendered row indexes into runs of adjacent rows from the same card,
 * so each run can be drawn as a card fragment. Gaps are not drawn.
 *
 * A fragment's key decides which element its rows are rendered in, so rows
 * moving to a fragment with another key are recreated. Each fragment keeps
 * the key of a `previous` fragment it shares rows with. When a card splits
 * (rows scroll away from a focused row kept mounted) or rejoins, the fragment
 * holding `focusedKey` claims its previous key first, so the focused element
 * survives. Fragments sharing no rows with the previous render get new keys.
 */
export function chunkHistoryRows(
  rows: HistoryRow[],
  groups: HistoryGroup[],
  indexes: number[],
  previous: HistoryChunk[] = [],
  focusedKey?: string,
): HistoryChunk[] {
  const chunks = splitRuns(rows, indexes);
  const claimed = new Set<string>();
  const inherit = (chunk: HistoryChunk, candidates: HistoryChunk[]) => {
    const match = candidates.find(
      (old) => !claimed.has(old.key) && overlaps(chunk.rowKeys, old.rowKeys),
    );
    if (!match) return;
    chunk.key = match.key;
    claimed.add(match.key);
  };

  const hasFocus = (chunk: HistoryChunk) =>
    focusedKey !== undefined && chunk.rowKeys.has(focusedKey);
  const focusedChunk = chunks.find(hasFocus);
  if (focusedChunk) inherit(focusedChunk, previous.filter(hasFocus));
  for (const chunk of chunks) if (!chunk.key) inherit(chunk, previous);
  // Fragments sharing no rows get keys unused by the previous render too.
  // Reusing one would reuse an unrelated element, possibly in another order,
  // and Svelte could move the focused fragment's element to reorder them;
  // moving an element blurs it.
  const taken = new Set([...claimed, ...previous.map((old) => old.key)]);
  for (const chunk of chunks) {
    if (chunk.key) continue;
    chunk.key = freshKey(groups[chunk.group].key, taken);
    taken.add(chunk.key);
  }
  return chunks;
}

function splitRuns(rows: HistoryRow[], indexes: number[]): HistoryChunk[] {
  const chunks: HistoryChunk[] = [];
  let previous = -2;
  for (const index of indexes) {
    const row = rows[index];
    if (!row || row.type === "gap") continue;
    const current = chunks.at(-1);
    if (current?.group === row.group && index === previous + 1) {
      current.indexes.push(index);
      current.rowKeys.add(row.key);
    } else {
      chunks.push({
        key: "",
        group: row.group,
        indexes: [index],
        rowKeys: new Set([row.key]),
      });
    }
    previous = index;
  }
  return chunks;
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const key of a) if (b.has(key)) return true;
  return false;
}

function freshKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let count = 1;
  while (taken.has(`${base}:${count}`)) count++;
  return `${base}:${count}`;
}
