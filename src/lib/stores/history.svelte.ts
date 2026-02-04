import {
  getHistory,
  groupHistoryByDay,
  groupHistoryByDayAndHour,
  fillEmptyDays,
  fillEmptyHours,
  deleteUrl,
  type HistoryByDay,
  type HistoryByDayAndHour,
} from "../utils/chrome-api";

// ============================================
// Core State
// ============================================

let rawHistory = $state<chrome.history.HistoryItem[]>([]);
let searchQuery = $state("");
let selectedMoments = $state<string[]>([]);
let isLoading = $state(false);
let error = $state<string | null>(null);

// ============================================
// Derived State
// ============================================

const filtered = $derived.by(() => {
  if (!searchQuery) return rawHistory;
  const query = searchQuery.toLowerCase();
  return rawHistory.filter(
    (item) =>
      item.title?.toLowerCase().includes(query) ||
      item.url?.toLowerCase().includes(query),
  );
});

const byDay = $derived<HistoryByDay>(groupHistoryByDay(filtered));

const byDayWithEmpty = $derived<HistoryByDay>(
  fillEmptyDays({ ...byDay }, rawHistory),
);

const byDayAndHour = $derived<HistoryByDayAndHour>(
  groupHistoryByDayAndHour(filtered),
);

const byDayAndHourWithEmpty = $derived<HistoryByDayAndHour>(
  fillEmptyHours({ ...byDayAndHour }, rawHistory),
);

// ============================================
// Actions
// ============================================

async function fetch(): Promise<void> {
  isLoading = true;
  error = null;
  try {
    rawHistory = await getHistory();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch history";
    rawHistory = [];
  } finally {
    isLoading = false;
  }
}

async function removeUrl(url: string): Promise<void> {
  try {
    await deleteUrl(url);
    rawHistory = rawHistory.filter((item) => item.url !== url);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to delete URL";
  }
}

function setSearch(query: string): void {
  searchQuery = query;
}

function toggleMoment(date: string): void {
  const index = selectedMoments.indexOf(date);
  if (index === -1) {
    selectedMoments = [...selectedMoments, date].sort().reverse();
  } else {
    selectedMoments = selectedMoments.filter((_, i) => i !== index);
  }
}

function clearSelection(): void {
  selectedMoments = [];
}

// Helper to get history items for a selected moment (works for both day and hour keys)
function getItemsForMoment(key: string): chrome.history.HistoryItem[] {
  // Hour key format: "2024-01-15T14"
  // Day key format: "2024-01-15"
  if (key.includes("T")) {
    const [date, hour] = key.split("T");
    return byDayAndHour[date]?.[hour] ?? [];
  }
  return byDay[key] ?? [];
}

// ============================================
// Export Store
// ============================================

export const historyStore = {
  // Raw state (read-only getters)
  get raw() {
    return rawHistory;
  },
  get search() {
    return searchQuery;
  },
  get selectedMoments() {
    return selectedMoments;
  },
  get isLoading() {
    return isLoading;
  },
  get error() {
    return error;
  },

  // Derived state (computed)
  get filtered() {
    return filtered;
  },
  get byDay() {
    return byDay;
  },
  get byDayWithEmpty() {
    return byDayWithEmpty;
  },
  get byDayAndHour() {
    return byDayAndHour;
  },
  get byDayAndHourWithEmpty() {
    return byDayAndHourWithEmpty;
  },

  // Actions
  fetch,
  removeUrl,
  setSearch,
  toggleMoment,
  clearSelection,
  getItemsForMoment,
};
