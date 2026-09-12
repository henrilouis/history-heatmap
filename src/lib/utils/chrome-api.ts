import { eachLocalDate, getDateKey } from "./date";

// HistoryItem.id identifies a URL; visitId identifies an individual visit.
export type HistoryVisit = chrome.history.VisitItem & {
  url: string;
  title?: string;
};

const VISIT_REQUEST_CONCURRENCY = 8;

function searchHistory(filter: string): Promise<chrome.history.HistoryItem[]> {
  return new Promise<chrome.history.HistoryItem[]>((resolve, reject) => {
    if (!chrome?.history) {
      reject(new Error("Chrome history API not available"));
      return;
    }
    chrome.history.search(
      { text: filter, maxResults: 9999999, startTime: 0 },
      (results: chrome.history.HistoryItem[]) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(results);
        }
      },
    );
  });
}

function getVisits(url: string): Promise<chrome.history.VisitItem[]> {
  return new Promise((resolve, reject) => {
    chrome.history.getVisits({ url }, (results) => {
      if (chrome.runtime.lastError) {
        reject(new Error(
          `Failed to retrieve history visits: ${chrome.runtime.lastError.message}`,
        ));
      } else {
        resolve(results);
      }
    });
  });
}

export async function getHistory(filter: string = ""): Promise<HistoryVisit[]> {
  const history = await searchHistory(filter);
  const visits: HistoryVisit[] = [];
  let nextIndex = 0;
  let failed = false;

  async function worker(): Promise<void> {
    while (!failed && nextIndex < history.length) {
      const item = history[nextIndex++];
      // Chrome makes URL optional; without it we cannot request individual visits.
      if (!item.url) continue;

      try {
        const urlVisits = await getVisits(item.url);
        for (const visit of urlVisits) {
          visits.push({ ...visit, url: item.url, title: item.title });
        }
      } catch (error) {
        // Stop scheduling work and reject the load rather than show partial counts.
        failed = true;
        throw error;
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(VISIT_REQUEST_CONCURRENCY, history.length) },
      () => worker(),
    ),
  );

  // API response order and worker completion order do not define chronology.
  return visits.sort((a, b) => (b.visitTime ?? 0) - (a.visitTime ?? 0));
}

// Helper to get hour key
function getHourKey(date: Date): string {
  return String(date.getHours()).padStart(2, "0");
}

export type HistoryByDay = {
  [day: string]: HistoryVisit[];
};

export type HistoryByDayAndHour = {
  [day: string]: {
    [hour: string]: HistoryVisit[];
  };
};

// Pure grouping function - works on already-fetched data
export function groupHistoryByDay(
  history: HistoryVisit[],
): HistoryByDay {
  const grouped: HistoryByDay = {};

  for (const item of history) {
    if (item.visitTime === undefined) continue;
    const dayKey = getDateKey(new Date(item.visitTime));
    (grouped[dayKey] ??= []).push(item);
  }

  // Sort items within each day (newest first)
  for (const items of Object.values(grouped)) {
    items.sort((a, b) => (b.visitTime ?? 0) - (a.visitTime ?? 0));
  }

  return grouped;
}

// Pure grouping function - by day and hour
export function groupHistoryByDayAndHour(
  history: HistoryVisit[],
): HistoryByDayAndHour {
  const grouped: HistoryByDayAndHour = {};

  for (const item of history) {
    if (item.visitTime === undefined) continue;
    const date = new Date(item.visitTime);
    const dayKey = getDateKey(date);
    const hourKey = getHourKey(date);

    (grouped[dayKey] ??= {})[hourKey] ??= [];
    grouped[dayKey][hourKey].push(item);
  }

  // Sort items within each hour (newest first)
  for (const day of Object.values(grouped)) {
    for (const items of Object.values(day)) {
      items.sort((a, b) => (b.visitTime ?? 0) - (a.visitTime ?? 0));
    }
  }

  return grouped;
}

// Scan bounds without allocating a timestamp array or spreading it into a call.
function getHistoryDateRange(
  history: HistoryVisit[],
): { startDate: Date; endDate: Date } | undefined {
  let earliest = Infinity;
  let latest = -Infinity;

  for (const { visitTime } of history) {
    if (visitTime === undefined) continue;
    if (visitTime < earliest) earliest = visitTime;
    if (visitTime > latest) latest = visitTime;
  }

  if (earliest === Infinity) return;

  const startDate = new Date(earliest);
  const endDate = new Date(latest);
  // Compare calendar dates so an earlier time on the final day cannot omit it.
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  return { startDate, endDate };
}

// Fill empty days in a date range
export function fillEmptyDays(
  grouped: HistoryByDay,
  allHistory: HistoryVisit[],
): HistoryByDay {
  const range = getHistoryDateRange(allHistory);
  if (!range) return grouped;
  const { startDate, endDate } = range;

  // The day view is a week grid, so pad its first week back to Monday.
  startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));

  for (const current of eachLocalDate(startDate, endDate)) {
    grouped[getDateKey(current)] ??= [];
  }

  return grouped;
}

// Fill empty hours (00-23) for each day
export function fillEmptyHours(
  grouped: HistoryByDayAndHour,
  allHistory: HistoryVisit[],
): HistoryByDayAndHour {
  const range = getHistoryDateRange(allHistory);
  if (!range) return grouped;
  const { startDate, endDate } = range;

  // The hour view is a flat day list and needs no Monday padding.
  for (const current of eachLocalDate(startDate, endDate)) {
    const dayKey = getDateKey(current);
    grouped[dayKey] ??= {};

    // Fill all 24 hours for each day
    for (let hour = 0; hour < 24; hour++) {
      const hourKey = String(hour).padStart(2, "0");
      grouped[dayKey][hourKey] ??= [];
    }
  }

  return grouped;
}

export async function deleteUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!chrome?.history) {
      reject(new Error("Chrome history API not available"));
      return;
    }

    chrome.history.deleteUrl({ url }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

export function getFaviconURL(pageUrl: string) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", "32");
  return url.toString();
}
