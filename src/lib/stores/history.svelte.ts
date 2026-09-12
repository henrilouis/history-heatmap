import {
  getHistory,
  getHistoryForUrls,
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
import { mergeHistoryVisits } from "../utils/history-merge";

// ============================================
// Core State
// ============================================

// Visits are immutable; avoid creating a reactive proxy for every visit object.
let rawHistory = $state.raw<HistoryVisit[]>([]);
let searchQuery = $state("");
let selectedMoments = $state<string[]>([]);
let isLoading = $state(false);
let error = $state<string | null>(null);
let syncError = $state<string | null>(null);
const failedSyncUrls = new Set<string>();
let hasSnapshot = false;
let progress = $state<HistoryLoadProgress | null>(null);
let requestId = 0;
let currentLoad: AbortController | undefined;
let removedDuringLoad = new Set<string>();
let subscribers = 0;
let removeListeners: (() => void) | undefined;
const pendingVisits = new Map<string, chrome.history.HistoryItem>();
let currentSync: {
  controller: AbortController;
  invalidated: Set<string>;
} | undefined;

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
  // The new snapshot supersedes earlier incremental reads. Events received
  // after it starts are queued and reconciled once the snapshot settles.
  stopSync();
  hasSnapshot = false;
  failedSyncUrls.clear();
  syncError = null;
  removedDuringLoad = new Set();
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
    if (id === requestId) {
      rawHistory = removedDuringLoad.size
        ? visits.filter((visit) => !removedDuringLoad.has(visit.url))
        : visits;
      hasSnapshot = true;
    }
  } catch (e) {
    if (id === requestId) {
      error = e instanceof Error ? e.message : "Failed to fetch history";
      rawHistory = [];
      pendingVisits.clear();
    }
  } finally {
    if (id === requestId) {
      isLoading = false;
      progress = null;
      currentLoad = undefined;
      removedDuringLoad.clear();
      void reconcileVisits();
    }
  }
}

function cancelFetch(): void {
  if (!currentLoad) return;
  stopFetch();
  pendingVisits.clear();
  error = "History loading cancelled. Retry to load your visits.";
  void reconcileVisits();
}

function stopFetch(): void {
  if (currentLoad) {
    requestId++;
    currentLoad.abort();
  }
  currentLoad = undefined;
  removedDuringLoad.clear();
  isLoading = false;
  progress = null;
}

function stopSync(): void {
  currentSync?.controller.abort();
  currentSync = undefined;
  pendingVisits.clear();
}

function onVisited(item: chrome.history.HistoryItem): void {
  if (!item.url) return;
  // Without a complete baseline, a single URL would produce partial counts.
  // A later full Retry will pick up events ignored after failure/cancellation.
  if (!currentLoad && !hasSnapshot) return;
  currentSync?.invalidated.add(item.url);
  pendingVisits.set(item.url, item);
  void reconcileVisits();
}

async function reconcileVisits(): Promise<void> {
  // Serialize batches with the full load to keep the same bounded worker pool.
  // Repeated events for a URL coalesce while another batch/load is in flight.
  if (!subscribers || !hasSnapshot || currentLoad || currentSync || !pendingVisits.size) return;
  const items = [...pendingVisits.values()];
  pendingVisits.clear();
  const sync = { controller: new AbortController(), invalidated: new Set<string>() };
  currentSync = sync;
  try {
    const visits = await getHistoryForUrls(items, { signal: sync.controller.signal });
    if (currentSync !== sync) return;
    const urls = new Set(items.map((item) => item.url!).filter((url) => !sync.invalidated.has(url)));
    if (!urls.size) return;
    rawHistory = mergeHistoryVisits(rawHistory, visits, urls);
    for (const url of urls) failedSyncUrls.delete(url);
    updateSyncError();
  } catch {
    if (currentSync === sync) {
      for (const item of items) {
        if (!sync.invalidated.has(item.url!)) failedSyncUrls.add(item.url!);
      }
      updateSyncError();
    }
  } finally {
    if (currentSync === sync) {
      currentSync = undefined;
      void reconcileVisits();
    }
  }
}

function updateSyncError(): void {
  syncError = failedSyncUrls.size
    ? "Some recent visits could not be refreshed. Showing previously loaded history."
    : null;
}

function onVisitRemoved(removed: chrome.history.RemovedResult): void {
  if (removed.allHistory) {
    stopFetch();
    stopSync();
    rawHistory = [];
    selectedMoments = [];
    // Chrome has supplied an authoritative empty snapshot. Earlier load/sync
    // failures no longer apply, and future visits can be reconciled from empty.
    hasSnapshot = true;
    error = null;
    failedSyncUrls.clear();
    updateSyncError();
    return;
  }
  const urls = new Set(removed.urls ?? []);
  if (!urls.size) return;
  for (const url of urls) {
    // A full snapshot or incremental request may already contain this URL.
    // Suppress its old results even if Chrome delivers them after this event.
    if (currentLoad) removedDuringLoad.add(url);
    currentSync?.invalidated.add(url);
    pendingVisits.delete(url);
    failedSyncUrls.delete(url);
  }
  updateSyncError();
  rawHistory = rawHistory.filter((visit) => !urls.has(visit.url));
}

function connect(): () => void {
  if (subscribers++ === 0) {
    const api = globalThis.chrome?.history;
    if (api) {
      api.onVisited.addListener(onVisited);
      api.onVisitRemoved.addListener(onVisitRemoved);
      removeListeners = () => {
        api.onVisited.removeListener(onVisited);
        api.onVisitRemoved.removeListener(onVisitRemoved);
      };
    }
    // Register listeners before searching, so initial-load mutations are seen.
    // Without the API, fetch surfaces the existing unavailable-API error.
    void fetch();
  }
  let disconnected = false;
  return () => {
    if (disconnected) return;
    disconnected = true;
    if (--subscribers === 0) {
      // No live consumer remains. A later first subscriber starts a fresh load;
      // disconnecting one of several consumers must not interrupt their load.
      removeListeners?.();
      removeListeners = undefined;
      stopFetch();
      stopSync();
      hasSnapshot = false;
    }
  };
}

async function removeUrl(url: string): Promise<void> {
  try {
    await deleteUrl(url);
    // Chrome also emits onVisitRemoved; applying the same removal is idempotent.
    onVisitRemoved({ allHistory: false, urls: [url] });
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
  get syncError() {
    return syncError;
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
  connect,
  fetch,
  cancelFetch,
  removeUrl,
  setSearch,
  toggleMoment,
  clearSelection,
  getItemsForMoment,
};
