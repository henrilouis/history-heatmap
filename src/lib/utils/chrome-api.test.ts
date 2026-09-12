import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteUrl,
  getHistory,
  groupHistoryByDay,
  groupHistoryByDayAndHour,
  fillEmptyDays,
} from "./chrome-api";
import { historyVisit } from "./history-fixtures";

// Chrome can omit results when a callback reports runtime.lastError.
type SearchCallback = (results?: chrome.history.HistoryItem[]) => void;
type VisitsCallback = (results?: chrome.history.VisitItem[]) => void;

const search = vi.fn<
  (query: chrome.history.HistoryQuery, callback: SearchCallback) => void
>();
const getVisits = vi.fn<
  (details: chrome.history.UrlDetails, callback: VisitsCallback) => void
>();
const deleteHistoryUrl = vi.fn<
  (details: chrome.history.UrlDetails, callback: () => void) => void
>();
let runtime: { lastError?: chrome.runtime.LastError };

function completeCallback(
  callback: () => void,
  error?: chrome.runtime.LastError,
) {
  // lastError is only available while the Chrome API callback executes.
  runtime.lastError = error;
  try {
    callback();
  } finally {
    delete runtime.lastError;
  }
}

function completeSearch(
  results?: chrome.history.HistoryItem[],
  error?: chrome.runtime.LastError,
) {
  const [, callback] = search.mock.lastCall!;
  completeCallback(() => callback(results), error);
}

function completeDeletion(error?: chrome.runtime.LastError) {
  const [, callback] = deleteHistoryUrl.mock.lastCall!;
  completeCallback(callback, error);
}

beforeEach(() => {
  runtime = {};
  vi.stubGlobal("chrome", {
    history: { search, getVisits, deleteUrl: deleteHistoryUrl },
    runtime,
  });
});

describe("getHistory", () => {
  const records: chrome.history.HistoryItem[] = [
    {
      id: "1",
      url: "https://example.com/",
      title: "Example",
      lastVisitTime: new Date(2026, 8, 12, 14).getTime(),
      visitCount: 25,
    },
  ];

  const older = historyVisit("older", new Date(2026, 8, 10, 18), { id: "1" });
  const early = historyVisit("early", new Date(2026, 8, 12, 9, 5), { id: "1" });
  const late = historyVisit("late", new Date(2026, 8, 12, 9, 45), { id: "1" });
  const nextHour = historyVisit("next-hour", new Date(2026, 8, 12, 14), { id: "1" });
  const visits = [early, older, nextHour, late];
  const expected = [nextHour, late, early, older].map((visit) => ({
    ...visit,
    url: "https://example.com/",
    title: "Example",
  }));

  beforeEach(() => {
    getVisits.mockImplementation((_details, callback) => {
      completeCallback(() => callback(visits));
    });
  });

  it("returns individual visits with URL metadata, newest-first, and forwards the filter", async () => {
    const result = getHistory("example");

    expect(search).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ text: "example", startTime: 0 }),
      expect.any(Function),
    );
    completeSearch(records);

    await expect(result).resolves.toEqual(expected);
    expect(getVisits).toHaveBeenCalledExactlyOnceWith(
      { url: "https://example.com/" },
      expect.any(Function),
    );
  });

  it("counts repeated visits in their own days and hours instead of the URL's latest time", async () => {
    const result = getHistory();
    completeSearch(records);
    const history = await result;

    expect(history).toHaveLength(4);
    expect(groupHistoryByDay(history)).toEqual({
      "2026-09-12": expected.slice(0, 3),
      "2026-09-10": [expected[3]],
    });
    expect(groupHistoryByDayAndHour(history)).toEqual({
      "2026-09-12": { "14": [expected[0]], "09": [expected[1], expected[2]] },
      "2026-09-10": { "18": [expected[3]] },
    });
    // The unfiltered calendar range must include earlier visits to this same URL.
    expect(Object.keys(fillEmptyDays({}, history)).sort()).toEqual([
      "2026-09-07", "2026-09-08", "2026-09-09",
      "2026-09-10", "2026-09-11", "2026-09-12",
    ]);
  });

  it("keeps earlier activity after revisiting a URL", async () => {
    const initial = getHistory();
    completeSearch(records);
    const before = groupHistoryByDayAndHour(await initial);
    const revisit = historyVisit("revisit", new Date(2026, 8, 13, 8), { id: "1" });
    getVisits.mockImplementation((_details, callback) => {
      completeCallback(() => callback([...visits, revisit]));
    });

    const refreshed = getHistory();
    completeSearch([{ ...records[0], lastVisitTime: revisit.visitTime, visitCount: 26 }]);
    const after = groupHistoryByDayAndHour(await refreshed);

    expect(after["2026-09-10"]).toEqual(before["2026-09-10"]);
    expect(after["2026-09-12"]).toEqual(before["2026-09-12"]);
    expect(after["2026-09-13"]?.["08"]).toEqual([
      { ...revisit, url: "https://example.com/", title: "Example" },
    ]);
  });

  it("does not invent visits when a URL has no visit records", async () => {
    getVisits.mockImplementation((_details, callback) => {
      completeCallback(() => callback([]));
    });
    const result = getHistory();
    completeSearch(records);

    await expect(result).resolves.toEqual([]);
  });

  it("skips search records without URLs and supports missing titles and latest timestamps", async () => {
    const result = getHistory();
    completeSearch([{ id: "missing-url" }, { id: "1", url: "https://example.com/" }]);

    await expect(result).resolves.toEqual(expected.map((visit) => ({ ...visit, title: undefined })));
    expect(getVisits).toHaveBeenCalledTimes(1);
  });

  it("resolves an empty history as an empty array", async () => {
    const result = getHistory();

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ text: "" }),
      expect.any(Function),
    );
    completeSearch([]);

    await expect(result).resolves.toEqual([]);
    expect(getVisits).not.toHaveBeenCalled();
  });

  it("rejects with the API error when the callback has no results", async () => {
    const result = getHistory();
    completeSearch(undefined, { message: "History service unavailable" });

    await expect(result).rejects.toThrow("History service unavailable");
    expect(getVisits).not.toHaveBeenCalled();
  });

  it("allows a successful retry after an API failure", async () => {
    const failed = getHistory();
    completeSearch(undefined, { message: "Temporary history failure" });
    await expect(failed).rejects.toThrow("Temporary history failure");

    const retried = getHistory();
    completeSearch(records);

    await expect(retried).resolves.toEqual(expected);
  });

  it("rejects visit API failures with a useful error and allows a successful retry", async () => {
    getVisits.mockImplementationOnce((_details, callback) => {
      completeCallback(() => callback(undefined), { message: "Visit service unavailable" });
    });
    const failed = getHistory();
    completeSearch(records);

    await expect(failed).rejects.toThrow("Failed to retrieve history visits: Visit service unavailable");

    const retried = getHistory();
    completeSearch(records);
    await expect(retried).resolves.toEqual(expected);
  });

  it.each([undefined, {}])(
    "rejects when Chrome history is unavailable (%j)",
    async (chromeApi) => {
      vi.stubGlobal("chrome", chromeApi);

      await expect(getHistory()).rejects.toThrow(
        "Chrome history API not available",
      );
      expect(search).not.toHaveBeenCalled();
    },
  );
});

