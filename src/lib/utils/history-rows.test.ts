import { describe, expect, it } from "vitest";
import { historyVisit } from "./history-fixtures";
import {
  chunkHistoryRows,
  flattenHistoryGroups,
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
    expect(chunkHistoryRows(rows, groups, [1, 2, 3, 4, 5, 6])).toEqual([
      { key: "2026-09-12", group: 0, indexes: [1, 2] },
      { key: "2026-09-11", group: 1, indexes: [4] },
      { key: "2026-09-10", group: 2, indexes: [6] },
    ]);
  });

  it("gives a detached row of the same card its own fragment", () => {
    const busy: HistoryGroup[] = [
      {
        key: "2026-09-12",
        items: Array.from({ length: 10 }, (_, i) => historyVisit(`${i}`)),
      },
    ];
    const rows = flattenHistoryGroups(busy);
    expect(chunkHistoryRows(rows, busy, [2, 6, 7, 8])).toEqual([
      { key: "2026-09-12", group: 0, indexes: [2] },
      { key: "2026-09-12:1", group: 0, indexes: [6, 7, 8] },
    ]);
  });
});
