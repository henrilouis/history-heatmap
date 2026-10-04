import type { DayRange, SiteStats, VisitAggregate } from "./aggregate";

export type SiteSummary = {
  site: string;
  /** Most visited page, for the favicon. */
  topUrl: string;
};

export type DeepDive = SiteSummary & { newPages: number };

export type Regular = SiteSummary & { days: number; visits: number };

export type LoyaltyBucket = {
  label: string;
  /** Inclusive minimum of distinct days visited. */
  min: number;
  sites: number;
};

export type Discovery = {
  sites: number;
  pages: number;
  /** Websites visited on a single day only. */
  oneTimeSites: number;
  /** Websites visited on two or more days. */
  returningSites: number;
  /** Pages first opened on a later day than their website's first visit. */
  newPagesOnKnownSites: number;
  deepDives: DeepDive[];
  /** Cumulative distinct websites per calendar day in the range. */
  curve: number[];
  /** Websites first visited in the last RECENT_DAYS days of the range. */
  recentSites: number;
  loyalty: LoyaltyBucket[];
  regulars: Regular[];
};

export const RECENT_DAYS = 7;
const DEEP_DIVE_LIMIT = 3;
const REGULAR_LIMIT = 10;

const LOYALTY_BUCKETS: Omit<LoyaltyBucket, "sites">[] = [
  { label: "1 day", min: 1 },
  { label: "2–3 days", min: 2 },
  { label: "4–7 days", min: 4 },
  { label: "8–30 days", min: 8 },
  { label: "31+ days", min: 31 },
];

function summary(site: SiteStats): SiteSummary {
  return { site: site.site, topUrl: site.topUrl };
}

function findNewPages({ urls, sites }: VisitAggregate) {
  const perSite = new Map<string, number>();
  let total = 0;
  for (const page of urls.values()) {
    const site = sites.get(page.site)!;
    if (page.firstDay === Infinity || page.firstDay <= site.firstDay) continue;
    total++;
    perSite.set(page.site, (perSite.get(page.site) ?? 0) + 1);
  }

  const deepDives = [...perSite]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, DEEP_DIVE_LIMIT)
    .map(([site, newPages]) => ({ ...summary(sites.get(site)!), newPages }));
  return { newPagesOnKnownSites: total, deepDives };
}

function bucketOf(loyalty: LoyaltyBucket[], days: number): LoyaltyBucket {
  let bucket = loyalty.length - 1;
  while (days < loyalty[bucket].min) bucket--;
  return loyalty[bucket];
}

function countReturns({ sites }: VisitAggregate, range: DayRange) {
  const firstVisits = Array<number>(range.days).fill(0);
  const loyalty = LOYALTY_BUCKETS.map((bucket) => ({ ...bucket, sites: 0 }));
  let oneTimeSites = 0;
  for (const site of sites.values()) {
    const days = site.days.size;
    if (days === 0) continue;
    if (days === 1) oneTimeSites++;
    bucketOf(loyalty, days).sites++;
    const offset = site.firstDay - range.start;
    if (offset >= 0 && offset < range.days) firstVisits[offset]++;
  }
  const placed = loyalty.reduce((sum, bucket) => sum + bucket.sites, 0);
  return {
    oneTimeSites,
    returningSites: placed - oneTimeSites,
    loyalty,
    firstVisits,
  };
}

function discoveryCurve(firstVisits: number[]) {
  let total = 0;
  const curve = firstVisits.map((count) => (total += count));
  const recentStart = Math.max(0, curve.length - RECENT_DAYS);
  const recentSites = total - (recentStart ? curve[recentStart - 1] : 0);
  return { curve, recentSites };
}

function findRegulars({ sites }: VisitAggregate): Regular[] {
  return [...sites.values()]
    .filter((site) => site.days.size > 1)
    .sort(
      (a, b) =>
        b.days.size - a.days.size ||
        b.visits - a.visits ||
        a.site.localeCompare(b.site),
    )
    .slice(0, REGULAR_LIMIT)
    .map((site) => ({
      ...summary(site),
      days: site.days.size,
      visits: site.visits,
    }));
}

/**
 * Splits websites and pages into first-time and returning ones over the whole
 * loaded history. Visits without a time cannot be placed on a day and only
 * count towards the totals.
 */
export function buildDiscovery(
  aggregate: VisitAggregate,
  range: DayRange,
): Discovery {
  const { firstVisits, ...returns } = countReturns(aggregate, range);
  return {
    sites: aggregate.sites.size,
    pages: aggregate.urls.size,
    ...returns,
    ...findNewPages(aggregate),
    ...discoveryCurve(firstVisits),
    regulars: findRegulars(aggregate),
  };
}
