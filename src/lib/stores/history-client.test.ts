import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chromeVisit } from "../utils/history-fixtures";

// The client Vitest project uses jsdom and browser resolution so these imports
// exercise Svelte reactivity rather than the one-time SSR derived expressions.
let store: typeof import("./history.svelte").historyStore;
let disconnect: () => void;
let removed: (event: chrome.history.RemovedResult) => void;
let visited: (item: chrome.history.HistoryItem) => void;
let visitsByUrl: Map<string, chrome.history.VisitItem[]>;
const sensitiveUrl = "https://example.com/sensitive";
const publicUrl = "https://example.com/public";

beforeEach(async () => {
  visitsByUrl = new Map([
    [sensitiveUrl, [
      chromeVisit("sensitive-old", new Date(2026, 8, 10, 18)),
      chromeVisit("sensitive-new", new Date(2026, 8, 12, 9)),
    ]],
    [publicUrl, [chromeVisit("public", new Date(2026, 8, 11, 14))]],
  ]);
  const chromeApi = {
    runtime: {},
    history: {
      search: (_query: chrome.history.HistoryQuery, callback: (items: chrome.history.HistoryItem[]) => void) => {
        callback([
          { id: "sensitive", url: sensitiveUrl, title: "Sensitive title" },
          { id: "public", url: publicUrl, title: "Public title" },
        ]);
      },
      getVisits: ({ url }: chrome.history.UrlDetails, callback: (visits: chrome.history.VisitItem[]) => void) => {
        callback(visitsByUrl.get(url) ?? []);
      },
      onVisitRemoved: {
        addListener: (listener: typeof removed) => { removed = listener; },
        removeListener: vi.fn(),
      },
      onVisited: {
        addListener: (listener: typeof visited) => { visited = listener; },
        removeListener: vi.fn(),
      },
    },
  };
  vi.stubGlobal("chrome", chromeApi);
  vi.resetModules();
  ({ historyStore: store } = await import("./history.svelte"));
  disconnect = store.connect();
  await vi.waitFor(() => expect(store.raw).toHaveLength(3));
});

afterEach(() => disconnect?.());

describe("reactive views after history events", () => {
  it("removes deleted records from an already evaluated search and both calendar views", () => {
    store.setSearch("sensitive");
    expect(store.filtered).toHaveLength(2);
    expect(store.byDay["2026-09-10"]).toHaveLength(1);
    expect(store.byDayAndHour["2026-09-12"]?.["09"]).toHaveLength(1);
    expect(store.byDayWithEmpty["2026-09-12"]).toHaveLength(1);
    expect(store.byDayAndHourWithEmpty["2026-09-12"]?.["09"]).toHaveLength(1);

    removed({ allHistory: false, urls: [sensitiveUrl] });

    expect(store.raw.map((visit) => visit.url)).toEqual([publicUrl]);
    expect(store.filtered).toEqual([]);
    expect(store.byDay).toEqual({});
    expect(store.byDayAndHour).toEqual({});
    expect(store.byDayWithEmpty["2026-09-12"]).toBeUndefined();
    expect(store.byDayAndHourWithEmpty["2026-09-12"]).toBeUndefined();
    expect(store.getItemsForMoment("2026-09-10")).toEqual([]);
    expect(store.getItemsForMoment("2026-09-12T09")).toEqual([]);
    store.setSearch("");
    expect(store.filtered.map((visit) => visit.url)).toEqual([publicUrl]);
  });

  it("clears all records, cached derived views, and selection on allHistory", () => {
    store.toggleMoment("2026-09-12");
    expect(store.filtered).toHaveLength(3);
    expect(Object.keys(store.byDay)).toHaveLength(3);
    expect(Object.keys(store.byDayAndHour)).toHaveLength(3);
    expect(Object.keys(store.byDayWithEmpty)).toHaveLength(6);
    expect(Object.keys(store.byDayAndHourWithEmpty)).toHaveLength(3);

    removed({ allHistory: true });

    expect(store.raw).toEqual([]);
    expect(store.filtered).toEqual([]);
    expect(store.byDay).toEqual({});
    expect(store.byDayAndHour).toEqual({});
    expect(store.byDayWithEmpty).toEqual({});
    expect(store.byDayAndHourWithEmpty).toEqual({});
    expect(store.selectedMoments).toEqual([]);
    expect(store.getItemsForMoment("2026-09-12")).toEqual([]);
  });

  it("adds a new URL to an active search and extends the day/hour views", async () => {
    store.setSearch("new page");
    expect(store.filtered).toEqual([]);
    expect(store.byDayWithEmpty["2026-09-13"]).toBeUndefined();
    expect(store.byDayAndHourWithEmpty["2026-09-13"]).toBeUndefined();
    const url = "https://example.com/new";
    visitsByUrl.set(url, [chromeVisit("new", new Date(2026, 8, 13, 8))]);

    visited({ id: "new-url", url, title: "New page" });

    await vi.waitFor(() => expect(store.filtered).toHaveLength(1));
    expect(store.raw).toHaveLength(4);
    expect(store.byDay["2026-09-13"]?.[0].visitId).toBe("new");
    expect(store.byDayAndHour["2026-09-13"]?.["08"]?.[0].visitId).toBe("new");
    expect(store.byDayWithEmpty["2026-09-13"]).toHaveLength(1);
    expect(store.byDayAndHourWithEmpty["2026-09-13"]?.["08"]).toHaveLength(1);
  });
});
