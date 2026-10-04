import { describe, expect, it } from "vitest";
import { aggregateVisits, toDayRange } from "./aggregate";
import { buildDiscovery } from "./discovery";
import { localVisit, TEST_TIME_ZONE } from "../history-fixtures";
import type { HistoryVisit } from "../chrome-api";

function discovery(visits: HistoryVisit[]) {
  return buildDiscovery(
    aggregateVisits(visits, TEST_TIME_ZONE),
    toDayRange(visits, TEST_TIME_ZONE)!,
  );
}

describe("buildDiscovery", () => {
  const visits = [
    // a.com: three days, two pages found on later days.
    localVisit("https://a.com/", "2026-03-01T10:00"),
    localVisit("https://a.com/", "2026-03-01T11:00"),
    localVisit("https://a.com/new", "2026-03-02T10:00"),
    localVisit("https://a.com/later", "2026-03-10T10:00"),
    // b.com: two days, but the page was known from the first one.
    localVisit("https://b.com/", "2026-03-01T10:00"),
    localVisit("https://b.com/", "2026-03-05T10:00"),
    localVisit("https://b.com/same-day", "2026-03-01T12:00"),
    // c.com and d.com: one day each, even with several visits.
    localVisit("https://c.com/", "2026-03-04T10:00"),
    localVisit("https://c.com/", "2026-03-04T11:00"),
    localVisit("https://d.com/", "2026-03-10T09:00"),
  ];

  it("splits websites into one-time and returning ones", () => {
    const result = discovery(visits);

    expect(result.sites).toBe(4);
    expect(result.pages).toBe(7);
    expect(result.oneTimeSites).toBe(2);
    expect(result.returningSites).toBe(2);
  });

  it("counts pages first opened after their website was known", () => {
    const result = discovery(visits);

    expect(result.newPagesOnKnownSites).toBe(2);
    expect(result.deepDives).toEqual([
      { site: "a.com", topUrl: "https://a.com/", newPages: 2 },
    ]);
  });

  it("builds a cumulative curve of discovered websites", () => {
    const result = discovery(visits);

    expect(result.curve).toEqual([2, 2, 2, 3, 3, 3, 3, 3, 3, 4]);
    // The last seven days run from 4 to 10 March.
    expect(result.recentSites).toBe(2);
  });

  it("buckets websites by distinct days visited", () => {
    const result = discovery(visits);

    expect(result.loyalty.map(({ label, sites }) => [label, sites])).toEqual([
      ["1 day", 2],
      ["2–3 days", 2],
      ["4–7 days", 0],
      ["8–30 days", 0],
      ["31+ days", 0],
    ]);
  });

  it("ranks returning websites by days, then visits", () => {
    const result = discovery(visits);

    expect(result.regulars).toEqual([
      { site: "a.com", topUrl: "https://a.com/", days: 3, visits: 4 },
      { site: "b.com", topUrl: "https://b.com/", days: 2, visits: 3 },
    ]);
  });
});
