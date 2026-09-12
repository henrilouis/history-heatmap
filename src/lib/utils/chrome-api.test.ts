import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteUrl, getHistory } from "./chrome-api";

// Chrome can omit results when a callback reports runtime.lastError.
type SearchCallback = (results?: chrome.history.HistoryItem[]) => void;

const search = vi.fn<
  (query: chrome.history.HistoryQuery, callback: SearchCallback) => void
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
    history: { search, deleteUrl: deleteHistoryUrl },
    runtime,
  });
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

describe("deleteUrl", () => {
  const url = "https://example.com/page?query=history#section";

  it("forwards the exact URL and resolves after successful deletion", async () => {
    const result = deleteUrl(url);

    expect(deleteHistoryUrl).toHaveBeenCalledExactlyOnceWith(
      { url },
      expect.any(Function),
    );
    completeDeletion();

    await expect(result).resolves.toBeUndefined();
  });

  it("stays pending until Chrome completes the deletion", async () => {
    const result = deleteUrl(url);
    const onSettled = vi.fn();
    const settlement = result.then(onSettled, onSettled);

    // Yield an event-loop turn so any premature settlement becomes observable.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(onSettled).not.toHaveBeenCalled();

    completeDeletion();
    await settlement;

    expect(onSettled).toHaveBeenCalledExactlyOnceWith(undefined);
    await expect(result).resolves.toBeUndefined();
  });

  it("rejects with the error reported by the deletion callback", async () => {
    const result = deleteUrl(url);
    completeDeletion({ message: "History deletion failed" });

    await expect(result).rejects.toThrow("History deletion failed");
  });
});
