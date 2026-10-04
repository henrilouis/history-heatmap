import type { HistoryVisit } from "./chrome-api";

// Synthetic visits for tests; no browser profile or machine clock is involved.
export function historyVisit(
  visitId: string,
  date?: Date,
  overrides: Partial<HistoryVisit> = {},
): HistoryVisit {
  return {
    visitId,
    visitTime: date?.getTime(),
    url: `https://example.com/${visitId}`,
    ...overrides,
  };
}

/** Time zone for insight tests, which has a daylight saving time switch. */
export const TEST_TIME_ZONE = "Europe/Amsterdam";

let localVisitId = 0;

/** A visit at a local date and time, like "2026-03-02T10:00". */
export function localVisit(
  url: string,
  local: string,
  overrides: Partial<HistoryVisit> = {},
): HistoryVisit {
  return {
    visitId: `local-${++localVisitId}`,
    visitTime:
      Temporal.PlainDateTime.from(local).toZonedDateTime(TEST_TIME_ZONE)
        .epochMilliseconds,
    url,
    ...overrides,
  };
}

/** `count` visits to the same URL at the same local time. */
export function localVisits(
  url: string,
  local: string,
  count: number,
): HistoryVisit[] {
  return Array.from({ length: count }, () => localVisit(url, local));
}

export function chromeVisit(
  visitId: string,
  date?: Date,
  overrides: Partial<chrome.history.VisitItem> = {},
): chrome.history.VisitItem {
  return {
    id: `url-${visitId}`,
    visitId,
    visitTime: date?.getTime(),
    referringVisitId: "0",
    transition: "link",
    isLocal: true,
    ...overrides,
  };
}
