import type { VisitAggregate } from "./aggregate";
import type { Rhythm } from "./rhythm";

export type Trait = {
  name: string;
  /** Explains the trait with the share that earned it. */
  reason: string;
};

export type Personality = { time: Trait; style: Trait };

/** Too few visits make any label a coin toss. */
export const MIN_PERSONALITY_VISITS = 50;
const MIN_PERSONALITY_SITES = 6;

/** Share of visits from 22:00 to 04:00 that makes a Night Owl. */
export const NIGHT_OWL_SHARE = 0.25;
/** Share of visits from 05:00 to 09:00 that makes an Early Bird. */
export const EARLY_BIRD_SHARE = 0.2;
/** Share of visits on weekdays from 09:00 to 17:00 that makes a 9-to-5er. */
export const OFFICE_SHARE = 0.5;
/** How much busier an average weekend day is for a Weekend Warrior. */
export const WEEKEND_RATIO = 1.25;
/** Share of visits to the top sites that makes a Loyalist, or at most an Explorer. */
export const LOYALIST_SHARE = 0.6;
export const EXPLORER_SHARE = 0.3;
const TOP_SITES = 5;

const percent = (share: number) =>
  share.toLocaleString(undefined, {
    style: "percent",
    maximumFractionDigits: 0,
  });

function sumHours(
  grid: number[][],
  hours: number[],
  weekdays = [0, 1, 2, 3, 4, 5, 6],
): number {
  let sum = 0;
  for (const weekday of weekdays) {
    for (const hour of hours) sum += grid[weekday][hour];
  }
  return sum;
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => from + i);

function timeTrait(grid: number[][], timed: number, rhythm: Rhythm): Trait {
  const night = sumHours(grid, [22, 23, ...range(0, 4)]) / timed;
  if (night >= NIGHT_OWL_SHARE) {
    return {
      name: "Night Owl",
      reason: `${percent(night)} of your browsing happens between 22:00 and 04:00.`,
    };
  }

  const early = sumHours(grid, range(5, 9)) / timed;
  if (early >= EARLY_BIRD_SHARE) {
    return {
      name: "Early Bird",
      reason: `${percent(early)} of your browsing happens between 05:00 and 09:00.`,
    };
  }

  const office = sumHours(grid, range(9, 17), range(0, 5)) / timed;
  if (office >= OFFICE_SHARE) {
    return {
      name: "9-to-5er",
      reason: `${percent(office)} of your browsing happens on weekdays between 09:00 and 17:00.`,
    };
  }

  const weekday = rhythm.weekdays.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  const weekend = (rhythm.weekdays[5] + rhythm.weekdays[6]) / 2;
  if (weekend > 0 && weekend >= weekday * WEEKEND_RATIO) {
    const ratio = (weekend / weekday).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
    return {
      name: "Weekend Warrior",
      reason: weekday
        ? `You browse ${ratio}× as much on an average weekend day as on a weekday.`
        : "You only browse on weekends.",
    };
  }

  return {
    name: "All-Day Surfer",
    reason: `Your browsing is spread across the day, peaking around ${String(rhythm.peakHour).padStart(2, "0")}:00.`,
  };
}

function styleTrait({ sites, total }: VisitAggregate): Trait {
  const top = [...sites.values()]
    .map((site) => site.visits)
    .sort((a, b) => b - a)
    .slice(0, TOP_SITES)
    .reduce((a, b) => a + b, 0);
  const share = top / total;
  if (share >= LOYALIST_SHARE) {
    return {
      name: "Loyalist",
      reason: `${percent(share)} of your visits go to just ${TOP_SITES} websites.`,
    };
  }
  if (share <= EXPLORER_SHARE) {
    return {
      name: "Explorer",
      reason: `Your top ${TOP_SITES} websites get only ${percent(share)} of your visits; the rest is spread over ${(sites.size - TOP_SITES).toLocaleString()} others.`,
    };
  }
  return {
    name: "All-Rounder",
    reason: `Your top ${TOP_SITES} websites get ${percent(share)} of your visits, with plenty of room for others.`,
  };
}

export function buildPersonality(
  aggregate: VisitAggregate,
  rhythm: Rhythm,
): Personality | undefined {
  const timed = aggregate.grid.flat().reduce((a, b) => a + b, 0);
  if (
    timed < MIN_PERSONALITY_VISITS ||
    aggregate.sites.size < MIN_PERSONALITY_SITES
  ) {
    return;
  }
  return {
    time: timeTrait(aggregate.grid, timed, rhythm),
    style: styleTrait(aggregate),
  };
}
