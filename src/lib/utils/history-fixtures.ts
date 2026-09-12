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
