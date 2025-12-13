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
      }
    );
  });
}

export type HistoryByDay = {
  [day: string]: chrome.history.HistoryItem[];
};

export async function getHistoryByDay(
  filter: string = "",
  emptyDays: boolean = false
): Promise<HistoryByDay> {
  const getDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const history = await getHistory(filter);
  const grouped: HistoryByDay = {};

  // Group history items by day
  for (const item of history) {
    if (!item.lastVisitTime) continue;

    const dayKey = getDateKey(new Date(item.lastVisitTime));
    (grouped[dayKey] ??= []).push(item);
  }

  // Determine date range and fill empty days if needed
  if (emptyDays) {
    const allHistory = filter ? await getHistory("") : history;
    const timestamps = allHistory
      .map((item) => item.lastVisitTime)
      .filter((t): t is number => t !== undefined);

    if (timestamps.length > 0) {
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
    }
  }

  // Sort items within each day (newest first)
  for (const items of Object.values(grouped)) {
    items.sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));
  }

  return grouped;
}

export async function deleteHistoryUrl(url: string): Promise<void> {
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

export function getFaviconURL(u: string) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", u);
  url.searchParams.set("size", "16");
  return url.toString();
}
