import { describe, expect, it } from "vitest";
import { aggregateVisits, toDayNumber } from "./aggregate";
import {
  findBusiestDay,
  findLateNight,
  findMostRevisited,
  findRabbitHole,
  findStreaks,
  findTopSites,
  MIN_RABBIT_HOLE_VISITS,
  summarizeTransitions,
} from "./highlights";
import {
  historyVisit,
  localVisit,
  localVisits,
  TEST_TIME_ZONE,
} from "../history-fixtures";
import { indexNavigation } from "../history-graph";
import type { HistoryVisit } from "../chrome-api";

const day = (date: string) => toDayNumber(Temporal.PlainDate.from(date));
const aggregate = (visits: HistoryVisit[]) =>
  aggregateVisits(visits, TEST_TIME_ZONE);

describe("findTopSites", () => {
  it("ranks websites by visits with their share", () => {
    const visits = [
      ...localVisits("https://a.com/", "2026-03-01T10:00", 3),
      ...localVisits("https://b.com/", "2026-03-01T10:00", 1),
    ];

    expect(findTopSites(aggregate(visits), 1)).toEqual([
      { site: "a.com", topUrl: "https://a.com/", visits: 3, share: 0.75 },
    ]);
  });
});

describe("findBusiestDay", () => {
  it("finds the day with most visits and its top website", () => {
    const visits = [
      ...localVisits("https://a.com/", "2026-03-01T10:00", 2),
      ...localVisits("https://b.com/x", "2026-03-02T00:00", 2),
      localVisit("https://b.com/y", "2026-03-02T23:59"),
      localVisit("https://a.com/", "2026-03-02T12:00"),
      ...localVisits("https://b.com/y", "2026-03-03T00:00", 2),
    ];

    expect(findBusiestDay(visits, aggregate(visits), TEST_TIME_ZONE)).toEqual({
      day: day("2026-03-02"),
      visits: 4,
      topSite: { site: "b.com", topUrl: "https://b.com/y", visits: 3 },
    });
  });

  it("prefers the most recent of equally busy days", () => {
    const visits = [
      localVisit("https://a.com/", "2026-03-01T10:00"),
      localVisit("https://a.com/", "2026-03-05T10:00"),
    ];

    expect(findBusiestDay(visits, aggregate(visits), TEST_TIME_ZONE)?.day).toBe(
      day("2026-03-05"),
    );
  });

  it("has no busiest day without timed visits", () => {
    const visits = [historyVisit("untimed")];
    expect(findBusiestDay(visits, aggregate(visits), TEST_TIME_ZONE)).toBe(
      undefined,
    );
  });
});

describe("findStreaks", () => {
  function streaks(visits: HistoryVisit[], today: string) {
    return findStreaks(aggregate(visits), day(today));
  }

  it("finds the longest run and the current one up to yesterday", () => {
    const visits = [
      localVisit("https://a.com/", "2026-03-01T10:00"),
      localVisit("https://a.com/", "2026-03-02T10:00"),
      localVisit("https://b.com/", "2026-03-03T10:00"),
      localVisit("https://a.com/", "2026-03-05T10:00"),
      localVisit("https://b.com/", "2026-03-06T10:00"),
    ];
    const result = streaks(visits, "2026-03-07");

    expect(result.longest).toEqual({
      length: 3,
      start: day("2026-03-01"),
      end: day("2026-03-03"),
    });
    expect(result.current).toBe(2);
    expect(result.site).toEqual({
      site: "a.com",
      topUrl: "https://a.com/",
      length: 2,
      start: day("2026-03-01"),
      end: day("2026-03-02"),
    });
  });

  it("has no current streak after a missed day", () => {
    const visits = [localVisit("https://a.com/", "2026-03-01T10:00")];
    const result = streaks(visits, "2026-03-03");

    expect(result.current).toBe(0);
    expect(result.longest.length).toBe(1);
    expect(result.site).toBe(undefined);
  });

  it.each([
    ["2026-03-03", 3],
    ["2026-03-04", 3],
    ["2026-03-05", 0],
    ["2026-10-05", 0],
  ])("anchors the current streak to %s, giving %i days", (today, current) => {
    const visits = ["01", "02", "03"].map((date) =>
      localVisit("https://a.com/", `2026-03-${date}T10:00`),
    );
    const result = streaks(visits, today);

    expect(result.current).toBe(current);
    expect(result.longest.length).toBe(3);
    expect(result.site?.length).toBe(3);
  });
});

