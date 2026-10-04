import type { HistoryVisit } from "../chrome-api";
import type { NavigationIndex } from "../history-graph";
import {
  fromDayNumber,
  type DayRange,
  type UrlStats,
  type VisitAggregate,
} from "./aggregate";
import type { SiteSummary } from "./discovery";

export type TopSite = SiteSummary & { visits: number; share: number };

export type BusiestDay = {
  day: number;
  visits: number;
  topSite?: SiteSummary & { visits: number };
};

export type Run = { length: number; start: number; end: number };

export type Streaks = {
  longest: Run;
  /** Consecutive days up to the end of the range, or the day before it. */
  current: number;
  site?: SiteSummary & Run;
};

export type RabbitHole = {
  start: HistoryVisit;
  visits: number;
  sites: number;
  /** Milliseconds between the first and last visit of the trail. */
  duration: number;
};

export type LateNight = SiteSummary & { visits: number; total: number };

export type TransitionSummary = {
  typed: number;
  clicked: number;
  bookmarked: number;
  reloaded: number;
  other: number;
  /** Visits with a known transition; the sum of the others. */
  known: number;
};

const TOP_SITE_LIMIT = 5;
export const MIN_RABBIT_HOLE_VISITS = 3;
const MIN_LATE_NIGHT_VISITS = 3;

export function findTopSites(
  { sites, total }: VisitAggregate,
  limit = TOP_SITE_LIMIT,
): TopSite[] {
  return [...sites.values()]
    .sort((a, b) => b.visits - a.visits || a.site.localeCompare(b.site))
    .slice(0, limit)
    .map((site) => ({
      site: site.site,
      topUrl: site.topUrl,
      visits: site.visits,
      share: total ? site.visits / total : 0,
    }));
}

function busiestOf(days: Map<number, number>) {
  let busiest: { day: number; visits: number } | undefined;
  for (const [day, visits] of days) {
    // Ties go to the most recent day.
    if (
      busiest &&
      (visits < busiest.visits ||
        (visits === busiest.visits && day < busiest.day))
    ) {
      continue;
    }
    busiest = { day, visits };
  }
  return busiest;
}

function topSiteBetween(
  visits: HistoryVisit[],
  { urls, sites }: VisitAggregate,
  start: number,
  end: number,
): BusiestDay["topSite"] {
  const perSite = new Map<string, number>();
  for (const { url, visitTime } of visits) {
    if (visitTime === undefined) continue;
    const time = Math.trunc(visitTime);
    if (time < start || time >= end) continue;
    const site = urls.get(url)!.site;
    perSite.set(site, (perSite.get(site) ?? 0) + 1);
  }

  let top: BusiestDay["topSite"];
  for (const [site, count] of perSite) {
    if (top && count <= top.visits) continue;
    top = { site, topUrl: sites.get(site)!.topUrl, visits: count };
  }
  return top;
}

/**
 * The day with the most visits, and the website most visited on it. Only that
 * day's visits are walked again, by their time window.
 */
export function findBusiestDay(
  visits: HistoryVisit[],
  aggregate: VisitAggregate,
  timeZone: string,
): BusiestDay | undefined {
  const busiest = busiestOf(aggregate.days);
  if (!busiest) return;
  const date = fromDayNumber(busiest.day);
  const start = date.toZonedDateTime(timeZone).epochMilliseconds;
  const end = date.add({ days: 1 }).toZonedDateTime(timeZone).epochMilliseconds;
  return { ...busiest, topSite: topSiteBetween(visits, aggregate, start, end) };
}

/** Longest run of consecutive numbers in an ascending list. */
function longestRun(days: number[]): Run {
  let best: Run = { length: 0, start: NaN, end: NaN };
  let start = 0;
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && days[i] !== days[i - 1] + 1) start = i;
    const length = i - start + 1;
    if (length > best.length) {
      best = { length, start: days[start], end: days[i] };
    }
  }
  return best;
}

const ascending = (a: number, b: number) => a - b;

