import type { HistoryVisit } from "./chrome-api";
import type { NavigationIndex } from "./history-graph";
import { siteForUrl } from "./history-stats";
import { parseSearch } from "./insights/searches";

/** A trail this quiet has ended; coming back to it starts a new flow. */
const FLOW_IDLE_MS = 60 * 60 * 1000;
/** Flows on the same website this close together are one flow. */
const SITE_MERGE_MS = 30 * 60 * 1000;
/** Flows this small are pooled per session rather than getting a card. */
const SMALL_FLOW_VISITS = 2;
/** Small flows further apart than this are pooled into separate cards. */
const SESSION_IDLE_MS = 30 * 60 * 1000;

export type FlowTopic =
  | { kind: "search"; term: string }
  | { kind: "site"; site: string }
  | { kind: "other" };

export type Flow = {
  /** Stays the same while the flow grows: based on its earliest visit. */
  key: string;
  /** Newest first. */
  items: HistoryVisit[];
  topic: FlowTopic;
};

export function flowTitle(topic: FlowTopic): string {
  switch (topic.kind) {
    case "search":
      return `“${topic.term}”`;
    case "site":
      return topic.site;
    case "other":
      return "Other visits";
  }
}

type Entry = {
  visit: HistoryVisit;
  /** Position newest first. */
  order: number;
  time: number;
  site: string;
  search?: string;
};

/** Visits of one flow and the time they span. */
type Segment = { entries: Entry[]; start: number; end: number };

const byStart = (a: Segment, b: Segment) => a.start - b.start;

/**
 * Group visits into flows: pages opened from one another, joined with nearby
 * flows on the same website. Small unrelated flows from one session are
 * pooled, so a burst of launched pages doesn't become a card each.
 */
export function groupByFlow(
  visits: HistoryVisit[],
  navigation: NavigationIndex,
): Flow[] {
  const segments = splitIdle(byTrail(toEntries(visits), navigation));
  return poolSmall(mergeBySite(segments))
    .map(toFlow)
    .sort((a, b) => a.order - b.order)
    .map(({ flow }) => flow);
}

function toEntries(visits: HistoryVisit[]): Entry[] {
  const pages = new Map<string, { site: string; search?: string }>();
  return [...visits]
    .sort((a, b) => (b.visitTime ?? 0) - (a.visitTime ?? 0))
    .map((visit, order) => {
      let page = pages.get(visit.url);
      if (!page) {
        const site = siteForUrl(visit.url);
        page = { site, search: parseSearch(visit.url, site)?.term };
        pages.set(visit.url, page);
      }
      return { visit, order, time: visit.visitTime ?? 0, ...page };
    });
}

/** Visits per navigation trail, oldest first. */
function byTrail(entries: Entry[], navigation: NavigationIndex) {
  const trails = new Map<string, Entry[]>();
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const id = entry.visit.visitId;
    const trail = navigation.trails.get(id) ?? id;
    const members = trails.get(trail);
    if (members) members.push(entry);
    else trails.set(trail, [entry]);
  }
  return trails.values();
}

function splitIdle(trails: Iterable<Entry[]>): Segment[] {
  const segments: Segment[] = [];
  for (const entries of trails) {
    let current: Segment | undefined;
    for (const entry of entries) {
      if (current && entry.time - current.end <= FLOW_IDLE_MS) {
        current.entries.push(entry);
        current.end = entry.time;
      } else {
        current = { entries: [entry], start: entry.time, end: entry.time };
        segments.push(current);
      }
    }
  }
  return segments;
}

/** The most visited website, the earliest visited one on a tie. */
function mainSite(entries: Entry[]): string {
  const counts = new Map<string, { count: number; time: number }>();
  for (const { site, time } of entries) {
    const stats = counts.get(site);
    if (stats) {
      stats.count++;
      stats.time = Math.min(stats.time, time);
    } else counts.set(site, { count: 1, time });
  }
  let best: [string, { count: number; time: number }] | undefined;
  for (const candidate of counts) {
    const [, stats] = candidate;
    if (
      !best ||
      stats.count > best[1].count ||
      (stats.count === best[1].count && stats.time < best[1].time)
    )
      best = candidate;
  }
  return best![0];
}

/**
 * Join flows mostly on one website that closely follow each other, such as
 * pages of one site opened from the address bar. A flow with a search is
 * about that search, so it never joins others on the search engine.
 */
function mergeBySite(segments: Segment[]): Segment[] {
  const merged: Segment[] = [];
  const open = new Map<string, Segment>();
  for (const segment of [...segments].sort(byStart)) {
    if (segment.entries.some((entry) => entry.search)) {
      merged.push(segment);
      continue;
    }
    const site = mainSite(segment.entries);
    const previous = open.get(site);
    if (previous && segment.start - previous.end <= SITE_MERGE_MS) {
      previous.entries.push(...segment.entries);
      previous.end = Math.max(previous.end, segment.end);
      continue;
    }
    const copy = { ...segment, entries: [...segment.entries] };
    open.set(site, copy);
    merged.push(copy);
  }
  return merged;
}

type Pooled = Segment & { pooled: boolean };

function poolSmall(segments: Segment[]): Pooled[] {
  const result: Pooled[] = [];
  let pool: Segment[] = [];
  let poolEnd = -Infinity;
  const flush = () => {
    if (pool.length === 0) return;
    result.push({
      entries: pool.flatMap((segment) => segment.entries),
      start: pool[0].start,
      end: poolEnd,
      pooled: pool.length > 1,
    });
    pool = [];
  };

  for (const segment of [...segments].sort(byStart)) {
    if (segment.entries.length > SMALL_FLOW_VISITS) {
      result.push({ ...segment, pooled: false });
      continue;
    }
    if (segment.start - poolEnd > SESSION_IDLE_MS) flush();
    poolEnd = pool.length ? Math.max(poolEnd, segment.end) : segment.end;
    pool.push(segment);
  }
  flush();
  return result;
}

function toFlow({ entries, pooled }: Pooled) {
  const sorted = [...entries].sort((a, b) => a.order - b.order);
  const earliest = sorted[sorted.length - 1];
  let search: string | undefined;
  for (let i = sorted.length - 1; i >= 0 && !search; i--)
    search = sorted[i].search;

  const topic: FlowTopic = pooled
    ? { kind: "other" }
    : search
      ? { kind: "search", term: search }
      : { kind: "site", site: mainSite(sorted) };
  return {
    order: sorted[0].order,
    flow: {
      key: `${pooled ? "other" : "flow"}:${earliest.visit.visitId}`,
      items: sorted.map((entry) => entry.visit),
      topic,
    },
  };
}
