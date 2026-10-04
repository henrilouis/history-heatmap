import { describe, expect, it } from "vitest";
import {
  aggregateVisits,
  fromDayNumber,
  toDayNumber,
  toDayRange,
  weekdayOf,
} from "./aggregate";
import { historyVisit, localVisit, TEST_TIME_ZONE } from "../history-fixtures";

const day = (date: string) => toDayNumber(Temporal.PlainDate.from(date));

describe("day numbers", () => {
  it.each([
    ["1970-01-01", 0, 3],
    ["1969-12-29", -3, 0],
    ["2026-03-02", day("2026-03-02"), 0],
    ["2026-03-08", day("2026-03-08"), 6],
  ])("numbers %s as %i, weekday %i", (date, number, weekday) => {
    expect(day(date)).toBe(number);
    expect(fromDayNumber(number).toString()).toBe(date);
    expect(weekdayOf(number)).toBe(weekday);
    expect(weekdayOf(number)).toBe(Temporal.PlainDate.from(date).dayOfWeek - 1);
  });
});

describe("toDayRange", () => {
  it("spans the first to the last local day, inclusive", () => {
    expect(
      toDayRange(
        [
          localVisit("https://a.com/", "2026-03-10T23:59"),
          localVisit("https://a.com/", "2026-03-02T00:01"),
          historyVisit("untimed"),
        ],
        TEST_TIME_ZONE,
      ),
    ).toEqual({ start: day("2026-03-02"), end: day("2026-03-10"), days: 9 });
  });

  it("has no range without timed visits", () => {
    expect(toDayRange([historyVisit("untimed")], TEST_TIME_ZONE)).toBe(
      undefined,
    );
  });
});

describe("aggregateVisits", () => {
  it("counts visits per page, site, day, weekday, hour and transition", () => {
    const aggregate = aggregateVisits(
      [
        localVisit("https://www.a.com/2", "2026-03-03T03:59", {
          transition: "typed",
        }),
        localVisit("https://a.com/1", "2026-03-03T04:00", {
          transition: "link",
        }),
        localVisit("https://a.com/1", "2026-03-02T10:00", {
          transition: "link",
          title: "One",
        }),
        localVisit("https://b.com/", "2026-03-02T10:30"),
        historyVisit("untimed", undefined, { url: "https://a.com/1" }),
      ],
      TEST_TIME_ZONE,
    );

    expect(aggregate.total).toBe(5);
    expect(aggregate.urls.get("https://a.com/1")).toEqual({
      url: "https://a.com/1",
      title: undefined,
      site: "a.com",
      visits: 3,
      firstDay: day("2026-03-02"),
    });
    expect(aggregate.urls.get("https://www.a.com/2")?.firstDay).toBe(
      day("2026-03-03"),
    );
    expect(aggregate.sites.get("a.com")).toEqual({
      site: "a.com",
      visits: 4,
      days: new Set([day("2026-03-02"), day("2026-03-03")]),
      firstDay: day("2026-03-02"),
      lateVisits: 1,
      topUrl: "https://a.com/1",
    });
    expect([...aggregate.days]).toEqual([
      [day("2026-03-03"), 2],
      [day("2026-03-02"), 2],
    ]);
    expect(aggregate.grid[0][10]).toBe(2);
    expect(aggregate.grid[1][3]).toBe(1);
    expect(aggregate.grid[1][4]).toBe(1);
    expect(aggregate.grid.flat().reduce((a, b) => a + b)).toBe(4);
    expect(Object.fromEntries(aggregate.transitions)).toEqual({
      typed: 1,
      link: 2,
    });
  });

  it("places visits around a daylight saving switch in their local hour", () => {
    // Amsterdam skips 02:00–03:00 on 2026-03-29.
    const aggregate = aggregateVisits(
      [
        localVisit("https://a.com/", "2026-03-29T01:59"),
        localVisit("https://a.com/", "2026-03-29T03:00"),
      ],
      TEST_TIME_ZONE,
    );

    expect([...aggregate.days]).toEqual([[day("2026-03-29"), 2]]);
    expect(aggregate.grid[6][1]).toBe(1);
    expect(aggregate.grid[6][2]).toBe(0);
    expect(aggregate.grid[6][3]).toBe(1);
  });
});
