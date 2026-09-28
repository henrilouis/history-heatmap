import { describe, expect, it } from "vitest";
import { historyVisit } from "./history-fixtures";
import {
  chunkHistoryRows,
  flattenHistoryGroups,
  type HistoryChunk,
  type HistoryGroup,
} from "./history-rows";

const groups: HistoryGroup[] = [
  { key: "2026-09-12", items: [historyVisit("a"), historyVisit("b")] },
  { key: "2026-09-11", items: [] },
  { key: "2026-09-10", items: [historyVisit("c")] },
];

describe("history list rows", () => {
  it("flattens cards into headings and visits separated by gaps", () => {
    expect(flattenHistoryGroups(groups)).toEqual([
      { type: "heading", key: "heading:2026-09-12", group: 0 },
      { type: "visit", key: "visit:2026-09-12:a", group: 0, position: 0 },
      { type: "visit", key: "visit:2026-09-12:b", group: 0, position: 1 },
      { type: "gap", key: "gap:2026-09-11" },
      { type: "heading", key: "heading:2026-09-11", group: 1 },
      { type: "gap", key: "gap:2026-09-10" },
      { type: "heading", key: "heading:2026-09-10", group: 2 },
      { type: "visit", key: "visit:2026-09-10:c", group: 2, position: 0 },
    ]);
  });

  it("keeps a visit's key when it appears in another day or hour", () => {
    const visit = historyVisit("same");
    const keys = flattenHistoryGroups([
      { key: "2026-09-12T09", items: [visit] },
      { key: "2026-09-12T10", items: [visit] },
    ]).map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("groups rendered rows into card fragments keyed by their card", () => {
    const rows = flattenHistoryGroups(groups);
    expect(
      chunkHistoryRows(rows, groups, [1, 2, 3, 4, 5, 6]).map(summary),
    ).toEqual([
      { key: "2026-09-12", indexes: [1, 2] },
      { key: "2026-09-11", indexes: [4] },
      { key: "2026-09-10", indexes: [6] },
    ]);
  });

  describe("with a focused row kept mounted in a busy card", () => {
    const busy: HistoryGroup[] = [
      {
        key: "2026-09-12",
        items: Array.from({ length: 100 }, (_, i) => historyVisit(`${i}`)),
      },
    ];
    const rows = flattenHistoryGroups(busy);
    const focused = rows[50].key;
    const range = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const scroll = (steps: number[][]) =>
      steps.reduce<HistoryChunk[][]>((renders, indexes) => {
        const previous = renders.at(-1);
        return [
          ...renders,
          chunkHistoryRows(rows, busy, indexes, previous, focused),
        ];
      }, []);
    const keyOf = (chunks: HistoryChunk[], index: number) =>
      chunks.find((chunk) => chunk.indexes.includes(index))?.key;

    it("keeps the focused row's fragment key when scrolling up splits it", () => {
      const renders = scroll([
        range(40, 60),
        range(30, 50),
        [...range(20, 40), 50],
      ]);
      expect(renders.at(-1)!.map(summary)).toEqual([
        { key: "2026-09-12:1", indexes: range(20, 40) },
        { key: "2026-09-12", indexes: [50] },
      ]);
      expect(new Set(renders.map((chunks) => keyOf(chunks, 50)))).toEqual(
        new Set(["2026-09-12"]),
      );
    });

    it("keeps it when jumping away without overlap and rejoining", () => {
      const renders = scroll([
        range(40, 60),
        [...range(0, 20), 50],
        range(40, 60),
      ]);
      expect(renders.map((chunks) => keyOf(chunks, 50))).toEqual([
        "2026-09-12",
        "2026-09-12",
        "2026-09-12",
      ]);
      expect(renders.at(-1)!.map(summary)).toEqual([
        { key: "2026-09-12", indexes: range(40, 60) },
      ]);
    });

    it("keeps the visible fragment's key when focus moves into it", () => {
      const detached = scroll([range(40, 60), [...range(0, 20), 50]]).at(-1)!;
      const visibleKey = keyOf(detached, 10);
      // Focus moved to row 10; the old focused row drops out of the range.
      const next = chunkHistoryRows(
        rows,
        busy,
        range(0, 22),
        detached,
        rows[10].key,
      );
      expect(next.map(summary)).toEqual([
        { key: visibleKey, indexes: range(0, 22) },
      ]);
    });

    it("gives unrelated fragments keys the previous render did not use", () => {
      // Visible rows below the focused row, then a jump above it.
      const below = scroll([range(40, 60), [50, ...range(60, 80)]]).at(-1)!;
      const above = chunkHistoryRows(
        rows,
        busy,
        [...range(0, 20), 50],
        below,
        focused,
      );
      expect(keyOf(above, 50)).toBe(keyOf(below, 50));
      expect(below.map((chunk) => chunk.key)).not.toContain(keyOf(above, 10));
    });

    it("matches fragments by row rather than index when rows shift", () => {
      const before = chunkHistoryRows(
        rows,
        busy,
        [...range(0, 20), 50],
        [],
        focused,
      );
      // Deleting visit 0 shifts every later row up by one index.
      const fewer: HistoryGroup[] = [
        { key: busy[0].key, items: busy[0].items.slice(1) },
      ];
      const shifted = flattenHistoryGroups(fewer);
      const after = chunkHistoryRows(
        shifted,
        fewer,
        [...range(0, 20), 49],
        before,
        focused,
      );
      expect(keyOf(after, 49)).toBe(keyOf(before, 50));
      expect(keyOf(after, 10)).toBe(keyOf(before, 10));
    });
  });
});

function summary({ key, indexes }: HistoryChunk) {
  return { key, indexes };
}
