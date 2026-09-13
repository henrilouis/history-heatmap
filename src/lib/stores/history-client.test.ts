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

describe("reactive views after search changes", () => {
  it.each([
    { name: "matching only the middle day", query: "public", total: 1, sensitiveCount: 0, publicCount: 1 },
    { name: "matching nothing", query: "no match", total: 0, sensitiveCount: 0, publicCount: 0 },
    { name: "clearing the query", query: "", total: 3, sensitiveCount: 1, publicCount: 1 },
  ])("preserves both unfiltered calendar ranges when $name", ({ query, total, sensitiveCount, publicCount }) => {
    const dayKeys = [
      "2026-09-07", "2026-09-08", "2026-09-09",
      "2026-09-10", "2026-09-11", "2026-09-12",
    ];
    const hourDayKeys = ["2026-09-10", "2026-09-11", "2026-09-12"];
    // Evaluate a different active search first, including for the clear case.
    store.setSearch("sensitive");
    expect(store.filtered).toHaveLength(2);
    expect(Object.keys(store.byDayWithEmpty).sort()).toEqual(dayKeys);
    expect(Object.keys(store.byDayAndHourWithEmpty).sort()).toEqual(hourDayKeys);
    expect(store.byDayWithEmpty["2026-09-10"]).toHaveLength(1);
    expect(store.byDayAndHourWithEmpty["2026-09-12"]?.["09"]).toHaveLength(1);

    store.setSearch(query);

    expect(store.filtered).toHaveLength(total);
    expect(Object.keys(store.byDayWithEmpty).sort()).toEqual(dayKeys);
    expect(Object.keys(store.byDayAndHourWithEmpty).sort()).toEqual(hourDayKeys);
    expect(store.byDayWithEmpty["2026-09-10"]).toHaveLength(sensitiveCount);
    expect(store.byDayAndHourWithEmpty["2026-09-12"]?.["09"]).toHaveLength(sensitiveCount);
    expect(store.byDayWithEmpty["2026-09-11"]).toHaveLength(publicCount);
    expect(store.getItemsForMoment("2026-09-11T14")).toHaveLength(publicCount);
  });
});

describe("reactive views after history events", () => {
  it.each([
    {
      query: "renamed",
      initial: { visitIds: [], olderDayCount: 0, newerHourCount: 0 },
      updated: { visitIds: ["revisit", "sensitive-new", "sensitive-old"], olderDayCount: 1, newerHourCount: 2 },
    },
    {
      query: "sensitive title",
      initial: { visitIds: ["sensitive-new", "sensitive-old"], olderDayCount: 1, newerHourCount: 1 },
      updated: { visitIds: [], olderDayCount: 0, newerHourCount: 0 },
    },
  ])("re-evaluates every visit's title match for an active '$query' search", async ({ query, initial, updated }) => {
    store.setSearch(query);
    expect(store.filtered.map((visit) => visit.visitId)).toEqual(initial.visitIds);
    expect(store.byDay["2026-09-10"]?.length ?? 0).toBe(initial.olderDayCount);
    expect(store.byDayAndHour["2026-09-12"]?.["09"]?.length ?? 0).toBe(initial.newerHourCount);
    expect(store.byDayWithEmpty["2026-09-10"]).toHaveLength(initial.olderDayCount);
    expect(store.byDayAndHourWithEmpty["2026-09-12"]?.["09"]).toHaveLength(initial.newerHourCount);
    const dayKeys = Object.keys(store.byDayWithEmpty).sort();
    const hourDayKeys = Object.keys(store.byDayAndHourWithEmpty).sort();
    visitsByUrl.set(sensitiveUrl, [
      ...visitsByUrl.get(sensitiveUrl)!,
      chromeVisit("revisit", new Date(2026, 8, 12, 9, 30)),
    ]);

    visited({ id: "sensitive", url: sensitiveUrl, title: "Renamed page" });

    await vi.waitFor(() => expect(store.raw).toHaveLength(4));
    expect(store.filtered.map((visit) => visit.visitId)).toEqual(updated.visitIds);
    expect(store.byDay["2026-09-10"]?.length ?? 0).toBe(updated.olderDayCount);
    expect(store.byDay["2026-09-12"]?.length ?? 0).toBe(updated.newerHourCount);
    expect(store.byDayAndHour["2026-09-12"]?.["09"]?.length ?? 0).toBe(updated.newerHourCount);
    expect(store.byDayWithEmpty["2026-09-10"]).toHaveLength(updated.olderDayCount);
    expect(store.byDayAndHourWithEmpty["2026-09-12"]?.["09"]).toHaveLength(updated.newerHourCount);
    expect(Object.keys(store.byDayWithEmpty).sort()).toEqual(dayKeys);
    expect(Object.keys(store.byDayAndHourWithEmpty).sort()).toEqual(hourDayKeys);
  });

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
