import { eachLocalDate, getDateKey } from "./date";

// Keep only fields consumed by the UI; URL/title strings are shared per URL.
export type HistoryVisit = Pick<chrome.history.VisitItem, "visitId" | "visitTime"> & {
  url: string;
  title?: string;
};

const VISIT_REQUEST_CONCURRENCY = 8;

export type HistoryLoadProgress = { completed: number; total: number };
export type HistoryLoadOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: HistoryLoadProgress) => void;
};

function searchHistory(filter: string): Promise<chrome.history.HistoryItem[]> {
  return new Promise<chrome.history.HistoryItem[]>((resolve, reject) => {
    if (!globalThis.chrome?.history) {
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
    if (!globalThis.chrome?.history) {
      reject(new Error("Chrome history API not available"));
      return;
    }
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

async function loadHistory(
  filter: string,
  options: HistoryLoadOptions,
): Promise<HistoryVisit[]> {
  options.signal?.throwIfAborted();
  const results = await searchHistory(filter);
  return loadVisits(results, options);
}

async function loadVisits(
  results: chrome.history.HistoryItem[],
  { signal, onProgress }: HistoryLoadOptions,
): Promise<HistoryVisit[]> {
  signal?.throwIfAborted();
  // Only requestable URLs contribute to the worker count and progress total.
  const history = results.filter(
    (item): item is chrome.history.HistoryItem & { url: string } => !!item.url,
  );
  const visits: HistoryVisit[] = [];
  let nextIndex = 0;
  let failed = false;
  let completed = 0;
  let lastProgress = performance.now();
  onProgress?.({ completed, total: history.length });

  async function worker(): Promise<void> {
    while (!failed && nextIndex < history.length) {
      signal?.throwIfAborted();
      const item = history[nextIndex++];

      try {
        let urlVisits: chrome.history.VisitItem[];
        try {
          urlVisits = await getVisits(item.url);
        } catch (error) {
          signal?.throwIfAborted();
          if (failed) throw error;
          // At high URL counts, retry one transient failure locally instead of
          // forcing the user to repeat an otherwise successful full-history load.
          urlVisits = await getVisits(item.url);
        }
        signal?.throwIfAborted();
        if (failed) return;
        for (const visit of urlVisits) {
          visits.push({
            visitId: visit.visitId,
            visitTime: visit.visitTime,
            url: item.url,
            title: item.title,
          });
        }
        completed++;
        const now = performance.now();
        if (completed === history.length || now - lastProgress >= 100) {
          onProgress?.({ completed, total: history.length });
          lastProgress = now;
        }
      } catch (error) {
        // A persistent failure still rejects the load: incomplete counts would
        // misrepresent browsing activity. Already-issued Chrome calls may finish.
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

export function getHistory(
  filter: string = "",
  options: HistoryLoadOptions = {},
): Promise<HistoryVisit[]> {
  return withCancellation(loadHistory(filter, options), options.signal);
}

// History events already supply URL metadata; reuse the bounded, retrying visit
// loader without searching and expanding the entire browsing history again.
export function getHistoryForUrls(
  items: chrome.history.HistoryItem[],
  options: HistoryLoadOptions = {},
): Promise<HistoryVisit[]> {
  return withCancellation(loadVisits(items, options), options.signal);
}

function withCancellation(
  load: Promise<HistoryVisit[]>,
  signal?: AbortSignal,
): Promise<HistoryVisit[]> {
  if (!signal) return load;

  // Chrome cannot cancel an issued IPC call. Reject promptly on cancellation;
  // the workers check the signal before queuing any further work or retrying.
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    load.then(
      (visits) => { signal.removeEventListener("abort", abort); resolve(visits); },
      (error) => { signal.removeEventListener("abort", abort); reject(error); },
    );
  });
}

export function filterHistory(history: HistoryVisit[], query: string): HistoryVisit[] {
  if (!query) return history;
  const normalized = query.toLowerCase();
  const matchesByUrl = new Map<string, boolean>();
  return history.filter((visit) => {
    let matches = matchesByUrl.get(visit.url);
    if (matches === undefined) {
      // Every visit to a URL shares its latest title and URL metadata.
      matches = !!visit.title?.toLowerCase().includes(normalized) ||
        visit.url.toLowerCase().includes(normalized);
      matchesByUrl.set(visit.url, matches);
    }
    return matches;
  });
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
    if (!globalThis.chrome?.history) {
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
