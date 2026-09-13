import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHistory, getHistoryForUrls, deleteUrl, type HistoryVisit } from "../utils/chrome-api";
import { historyVisit } from "../utils/history-fixtures";
let historyStore: typeof import("./history.svelte").historyStore;

vi.mock("../utils/chrome-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../utils/chrome-api")>(),
  getHistory: vi.fn(),
  getHistoryForUrls: vi.fn(),
  deleteUrl: vi.fn(),
}));

const url = "https://example.com/repeated";
const older = historyVisit("older", new Date(2026, 8, 10, 18), { url });
const newer = historyVisit("newer", new Date(2026, 8, 12, 9), { url });
const other = historyVisit("other", new Date(2026, 8, 11, 14));
const visits = [newer, other, older];

beforeEach(async () => {
  vi.resetModules();
  ({ historyStore } = await import("./history.svelte"));
  vi.mocked(getHistory).mockReset().mockResolvedValue(visits);
  vi.mocked(deleteUrl).mockReset().mockResolvedValue(undefined);
  vi.mocked(getHistoryForUrls).mockReset().mockResolvedValue([]);
  await historyStore.fetch();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// Exercise store actions and raw state in Node; client reactivity is not simulated.
describe("visit-level store actions", () => {
  it("removes every visit to a URL only after deletion succeeds", async () => {
    let finishDeletion!: () => void;
    vi.mocked(deleteUrl).mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishDeletion = resolve;
    }));

    const deletion = historyStore.removeUrl(url);
    expect(deleteUrl).toHaveBeenCalledExactlyOnceWith(url);
    expect(historyStore.raw).toEqual(visits);

    finishDeletion();
    await deletion;
    expect(historyStore.raw).toEqual([other]);
  });

  it("preserves all visits when deletion fails", async () => {
    vi.mocked(deleteUrl).mockRejectedValueOnce(new Error("Deletion failed"));

    await historyStore.removeUrl(url);

    expect(historyStore.raw).toEqual(visits);
    expect(historyStore.error).toBe("Deletion failed");
  });

  it("does not resurrect locally deleted visits from a pending fetch", async () => {
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistory).mockReturnValueOnce(pending.promise);
    const fetching = historyStore.fetch();
    await historyStore.removeUrl(url);
    pending.resolve(visits);
    await fetching;
    expect(historyStore.raw).toEqual([other]);
  });

  it("exposes a failed visit load and recovers on retry", async () => {
    vi.mocked(getHistory).mockRejectedValueOnce(new Error("Visit service unavailable"));

    await historyStore.fetch();

    expect(historyStore.raw).toEqual([]);
    expect(historyStore.error).toBe("Visit service unavailable");
    expect(historyStore.isLoading).toBe(false);

    await historyStore.fetch();

    expect(historyStore.raw).toEqual(visits);
    expect(historyStore.error).toBeNull();
    expect(historyStore.isLoading).toBe(false);
  });

  it("ignores stale success and progress after a newer load completes", async () => {
    const old = deferred<HistoryVisit[]>();
    const fresh = deferred<HistoryVisit[]>();
    vi.mocked(getHistory).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const first = historyStore.fetch();
    const oldOptions = vi.mocked(getHistory).mock.lastCall![1]!;
    const second = historyStore.fetch();

    expect(oldOptions.signal?.aborted).toBe(true);
    fresh.resolve([other]);
    await second;
    oldOptions.onProgress?.({ completed: 1, total: 5 });
    old.resolve([older]);
    await first;

    expect(historyStore.raw).toEqual([other]);
    expect(historyStore.progress).toBeNull();
    expect(historyStore.error).toBeNull();
    expect(historyStore.isLoading).toBe(false);
  });

  it("ignores stale errors and finalization while a newer load is pending", async () => {
    const old = deferred<HistoryVisit[]>();
    const fresh = deferred<HistoryVisit[]>();
    vi.mocked(getHistory).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const first = historyStore.fetch();
    const second = historyStore.fetch();
    vi.mocked(getHistory).mock.lastCall![1]!.onProgress?.({ completed: 2, total: 10 });
    old.reject(new Error("Stale failure"));
    await first;

    expect(historyStore.isLoading).toBe(true);
    expect(historyStore.progress).toEqual({ completed: 2, total: 10 });
    expect(historyStore.error).toBeNull();
    expect(historyStore.raw).toEqual(visits);
    fresh.resolve([other]);
    await second;
    expect(historyStore.raw).toEqual([other]);
  });

  it("cancels loading without accepting late results or losing existing visits", async () => {
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistory).mockReturnValueOnce(pending.promise);
    const fetching = historyStore.fetch();
    const options = vi.mocked(getHistory).mock.lastCall![1]!;
    historyStore.cancelFetch();

    expect(options.signal?.aborted).toBe(true);
    expect(historyStore.isLoading).toBe(false);
    expect(historyStore.error).toContain("cancelled");
    pending.resolve([other]);
    await fetching;
    expect(historyStore.raw).toEqual(visits);
  });
});

