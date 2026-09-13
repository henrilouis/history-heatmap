import { describe, expect, it } from "vitest";
import {
  fillEmptyDays,
  fillEmptyHours,
  groupHistoryByDay,
  groupHistoryByDayAndHour,
  type HistoryVisit,
} from "./chrome-api";
import { historyVisit } from "./history-fixtures";

// Keep expected keys independent of production hour formatting.
const hourKeys =
  "00 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 22 23".split(
    " ",
  );
const emptyHours = Object.fromEntries(hourKeys.map((hour) => [hour, []]));

describe.each([
  {
    name: "fillEmptyDays",
    fill: (filtered: HistoryVisit[], all: HistoryVisit[]) =>
      fillEmptyDays(groupHistoryByDay(filtered), all),
    emptyDay: [],
    mondayPadding: ["2026-09-07", "2026-09-08", "2026-09-09"],
    populatedDay: (item: HistoryVisit) => [item],
  },
  {
    name: "fillEmptyHours",
    fill: (filtered: HistoryVisit[], all: HistoryVisit[]) =>
      fillEmptyHours(groupHistoryByDayAndHour(filtered), all),
    emptyDay: emptyHours,
    mondayPadding: [],
    populatedDay: (item: HistoryVisit) => ({
      ...emptyHours,
      "18": [item],
    }),
  },
])("$name", ({ fill, emptyDay, mondayPadding, populatedDay }) => {
  it("keeps both endpoints from unsorted history when filtering out the newest day", () => {
    const oldest = historyVisit("oldest", new Date(2026, 8, 10, 18));
    const middle = historyVisit("middle", new Date(2026, 8, 11, 12));
    const newest = historyVisit("newest", new Date(2026, 8, 12, 9));
    const all = [newest, oldest, historyVisit("undated"), middle];
    const result = fill([oldest], all);

    expect(Object.keys(result).sort()).toEqual([
      ...mondayPadding,
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ]);
    expect(result["2026-09-10"]).toEqual(populatedDay(oldest));
    expect(result["2026-09-11"]).toEqual(emptyDay);
    expect(result["2026-09-12"]).toEqual(emptyDay);
    expect(Object.keys(fill([], all)).sort()).toEqual(
      Object.keys(result).sort(),
    );
    expect(Object.keys(fill(all, all)).sort()).toEqual(
      Object.keys(result).sort(),
    );
  });

  it.each([
    { name: "empty history", all: [] },
    { name: "missing timestamps", all: [historyVisit("undated")] },
  ])("preserves existing groups for $name", ({ all }) => {
    expect(fill([], all)).toEqual({});

    const item = historyVisit("existing", new Date(2026, 8, 10, 18));
    const result = fill([item], all);
    expect(Object.keys(result)).toEqual(["2026-09-10"]);
    // Without date bounds, filling should not introduce any empty hours either.
    expect(result["2026-09-10"]).toEqual(
      Array.isArray(emptyDay) ? [item] : { "18": [item] },
    );
  });

  it("fills a single calendar day", () => {
    const all = [historyVisit("only", new Date(2026, 8, 7, 18))];

    expect(fill([], all)).toEqual({ "2026-09-07": emptyDay });
  });

  it.each([
    {
      name: "leap day and month boundary",
      start: new Date(2024, 1, 26, 18),
      end: new Date(2024, 2, 1, 9),
      keys: [
        "2024-02-26",
        "2024-02-27",
        "2024-02-28",
        "2024-02-29",
        "2024-03-01",
      ],
    },
    {
      name: "year boundary",
      start: new Date(2024, 11, 30, 18),
      end: new Date(2025, 0, 2, 9),
      keys: ["2024-12-30", "2024-12-31", "2025-01-01", "2025-01-02"],
    },
    {
      name: "spring-forward boundary",
      start: new Date(2026, 2, 2, 18),
      end: new Date(2026, 2, 9, 9),
      keys: [
        "2026-03-02",
        "2026-03-03",
        "2026-03-04",
        "2026-03-05",
        "2026-03-06",
        "2026-03-07",
        "2026-03-08",
        "2026-03-09",
      ],
    },
    {
      name: "fall-back boundary",
      start: new Date(2026, 9, 26, 18),
      end: new Date(2026, 10, 2, 9),
      keys: [
        "2026-10-26",
        "2026-10-27",
        "2026-10-28",
        "2026-10-29",
        "2026-10-30",
        "2026-10-31",
        "2026-11-01",
        "2026-11-02",
      ],
    },
    {
      // Sao Paulo skipped midnight on November 4, 2018. The following day
      // must return to midnight rather than inherit the normalized 01:00.
      name: "midnight spring-forward boundary",
      start: new Date(2018, 9, 29, 18),
      end: new Date(2018, 10, 5, 9),
      keys: [
        "2018-10-29",
        "2018-10-30",
        "2018-10-31",
        "2018-11-01",
        "2018-11-02",
        "2018-11-03",
        "2018-11-04",
        "2018-11-05",
      ],
    },
  ])(
    "includes every calendar date across the $name",
    ({ start, end, keys }) => {
      const result = fill(
        [],
        [historyVisit("end", end), historyVisit("start", start)],
      );

      expect(Object.keys(result).sort()).toEqual(keys);
      for (const key of keys) expect(result[key]).toEqual(emptyDay);
    },
  );

  it("computes bounds for 150,000 records without exceeding the argument limit", () => {
    // Many records, but a short date range: exercise the argument-limit regression
    // without generating an unnecessarily large calendar or relying on timing.
    const date = new Date(2026, 8, 8, 12);
    const all = Array.from({ length: 150_000 }, (_, i) =>
      historyVisit(String(i), date),
    );
    all[50_000] = historyVisit("oldest", new Date(2026, 8, 7, 18));
    all[100_000] = historyVisit("newest", new Date(2026, 8, 9, 9));

    expect(fill([], all)).toEqual({
      "2026-09-07": emptyDay,
      "2026-09-08": emptyDay,
      "2026-09-09": emptyDay,
    });
  });
});
