import { describe, expect, it } from "vitest";
import { aggregateVisits, toDayRange } from "./aggregate";
import { buildRhythm } from "./rhythm";
import { localVisit, localVisits, TEST_TIME_ZONE } from "../history-fixtures";
import type { HistoryVisit } from "../chrome-api";

function rhythm(visits: HistoryVisit[], allVisits = visits) {
  return buildRhythm(
    aggregateVisits(visits, TEST_TIME_ZONE),
    toDayRange(allVisits, TEST_TIME_ZONE)!,
  );
}

describe("buildRhythm", () => {
  it("averages over every calendar day in the range, including empty ones", () => {
    // Two full weeks, Monday 2 March to Sunday 15 March 2026.
    const result = rhythm([
      ...localVisits("https://a.com/", "2026-03-02T10:00", 4),
      ...localVisits("https://a.com/", "2026-03-15T21:00", 7),
    ]);

    expect(result.weekdays).toEqual([2, 0, 0, 0, 0, 0, 3.5]);
    expect(result.hours[10]).toBe(4 / 14);
    expect(result.hours[21]).toBe(7 / 14);
    expect(result.peakWeekday).toBe(6);
    expect(result.peakHour).toBe(21);
    expect(result.quietestWeekday).toBe(1);
  });

  it("uses the unfiltered history's range as the denominator", () => {
    const filtered = localVisits("https://a.com/", "2026-03-02T10:00", 4);
    const result = rhythm(filtered, [
      ...filtered,
      localVisit("https://b.com/", "2026-03-09T10:00"),
    ]);

    expect(result.weekdays[0]).toBe(2);
    expect(result.hours[10]).toBe(4 / 8);
  });

  it("ignores weekdays outside a short range when finding the quietest", () => {
    // Wednesday to Friday only.
    const result = rhythm([
      ...localVisits("https://a.com/", "2026-03-04T10:00", 3),
      ...localVisits("https://a.com/", "2026-03-05T10:00", 1),
      ...localVisits("https://a.com/", "2026-03-06T10:00", 2),
    ]);

    expect(result.quietestWeekday).toBe(3);
    expect(result.peakWeekday).toBe(2);
  });
});