export function findStreaks(
  { days, sites }: VisitAggregate,
  range: DayRange,
): Streaks {
  const active = new Set(days.keys());

  // Today may simply not have had a visit yet; that doesn't break a streak.
  let current = 0;
  let day = active.has(range.end) ? range.end : range.end - 1;
  while (active.has(day--)) current++;

  let site: Streaks["site"];
  for (const stats of sites.values()) {
    // A site can't beat the best streak with fewer days than it in total.
    if (stats.days.size < 2 || stats.days.size <= (site?.length ?? 0)) {
      continue;
    }
    const run = longestRun([...stats.days].sort(ascending));
    if (run.length > 1 && run.length > (site?.length ?? 0)) {
      site = { site: stats.site, topUrl: stats.topUrl, ...run };
    }
  }

  return {
    longest: longestRun([...active].sort(ascending)),
    current,
    site,
  };
}

function largestTrail(
  visits: HistoryVisit[],
  trailOf: (visit: HistoryVisit) => string,
) {
  const trails = new Map<string, number>();
  let best: { trail: string; visits: number } | undefined;
  for (const visit of visits) {
    const trail = trailOf(visit);
    const count = (trails.get(trail) ?? 0) + 1;
    trails.set(trail, count);
    if (!best || count > best.visits) best = { trail, visits: count };
  }
  return best;
}

/**
 * The navigation trail, a chain of pages opened from one another, with the
 * most visits. Trails come from the unfiltered history, so a search only
 * decides which of their visits count.
 */
export function findRabbitHole(
  visits: HistoryVisit[],
  navigation: NavigationIndex,
  { urls }: VisitAggregate,
): RabbitHole | undefined {
  const trailOf = (visit: HistoryVisit) =>
    navigation.trails.get(visit.visitId) ?? visit.visitId;
  const best = largestTrail(visits, trailOf);
  if (!best || best.visits < MIN_RABBIT_HOLE_VISITS) return;

  const members = visits.filter((visit) => trailOf(visit) === best.trail);
  let first = Infinity;
  let last = -Infinity;
  for (const { visitTime } of members) {
    if (visitTime === undefined) continue;
    first = Math.min(first, visitTime);
    last = Math.max(last, visitTime);
  }

  return {
    // Visits are newest first, so the last member is the earliest one when
    // the index doesn't know where the trail starts.
    start: navigation.visits.get(best.trail) ?? members.at(-1)!,
    visits: best.visits,
    sites: new Set(members.map((visit) => urls.get(visit.url)!.site)).size,
    duration: last > first ? last - first : 0,
  };
}

export function findLateNight({
  sites,
}: VisitAggregate): LateNight | undefined {
  let total = 0;
  let top: LateNight | undefined;
  for (const site of sites.values()) {
    total += site.lateVisits;
    if (site.lateVisits && (!top || site.lateVisits > top.visits)) {
      top = {
        site: site.site,
        topUrl: site.topUrl,
        visits: site.lateVisits,
        total: 0,
      };
    }
  }
  if (!top || total < MIN_LATE_NIGHT_VISITS) return;
  return { ...top, total };
}

export function findMostRevisited({
  urls,
}: VisitAggregate): UrlStats | undefined {
  let best: UrlStats | undefined;
  for (const page of urls.values()) {
    if (!best || page.visits > best.visits) best = page;
  }
  return best && best.visits > 1 ? best : undefined;
}

// Typed covers the address bar, including its suggestions and search keywords.
const TRANSITION_GROUPS = new Map<
  string,
  Exclude<keyof TransitionSummary, "known">
>([
  ["typed", "typed"],
  ["generated", "typed"],
  ["keyword", "typed"],
  ["keyword_generated", "typed"],
  ["link", "clicked"],
  ["auto_bookmark", "bookmarked"],
  ["reload", "reloaded"],
]);

export function summarizeTransitions({
  transitions,
}: VisitAggregate): TransitionSummary {
  const summary: TransitionSummary = {
    typed: 0,
    clicked: 0,
    bookmarked: 0,
    reloaded: 0,
    other: 0,
    known: 0,
  };
  for (const [transition, count] of transitions) {
    summary[TRANSITION_GROUPS.get(transition) ?? "other"] += count;
    summary.known += count;
  }
  return summary;
}
