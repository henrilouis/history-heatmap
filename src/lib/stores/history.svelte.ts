import {
  getHistory,
  filterHistory,
  groupHistoryByDay,
  groupHistoryByDayAndHour,
  fillEmptyDays,
  fillEmptyHours,
  deleteUrl,
  type HistoryByDay,
  type HistoryByDayAndHour,
  type HistoryVisit,
  type HistoryLoadProgress,
} from "../utils/chrome-api";

// ============================================
// Core State
// ============================================

// Visits are immutable; avoid creating a reactive proxy for every visit object.
let rawHistory = $state.raw<HistoryVisit[]>([]);
let searchQuery = $state("");
let selectedMoments = $state<string[]>([]);
let isLoading = $state(false);
let error = $state<string | null>(null);
let progress = $state<HistoryLoadProgress | null>(null);
let requestId = 0;
let currentLoad: AbortController | undefined;

// ============================================
// Derived State
// ============================================

const filtered = $derived(filterHistory(rawHistory, searchQuery));

const byDay = $derived<HistoryByDay>(groupHistoryByDay(filtered));

const byDayWithEmpty = $derived<HistoryByDay>(
  fillEmptyDays({ ...byDay }, rawHistory)
);

const byDayAndHour = $derived<HistoryByDayAndHour>(
  groupHistoryByDayAndHour(filtered)
);

const byDayAndHourWithEmpty = $derived<HistoryByDayAndHour>(
  fillEmptyHours({ ...byDayAndHour }, rawHistory)
);

// ============================================
// Actions
// ============================================

async function fetch(): Promise<void> {
  const id = ++requestId;
  currentLoad?.abort();
  const controller = new AbortController();
  currentLoad = controller;
  isLoading = true;
  error = null;
  progress = null;
  try {
    const visits = await getHistory("", {
      signal: controller.signal,
      onProgress: (value) => { if (id === requestId) progress = value; },
    });
    if (id === requestId) rawHistory = visits;
  } catch (e) {
    if (id === requestId) {
      error = e instanceof Error ? e.message : "Failed to fetch history";
      rawHistory = [];
    }
  } finally {
    if (id === requestId) {
      isLoading = false;
      progress = null;
      currentLoad = undefined;
    }
  }
}

function cancelFetch(): void {
  if (!currentLoad) return;
  requestId++;
  currentLoad.abort();
  currentLoad = undefined;
  isLoading = false;
  progress = null;
  error = "History loading cancelled. Retry to load your visits.";
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
function getItemsForMoment(key: string): HistoryVisit[] {
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
  get progress() {
    return progress;
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
  cancelFetch,
  removeUrl,
  setSearch,
  toggleMoment,
  clearSelection,
  getItemsForMoment,
};
