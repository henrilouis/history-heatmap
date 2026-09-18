import { describe, expect, it } from "vitest";
import { historyVisit } from "./history-fixtures";
import {
  describeGraphRow,
  indexNavigation,
  layoutNavigation,
} from "./history-graph";

const visit = (id: string, parent = "0") =>
  historyVisit(id, undefined, {
    referringVisitId: parent,
  });

describe("navigation graph", () => {
  it("branches at the referring visit while unrelated rows keep separate lanes", () => {
    const items = [
      visit("second", "root"),
      visit("unrelated"),
      visit("first", "root"),
      visit("root"),
    ];
    const index = indexNavigation(items);
    const { rows } = layoutNavigation(items, index);

    expect(rows.map((row) => row.visit.visitId)).toEqual(
      items.map((item) => item.visitId),
    );
    expect(rows[0].lane).not.toBe(rows[2].lane);
    expect(rows[1].lane).not.toBe(rows[0].lane);
    expect(rows[1].segments).toEqual([
      { from: rows[0].lane, to: rows[0].lane, half: "full", trail: "root" },
    ]);
    expect(rows[3].segments).toEqual([
      { from: rows[0].lane, to: rows[3].lane, half: "top", trail: "root" },
      { from: rows[2].lane, to: rows[3].lane, half: "top", trail: "root" },
    ]);
    expect(index.children.get("root")).toEqual(["second", "first"]);
    expect(describeGraphRow(rows[3], index)).toContain("Led to 2 visits");
  });

  it("keeps reloads in a continuous lane without linking independent visits to the same URL", () => {
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
    const index = indexNavigation(items);
    const { rows } = layoutNavigation(items, index);

    expect(rows.slice(0, 3).map((row) => row.lane)).toEqual([0, 0, 0]);
    expect(rows[1].segments.map((segment) => segment.half)).toEqual([
      "top",
      "bottom",
    ]);
    expect(rows[3].segments).toEqual([]);
    expect(rows[3].trail).not.toBe(rows[0].trail);
    expect(describeGraphRow(rows[0], index)).toContain(
      "Reload or restored page",
    );
  });

  it("marks both sides of filtered intermediates without inventing a shortcut", () => {
    const items = [
      visit("leaf", "middle"),
      visit("middle", "root"),
      visit("root"),
    ];
    const index = indexNavigation(items);
    const { rows } = layoutNavigation([items[0], items[2]], index);

    expect(rows.every((row) => row.segments.length === 0)).toBe(true);
    expect(rows[0].earlier).toBe(1);
    expect(rows[1].later).toBe(1);
    expect(rows[0].trail).toBe(rows[1].trail);

    // Deleting the middle visit removes its known relationships entirely.
    const remaining = [items[0], items[2]];
    const afterDeletion = layoutNavigation(
      remaining,
      indexNavigation(remaining),
    );
    expect(afterDeletion.rows.every((row) => !row.earlier && !row.later)).toBe(
      true,
    );
    expect(afterDeletion.rows[0].trail).not.toBe(afterDeletion.rows[1].trail);
  });

  it("marks connections across cards with stable trail colors/identity", () => {
    const items = [visit("new-day", "old-day"), visit("old-day")];
    const index = indexNavigation(items);
    const newer = layoutNavigation([items[0]], index).rows[0];
    const older = layoutNavigation([items[1]], index).rows[0];

    expect(newer.earlier).toBe(1);
    expect(older.later).toBe(1);
    expect(newer.trail).toBe(older.trail);
    expect(describeGraphRow(newer, index)).toContain(
      "From: https://example.com/old-day",
    );
    expect(describeGraphRow(newer, index)).toContain("Earlier continuation");
    expect(describeGraphRow(older, index)).toContain("Later continuation");
    expect(describeGraphRow(newer, index)).not.toContain("Tunnel shadows");
  });

  it("leaves absent, self-referencing, and future referrers unconnected", () => {
    const items = [
      visit("absent", "missing"),
      visit("self", "self"),
      { ...visit("earlier", "future"), visitTime: 1 },
      { ...visit("future"), visitTime: 2 },
    ];
    const { rows } = layoutNavigation(items, indexNavigation(items));
    expect(
      rows.every((row) => !row.segments.length && !row.earlier && !row.later),
    ).toBe(true);
  });

  it("bounds dense graphs and marks both endpoints of overflow connections", () => {
    const children = Array.from({ length: 12 }, (_, i) =>
      visit(`child-${i}`, `root-${i}`),
    );
    const roots = Array.from({ length: 12 }, (_, i) => visit(`root-${i}`));
    const items = [...children, ...roots];
    const { rows, widthRem } = layoutNavigation(items, indexNavigation(items));

    expect(widthRem).toBeLessThanOrEqual(6.125);
    expect(rows.slice(0, 12).filter((row) => row.earlier)).toHaveLength(7);
    expect(rows.slice(12).filter((row) => row.later)).toHaveLength(7);
    for (const row of rows) {
      // No through-track passes through an unrelated visit dot.
      expect(
        row.segments
          .filter((segment) => segment.half === "full")
          .every((segment) => segment.from !== row.lane),
      ).toBe(true);
    }
  });

  it("condenses very long edges instead of carrying tracks through an entire day", () => {
    const items = [
      visit("leaf", "root"),
      ...Array.from({ length: 100 }, (_, i) => visit(`unrelated-${i}`)),
      visit("root"),
    ];
    const { rows } = layoutNavigation(items, indexNavigation(items));
    expect(rows[0].earlier).toBe(1);
    expect(rows.at(-1)?.later).toBe(1);
    expect(rows.every((row) => !row.segments.length)).toBe(true);
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
    expect(layoutNavigation([], index).rows).toEqual([]);
  });
});
