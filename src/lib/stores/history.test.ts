import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHistory, deleteUrl } from "../utils/chrome-api";
import { historyVisit } from "../utils/history-fixtures";
import { historyStore } from "./history.svelte";

vi.mock("../utils/chrome-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../utils/chrome-api")>(),
  getHistory: vi.fn(),
  deleteUrl: vi.fn(),
}));

const url = "https://example.com/repeated";
const older = historyVisit("older", new Date(2026, 8, 10, 18), { id: "same-url", url });
const newer = historyVisit("newer", new Date(2026, 8, 12, 9), { id: "same-url", url });
const other = historyVisit("other", new Date(2026, 8, 11, 14));
const visits = [newer, other, older];

beforeEach(async () => {
  vi.mocked(getHistory).mockResolvedValue(visits);
  vi.mocked(deleteUrl).mockResolvedValue(undefined);
  await historyStore.fetch();
});

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
});