describe("visit request scheduling", () => {
  const records = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    url: `https://example.com/${i}`,
    title: `Page ${i}`,
  }));

  it("limits in-flight requests to eight and sorts visits independently of completion order", async () => {
    const pending = new Map<string, VisitsCallback>();
    let peak = 0;
    getVisits.mockImplementation(({ url }, callback) => {
      pending.set(url, callback);
      peak = Math.max(peak, pending.size);
    });

    const result = getHistory();
    completeSearch(records);
    await Promise.resolve();
    expect(pending.size).toBe(8);

    // Complete the newest queued request first, deliberately scrambling results.
    while (pending.size > 0) {
      const url = [...pending.keys()].at(-1)!;
      const callback = pending.get(url)!;
      pending.delete(url);
      const index = records.findIndex((record) => record.url === url);
      const visit = historyVisit(`visit-${index}`, new Date(2026, 8, 12, index), {
        id: records[index].id,
      });
      completeCallback(() => callback([visit]));
      await Promise.resolve();
    }

    const visits = await result;
    expect(peak).toBe(8);
    expect(getVisits).toHaveBeenCalledTimes(records.length);
    expect(getVisits.mock.calls.map(([details]) => details.url).sort()).toEqual(
      records.map((record) => record.url).sort(),
    );
    expect(visits.map((visit) => visit.visitId)).toEqual(
      records.map((_, i) => `visit-${i}`).reverse(),
    );
    expect(visits.map((visit) => visit.url)).toEqual(records.map((record) => record.url).reverse());
  });

  it("rejects partial loads and stops scheduling new requests after a failure", async () => {
    const pending: VisitsCallback[] = [];
    getVisits.mockImplementation((_details, callback) => pending.push(callback));
    const result = getHistory();
    const rejected = expect(result).rejects.toThrow("Visit request failed");
    completeSearch(records);
    await Promise.resolve();
    expect(getVisits).toHaveBeenCalledTimes(8);

    const successful = pending.shift()!;
    completeCallback(() => successful([historyVisit("loaded", new Date(2026, 8, 12))]));
    await Promise.resolve();
    expect(getVisits).toHaveBeenCalledTimes(9);

    const failed = pending.shift()!;
    completeCallback(() => failed(undefined), { message: "Visit request failed" });
    await rejected;

    // Requests already in flight may finish, but cannot start more queued work.
    for (const callback of pending) completeCallback(() => callback([]));
    await Promise.resolve();
    expect(getVisits).toHaveBeenCalledTimes(9);
  });
});

describe("deleteUrl", () => {
  const url = "https://example.com/page?query=history#section";

  it("forwards the exact URL and resolves only after Chrome completes deletion", async () => {
    const result = deleteUrl(url);

    expect(deleteHistoryUrl).toHaveBeenCalledExactlyOnceWith(
      { url },
      expect.any(Function),
    );
    const onSettled = vi.fn();
    void result.then(onSettled, onSettled);

    // Yield an event-loop turn so any premature settlement becomes observable.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(onSettled).not.toHaveBeenCalled();

    completeDeletion();
    await expect(result).resolves.toBeUndefined();
  });

  it("rejects with the error reported by the deletion callback", async () => {
    const result = deleteUrl(url);
    completeDeletion({ message: "History deletion failed" });

    await expect(result).rejects.toThrow("History deletion failed");
  });

  it.each([undefined, {}])(
    "rejects when Chrome history is unavailable (%j)",
    async (chromeApi) => {
      vi.stubGlobal("chrome", chromeApi);

      await expect(deleteUrl(url)).rejects.toThrow(
        "Chrome history API not available",
      );
      expect(deleteHistoryUrl).not.toHaveBeenCalled();
    },
  );
});
