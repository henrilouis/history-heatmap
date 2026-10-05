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
let cleanup: (() => Promise<void>) | undefined;
let tick: typeof import("svelte").tick;
const originalAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "animate",
);
const originalOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetHeight",
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
  // jsdom has no layout. Charts measure their container through
  // ResizeObserver; the virtualized list sizes its viewport from the scroll
  // container and measures rendered rows through offsetHeight.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains("wrapper") ? 800 : 48;
    },
  });
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
  await mountApp();
});

/**
 * Mount a fresh App at a URL hash. jsdom keeps one window per file, so the URL
 * is reset each time rather than leaking a previous test's route.
 */
async function mountApp(hash = "") {
  await cleanup?.();
  target?.remove();
  search.mockClear();
  history.replaceState(null, "", `${location.pathname}${hash}`);
  vi.resetModules();
  // Import the runtime and App together after reset so effects use one runtime.
  const svelte = await import("svelte");
  tick = svelte.tick;
  const { default: App } = await import("./App.svelte");
  target = document.createElement("div");
  document.body.append(target);
  const app = svelte.mount(App, { target });
  cleanup = async () => {
    await svelte.unmount(app);
    cleanup = undefined;
  };
  await tick();
  expect(search).toHaveBeenCalledTimes(1);
}

