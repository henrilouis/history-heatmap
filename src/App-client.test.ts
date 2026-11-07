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
const updateTab =
  vi.fn<
    (properties: chrome.tabs.UpdateProperties, callback: () => void) => void
  >();
const containsPermissions =
  vi.fn<(permissions: chrome.permissions.Permissions) => Promise<boolean>>();
const requestPermissions =
  vi.fn<(permissions: chrome.permissions.Permissions) => Promise<boolean>>();
const getDevices = vi.fn<() => Promise<chrome.sessions.Device[]>>();
type PermissionsListener = (
  permissions: chrome.permissions.Permissions,
) => void;
let permissionsRemoved: PermissionsListener | undefined;
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
const originalClientHeight = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "clientHeight",
);
/** Measured height of every row; the list's estimate for a visit row. */
const ROW_HEIGHT = 34;

beforeEach(async () => {
  search.mockReset();
  getVisits.mockReset();
  deleteUrl.mockReset();
  containsPermissions.mockResolvedValue(false);
  requestPermissions.mockResolvedValue(true);
  getDevices.mockResolvedValue([]);
  permissionsRemoved = undefined;
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
  // container's clientHeight and measures rendered rows through offsetHeight.
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
      return this.classList.contains("wrapper") ? 800 : ROW_HEIGHT;
    },
  });
  Object.defineProperty(Element.prototype, "clientHeight", {
    configurable: true,
    get(this: Element) {
      return this.classList.contains("wrapper") ? 800 : 0;
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
    tabs: { update: updateTab },
    permissions: {
      contains: containsPermissions,
      request: requestPermissions,
      onAdded: { addListener: vi.fn(), removeListener: vi.fn() },
      onRemoved: {
        addListener: (listener: PermissionsListener) => {
          permissionsRemoved = listener;
        },
        removeListener: vi.fn(),
      },
    },
    sessions: { getDevices },
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
  if (originalClientHeight)
    Object.defineProperty(
      Element.prototype,
      "clientHeight",
      originalClientHeight,
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
  it("groups the list into flows, also within a selection", async () => {
    visitsByUrl.set(repeatedUrl, [
      chromeVisit("older", new Date(2026, 8, 10, 18)),
      chromeVisit("root", new Date(2026, 8, 12, 9)),
      chromeVisit("again", new Date(2026, 8, 12, 9, 5), {
        referringVisitId: "next",
      }),
    ]);
    visitsByUrl.set(otherUrl, [
      chromeVisit("next", new Date(2026, 8, 12, 9, 2), {
        referringVisitId: "root",
      }),
    ]);
    completeSearch();
    await vi.waitFor(() => expect(historyLinks()).toHaveLength(4));
    const cards = () =>
      [...target.querySelectorAll(".moments header")].map((header) => ({
        title: header.querySelector("h3")?.textContent,
        span: header.querySelector("p")?.textContent,
      }));

    button("By flow").click();
    await vi.waitFor(() =>
      expect(cards()).toEqual([
        { title: "example.com", span: expect.stringMatching(/ · 3 visits$/) },
        { title: "example.com", span: expect.stringMatching(/ · 1 visit$/) },
      ]),
    );
    expect(historyLinks()).toEqual([
      repeatedUrl,
      otherUrl,
      repeatedUrl,
      repeatedUrl,
    ]);

    button("Toggle moment for 2026-09-10").click();
    await vi.waitFor(() => expect(historyLinks()).toEqual([repeatedUrl]));
    expect(cards()).toEqual([
      { title: "example.com", span: expect.stringMatching(/ · 1 visit$/) },
    ]);

    // A search can leave nothing to show in the selection.
    location.hash = "#/days?q=other&group=flow";
    await vi.waitFor(() =>
      expect(target.textContent).toContain("No results found"),
    );

    button("By time").click();
    await vi.waitFor(() =>
      expect(target.textContent).toContain("No results for this time"),
    );
    expect(cards()).toEqual([
      { title: expect.stringContaining("2026"), span: undefined },
    ]);
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

  it("opens Chrome's clear browsing data settings from the header", () => {
    button("Delete browsing data").click();

    expect(updateTab).toHaveBeenCalledExactlyOnceWith(
      { url: "chrome://settings/clearBrowserData" },
      expect.any(Function),
    );
  });

  it("shows loading progress in the search placeholder and announces the load", async () => {
    const status = () =>
      target.querySelector('header [role="status"]')?.textContent;
    const zeroPercent = new Intl.NumberFormat(undefined, {
      style: "percent",
    }).format(0);
    // The inputs stay available while loading; only the placeholder changes.
    expect(searchInput().placeholder).toBe("Loading history…");
    expect(currentView()).toBe("Days");
    expect(status()).toBe("Loading history…");
    expect(target.querySelector("progress")).toBeNull();

    const pending: [string, VisitsCallback][] = [];
    getVisits.mockImplementation(({ url }, callback) => {
      pending.push([url, callback]);
    });
    completeSearch();
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    await tick();
    expect(searchInput().placeholder).toBe(`Loading history… ${zeroPercent}`);

    for (const [url, callback] of pending) callback(visitsByUrl.get(url)!);
    await vi.waitFor(() =>
      expect(historyLinks()).toEqual([repeatedUrl, otherUrl, repeatedUrl]),
    );
    expect(searchInput().placeholder).toBe("Search...");
    expect(status()).toBe("History loaded");
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
    expect(target.querySelector('header [role="status"]')?.textContent).toBe(
      "",
    );

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
      expect(
        target.querySelector('.wrapper > [role="status"]')?.textContent,
      ).toContain("Some recent visits could not be refreshed"),
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
    expect(target.querySelector('.wrapper > [role="status"]')).toBeNull();
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
    expect(target.textContent).not.toContain("By flow");

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

    // Rows measure ROW_HEIGHT in this test; jump to the middle of the day.
    const scroller = target.querySelector<HTMLElement>(".wrapper")!;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      value: 1500 * ROW_HEIGHT,
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
    // Rows measure ROW_HEIGHT in this test.
    await scrollTo(1500 * ROW_HEIGHT, 1500);
    const focusTarget = row(1500)!.querySelector("button")!;
    focusTarget.focus();
    expect(document.activeElement).toBe(focusTarget);

    // Scroll upward past the focused row: it detaches into its own fragment.
    await scrollTo(1480 * ROW_HEIGHT, 1480);
    await scrollTo(1440 * ROW_HEIGHT, 1440);
    await scrollTo(0, 1);
    expect(row(1500)?.contains(focusTarget)).toBe(true);
    expect(document.activeElement).toBe(focusTarget);
    expect(rendered()).toBeLessThan(60);

    // Scroll back so the focused row rejoins the visible fragment.
    await scrollTo(1440 * ROW_HEIGHT, 1440);
    await scrollTo(1490 * ROW_HEIGHT, 1490);
    expect(row(1500)?.contains(focusTarget)).toBe(true);
    expect(document.activeElement).toBe(focusTarget);
    expect(rendered()).toBeLessThan(60);

    // Rows below the focused row, then a jump above it, swap the order of
    // the visible and focused fragments; the focused one must not be moved.
    await scrollTo(1560 * ROW_HEIGHT, 1560);
    await scrollTo(1600 * ROW_HEIGHT, 1600);
    await scrollTo(0, 1);
    expect(row(1500)?.contains(focusTarget)).toBe(true);
    expect(document.activeElement).toBe(focusTarget);
  });
});

const atHash = (hash: string) =>
  vi.waitFor(() => expect(location.hash).toBe(hash));

describe("hash routing", () => {
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

  it("keeps the grouping when switching views", async () => {
    await mountApp("#/hours?group=flow");
    completeSearch();
    await vi.waitFor(() => expect(currentView()).toBe("Hours"));

    expect(viewLink("Stats").getAttribute("href")).toBe("#/stats?group=flow");
    await switchView("Days");
    expect(location.hash).toBe("#/days?group=flow");
  });

  it("switches the grouping without adding history entries", async () => {
    await loadHistory();
    const pressed = () =>
      ["By time", "By flow"].filter(
        (name) => button(name).getAttribute("aria-pressed") === "true",
      );
    expect(pressed()).toEqual(["By time"]);
    const entries = history.length;

    button("By flow").click();
    await atHash("#/days?group=flow");
    await tick();
    expect(pressed()).toEqual(["By flow"]);
    expect(history.length).toBe(entries);

    await switchView("Hours");
    expect(location.hash).toBe("#/hours?group=flow");
    history.back();
    await vi.waitFor(() => expect(currentView()).toBe("Days"));
    expect(location.hash).toBe("#/days?group=flow");
    expect(pressed()).toEqual(["By flow"]);

    button("By time").click();
    await atHash("#/days");
    await tick();
    expect(pressed()).toEqual(["By time"]);
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

  it("drops a pending search edit when navigating back", async () => {
    await mountApp("#/days?q=repeated");
    completeSearch();
    await vi.waitFor(() =>
      expect(historyLinks()).toEqual([repeatedUrl, repeatedUrl]),
    );
    await switchView("Hours");
    expect(location.hash).toBe("#/hours?q=repeated");

    // Press Back before the 300 ms search debounce commits the edit. Both
    // entries share the same search, so only navigation itself can reset it.
    typeSearch("other");
    history.back();
    await vi.waitFor(() => expect(currentView()).toBe("Days"));
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(location.hash).toBe("#/days?q=repeated");
    expect(searchInput().value).toBe("repeated");
    expect(historyLinks()).toEqual([repeatedUrl, repeatedUrl]);
  });
});

describe("devices view", () => {
  const now = Math.floor(Date.now() / 1000);
  const devices: chrome.sessions.Device[] = [
    {
      deviceName: "Pixel",
      sessions: [
        {
          lastModified: now - 5 * 60,
          window: {
            tabs: [
              { url: "https://news.example/", title: "Morning news" },
              { url: "https://docs.example/", title: "Docs" },
            ],
          } as chrome.windows.Window,
        },
      ],
    },
    {
      deviceName: "Laptop",
      sessions: [
        {
          lastModified: now - 3 * 3600,
          window: {
            tabs: [{ url: "https://code.example/", title: "Code review" }],
          } as chrome.windows.Window,
        },
      ],
    },
  ];

  function deviceCards(): { name: string; links: string[] }[] {
    return [...target.querySelectorAll(".devices article")].map((card) => ({
      name: card.getAttribute("aria-label") ?? "",
      links: [...card.querySelectorAll("a")].map((link) => link.href),
    }));
  }

  async function openDevices(hash = "#/devices") {
    // Warm the lazily loaded view, as for stats, so waitFor stays short.
    await import("./lib/components/devices/Devices.svelte");
    await mountApp(hash);
  }

  it("asks for permission, then shows the tabs of each device", async () => {
    getDevices.mockResolvedValue(devices);
    await openDevices();
    await vi.waitFor(() =>
      expect(target.textContent).toContain("needs permission"),
    );
    expect(getDevices).not.toHaveBeenCalled();
    expect(currentView()).toBe("Devices");
    expect(target.querySelector(".heatmap")).toBeNull();

    button("Show tabs from other devices").click();
    expect(requestPermissions).toHaveBeenCalledExactlyOnceWith({
      permissions: ["sessions", "tabs"],
    });
    await vi.waitFor(() =>
      expect(deviceCards()).toEqual([
        {
          name: "Pixel",
          links: ["https://news.example/", "https://docs.example/"],
        },
        { name: "Laptop", links: ["https://code.example/"] },
      ]),
    );
    expect(target.textContent).toMatch(/Updated 5 minutes ago · 2 tabs/);
    expect(target.textContent).toMatch(/Updated 3 hours ago · 1 tab\b/);
  });

  it("stays on the permission card when the request is declined", async () => {
    requestPermissions.mockResolvedValue(false);
    await openDevices();
    await vi.waitFor(() =>
      expect(target.textContent).toContain("needs permission"),
    );

    button("Show tabs from other devices").click();
    await tick();
    await Promise.resolve();

    expect(getDevices).not.toHaveBeenCalled();
    expect(target.textContent).toContain("needs permission");
  });

  it("filters tabs by the search", async () => {
    containsPermissions.mockResolvedValue(true);
    getDevices.mockResolvedValue(devices);
    await openDevices("#/devices?q=docs");

    await vi.waitFor(() =>
      expect(deviceCards()).toEqual([
        { name: "Pixel", links: ["https://docs.example/"] },
      ]),
    );
    expect(viewLink("Days").getAttribute("href")).toBe("#/days?q=docs");
  });

  it("explains how to sync tabs when there are no other devices", async () => {
    containsPermissions.mockResolvedValue(true);
    await openDevices();
    await vi.waitFor(() =>
      expect(target.textContent).toContain("No tabs from other devices"),
    );

    button("Open sync settings").click();
    expect(updateTab).toHaveBeenCalledExactlyOnceWith(
      { url: "chrome://settings/syncSetup" },
      expect.any(Function),
    );
  });

  it("refreshes when the page regains focus and hides tabs once access is revoked", async () => {
    containsPermissions.mockResolvedValue(true);
    getDevices.mockResolvedValue(devices.slice(1));
    await openDevices();
    await vi.waitFor(() =>
      expect(deviceCards().map((card) => card.name)).toEqual(["Laptop"]),
    );

    getDevices.mockResolvedValue(devices);
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() =>
      expect(deviceCards().map((card) => card.name)).toEqual([
        "Pixel",
        "Laptop",
      ]),
    );

    containsPermissions.mockResolvedValue(false);
    permissionsRemoved!({ permissions: ["tabs"] });
    await vi.waitFor(() =>
      expect(target.textContent).toContain("needs permission"),
    );
    expect(deviceCards().flatMap((card) => card.links)).toEqual([]);
  });

  it("keeps the shown tabs when a refresh fails and recovers through Retry", async () => {
    containsPermissions.mockResolvedValue(true);
    getDevices.mockResolvedValue(devices.slice(1));
    await openDevices();
    await vi.waitFor(() => expect(deviceCards()).toHaveLength(1));

    getDevices.mockRejectedValue(new Error("Sync unavailable"));
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() =>
      expect(target.textContent).toContain(
        "Couldn't refresh tabs from other devices.",
      ),
    );
    expect(deviceCards().map((card) => card.name)).toEqual(["Laptop"]);

    getDevices.mockResolvedValue(devices);
    button("Retry").click();
    await vi.waitFor(() => expect(deviceCards()).toHaveLength(2));
    expect(target.textContent).not.toContain("Couldn't refresh");
  });

  it("shows a first load failure with Retry", async () => {
    containsPermissions.mockResolvedValue(true);
    getDevices.mockRejectedValue(new Error("Sync unavailable"));
    await openDevices();
    await vi.waitFor(() =>
      expect(target.querySelector('[role="alert"]')?.textContent).toContain(
        "Sync unavailable",
      ),
    );

    getDevices.mockResolvedValue(devices);
    button("Retry").click();
    await vi.waitFor(() => expect(deviceCards()).toHaveLength(2));
  });

  it("hides tabs when access is revoked while a refresh is starting", async () => {
    containsPermissions.mockResolvedValue(true);
    getDevices.mockResolvedValue(devices);
    await openDevices();
    await vi.waitFor(() => expect(deviceCards()).toHaveLength(2));

    // Without sessions, the refresh fails; it must not keep the old tabs.
    containsPermissions.mockResolvedValue(false);
    getDevices.mockRejectedValue(new Error("Permission denied"));
    permissionsRemoved!({ permissions: ["sessions"] });
    window.dispatchEvent(new Event("focus"));

    await vi.waitFor(() =>
      expect(target.textContent).toContain("needs permission"),
    );
    await tick();
    expect(deviceCards().flatMap((card) => card.links)).toEqual([]);
    expect(target.textContent).not.toContain("Couldn't refresh");
  });

  it("offers Retry when a refresh fails after finding no devices", async () => {
    containsPermissions.mockResolvedValue(true);
    await openDevices();
    await vi.waitFor(() =>
      expect(target.textContent).toContain("No tabs from other devices"),
    );

    getDevices.mockRejectedValue(new Error("Sync unavailable"));
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() =>
      expect(target.textContent).toContain(
        "Couldn't refresh tabs from other devices.",
      ),
    );
    expect(target.textContent).toContain("No tabs from other devices");

    getDevices.mockResolvedValue(devices);
    button("Retry").click();
    await vi.waitFor(() => expect(deviceCards()).toHaveLength(2));
    expect(target.textContent).not.toContain("Couldn't refresh");
  });
});
