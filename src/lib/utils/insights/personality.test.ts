import { describe, expect, it } from "vitest";
import { aggregateVisits, toDayRange } from "./aggregate";
import {
  buildPersonality,
  EARLY_BIRD_SHARE,
  EXPLORER_SHARE,
  LOYALIST_SHARE,
  MIN_PERSONALITY_VISITS,
  NIGHT_OWL_SHARE,
  OFFICE_SHARE,
  WEEKEND_RATIO,
} from "./personality";
import { buildRhythm } from "./rhythm";
import { localVisit, TEST_TIME_ZONE } from "../history-fixtures";
import type { HistoryVisit } from "../chrome-api";

// Monday 2 to Sunday 8 March 2026; the range anchors are not counted.
const WEEK = toDayRange(
  [
    localVisit("https://anchor.com/", "2026-03-02T12:00"),
    localVisit("https://anchor.com/", "2026-03-08T12:00"),
  ],
  TEST_TIME_ZONE,
)!;
const MONDAY = "2026-03-02";
const SATURDAY = "2026-03-07";

/** Visits at a local time, spread round-robin over ten websites. */
function at(local: string, count: number): HistoryVisit[] {
  return Array.from({ length: count }, (_, i) =>
    localVisit(`https://site${i % 10}.com/`, local),
  );
}

/** Visits at one time, with the given number of visits per website. */
function perSite(counts: number[]): HistoryVisit[] {
  return counts.flatMap((count, site) =>
    Array.from({ length: count }, () =>
      localVisit(`https://site${site}.com/`, `${MONDAY}T20:00`),
    ),
  );
}

function personality(visits: HistoryVisit[], range = WEEK) {
  const aggregate = aggregateVisits(visits, TEST_TIME_ZONE);
  return buildPersonality(aggregate, buildRhythm(aggregate, range));
}

describe("time of day trait", () => {
  it.each([
    {
      name: "Night Owl",
      visits: () => [
        ...at(`${MONDAY}T23:00`, NIGHT_OWL_SHARE * 100),
        ...at(`${MONDAY}T12:00`, 100 - NIGHT_OWL_SHARE * 100),
      ],
    },
    {
      name: "9-to-5er",
      visits: () => [
        ...at(`${MONDAY}T23:00`, NIGHT_OWL_SHARE * 100 - 1),
        ...at(`${MONDAY}T12:00`, 100 - NIGHT_OWL_SHARE * 100 + 1),
      ],
    },
    {
      name: "Early Bird",
      visits: () => [
        ...at(`${SATURDAY}T06:00`, EARLY_BIRD_SHARE * 100),
        ...at(`${SATURDAY}T20:00`, 100 - EARLY_BIRD_SHARE * 100),
      ],
    },
    {
      name: "Weekend Warrior",
      visits: () => [
        ...at(`${SATURDAY}T06:00`, EARLY_BIRD_SHARE * 100 - 1),
        ...at(`${SATURDAY}T20:00`, 100 - EARLY_BIRD_SHARE * 100 + 1),
      ],
    },
    {
      name: "9-to-5er",
      visits: () => [
        ...at(`${MONDAY}T09:00`, OFFICE_SHARE * 100),
        ...at(`${MONDAY}T17:00`, 100 - OFFICE_SHARE * 100),
      ],
    },
    {
      name: "All-Day Surfer",
      visits: () => [
        ...at(`${MONDAY}T09:00`, OFFICE_SHARE * 100 - 1),
        ...at(`${MONDAY}T17:00`, 100 - OFFICE_SHARE * 100 + 1),
      ],
    },
  ])("labels a $name", ({ name, visits }) => {
    expect(personality(visits())?.time.name).toBe(name);
  });

  function weekendWeek(saturday: number) {
    return [
      ...["02", "03", "04", "05", "06"].flatMap((date) =>
        at(`2026-03-${date}T20:00`, 10),
      ),
      ...at(`${SATURDAY}T20:00`, saturday),
    ];
  }

  it("labels a Weekend Warrior from the weekend to weekday ratio", () => {
    const result = personality(weekendWeek(WEEKEND_RATIO * 10 * 2));
    expect(result?.time).toEqual({
      name: "Weekend Warrior",
      reason:
        "You browse 1.25× as much on an average weekend day as on a weekday.",
    });
  });

  it("labels an All-Day Surfer just below the weekend ratio", () => {
    const result = personality(weekendWeek(WEEKEND_RATIO * 10 * 2 - 1));
    expect(result?.time).toEqual({
      name: "All-Day Surfer",
      reason: "Your browsing is spread across the day, peaking around 20:00.",
    });
  });

  it("compares only calendar days inside a short history", () => {
    const visits = [
      ...at("2026-03-06T20:00", 30),
      ...at("2026-03-07T20:00", 30),
    ];
    expect(
      personality(visits, toDayRange(visits, TEST_TIME_ZONE))?.time.name,
    ).toBe("All-Day Surfer");
  });

  it("uses actual day counts for a busier weekend in a short history", () => {
    const visits = [
      ...at("2026-03-06T20:00", 30),
      ...at("2026-03-07T20:00", 40),
    ];
    expect(
      personality(visits, toDayRange(visits, TEST_TIME_ZONE))?.time,
    ).toEqual({
      name: "Weekend Warrior",
      reason:
        "You browse 1.33× as much on an average weekend day as on a weekday.",
    });
  });

  it("weights repeated weekdays and includes empty days within the range", () => {
    // Monday through the next Monday: six weekdays and two weekend days.
    const visits = [
      ...at("2026-03-02T20:00", 30),
      ...at("2026-03-07T20:00", 24),
      ...at("2026-03-08T20:00", 24),
      ...at("2026-03-09T20:00", 30),
    ];
    expect(
      personality(visits, toDayRange(visits, TEST_TIME_ZONE))?.time,
    ).toEqual({
      name: "Weekend Warrior",
      reason:
        "You browse 2.4× as much on an average weekend day as on a weekday.",
    });
  });

  it.each(["2026-03-06", "2026-03-07"])(
    "does not compare weekdays and weekends with only %s in the range",
    (date) => {
      const visits = at(`${date}T20:00`, 60);
      expect(
        personality(visits, toDayRange(visits, TEST_TIME_ZONE))?.time.name,
      ).toBe("All-Day Surfer");
    },
  );
});

describe("browsing style trait", () => {
  it.each([
    {
      name: "Loyalist",
      share: LOYALIST_SHARE,
      counts: [12, 12, 12, 12, 12, 8, 8, 8, 8, 8],
    },
    {
      name: "All-Rounder",
      share: LOYALIST_SHARE - 0.05,
      counts: [11, 11, 11, 11, 11, 9, 9, 9, 9, 9],
    },
    {
      name: "Explorer",
      share: EXPLORER_SHARE,
      counts: [6, 6, 6, 6, 6, ...Array<number>(14).fill(5)],
    },
  ])("labels a $name at a top five share of $share", ({ name, counts }) => {
    expect(personality(perSite(counts))?.style.name).toBe(name);
  });
});

describe("buildPersonality", () => {
  it("needs enough visits", () => {
    expect(
      personality(at(`${MONDAY}T20:00`, MIN_PERSONALITY_VISITS)),
    ).toBeDefined();
    expect(personality(at(`${MONDAY}T20:00`, MIN_PERSONALITY_VISITS - 1))).toBe(
      undefined,
    );
  });

  it("needs enough websites", () => {
    expect(personality(perSite([20, 20, 20, 20, 20]))).toBe(undefined);
    expect(personality(perSite([20, 20, 20, 20, 20, 1]))).toBeDefined();
  });
});