function historyEvent<T>() {
  const listeners = new Set<(value: T) => void>();
  return {
    addListener: vi.fn((listener: (value: T) => void) => { listeners.add(listener); }),
    removeListener: vi.fn((listener: (value: T) => void) => { listeners.delete(listener); }),
    emit: (value: T) => { for (const listener of listeners) listener(value); },
  };
}

describe("live history synchronization", () => {
  let onVisited: ReturnType<typeof historyEvent<chrome.history.HistoryItem>>;
  let onVisitRemoved: ReturnType<typeof historyEvent<chrome.history.RemovedResult>>;
  let disconnect: () => void;
  const item = { id: "repeated", url, title: "Updated title" };
  const revisit = historyVisit("revisit", new Date(2026, 8, 13, 8), { url, title: item.title });

  beforeEach(async () => {
    onVisited = historyEvent();
    onVisitRemoved = historyEvent();
    vi.stubGlobal("chrome", { history: { onVisited, onVisitRemoved } });
    disconnect = historyStore.connect();
    await vi.waitFor(() => expect(historyStore.isLoading).toBe(false));
    vi.mocked(getHistory).mockClear();
  });

  afterEach(() => disconnect());

  it("removes all visits to externally deleted URLs immediately", () => {
    onVisitRemoved.emit({ allHistory: false, urls: [url] });
    expect(historyStore.raw).toEqual([other]);
    expect(getHistory).not.toHaveBeenCalled();
  });

  it("suppresses deleted URLs in a pending snapshot while keeping other records", async () => {
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistory).mockReturnValueOnce(pending.promise);
    const fetching = historyStore.fetch();
    onVisitRemoved.emit({ allHistory: false, urls: [url] });
    expect(historyStore.raw).toEqual([other]);
    pending.resolve(visits);
    await fetching;
    expect(historyStore.raw).toEqual([other]);
  });

  it.each(["success", "failure"])("clears all history and ignores late snapshot %s", async (outcome) => {
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistory).mockReturnValueOnce(pending.promise);
    const fetching = historyStore.fetch();
    const options = vi.mocked(getHistory).mock.lastCall![1]!;
    historyStore.toggleMoment("2026-09-12");
    onVisitRemoved.emit({ allHistory: true });
    expect(historyStore.raw).toEqual([]);
    expect(historyStore.selectedMoments).toEqual([]);
    expect(options.signal?.aborted).toBe(true);
    options.onProgress?.({ completed: 1, total: 2 });
    if (outcome === "success") pending.resolve(visits);
    else pending.reject(new Error("Late failure"));
    await fetching;
    expect(historyStore.raw).toEqual([]);
    expect(historyStore.isLoading).toBe(false);
    expect(historyStore.progress).toBeNull();
    expect(historyStore.error).toBeNull();
  });

  it("reconciles only visited URLs, preserving earlier visits without duplicates", async () => {
    const updated = [revisit, { ...newer, title: item.title }, { ...older, title: item.title }];
    vi.mocked(getHistoryForUrls).mockResolvedValue(updated);
    onVisited.emit(item);
    await vi.waitFor(() => expect(historyStore.raw).toEqual([updated[0], updated[1], other, updated[2]]));
    onVisited.emit(item);
    await vi.waitFor(() => expect(getHistoryForUrls).toHaveBeenCalledTimes(2));
    expect(historyStore.raw).toHaveLength(4);
    expect(getHistoryForUrls).toHaveBeenCalledWith([item], expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(getHistory).not.toHaveBeenCalled();
  });

  it("queues and coalesces visit events received during the initial snapshot", async () => {
    disconnect();
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistory).mockReturnValueOnce(pending.promise);
    vi.mocked(getHistoryForUrls).mockResolvedValue([revisit, newer, older]);
    disconnect = historyStore.connect();
    onVisited.emit({ ...item, title: "Earlier title" });
    onVisited.emit(item);
    expect(getHistoryForUrls).not.toHaveBeenCalled();
    pending.resolve(visits);
    await vi.waitFor(() => expect(historyStore.raw).toEqual([revisit, newer, other, older]));
    expect(getHistoryForUrls).toHaveBeenCalledExactlyOnceWith([item], expect.any(Object));
  });

  it("ignores an incremental result superseded by another visit to the same URL", async () => {
    const pending = deferred<HistoryVisit[]>();
    const latest = deferred<HistoryVisit[]>();
    vi.mocked(getHistoryForUrls).mockReturnValueOnce(pending.promise).mockReturnValueOnce(latest.promise);
    onVisited.emit(item);
    onVisited.emit(item);
    onVisited.emit(item);
    pending.resolve([revisit]);
    await vi.waitFor(() => expect(getHistoryForUrls).toHaveBeenCalledTimes(2));
    expect(historyStore.raw).toEqual(visits);
    latest.resolve([revisit, newer, older]);
    await vi.waitFor(() => expect(historyStore.raw).toEqual([revisit, newer, other, older]));
  });

  it("does not restore a removed URL from a pending incremental read or queued event", async () => {
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistoryForUrls).mockReturnValueOnce(pending.promise);
    onVisited.emit(item);
    onVisited.emit(item);
    onVisitRemoved.emit({ allHistory: false, urls: [url] });
    pending.resolve([revisit, newer, older]);
    await Promise.resolve();
    expect(historyStore.raw).toEqual([other]);
    expect(getHistoryForUrls).toHaveBeenCalledTimes(1);
  });

  it.each(["deletion", "revisit"])("keeps valid updates in a mixed-URL batch after one URL's %s", async (event) => {
    const snapshot = deferred<HistoryVisit[]>();
    const batch = deferred<HistoryVisit[]>();
    const latest = deferred<HistoryVisit[]>();
    const otherItem = { id: "other", url: other.url, title: "Other updated" };
    const otherRevisit = historyVisit("other-revisit", new Date(2026, 8, 13, 7), otherItem);
    const updatedOther = { ...other, title: otherItem.title };
    vi.mocked(getHistory).mockReturnValueOnce(snapshot.promise);
    vi.mocked(getHistoryForUrls).mockReturnValueOnce(batch.promise).mockReturnValueOnce(latest.promise);

    // Queue both URLs behind a full load so they share one incremental batch.
    const fetching = historyStore.fetch();
    onVisited.emit(item);
    onVisited.emit(otherItem);
    snapshot.resolve(visits);
    await fetching;
    expect(getHistoryForUrls).toHaveBeenCalledExactlyOnceWith([item, otherItem], expect.any(Object));

    if (event === "deletion") onVisitRemoved.emit({ allHistory: false, urls: [url] });
    else onVisited.emit({ ...item, title: "Latest title" });
    batch.resolve([revisit, otherRevisit, newer, updatedOther, older]);
    await vi.waitFor(() => expect(historyStore.raw).toContainEqual(otherRevisit));

    if (event === "deletion") {
      expect(historyStore.raw).toEqual([otherRevisit, updatedOther]);
      expect(getHistoryForUrls).toHaveBeenCalledTimes(1);
    } else {
      // B lands immediately, but A's superseded response must not land at all.
      expect(historyStore.raw).toEqual([otherRevisit, newer, updatedOther, older]);
      expect(getHistoryForUrls).toHaveBeenCalledTimes(2);
      expect(getHistoryForUrls).toHaveBeenLastCalledWith(
        [{ ...item, title: "Latest title" }], expect.any(Object),
      );
      const fresh = [revisit, newer, older].map((visit) => ({ ...visit, title: "Latest title" }));
      latest.resolve(fresh);
      await vi.waitFor(() => expect(historyStore.raw).toEqual([
        fresh[0], otherRevisit, fresh[1], updatedOther, fresh[2],
      ]));
    }
    expect(historyStore.syncError).toBeNull();
  });

  it("accepts a genuinely new visit after deletion without restoring the old visits", async () => {
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistoryForUrls).mockReturnValueOnce(pending.promise).mockResolvedValueOnce([revisit]);
    onVisited.emit(item);
    onVisitRemoved.emit({ allHistory: false, urls: [url] });
    onVisited.emit(item);
    pending.resolve([newer, older]);
    await vi.waitFor(() => expect(historyStore.raw).toEqual([revisit, other]));
  });

  it("clears in-flight and queued incremental work and can reconcile visits afterward", async () => {
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistoryForUrls).mockReturnValueOnce(pending.promise).mockResolvedValueOnce([revisit]);
    onVisited.emit(item);
    const signal = vi.mocked(getHistoryForUrls).mock.lastCall![1]!.signal!;
    onVisited.emit({ id: "other", url: other.url });
    onVisitRemoved.emit({ allHistory: true, urls: [] });
    expect(signal.aborted).toBe(true);
    onVisited.emit(item);
    await vi.waitFor(() => expect(historyStore.raw).toEqual([revisit]));
    pending.resolve(visits);
    await Promise.resolve();
    expect(historyStore.raw).toEqual([revisit]);
    expect(getHistoryForUrls).toHaveBeenCalledTimes(2);
  });

  it("supersedes incremental results when a fresh full load starts", async () => {
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistoryForUrls).mockReturnValueOnce(pending.promise);
    onVisited.emit(item);
    const signal = vi.mocked(getHistoryForUrls).mock.lastCall![1]!.signal!;
    vi.mocked(getHistory).mockResolvedValueOnce([other]);
    await historyStore.fetch();
    expect(signal.aborted).toBe(true);
    pending.resolve(visits);
    await Promise.resolve();
    expect(historyStore.raw).toEqual([other]);
  });

  it("surfaces incremental failures and lets Retry recover", async () => {
    vi.mocked(getHistoryForUrls).mockRejectedValueOnce(new Error("Visit service unavailable"));
    onVisited.emit(item);
    await vi.waitFor(() => expect(historyStore.syncError).toContain("Some recent visits"));
    expect(historyStore.error).toBeNull();
    expect(historyStore.raw).toEqual(visits);
    vi.mocked(getHistory).mockResolvedValueOnce([revisit, newer, other, older]);
    await historyStore.fetch();
    expect(historyStore.raw).toEqual([revisit, newer, other, older]);
    expect(historyStore.error).toBeNull();
    expect(historyStore.syncError).toBeNull();
  });

  it("clears the sync notice only when failed URLs recover or are removed", async () => {
    vi.mocked(getHistoryForUrls).mockRejectedValueOnce(new Error("Unavailable"));
    onVisited.emit(item);
    await vi.waitFor(() => expect(historyStore.syncError).not.toBeNull());
    const unrelated = deferred<HistoryVisit[]>();
    vi.mocked(getHistoryForUrls).mockReturnValueOnce(unrelated.promise);
    onVisited.emit({ id: "other", url: other.url });
    unrelated.resolve([other]);
    await Promise.resolve();
    expect(historyStore.syncError).not.toBeNull();
    vi.mocked(getHistoryForUrls).mockResolvedValueOnce([revisit, newer, older]);
    onVisited.emit(item);
    await vi.waitFor(() => expect(historyStore.syncError).toBeNull());
    expect(historyStore.raw).toEqual([revisit, newer, other, older]);

    vi.mocked(getHistoryForUrls).mockRejectedValueOnce(new Error("Unavailable again"));
    onVisited.emit(item);
    await vi.waitFor(() => expect(historyStore.syncError).not.toBeNull());
    onVisitRemoved.emit({ allHistory: false, urls: [url] });
    expect(historyStore.syncError).toBeNull();
    expect(historyStore.error).toBeNull();
  });

  it("ignores late sync errors after clear-all", async () => {
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistoryForUrls).mockReturnValueOnce(pending.promise);
    onVisited.emit(item);
    onVisitRemoved.emit({ allHistory: true });
    pending.reject(new Error("Late failure"));
    await Promise.resolve();
    expect(historyStore.syncError).toBeNull();
    expect(historyStore.error).toBeNull();
    expect(historyStore.raw).toEqual([]);
  });

  it.each(["failure", "cancellation"])("does not reconcile queued or later visits after load %s", async (outcome) => {
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistory).mockReturnValueOnce(pending.promise);
    const fetching = historyStore.fetch();
    onVisited.emit(item);
    if (outcome === "failure") pending.reject(new Error("Load failed"));
    else {
      historyStore.cancelFetch();
      pending.resolve(visits);
    }
    await fetching;
    onVisited.emit(item);
    expect(getHistoryForUrls).not.toHaveBeenCalled();
    expect(historyStore.raw).toEqual(outcome === "failure" ? [] : visits);
    expect(historyStore.error).not.toBeNull();

    vi.mocked(getHistory).mockResolvedValueOnce([revisit, newer, other, older]);
    await historyStore.fetch();
    expect(historyStore.raw).toEqual([revisit, newer, other, older]);
    expect(historyStore.error).toBeNull();
    vi.mocked(getHistoryForUrls).mockResolvedValueOnce([revisit, newer, older]);
    onVisited.emit(item);
    await vi.waitFor(() => expect(getHistoryForUrls).toHaveBeenCalledTimes(1));
  });

  it("resumes syncing from an authoritative clear-all after a failed load", async () => {
    vi.mocked(getHistory).mockRejectedValueOnce(new Error("Load failed"));
    await historyStore.fetch();
    onVisitRemoved.emit({ allHistory: true });
    expect(historyStore.error).toBeNull();
    vi.mocked(getHistoryForUrls).mockResolvedValueOnce([revisit]);
    onVisited.emit(item);
    await vi.waitFor(() => expect(historyStore.raw).toEqual([revisit]));
  });

  it("ignores a non-clear-all event with no URLs without invalidating the snapshot", () => {
    const before = historyStore.raw;
    expect(() => onVisitRemoved.emit({ allHistory: false })).not.toThrow();
    expect(historyStore.raw).toBe(before);
  });

  it("preserves an in-flight snapshot for remaining consumers and reloads after the last leaves", async () => {
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistory).mockReturnValueOnce(pending.promise);
    const fetching = historyStore.fetch();
    const signal = vi.mocked(getHistory).mock.lastCall![1]!.signal!;
    const second = historyStore.connect();
    disconnect();
    disconnect = historyStore.connect();
    expect(signal.aborted).toBe(false);
    expect(historyStore.isLoading).toBe(true);
    expect(getHistory).toHaveBeenCalledTimes(1);
    second();
    disconnect();
    expect(signal.aborted).toBe(true);
    vi.mocked(getHistory).mockResolvedValueOnce([other]);
    disconnect = historyStore.connect();
    await vi.waitFor(() => expect(historyStore.raw).toEqual([other]));
    expect(getHistory).toHaveBeenCalledTimes(2);
    pending.resolve(visits);
    await fetching;
    expect(historyStore.raw).toEqual([other]);
  });

  it("surfaces the normal load error when connecting without the Chrome API", async () => {
    disconnect();
    vi.stubGlobal("chrome", undefined);
    const actual = await vi.importActual<typeof import("../utils/chrome-api")>("../utils/chrome-api");
    vi.mocked(getHistory).mockImplementationOnce(actual.getHistory);
    disconnect = historyStore.connect();
    await vi.waitFor(() => expect(historyStore.error).toBe("Chrome history API not available"));
    expect(historyStore.isLoading).toBe(false);
    expect(historyStore.raw).toEqual([]);
  });

  it("shares listeners and removes them only after the last consumer disconnects", () => {
    const second = historyStore.connect();
    expect(onVisited.addListener).toHaveBeenCalledTimes(1);
    expect(onVisitRemoved.addListener).toHaveBeenCalledTimes(1);
    expect(getHistory).not.toHaveBeenCalled();
    second();
    second();
    expect(onVisited.removeListener).not.toHaveBeenCalled();
    onVisitRemoved.emit({ allHistory: false, urls: [url] });
    expect(historyStore.raw).toEqual([other]);
    disconnect();
    expect(onVisited.removeListener).toHaveBeenCalledExactlyOnceWith(onVisited.addListener.mock.calls[0][0]);
    expect(onVisitRemoved.removeListener).toHaveBeenCalledExactlyOnceWith(onVisitRemoved.addListener.mock.calls[0][0]);
    onVisitRemoved.emit({ allHistory: true });
    onVisited.emit(item);
    expect(historyStore.raw).toEqual([other]);
    expect(getHistoryForUrls).not.toHaveBeenCalled();
  });

  it("aborts pending work on teardown and ignores late results", async () => {
    const pending = deferred<HistoryVisit[]>();
    vi.mocked(getHistoryForUrls).mockReturnValueOnce(pending.promise);
    onVisited.emit(item);
    const signal = vi.mocked(getHistoryForUrls).mock.lastCall![1]!.signal!;
    disconnect();
    expect(signal.aborted).toBe(true);
    pending.resolve([revisit]);
    await Promise.resolve();
    expect(historyStore.raw).toEqual(visits);
  });

  it("ignores URL-less visit events", () => {
    onVisited.emit({ id: "missing-url" });
    expect(getHistoryForUrls).not.toHaveBeenCalled();
  });
});
