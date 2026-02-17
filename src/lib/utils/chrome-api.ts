// Todo: after Jan 7 replace date with temporal API which should be in chrome then

export async function getHistory(filter: string = "") {
  return new Promise<chrome.history.HistoryItem[]>((resolve, reject) => {
    if (!chrome?.history) {
      reject(new Error("Chrome history API not available"));
      return;
    }
    chrome.history.search(
      { text: filter, maxResults: 9999999, startTime: 0 },
      (results: chrome.history.HistoryItem[]) => {
        resolve(results);
      },
    );
  });
}

// Helper to get date key
function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

// Fill empty days in a date range
export function fillEmptyDays(
  grouped: HistoryByDay,
  allHistory: chrome.history.HistoryItem[],
): HistoryByDay {
  const timestamps = allHistory
    .map((item) => item.lastVisitTime)
    .filter((t): t is number => t !== undefined);

  if (timestamps.length === 0) return grouped;

  const startDate = new Date(Math.min(...timestamps));
  const endDate = new Date(Math.max(...timestamps));

  // Adjust to start on Monday
  startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));

  // Fill all days in range
  for (
    let current = new Date(startDate);
    current <= endDate;
    current.setDate(current.getDate() + 1)
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
  const timestamps = allHistory
    .map((item) => item.lastVisitTime)
    .filter((t): t is number => t !== undefined);

  if (timestamps.length === 0) return grouped;

  const startDate = new Date(Math.min(...timestamps));
  const endDate = new Date(Math.max(...timestamps));

  // Fill all days and hours in range
  for (
    let current = new Date(startDate);
    current <= endDate;
    current.setDate(current.getDate() + 1)
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
