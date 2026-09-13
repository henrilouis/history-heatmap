import { describe, expect, it } from "vitest";
import { getDateKey, parseDateKey } from "./date";
import { dateTimeFormatOptions, formatMomentKey } from "./general";

describe("local calendar date keys", () => {
  it.each([
    { key: "2026-09-12", year: 2026, month: 8, day: 12, weekday: 6 },
    { key: "2027-03-01", year: 2027, month: 2, day: 1, weekday: 1 },
    { key: "2024-02-29", year: 2024, month: 1, day: 29, weekday: 4 },
    { key: "2026-03-08", year: 2026, month: 2, day: 8, weekday: 0 },
    { key: "2026-11-01", year: 2026, month: 10, day: 1, weekday: 0 },
    { key: "2027-01-01", year: 2027, month: 0, day: 1, weekday: 5 },
  ])(
    "preserves $key at local midnight",
    ({ key, year, month, day, weekday }) => {
      const date = parseDateKey(key);

      expect([
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getDay(),
        date.getHours(),
        date.getMinutes(),
      ]).toEqual([year, month, day, weekday, 0, 0]);
      expect(getDateKey(new Date(year, month, day, 23, 59))).toBe(key);
    },
  );
});

describe("moment labels", () => {
  it.each([
    { key: "2026-09-12", date: new Date(2026, 8, 12, 15) },
    { key: "2027-03-01", date: new Date(2027, 2, 1, 15) },
    { key: "2024-02-29", date: new Date(2024, 1, 29, 15) },
    { key: "2026-03-08", date: new Date(2026, 2, 8, 15) },
    { key: "2026-11-01", date: new Date(2026, 10, 1, 15) },
  ])(
    "labels $key consistently with and without a timestamp",
    ({ key, date }) => {
      // Use an explicit local afternoon as the independent expected calendar date.
      const label = date.toLocaleDateString(undefined, dateTimeFormatOptions);

      expect(formatMomentKey(key)).toBe(label);
      expect(formatMomentKey(key, date.getTime())).toBe(label);
      expect(formatMomentKey(`${key}T15`)).toBe(`${label} at 15:00`);
      expect(formatMomentKey(`${key}T15`, date.getTime())).toBe(
        `${label} at 15:00`,
      );
    },
  );
});
