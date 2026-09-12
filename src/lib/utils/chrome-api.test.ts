import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHistory } from "./chrome-api";

// Chrome can omit results when a callback reports runtime.lastError.
type SearchCallback = (results?: chrome.history.HistoryItem[]) => void;

const search = vi.fn<
  (query: chrome.history.HistoryQuery, callback: SearchCallback) => void
>();
let runtime: { lastError?: chrome.runtime.LastError };

function completeSearch(
  results?: chrome.history.HistoryItem[],
  error?: chrome.runtime.LastError,
) {
  const [, callback] = search.mock.lastCall!;
  // lastError is only available while the Chrome API callback executes.
  runtime.lastError = error;
  try {
    callback(results);
  } finally {
    delete runtime.lastError;
  }
}

beforeEach(() => {
  runtime = {};
  vi.stubGlobal("chrome", { history: { search }, runtime });
});

describe("getHistory", () => {
  const records: chrome.history.HistoryItem[] = [
    {
      id: "1",
      url: "https://example.com/",
      title: "Example",
      lastVisitTime: Date.UTC(2026, 8, 12, 9),
    },
  ];

  it("returns history records and forwards the search filter", async () => {
    const result = getHistory("example");

    expect(search).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ text: "example", startTime: 0 }),
      expect.any(Function),
    );
    completeSearch(records);

    await expect(result).resolves.toEqual(records);
  });

  it("resolves an empty history as an empty array", async () => {
    const result = getHistory();

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ text: "" }),
      expect.any(Function),
    );
    completeSearch([]);

    await expect(result).resolves.toEqual([]);
  });

  it("rejects with the API error when the callback has no results", async () => {
    const result = getHistory();
    completeSearch(undefined, { message: "History service unavailable" });

    await expect(result).rejects.toThrow("History service unavailable");
  });

  it("allows a successful retry after an API failure", async () => {
    const failed = getHistory();
    completeSearch(undefined, { message: "Temporary history failure" });
    await expect(failed).rejects.toThrow("Temporary history failure");

    const retried = getHistory();
    completeSearch(records);

    await expect(retried).resolves.toEqual(records);
  });
});
