import { getHistoryDateRange, type HistoryVisit } from "../chrome-api";
import { createLocalTimeKeyer } from "../date";
import { siteForUrl } from "../history-stats";

/** Local calendar days are numbered from 1970-01-01, so ranges are plain maths. */
const EPOCH = Temporal.PlainDate.from("1970-01-01");

export function toDayNumber(date: Temporal.PlainDate): number {
  return date.since(EPOCH).days;
}

export function fromDayNumber(day: number): Temporal.PlainDate {
  return EPOCH.add({ days: day });
}

/** 0 is Monday and 6 is Sunday; 1970-01-01 was a Thursday. */
export function weekdayOf(day: number): number {
  return (((day + 3) % 7) + 7) % 7;
}

export type DayRange = {
  start: number;
  end: number;
  /** Calendar days in the range, including days without visits. */
  days: number;
};

export function toDayRange(
  visits: HistoryVisit[],
  timeZone: string,
): DayRange | undefined {
  const range = getHistoryDateRange(visits, timeZone);
  if (!range) return;
  const start = toDayNumber(range.startDate);
  const end = toDayNumber(range.endDate);
  return { start, end, days: end - start + 1 };
}

export type UrlStats = {
  url: string;
  title?: string;
  site: string;
  visits: number;
  /** Day of the first visit; Infinity when no visit has a time. */
  firstDay: number;
};

export type SiteStats = {
  site: string;
  visits: number;
  /** Distinct days with a visit. */
  days: Set<number>;
  firstDay: number;
  /** Visits between 00:00 and LATE_NIGHT_END_HOUR. */
  lateVisits: number;
  /** The site's most visited page, which stands in for its favicon. */
  topUrl: string;
};

export type VisitAggregate = {
  total: number;
  urls: Map<string, UrlStats>;
  sites: Map<string, SiteStats>;
  /** Visits per day number. */
  days: Map<number, number>;
  /** Visits per weekday (0 is Monday) and local hour. */
  grid: number[][];
  /** Visits per Chrome transition type; visits without one are left out. */
  transitions: Map<string, number>;
};

const LATE_NIGHT_END_HOUR = 4;

function increment<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Local day number and hour of a timestamp, cached per local day key. */
function createLocalDayResolver(timeZone: string) {
  const keyOf = createLocalTimeKeyer(timeZone);
  const dayNumbers = new Map<string, number>();
  return (timestamp: number) => {
    const key = keyOf(timestamp);
    let day = dayNumbers.get(key.day);
    if (day === undefined) {
      day = toDayNumber(Temporal.PlainDate.from(key.day));
      dayNumbers.set(key.day, day);
    }
    return { day, hour: Number(key.hour) };
  };
}

function countPage(
  { urls, sites }: VisitAggregate,
  visit: HistoryVisit,
): { page: UrlStats; site: SiteStats } {
  let page = urls.get(visit.url);
  if (!page) {
    page = {
      url: visit.url,
      title: visit.title,
      site: siteForUrl(visit.url),
      visits: 0,
      firstDay: Infinity,
    };
    urls.set(visit.url, page);
  }
  page.visits++;

  let site = sites.get(page.site);
  if (!site) {
    site = {
      site: page.site,
      visits: 0,
      days: new Set(),
      firstDay: Infinity,
      lateVisits: 0,
      topUrl: page.url,
    };
    sites.set(page.site, site);
  }
  site.visits++;
  return { page, site };
}

function countTime(
  { days, grid }: VisitAggregate,
  page: UrlStats,
  site: SiteStats,
  { day, hour }: { day: number; hour: number },
) {
  page.firstDay = Math.min(page.firstDay, day);
  site.firstDay = Math.min(site.firstDay, day);
  site.days.add(day);
  if (hour < LATE_NIGHT_END_HOUR) site.lateVisits++;
  increment(days, day);
  grid[weekdayOf(day)][hour]++;
}

/**
 * Counts visits per URL, site, day, weekday and hour in one pass. Every other
 * insight derives from these totals instead of walking the visits again.
 */
export function aggregateVisits(
  visits: HistoryVisit[],
  timeZone: string,
): VisitAggregate {
  const aggregate: VisitAggregate = {
    total: visits.length,
    urls: new Map(),
    sites: new Map(),
    days: new Map(),
    grid: Array.from({ length: 7 }, () => Array<number>(24).fill(0)),
    transitions: new Map(),
  };
  const localDay = createLocalDayResolver(timeZone);

  for (const visit of visits) {
    const { page, site } = countPage(aggregate, visit);
    if (visit.transition) increment(aggregate.transitions, visit.transition);
    if (visit.visitTime !== undefined) {
      countTime(aggregate, page, site, localDay(visit.visitTime));
    }
  }

  for (const page of aggregate.urls.values()) {
    const site = aggregate.sites.get(page.site)!;
    if (page.visits > aggregate.urls.get(site.topUrl)!.visits) {
      site.topUrl = page.url;
    }
  }

  return aggregate;
}
