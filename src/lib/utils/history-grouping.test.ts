import { describe, expect, it } from "vitest";
import {
  groupHistoryByDay,
  groupHistoryByDayAndHour,
  type HistoryVisit,
} from "./chrome-api";
import { historyVisit } from "./history-fixtures";

it("counts a zero visit timestamp rather than treating it as missing", () => {
  const date = new Date(0);
  const visit = historyVisit("epoch", date);
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const hour = String(date.getHours()).padStart(2, "0");

  expect(groupHistoryByDay([visit])).toEqual({ [day]: [visit] });
  expect(groupHistoryByDayAndHour([visit])).toEqual({
    [day]: { [hour]: [visit] },
  });
});

// Numeric Date constructors express local wall-clock times. CI runs these
// fixtures in multiple time zones to catch accidental UTC-based grouping.
describe("groupHistoryByDay", () => {
  it("separates dates and sorts each day newest-first from unsorted input", () => {
    const yesterdayEarly = historyVisit("1", new Date(2026, 8, 11, 9, 5));
    const yesterdayLate = historyVisit("2", new Date(2026, 8, 11, 18, 20));
    const todayEarly = historyVisit("3", new Date(2026, 8, 12, 8, 10));
    const todayLate = historyVisit("4", new Date(2026, 8, 12, 17, 45));

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
    const beforeMidnight = historyVisit(
      "1",
      new Date(2026, 0, 31, 23, 59, 59, 999),
    );
    const atMidnight = historyVisit("2", new Date(2026, 1, 1, 0, 0));

    expect(groupHistoryByDay([atMidnight, beforeMidnight])).toEqual({
      "2026-01-31": [beforeMidnight],
      "2026-02-01": [atMidnight],
    });
  });
});

describe("groupHistoryByDayAndHour", () => {
  it("separates dates and hours and sorts each hour newest-first", () => {
    const yesterdayEarly = historyVisit("1", new Date(2026, 8, 11, 9, 5));
    const yesterdayLate = historyVisit("2", new Date(2026, 8, 11, 9, 45));
    const early = historyVisit("3", new Date(2026, 8, 12, 9, 0));
    const late = historyVisit("4", new Date(2026, 8, 12, 9, 59, 59, 999));
    const nextHour = historyVisit("5", new Date(2026, 8, 12, 10, 0));

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
    const beforeMidnight = historyVisit(
      "1",
      new Date(2026, 0, 31, 23, 59, 59, 999),
    );
    const atMidnight = historyVisit("2", new Date(2026, 1, 1, 0, 0));

    expect(groupHistoryByDayAndHour([atMidnight, beforeMidnight])).toEqual({
      "2026-01-31": { "23": [beforeMidnight] },
      "2026-02-01": { "00": [atMidnight] },
    });
  });
});

// These fixtures specify Los Angeles transition rules, not the host zone's rules.
// The LA CI matrix job always runs them; other zones run the general tests above.
describe.runIf(
  Intl.DateTimeFormat().resolvedOptions().timeZone === "America/Los_Angeles",
)("Los Angeles DST grouping", () => {
  it("normalizes a nonexistent spring-forward time into hour 03", () => {
    const beforeJump = historyVisit("before", new Date("2026-03-08T09:30:00Z"));
    const afterJump = historyVisit("after", new Date("2026-03-08T10:15:00Z"));
    // 02:30 does not exist locally; Date normalizes it to 03:30 PDT.
    const normalized = historyVisit("normalized", new Date(2026, 2, 8, 2, 30));
    const input = [beforeJump, normalized, afterJump];

    expect(groupHistoryByDay(input)).toEqual({
      "2026-03-08": [normalized, afterJump, beforeJump],
    });
    expect(groupHistoryByDayAndHour(input)).toEqual({
      "2026-03-08": { "01": [beforeJump], "03": [normalized, afterJump] },
    });
  });

  it("keeps both fall-back visits in hour 01 ordered by actual visit time", () => {
    // Explicit instants distinguish the two occurrences of local 01:30.
    const first = historyVisit("first", new Date("2026-11-01T08:30:00Z"));
    const second = historyVisit("second", new Date("2026-11-01T09:30:00Z"));
    const input = [first, second];

    expect(groupHistoryByDay(input)).toEqual({
      "2026-11-01": [second, first],
    });
    expect(groupHistoryByDayAndHour(input)).toEqual({
      "2026-11-01": { "01": [second, first] },
    });
  });
});

const makeDatedItem = () => historyVisit("dated", new Date(2026, 8, 12, 9, 0));

describe.each([
  {
    name: "groupHistoryByDay",
    group: groupHistoryByDay,
    expected: (item: HistoryVisit) => ({ "2026-09-12": [item] }),
  },
  {
    name: "groupHistoryByDayAndHour",
    group: groupHistoryByDayAndHour,
    expected: (item: HistoryVisit) => ({
      "2026-09-12": { "09": [item] },
    }),
  },
])("$name input handling", ({ group, expected }) => {
  it("returns no groups for empty input", () => {
    expect(group([])).toEqual({});
  });

  it("skips records without timestamps while retaining dated records", () => {
    const datedItem = makeDatedItem();
    expect(group([historyVisit("undated"), datedItem])).toEqual(
      expected(datedItem),
    );
  });

  it("accepts fractional milliseconds and sorts by the original visit time", () => {
    const whole = makeDatedItem();
    const fractional = {
      ...whole,
      visitId: "fractional",
      visitTime: whole.visitTime! + 0.9,
    };
    const result = group([whole, fractional]);
    const entries = Object.values(result["2026-09-12"]).flat();

    expect(entries).toEqual([fractional, whole]);
    expect(fractional.visitTime).toBe(whole.visitTime! + 0.9);
  });

  it("preserves the original records and their input order", () => {
    const datedItem = makeDatedItem();
    const laterItem = historyVisit("later", new Date(2026, 8, 12, 9, 30));
    const input = [datedItem, laterItem];
    const original = structuredClone(input);

    group(input);

    expect(input).toEqual(original);
  });
});
