import { describe, expect, it } from "vitest";
import { groupHistoryByDay, groupHistoryByDayAndHour } from "./chrome-api";

function historyItem(id: string, date: Date): chrome.history.HistoryItem {
  return {
    id,
    url: `https://example.com/${id}`,
    lastVisitTime: date.getTime(),
  };
}

// Numeric Date constructors express local wall-clock times. CI runs these
// fixtures in multiple time zones to catch accidental UTC-based grouping.
describe("groupHistoryByDay", () => {
  it("separates dates and sorts each day newest-first from unsorted input", () => {
    const yesterdayEarly = historyItem("1", new Date(2026, 8, 11, 9, 5));
    const yesterdayLate = historyItem("2", new Date(2026, 8, 11, 18, 20));
    const todayEarly = historyItem("3", new Date(2026, 8, 12, 8, 10));
    const todayLate = historyItem("4", new Date(2026, 8, 12, 17, 45));

    const grouped = groupHistoryByDay([
      todayEarly,
      yesterdayEarly,
      todayLate,
      yesterdayLate,
    ]);

    expect(grouped).toEqual({
      "2026-09-11": [yesterdayLate, yesterdayEarly],
      "2026-09-12": [todayLate, todayEarly],
    });
  });

  it("separates records across local midnight at a month boundary", () => {
    const beforeMidnight = historyItem(
      "1",
      new Date(2026, 0, 31, 23, 59, 59, 999),
    );
    const atMidnight = historyItem("2", new Date(2026, 1, 1, 0, 0));

    expect(groupHistoryByDay([atMidnight, beforeMidnight])).toEqual({
      "2026-01-31": [beforeMidnight],
      "2026-02-01": [atMidnight],
    });
  });
});

describe("groupHistoryByDayAndHour", () => {
  it("separates dates and hours and sorts each hour newest-first", () => {
    const yesterdayEarly = historyItem("1", new Date(2026, 8, 11, 9, 5));
    const yesterdayLate = historyItem("2", new Date(2026, 8, 11, 9, 45));
    const early = historyItem("3", new Date(2026, 8, 12, 9, 0));
    const late = historyItem("4", new Date(2026, 8, 12, 9, 59, 59, 999));
    const nextHour = historyItem("5", new Date(2026, 8, 12, 10, 0));

    const grouped = groupHistoryByDayAndHour([
      early,
      yesterdayEarly,
      nextHour,
      late,
      yesterdayLate,
    ]);

    expect(grouped).toEqual({
      "2026-09-11": { "09": [yesterdayLate, yesterdayEarly] },
      "2026-09-12": { "09": [late, early], "10": [nextHour] },
    });
  });

  it("separates the final hour of a month from midnight of the next month", () => {
    const beforeMidnight = historyItem(
      "1",
      new Date(2026, 0, 31, 23, 59, 59, 999),
    );
    const atMidnight = historyItem("2", new Date(2026, 1, 1, 0, 0));

    expect(groupHistoryByDayAndHour([atMidnight, beforeMidnight])).toEqual({
      "2026-01-31": { "23": [beforeMidnight] },
      "2026-02-01": { "00": [atMidnight] },
    });
  });
});

const datedItem = historyItem("dated", new Date(2026, 8, 12, 9, 0));

describe.each([
  {
    name: "groupHistoryByDay",
    group: groupHistoryByDay,
    expected: { "2026-09-12": [datedItem] },
  },
  {
    name: "groupHistoryByDayAndHour",
    group: groupHistoryByDayAndHour,
    expected: { "2026-09-12": { "09": [datedItem] } },
  },
])("$name input handling", ({ group, expected }) => {
  it("returns no groups for empty input", () => {
    expect(group([])).toEqual({});
  });

  it("skips records without timestamps while retaining dated records", () => {
    expect(group([{ id: "undated" }, datedItem])).toEqual(expected);
  });

  it("preserves the original records and their input order", () => {
    const laterItem = historyItem("later", new Date(2026, 8, 12, 9, 30));
    const input = [datedItem, laterItem];
    const original = structuredClone(input);

    group(input);

    expect(input).toEqual(original);
  });
});