afterEach(async () => {
  await cleanup?.();
  target?.remove();
  if (originalAnimate)
    Object.defineProperty(Element.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(Element.prototype, "animate");
  if (originalOffsetHeight)
    Object.defineProperty(
      HTMLElement.prototype,
      "offsetHeight",
      originalOffsetHeight,
    );
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

function viewLink(name: string): HTMLAnchorElement {
  const nav = target.querySelector('nav[aria-label="View"]');
  const matches = [...(nav?.querySelectorAll("a") ?? [])].filter(
    (element) => element.textContent?.trim() === name,
  );
  expect(matches, `view link named '${name}'`).toHaveLength(1);
  return matches[0];
}

function currentView(): string | undefined {
  return target
    .querySelector('nav[aria-label="View"] [aria-current="page"]')
    ?.textContent?.trim();
}

function searchInput(): HTMLInputElement {
  return target.querySelector('input[type="search"]')!;
}

/** Follow a view link the way a user does; jsdom fires hashchange async. */
async function switchView(name: string) {
  const link = viewLink(name);
  const changed =
    link.href !== location.href &&
    new Promise((resolve) =>
      window.addEventListener("hashchange", resolve, { once: true }),
    );
  link.click();
  await changed;
  await tick();
  expect(currentView()).toBe(name);
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
    await switchView(mode);
    button(`Toggle moment for ${first}`).click();
    button(`Toggle moment for ${second}`).click();
    await tick();
    expect(target.querySelectorAll('[data-selected="true"]')).toHaveLength(2);
    expect(historyLinks()).toEqual([repeatedUrl, otherUrl]);

    const modeLink = viewLink(mode);
    modeLink.focus();
    expect(document.activeElement).toBe(modeLink);
    modeLink.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await tick();
    expect(target.querySelectorAll('[data-selected="true"]')).toHaveLength(2);

    modeLink.dispatchEvent(
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
    await switchView("Hours");
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
    await switchView("Days");
    expect(target.querySelector('[data-selected="true"]')).toBeNull();
    expect(target.textContent).not.toContain("Clear selection");
    expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]);
  });

  it("replaces the history list with insight cards", async () => {
    await loadHistory();
    button("Toggle moment for 2026-09-12").click();
    await tick();

    // The stats view loads lazily. Its first transform takes seconds under
    // Vitest, so warm the module registry rather than stretching waitFor.
    await import("./lib/components/stats/Stats.svelte");
    await switchView("Stats");
    await vi.waitFor(() =>
      expect(target.querySelector(".stat-card .headline")?.textContent).toMatch(
        /3\s+visits/,
      ),
    );
    expect(
      [...target.querySelectorAll(".stat-card .eyebrow")]
        .slice(0, 2)
        .map((heading) => heading.textContent),
    ).toEqual(["Your browsing history", "Your top website"]);
    expect(target.textContent).toMatch(/2\s+pages on\s+1\s+website/);
    expect(historyLinks()).toEqual([]);
    expect(target.querySelector(".heatmap")).toBeNull();
    expect(target.textContent).not.toContain("Clear selection");

    await switchView("Days");
    await vi.waitFor(() =>
      expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]),
    );
  }, 30_000);

  it("renders only the visits near the viewport of a very busy day", async () => {
    const day = new Date(2026, 8, 12).getTime();
    visitsByUrl.set(
      repeatedUrl,
      Array.from({ length: 3000 }, (_, i) =>
        chromeVisit(`busy-${i}`, new Date(day + i * 20_000)),
      ),
    );
    visitsByUrl.delete(otherUrl);
    completeSearch();

    const rendered = () =>
      [...target.querySelectorAll<HTMLElement>(".moments li")].map((li) =>
        Number(li.getAttribute("aria-posinset")),
      );
    await vi.waitFor(() => expect(rendered()).toContain(1));
    expect(rendered().length).toBeLessThan(50);
    expect(
      target.querySelector(".moments li")?.getAttribute("aria-setsize"),
    ).toBe("3000");

    // Rows measure 48px in this test; jump to the middle of the day.
    const scroller = target.querySelector<HTMLElement>(".wrapper")!;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      value: 1500 * 48,
    });
    scroller.dispatchEvent(new Event("scroll"));
    await vi.waitFor(() => expect(rendered()).toContain(1500));
    expect(rendered()).not.toContain(1);
    expect(rendered().length).toBeLessThan(50);
  });

  it("moves focus to the next visit after deleting from a focused row", async () => {
    await loadHistory();
    const deleteButton = (url: string) =>
      [
        ...target.querySelectorAll<HTMLButtonElement>(
          `button[aria-label="Delete all visits to ${url}, including visits on other days"]`,
        ),
      ][0];
    deleteButton(repeatedUrl).focus();
    deleteButton(repeatedUrl).click();
    deleteUrl.mock.lastCall![1]();

    await vi.waitFor(() => expect(historyLinks()).toEqual([otherUrl]));
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(deleteButton(otherUrl)),
    );
  });

  it("handles deleting the final result from a focused row", async () => {
    visitsByUrl.delete(otherUrl);
    completeSearch();
    await vi.waitFor(() =>
      expect(historyLinks()).toEqual([repeatedUrl, repeatedUrl]),
    );
    const deleteButton = target.querySelector<HTMLButtonElement>(
      `button[aria-label="Delete all visits to ${repeatedUrl}, including visits on other days"]`,
    )!;
    deleteButton.focus();
    deleteButton.click();
    // Focus recovery runs in an effect; Vitest fails the run on any error it
    // throws once the list is empty.
    deleteUrl.mock.lastCall![1]();

    await vi.waitFor(() =>
      expect(target.textContent).toContain("No results found"),
    );
    await tick();
  });

  it("keeps a focused row's element while scrolling away and back", async () => {
    const day = new Date(2026, 8, 12).getTime();
    visitsByUrl.set(
      repeatedUrl,
      Array.from({ length: 3000 }, (_, i) =>
        chromeVisit(`busy-${i}`, new Date(day + i * 20_000)),
      ),
    );
    visitsByUrl.delete(otherUrl);
    completeSearch();
    const row = (position: number) =>
      target.querySelector<HTMLElement>(
        `.moments li[aria-posinset="${position}"]`,
      );
    const rendered = () => target.querySelectorAll(".moments li").length;
    const scroller = target.querySelector<HTMLElement>(".wrapper")!;
    const scrollTo = async (top: number, visible: number) => {
      Object.defineProperty(scroller, "scrollTop", {
        configurable: true,
        value: top,
      });
      scroller.dispatchEvent(new Event("scroll"));
      await vi.waitFor(() => expect(row(visible)).not.toBeNull());
    };

    await vi.waitFor(() => expect(row(1)).not.toBeNull());
    // Rows measure 48px in this test.
    await scrollTo(1500 * 48, 1500);
    const focusTarget = row(1500)!.querySelector("button")!;
    focusTarget.focus();
    expect(document.activeElement).toBe(focusTarget);

    // Scroll upward past the focused row: it detaches into its own fragment.
    await scrollTo(1480 * 48, 1480);
    await scrollTo(1440 * 48, 1440);
    await scrollTo(0, 1);
    expect(row(1500)?.contains(focusTarget)).toBe(true);
    expect(document.activeElement).toBe(focusTarget);
    expect(rendered()).toBeLessThan(60);

    // Scroll back so the focused row rejoins the visible fragment.
    await scrollTo(1440 * 48, 1440);
    await scrollTo(1490 * 48, 1490);
    expect(row(1500)?.contains(focusTarget)).toBe(true);
    expect(document.activeElement).toBe(focusTarget);
    expect(rendered()).toBeLessThan(60);

    // Rows below the focused row, then a jump above it, swap the order of
    // the visible and focused fragments; the focused one must not be moved.
    await scrollTo(1560 * 48, 1560);
    await scrollTo(1600 * 48, 1600);
    await scrollTo(0, 1);
    expect(row(1500)?.contains(focusTarget)).toBe(true);
    expect(document.activeElement).toBe(focusTarget);
  });
});