describe("findRabbitHole", () => {
  function trail(length: number, start = "2026-03-01T10:00") {
    const time = Temporal.PlainDateTime.from(start);
    const visits: HistoryVisit[] = [];
    for (let i = 0; i < length; i++) {
      visits.push(
        localVisit(
          `https://site${i % 2}.com/${i}`,
          time.add({ minutes: i }).toString(),
          { referringVisitId: visits[i - 1]?.visitId ?? "0" },
        ),
      );
    }
    return visits;
  }

  it("finds the trail with the most visits", () => {
    const long = trail(5);
    const visits = [...trail(3, "2026-03-02T10:00"), ...long];

    expect(
      findRabbitHole(visits, indexNavigation(visits), aggregate(visits)),
    ).toEqual({
      start: long[0],
      visits: 5,
      sites: 2,
      duration: 4 * 60_000,
    });
  });

  it("counts only the trail's visits that match a search", () => {
    const visits = trail(6);
    const filtered = visits.filter((visit) => visit.url.includes("site1"));
    const result = findRabbitHole(
      filtered,
      indexNavigation(visits),
      aggregate(filtered),
    );

    expect(result).toMatchObject({ start: visits[0], visits: 3, sites: 1 });
  });

  it("ignores trails shorter than the minimum", () => {
    const visits = trail(MIN_RABBIT_HOLE_VISITS - 1);
    expect(
      findRabbitHole(visits, indexNavigation(visits), aggregate(visits)),
    ).toBe(undefined);
  });
});

describe("findLateNight", () => {
  it("finds the top website between 00:00 and 04:00", () => {
    const visits = [
      ...localVisits("https://a.com/", "2026-03-01T00:00", 2),
      localVisit("https://b.com/", "2026-03-01T03:59"),
      ...localVisits("https://b.com/", "2026-03-01T04:00", 5),
      ...localVisits("https://b.com/", "2026-03-01T23:59", 5),
    ];

    expect(findLateNight(aggregate(visits))).toEqual({
      site: "a.com",
      topUrl: "https://a.com/",
      visits: 2,
      total: 3,
    });
  });

  it("needs a few late visits", () => {
    const visits = localVisits("https://a.com/", "2026-03-01T01:00", 2);
    expect(findLateNight(aggregate(visits))).toBe(undefined);
  });
});

describe("findMostRevisited", () => {
  it("finds the page with most visits", () => {
    const visits = [
      ...localVisits("https://a.com/1", "2026-03-01T10:00", 2),
      ...localVisits("https://a.com/2", "2026-03-01T10:00", 3),
    ];
    expect(findMostRevisited(aggregate(visits))).toMatchObject({
      url: "https://a.com/2",
      visits: 3,
    });
  });

  it("needs a page visited more than once", () => {
    const visits = [localVisit("https://a.com/1", "2026-03-01T10:00")];
    expect(findMostRevisited(aggregate(visits))).toBe(undefined);
  });
});

describe("summarizeTransitions", () => {
  it("groups Chrome transitions and skips visits without one", () => {
    const visits = [
      "typed",
      "generated",
      "keyword",
      "keyword_generated",
      "link",
      "link",
      "auto_bookmark",
      "reload",
      "form_submit",
      "auto_toplevel",
      undefined,
    ].map((transition) =>
      localVisit("https://a.com/", "2026-03-01T10:00", {
        transition: transition as chrome.history.TransitionType | undefined,
      }),
    );

    expect(summarizeTransitions(aggregate(visits))).toEqual({
      typed: 4,
      clicked: 2,
      bookmarked: 1,
      reloaded: 1,
      other: 2,
      known: 10,
    });
  });
});
