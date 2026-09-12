import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHistory, deleteUrl, type HistoryVisit } from "../utils/chrome-api";
import { historyVisit } from "../utils/history-fixtures";
let historyStore: typeof import("./history.svelte").historyStore;

vi.mock("../utils/chrome-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../utils/chrome-api")>(),
  getHistory: vi.fn(),
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
