import { describe, expect, it } from "vitest";
import { mergeHistoryVisits } from "./history-merge";
import type { HistoryVisit } from "./chrome-api";

const visit = (visitId: string, url: string, visitTime?: number): HistoryVisit => ({ visitId, url, visitTime });

describe("mergeHistoryVisits", () => {
  it("replaces accepted URLs and merges interleaved visits without accepting stale updates", () => {
    const history = [visit("a-old", "a", 10), visit("b", "b", 8), visit("c", "c", 4)];
    const updates = [visit("stale", "b", 20), visit("a-new", "a", 12), visit("d", "d", 6), visit("a-old", "a", 2)];
    const result = mergeHistoryVisits(history, updates, new Set(["a", "d"]));
    expect(result.map((item) => item.visitId)).toEqual(["a-new", "b", "d", "c", "a-old"]);
    expect(history.map((item) => item.visitId)).toEqual(["a-old", "b", "c"]);
    expect(updates.map((item) => item.visitId)).toEqual(["stale", "a-new", "d", "a-old"]);
  });

  it("removes accepted URLs when Chrome returns no visits and handles empty inputs", () => {
    const history = [visit("a", "a", 10), visit("b", "b", 5)];
    expect(mergeHistoryVisits(history, [], new Set(["a"]))).toEqual([history[1]]);
    expect(mergeHistoryVisits([], history, new Set(["a", "b"]))).toEqual(history);
    expect(mergeHistoryVisits([], [], new Set())).toEqual([]);
  });

  it("preserves stable tie order and the loader's missing-timestamp fallback", () => {
    const history = [visit("old-tie", "a", 5), visit("old-missing", "b")];
    const updates = [visit("new-tie", "c", 5), visit("new-missing", "c")];
    expect(mergeHistoryVisits(history, updates, new Set(["c"])).map((item) => item.visitId))
      .toEqual(["old-tie", "new-tie", "old-missing", "new-missing"]);
  });
});
