import { describe, expect, it } from "vitest";
import { buildInsights } from "./index";
import { toDayNumber } from "./aggregate";
import {
  historyVisit,
  localVisit,
  localVisits,
  TEST_TIME_ZONE,
} from "../history-fixtures";
import { indexNavigation } from "../history-graph";
import type { HistoryVisit } from "../chrome-api";

function insights(
  visits: HistoryVisit[],
  allVisits = visits,
  today = "2026-03-15",
) {
  return buildInsights(visits, {
    allVisits,
    navigation: indexNavigation(allVisits),
    timeZone: TEST_TIME_ZONE,
    today: Temporal.PlainDate.from(today),
  });
}

describe("buildInsights", () => {
  it.each([
    ["2026-03-03", 3],
    ["2026-03-04", 3],
    ["2026-10-05", 0],
  ])("anchors the current streak to %s, giving %i days", (today, current) => {
    const visits = ["01", "02", "03"].map((date) =>
      localVisit("https://a.com/", `2026-03-${date}T10:00`),
    );
    const result = insights(visits, visits, today);

    expect(result.streaks?.current).toBe(current);
    expect(result.streaks?.longest.length).toBe(3);
    expect(result.range?.days).toBe(3);
  });

  it("summarises filtered visits over the unfiltered date range", () => {
    const all = [
      ...localVisits("https://a.com/1", "2026-03-02T10:00", 3),
      localVisit("https://a.com/2", "2026-03-03T10:00"),
      localVisit("https://b.com/", "2026-03-15T10:00"),
    ];
    const result = insights(
      all.filter((visit) => visit.url.includes("a.com")),
      all,
    );

    expect(result.totals).toEqual({
      visits: 4,
      pages: 2,
      sites: 1,
      activeDays: 2,
    });
    expect(result.range).toEqual({
      start: toDayNumber(Temporal.PlainDate.from("2026-03-02")),
      end: toDayNumber(Temporal.PlainDate.from("2026-03-15")),
      days: 14,
    });
    expect(result.dailyVisits).toHaveLength(14);
    expect(result.dailyVisits.slice(0, 3)).toEqual([3, 1, 0]);
    expect(result.rhythm?.weekdays[0]).toBe(1.5);
    expect(result.discovery?.newPagesOnKnownSites).toBe(1);
    expect(result.topSites.map((site) => site.site)).toEqual(["a.com"]);
    expect(result.streaks?.current).toBe(0);
  });

  it("leaves out time-based insights without timed visits", () => {
    const result = insights([historyVisit("untimed")]);

    expect(result.totals.visits).toBe(1);
    expect(result.range).toBe(undefined);
    expect(result.dailyVisits).toEqual([]);
    expect(result.rhythm).toBe(undefined);
    expect(result.discovery).toBe(undefined);
    expect(result.personality).toBe(undefined);
    expect(result.streaks).toBe(undefined);
    expect(result.busiestDay).toBe(undefined);
  });

  it("handles an empty history", () => {
    const result = insights([]);

    expect(result.totals).toEqual({
      visits: 0,
      pages: 0,
      sites: 0,
      activeDays: 0,
    });
    expect(result.topSites).toEqual([]);
    expect(result.searches.total).toBe(0);
    expect(result.mostRevisited).toBe(undefined);
    expect(result.rabbitHole).toBe(undefined);
  });
});