describe("hash routing", () => {
  const atHash = (hash: string) =>
    vi.waitFor(() => expect(location.hash).toBe(hash));

  function typeSearch(query: string) {
    const input = searchInput();
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("opens the view and search from the URL", async () => {
    await mountApp("#/hours?q=other");
    completeSearch();
    await vi.waitFor(() => expect(historyLinks()).toEqual([otherUrl]));

    expect(currentView()).toBe("Hours");
    expect(searchInput().value).toBe("other");
    expect(button("Toggle moment for 2026-09-11 at 14:00")).toBeDefined();
    // Switching views keeps the search.
    expect(viewLink("Stats").getAttribute("href")).toBe("#/stats?q=other");
    expect(viewLink("Days").getAttribute("href")).toBe("#/days?q=other");
  });

  it("falls back to days for an unknown view", async () => {
    await mountApp("#/nope");
    await loadHistory();
    expect(currentView()).toBe("Days");
    expect(button("Toggle moment for 2026-09-12")).toBeDefined();
  });

  it("follows back and forward between views and clears the selection", async () => {
    await loadHistory();
    await switchView("Hours");
    button("Toggle moment for 2026-09-12 at 09:00").click();
    await tick();
    expect(historyLinks()).toEqual([repeatedUrl]);

    history.back();
    await vi.waitFor(() => expect(currentView()).toBe("Days"));
    expect(target.querySelector('[data-selected="true"]')).toBeNull();
    expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]);

    history.forward();
    await vi.waitFor(() => expect(currentView()).toBe("Hours"));
    expect(location.hash).toBe("#/hours");
    expect(target.querySelector('[data-selected="true"]')).toBeNull();
  });

  it("keeps the search in the URL without adding history entries", async () => {
    await loadHistory();
    const entries = history.length;

    typeSearch("other");
    await atHash("#/days?q=other");
    await vi.waitFor(() => expect(historyLinks()).toEqual([otherUrl]));
    typeSearch("other page");
    await atHash("#/days?q=other+page");
    expect(history.length).toBe(entries);

    await switchView("Hours");
    expect(location.hash).toBe("#/hours?q=other+page");
    expect(searchInput().value).toBe("other page");
    expect(history.length).toBe(entries + 1);

    // Back skips the typing and returns to the previous view and its search.
    history.back();
    await vi.waitFor(() => expect(currentView()).toBe("Days"));
    expect(location.hash).toBe("#/days?q=other+page");
    expect(searchInput().value).toBe("other page");

    typeSearch("");
    await atHash("#/days");
    await vi.waitFor(() =>
      expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]),
    );
  });

  it("shows a search changed through the URL", async () => {
    await loadHistory();
    location.hash = "#/days?q=repeated";
    await vi.waitFor(() => expect(searchInput().value).toBe("repeated"));
    await vi.waitFor(() =>
      expect(historyLinks()).toEqual([repeatedUrl, repeatedUrl]),
    );
  });
});
