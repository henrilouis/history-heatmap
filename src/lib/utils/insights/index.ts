import type { HistoryVisit } from "../chrome-api";
import type { NavigationIndex } from "../history-graph";
import { aggregateVisits, toDayRange } from "./aggregate";
import { buildDiscovery } from "./discovery";
import {
  findBusiestDay,
  findLateNight,
  findMostRevisited,
  findRabbitHole,
  findStreaks,
  findTopSites,
  summarizeTransitions,
} from "./highlights";
import { buildPersonality } from "./personality";
import { buildRhythm } from "./rhythm";
import { buildSearches } from "./searches";

export type InsightOptions = {
  /** Unfiltered history; its date range is the denominator for averages. */
  allVisits: HistoryVisit[];
  navigation: NavigationIndex;
  timeZone?: string;
};

export type Insights = ReturnType<typeof buildInsights>;

/**
 * Everything the stats view shows about the given visits. Visits may be
 * filtered by a search; averages still span the full history, so a filter
 * doesn't make quiet days disappear.
 */
export function buildInsights(
  visits: HistoryVisit[],
  {
    allVisits,
    navigation,
    timeZone = Temporal.Now.timeZoneId(),
  }: InsightOptions,
) {
  const aggregate = aggregateVisits(visits, timeZone);
  const range = toDayRange(allVisits, timeZone);
  const timed = range && aggregate.days.size > 0 ? range : undefined;
  const rhythm = timed && buildRhythm(aggregate, timed);

  return {
    totals: {
      visits: aggregate.total,
      pages: aggregate.urls.size,
      sites: aggregate.sites.size,
      activeDays: aggregate.days.size,
    },
    range: timed,
    topSites: findTopSites(aggregate),
    rhythm,
    discovery: timed && buildDiscovery(aggregate, timed),
    personality: rhythm && buildPersonality(aggregate, rhythm),
    busiestDay: findBusiestDay(visits, aggregate, timeZone),
    streaks: timed && findStreaks(aggregate, timed),
    rabbitHole: findRabbitHole(visits, navigation, aggregate),
    lateNight: findLateNight(aggregate),
    mostRevisited: findMostRevisited(aggregate),
    transitions: summarizeTransitions(aggregate),
    searches: buildSearches(aggregate),
  };
}
