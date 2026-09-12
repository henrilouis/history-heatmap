import type { HistoryVisit } from "./chrome-api";

// Synthetic visits for tests; no browser profile or machine clock is involved.
export function historyVisit(
  visitId: string,
  date?: Date,
  overrides: Partial<HistoryVisit> = {},
): HistoryVisit {
  return {
    id: `url-${visitId}`,
    visitId,
    visitTime: date?.getTime(),
    url: `https://example.com/${visitId}`,
    referringVisitId: "0",
    transition: "link",
    isLocal: true,
    ...overrides,
  };
}
