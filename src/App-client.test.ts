import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chromeVisit } from "./lib/utils/history-fixtures";

type SearchCallback = (items: chrome.history.HistoryItem[]) => void;
type VisitsCallback = (items: chrome.history.VisitItem[]) => void;
const repeatedUrl = "https://example.com/repeated";
const otherUrl = "https://example.com/other";
const records = [
  { id: "repeated", url: repeatedUrl, title: "Repeated page" },
  { id: "other", url: otherUrl, title: "Other page" },
];
const search =
  vi.fn<
    (query: chrome.history.HistoryQuery, callback: SearchCallback) => void
  >();
const getVisits =
  vi.fn<
    (details: chrome.history.UrlDetails, callback: VisitsCallback) => void
  >();
const deleteUrl =
  vi.fn<(details: chrome.history.UrlDetails, callback: () => void) => void>();
let visitsByUrl: Map<string, chrome.history.VisitItem[]>;
let runtime: {
  lastError?: chrome.runtime.LastError;
  getURL: (path: string) => string;
};
let visited: (item: chrome.history.HistoryItem) => void;
let target: HTMLDivElement;
let cleanup: () => Promise<void>;
let tick: typeof import("svelte").tick;
const originalAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "animate",
);

beforeEach(async () => {
  search.mockReset();
  getVisits.mockReset();
  deleteUrl.mockReset();
  visitsByUrl = new Map([
    [
      repeatedUrl,
      [
        chromeVisit("older", new Date(2026, 8, 10, 18)),
        chromeVisit("newer", new Date(2026, 8, 12, 9)),
      ],
    ],
    [otherUrl, [chromeVisit("other", new Date(2026, 8, 11, 14))]],
  ]);
  getVisits.mockImplementation(({ url }, callback) =>
    callback(visitsByUrl.get(url) ?? []),
  );
  runtime = { getURL: (path) => `chrome-extension://test${path}` };
  // Mock browser boundaries; mount the actual App, components, store, and loader.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  // jsdom has no Web Animations API. Finish transitions in a microtask so DOM
  // removal exercises Svelte's outro lifecycle without depending on elapsed time.
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: () => {
      let cancelled = false;
      const animation = {
        onfinish: null as (() => void) | null,
        cancel: () => {
          cancelled = true;
        },
      };
      queueMicrotask(() => {
        if (!cancelled) animation.onfinish?.();
      });
      return animation;
    },
  });
  vi.stubGlobal("chrome", {
    runtime,
    history: {
      search,
      getVisits,
      deleteUrl,
      onVisited: {
        addListener: (listener: typeof visited) => {
          visited = listener;
        },
        removeListener: vi.fn(),
      },
      onVisitRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  vi.resetModules();
  // Import the runtime and App together after reset so effects use one runtime.
  const svelte = await import("svelte");
  tick = svelte.tick;
  const { default: App } = await import("./App.svelte");
  target = document.createElement("div");
  document.body.append(target);
  const app = svelte.mount(App, { target });
  cleanup = () => svelte.unmount(app);
  await tick();
  expect(search).toHaveBeenCalledTimes(1);
});

afterEach(async () => {
  await cleanup?.();
  target?.remove();
  if (originalAnimate)
    Object.defineProperty(Element.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(Element.prototype, "animate");
});

function button(name: string): HTMLButtonElement {
  const matches = [...target.querySelectorAll("button")].filter(
    (element) =>
      (element.getAttribute("aria-label") ?? element.textContent?.trim()) ===
      name,
  );
  expect(matches, `button named '${name}'`).toHaveLength(1);
  return matches[0];
}

function historyLinks(): string[] {
  return [...target.querySelectorAll<HTMLAnchorElement>(".moments a")].map(
    (link) => link.href,
  );
}

function completeSearch() {
  search.mock.lastCall![1](records);
}

function failCallback(callback: () => void, message: string) {
  runtime.lastError = { message };
  try {
    callback();
  } finally {
    delete runtime.lastError;
  }
}

async function loadHistory() {
  completeSearch();
  await vi.waitFor(() =>
    expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]),
  );
}

async function startDeletion() {
  await loadHistory();
  // The same URL has a button on two different days; click its newest visit.
  const buttons = target.querySelectorAll<HTMLButtonElement>(
    `button[aria-label="Delete all visits to ${repeatedUrl}, including visits on other days"]`,
  );
  expect(buttons).toHaveLength(2);
  buttons[0].click();
  await tick();
  expect(deleteUrl).toHaveBeenCalledExactlyOnceWith(
    { url: repeatedUrl },
    expect.any(Function),
  );
  expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]);
  return deleteUrl.mock.lastCall![1];
}

