import { getDateKey } from "./date";

export async function getHistory(filter: string = "") {
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

// Helper to get hour key
function getHourKey(date: Date): string {
  return String(date.getHours()).padStart(2, "0");
}

export type HistoryByDay = {
  [day: string]: chrome.history.HistoryItem[];
};

export type HistoryByDayAndHour = {
  [day: string]: {
    [hour: string]: chrome.history.HistoryItem[];
  };
};

// Pure grouping function - works on already-fetched data
export function groupHistoryByDay(
  history: chrome.history.HistoryItem[],
): HistoryByDay {
  const grouped: HistoryByDay = {};

  for (const item of history) {
    if (!item.lastVisitTime) continue;
    const dayKey = getDateKey(new Date(item.lastVisitTime));
    (grouped[dayKey] ??= []).push(item);
  }

  // Sort items within each day (newest first)
  for (const items of Object.values(grouped)) {
    items.sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));
  }

  return grouped;
}

// Pure grouping function - by day and hour
export function groupHistoryByDayAndHour(
  history: chrome.history.HistoryItem[],
): HistoryByDayAndHour {
  const grouped: HistoryByDayAndHour = {};

  for (const item of history) {
    if (!item.lastVisitTime) continue;
    const date = new Date(item.lastVisitTime);
    const dayKey = getDateKey(date);
    const hourKey = getHourKey(date);

    (grouped[dayKey] ??= {})[hourKey] ??= [];
    grouped[dayKey][hourKey].push(item);
  }

  // Sort items within each hour (newest first)
  for (const day of Object.values(grouped)) {
    for (const items of Object.values(day)) {
      items.sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));
    }
  }

  return grouped;
}

// Scan bounds without allocating a timestamp array or spreading it into a call.
function getHistoryDateRange(history: chrome.history.HistoryItem[]) {
  let earliest = Infinity;
  let latest = -Infinity;

  for (const { lastVisitTime } of history) {
    if (lastVisitTime === undefined) continue;
    if (lastVisitTime < earliest) earliest = lastVisitTime;
    if (lastVisitTime > latest) latest = lastVisitTime;
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
  allHistory: chrome.history.HistoryItem[],
): HistoryByDay {
  const range = getHistoryDateRange(allHistory);
  if (!range) return grouped;
  const { startDate, endDate } = range;

  // Adjust to start on Monday
  startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));

  // Construct each local midnight afresh: a midnight DST jump must not carry
  // an hour offset into subsequent days and exclude the final date.
  for (
    let current = new Date(startDate);
    current <= endDate;
    current = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + 1,
    )
  ) {
    grouped[getDateKey(current)] ??= [];
  }

  return grouped;
}

// Fill empty hours (00-23) for each day
export function fillEmptyHours(
  grouped: HistoryByDayAndHour,
  allHistory: chrome.history.HistoryItem[],
): HistoryByDayAndHour {
  const range = getHistoryDateRange(allHistory);
  if (!range) return grouped;
  const { startDate, endDate } = range;

  // Fill all days and hours in range
  for (
    let current = new Date(startDate);
    current <= endDate;
    current = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + 1,
    )
  ) {
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
