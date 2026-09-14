import { describe, expect, it } from "vitest";
import {
  createLocalTimeKeyer,
  eachCalendarDate,
  toLocalZonedDateTime,
} from "./date";
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
    "converts a late local visit to $key",
    ({ key, year, month, day, weekday }) => {
      const date = toLocalZonedDateTime(
        new Date(year, month, day, 23, 59).getTime(),
      ).toPlainDate();

      expect([date.year, date.month, date.day, date.dayOfWeek]).toEqual([
        year,
        month + 1,
        day,
        weekday === 0 ? 7 : weekday,
      ]);
      expect(date.toString()).toBe(key);
    },
  );

  it.each([0, 0.9, -0.9, 1.9, -1.9])(
    "truncates fractional milliseconds toward zero for %s",
    (timestamp) => {
      expect(toLocalZonedDateTime(timestamp, "UTC").epochMilliseconds).toBe(
        new Date(timestamp).getTime(),
      );
    },
  );

  it("uses the supplied timezone to distinguish repeated wall-clock hours", () => {
    const first = toLocalZonedDateTime(
      Date.parse("2026-11-01T08:30:00Z"),
      "America/Los_Angeles",
    );
    const second = toLocalZonedDateTime(
      Date.parse("2026-11-01T09:30:00Z"),
      "America/Los_Angeles",
    );

    expect([first.hour, second.hour]).toEqual([1, 1]);
    expect([first.offset, second.offset]).toEqual(["-07:00", "-08:00"]);
  });

  it("includes calendar dates even when the timezone skipped an entire day", () => {
    const start = toLocalZonedDateTime(
      Date.parse("2011-12-29T12:00:00-10:00"),
      "Pacific/Apia",
    ).toPlainDate();
    const end = toLocalZonedDateTime(
      Date.parse("2011-12-31T12:00:00+14:00"),
      "Pacific/Apia",
    ).toPlainDate();

    expect([...eachCalendarDate(start, end)].map(String)).toEqual([
      "2011-12-29",
      "2011-12-30",
      "2011-12-31",
    ]);
    expect(start.toString()).toBe("2011-12-29");
    expect(end.toString()).toBe("2011-12-31");
    expect([...eachCalendarDate(end, start)]).toEqual([]);
  });
});

describe("cached local time keys", () => {
  it.each([
    { timeZone: "America/Los_Angeles", boundary: "2026-03-08T10:00:00Z" },
    { timeZone: "America/Los_Angeles", boundary: "2026-11-01T09:00:00Z" },
    { timeZone: "Australia/Lord_Howe", boundary: "2026-04-04T15:00:00Z" },
    { timeZone: "Australia/Lord_Howe", boundary: "2026-10-03T15:30:00Z" },
    { timeZone: "America/Sao_Paulo", boundary: "2018-11-04T03:00:00Z" },
    { timeZone: "Pacific/Apia", boundary: "2011-12-30T10:00:00Z" },
    { timeZone: "Africa/Monrovia", boundary: "1972-01-07T00:44:30Z" },
    { timeZone: "Asia/Tokyo", boundary: "2026-09-11T15:00:00Z" },
  ])(
    "matches uncached local dates/hours around $boundary in $timeZone",
    ({ timeZone, boundary }) => {
      const keyFor = createLocalTimeKeyer(timeZone);
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
      });
      // Exercise ascending, descending, and out-of-order visits, including an
      // exact transition followed by an earlier visit in the same nominal hour.
      const offsets = [-3_600_001, -1_800_001, -1, 0, 1, 1_800_001, 3_600_001];
      for (const offset of [
        ...offsets,
        ...[...offsets].reverse(),
        0,
        -1,
        1,
        -1_800_001,
      ]) {
        const timestamp = Date.parse(boundary) + offset;
        const parts = Object.fromEntries(
          formatter
            .formatToParts(new Date(timestamp))
            .map(({ type, value }) => [type, value]),
        );
        expect(keyFor(timestamp)).toMatchObject({
          day: `${parts.year}-${parts.month}-${parts.day}`,
          hour: parts.hour,
        });
      }
    },
  );
});

describe("moment labels", () => {
  it.each([0, 0.9, -0.9])(
    "uses timestamp %s instead of falling back to the key",
    (timestamp) => {
      const label = new Date(timestamp).toLocaleDateString(
        undefined,
        dateTimeFormatOptions,
      );

      expect(formatMomentKey("2026-09-12", timestamp)).toBe(label);
      expect(formatMomentKey("2026-09-12T09", timestamp)).toBe(
        `${label} at 09:00`,
      );
    },
  );

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