describe("mounted history interactions", () => {
  it("renders a static, accessible reload trail across unrelated visits", async () => {
    visitsByUrl.set(repeatedUrl, [
      chromeVisit("root", new Date(2026, 8, 12, 9)),
      chromeVisit("refresh", new Date(2026, 8, 12, 9, 5), {
        referringVisitId: "root",
        transition: "reload",
      }),
    ]);
    visitsByUrl.set(otherUrl, [
      chromeVisit("independent", new Date(2026, 8, 12, 9, 2)),
    ]);
    completeSearch();
    await vi.waitFor(() =>
      expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]),
    );

    const graphs = [...target.querySelectorAll('.visit-graph[role="img"]')];
    expect(graphs).toHaveLength(3);
    expect(graphs[0].getAttribute("aria-label")).toContain(
      "Reload or restored page",
    );
    expect(graphs[0].querySelector(".graph-node.reload")).not.toBeNull();
    expect(graphs[2].getAttribute("aria-label")).toContain("Led to 1 visit");
    // The connecting track still spans the unrelated middle visit.
    expect(graphs[1].querySelector("path")).not.toBeNull();
    expect(target.querySelectorAll(".graph-node")).toHaveLength(3);
    expect(
      target.querySelector(
        ".visit-graph button, .visit-graph [tabindex], .visit-graph[tabindex]",
      ),
    ).toBeNull();
  });

  it("removes all visits from the list and calendar only after deletion succeeds", async () => {
    const callback = await startDeletion();

    callback();

    await vi.waitFor(() => expect(historyLinks()).toEqual([otherUrl]));
    expect(target.querySelector('[role="alert"]')).toBeNull();
    expect(target.querySelector('[data-date="2026-09-12"]')).toBeNull();
    expect(button("Toggle moment for 2026-09-10").disabled).toBe(true);
  });

  it("preserves the list and calendar and shows an error when deletion fails", async () => {
    const callback = await startDeletion();

    failCallback(callback, "History deletion failed");

    await vi.waitFor(() =>
      expect(target.querySelector('[role="alert"]')?.textContent).toContain(
        "History deletion failed",
      ),
    );
    expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]);
    expect(button("Toggle moment for 2026-09-10").disabled).toBe(false);
    expect(button("Toggle moment for 2026-09-12").disabled).toBe(false);
  });

  it("shows header progress, cancels loading, ignores late callbacks, and retries", async () => {
    expect(
      target.querySelector('header [role="status"]')?.textContent,
    ).toContain("Searching history");
    expect(target.querySelector('header input[type="search"]')).toBeNull();
    const pending: VisitsCallback[] = [];
    getVisits.mockImplementation((_details, callback) => {
      pending.push(callback);
    });
    completeSearch();
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    await tick();
    expect(target.querySelector('header [role="status"]')?.textContent).toMatch(
      /Loading visits: 0\s+of\s+2 URLs/,
    );
    const progress =
      target.querySelector<HTMLProgressElement>("header progress")!;
    expect(progress.value).toBe(0);
    expect(progress.max).toBe(2);

    button("Cancel").click();
    await vi.waitFor(() =>
      expect(target.querySelector('[role="alert"]')?.textContent).toContain(
        "cancelled",
      ),
    );
    expect(target.querySelector("progress")).toBeNull();
    expect(target.querySelector('header input[type="search"]')).not.toBeNull();
    for (const callback of pending) callback(visitsByUrl.get(repeatedUrl)!);
    await tick();
    expect(historyLinks()).toEqual([]);
    expect(target.querySelector('[role="alert"]')?.textContent).toContain(
      "cancelled",
    );

    getVisits.mockImplementation(({ url }, callback) =>
      callback(visitsByUrl.get(url) ?? []),
    );
    button("Retry").click();
    await tick();
    expect(search).toHaveBeenCalledTimes(2);
    expect(
      target.querySelector('header [role="status"]')?.textContent,
    ).toContain("Searching history");
    expect(target.querySelector('header input[type="search"]')).toBeNull();
    await loadHistory();
    expect(target.querySelector('[role="alert"]')).toBeNull();
    expect(target.querySelector('[role="status"]')).toBeNull();
    expect(target.querySelector('header input[type="search"]')).not.toBeNull();
  });

  it("renders a failed initial search and recovers through Retry", async () => {
    failCallback(
      () => search.mock.lastCall![1]([]),
      "History service unavailable",
    );
    await vi.waitFor(() =>
      expect(target.querySelector('[role="alert"]')?.textContent).toContain(
        "History service unavailable",
      ),
    );
    expect(historyLinks()).toEqual([]);
    expect(target.querySelector("progress")).toBeNull();

    button("Retry").click();
    await tick();
    expect(search).toHaveBeenCalledTimes(2);
    await loadHistory();
    expect(target.querySelector('[role="alert"]')).toBeNull();
  });

  it("keeps loaded visits visible after a sync failure and recovers through Refresh history", async () => {
    await loadHistory();
    const failVisits = (
      _details: chrome.history.UrlDetails,
      callback: VisitsCallback,
    ) => {
      failCallback(() => callback([]), "Visit service unavailable");
    };
    getVisits
      .mockImplementationOnce(failVisits)
      .mockImplementationOnce(failVisits);
    visited(records[0]);
    await vi.waitFor(() =>
      expect(target.querySelector('[role="status"]')?.textContent).toContain(
        "Some recent visits could not be refreshed",
      ),
    );
    expect(target.querySelector('[role="alert"]')).toBeNull();
    expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]);
    visitsByUrl
      .get(repeatedUrl)!
      .push(chromeVisit("revisit", new Date(2026, 8, 13, 8)));

    button("Refresh history").click();
    await tick();
    expect(search).toHaveBeenCalledTimes(2);
    expect(target.textContent).not.toContain(
      "Some recent visits could not be refreshed",
    );
    completeSearch();
    await vi.waitFor(() =>
      expect(historyLinks()).toEqual([
        repeatedUrl,
        repeatedUrl,
        otherUrl,
        repeatedUrl,
      ]),
    );
    expect(target.querySelector('[role="status"]')).toBeNull();
    expect(target.querySelector('[role="alert"]')).toBeNull();
  });

  it.each([
    ["Days", "2026-09-12", "2026-09-11"],
    ["Hours", "2026-09-12 at 09:00", "2026-09-11 at 14:00"],
  ])("clears all %s selections with Escape", async (mode, first, second) => {
    await loadHistory();
    button(mode).click();
    await tick();
    button(`Toggle moment for ${first}`).click();
    button(`Toggle moment for ${second}`).click();
    await tick();
    expect(target.querySelectorAll('[data-selected="true"]')).toHaveLength(2);
    expect(historyLinks()).toEqual([repeatedUrl, otherUrl]);

    const modeButton = button(mode);
    modeButton.focus();
    expect(document.activeElement).toBe(modeButton);
    modeButton.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await tick();
    expect(target.querySelectorAll('[data-selected="true"]')).toHaveLength(2);

    modeButton.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await tick();
    expect(target.querySelector('[data-selected="true"]')).toBeNull();
    expect(target.textContent).not.toContain("Clear selection");
    expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]);
  });

  it("selects day/hour cells and clears selection when switching calendar modes", async () => {
    await loadHistory();
    button("Toggle moment for 2026-09-12").click();
    await tick();
    expect(button("Toggle moment for 2026-09-12").dataset.selected).toBe(
      "true",
    );
    expect(historyLinks()).toEqual([repeatedUrl]);
    expect(target.textContent).toMatch(/1\s+day selected/);

    button("Clear selection").click();
    await tick();
    expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]);
    button("Toggle moment for 2026-09-12").click();
    await tick();
    button("Hours").click();
    await tick();
    expect(target.querySelector('[data-selected="true"]')).toBeNull();
    expect(target.textContent).not.toContain("Clear selection");
    expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]);

    button("Toggle moment for 2026-09-12 at 09:00").click();
    await tick();
    expect(
      button("Toggle moment for 2026-09-12 at 09:00").dataset.selected,
    ).toBe("true");
    expect(target.textContent).toMatch(/1\s+hour selected/);
    expect(historyLinks()).toEqual([repeatedUrl]);
    button("Days").click();
    await tick();
    expect(target.querySelector('[data-selected="true"]')).toBeNull();
    expect(target.textContent).not.toContain("Clear selection");
    expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]);
  });
});
