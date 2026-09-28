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
};

/**
 * Split rendered row indexes into runs of adjacent rows from the same card,
 * so each run can be drawn as a card fragment. Gaps are not drawn. A card
 * normally yields one fragment, keyed by its group so it survives scrolling;
 * a detached row, such as a focused row kept mounted off screen, gets its own.
 */
export function chunkHistoryRows(
  rows: HistoryRow[],
  groups: HistoryGroup[],
  indexes: number[],
): HistoryChunk[] {
  const chunks: HistoryChunk[] = [];
  const perGroup = new Map<number, number>();
  let previous = -2;
  for (const index of indexes) {
    const row = rows[index];
    if (!row || row.type === "gap") continue;
    const current = chunks.at(-1);
    if (current?.group === row.group && index === previous + 1) {
      current.indexes.push(index);
    } else {
      const count = perGroup.get(row.group) ?? 0;
      perGroup.set(row.group, count + 1);
      const key = groups[row.group].key;
      chunks.push({
        key: count ? `${key}:${count}` : key,
        group: row.group,
        indexes: [index],
      });
    }
    previous = index;
  }
  return chunks;
}
