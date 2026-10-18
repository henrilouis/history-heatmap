import { describe, expect, it } from "vitest";
import { historyVisit } from "./history-fixtures";
import { indexNavigation } from "./history-navigation";

const visit = (id: string, parent = "0") =>
  historyVisit(id, undefined, {
    referringVisitId: parent,
  });

describe("navigation index", () => {
  it("puts pages opened from one another on the trail of their first page", () => {
    const items = [
      visit("second", "root"),
      visit("unrelated"),
      visit("deeper", "first"),
      visit("first", "root"),
      visit("root"),
    ];
    const { trails } = indexNavigation(items);

    expect(Object.fromEntries(trails)).toEqual({
      second: "root",
      unrelated: "unrelated",
      deeper: "root",
      first: "root",
      root: "root",
    });
  });

  it("follows reloads without linking independent visits to the same URL", () => {
    const items = [
      visit("refresh2", "refresh1"),
      visit("refresh1", "root"),
      visit("root"),
      visit("independent"),
    ].map((item) => ({
      ...item,
      url: "https://example.com/repeated",
      transition: "reload" as const,
    }));
    const { trails } = indexNavigation(items);

    expect(trails.get("refresh2")).toBe("root");
    expect(trails.get("independent")).toBe("independent");
  });

  it("keeps a trail across visits that are later filtered out, but not deleted", () => {
    const items = [
      visit("leaf", "middle"),
      visit("middle", "root"),
      visit("root"),
    ];
    expect(indexNavigation(items).trails.get("leaf")).toBe("root");

    // Deleting the middle visit removes its known relationships entirely.
    const remaining = [items[0], items[2]];
    expect(indexNavigation(remaining).trails.get("leaf")).toBe("leaf");
  });

  it("leaves absent, self-referencing, and future referrers unconnected", () => {
    const items = [
      visit("absent", "missing"),
      visit("self", "self"),
      { ...visit("earlier", "future"), visitTime: 1 },
      { ...visit("future"), visitTime: 2 },
    ];
    const { trails } = indexNavigation(items);

    for (const { visitId } of items) expect(trails.get(visitId)).toBe(visitId);
  });

  it("handles deep trails iteratively and terminates on malformed cycles", () => {
    const items = Array.from({ length: 20_000 }, (_, i) =>
      visit(String(i + 1), i === 19_999 ? "0" : String(i + 2)),
    );
    const index = indexNavigation(items);
    expect(new Set(index.trails.values())).toEqual(new Set(["20000"]));
    expect(
      indexNavigation([visit("a", "b"), visit("b", "a")]).trails.size,
    ).toBe(2);
  });
});
