import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  affectsDevicePermissions,
  filterDeviceGroups,
  formatSyncedAgo,
  getDeviceGroups,
  hasDevicePermissions,
  requestDevicePermissions,
  toDeviceGroups,
  type DeviceGroup,
} from "./device-tabs";

function tab(
  url: string | undefined,
  title?: string,
  sessionId?: string,
): chrome.tabs.Tab {
  return { url, title, sessionId } as chrome.tabs.Tab;
}

function windowSession(
  lastModified: number,
  tabs: chrome.tabs.Tab[],
): chrome.sessions.Session {
  return { lastModified, window: { tabs } as chrome.windows.Window };
}

describe("toDeviceGroups", () => {
  it("flattens each device's windows in Chrome's order", () => {
    const groups = toDeviceGroups([
      {
        deviceName: "Phone",
        sessions: [
          windowSession(1_700_000_200, [
            tab("https://a.example/", "A", "phone.1"),
            tab("https://b.example/", "B", "phone.2"),
          ]),
          windowSession(1_700_000_100, [
            tab("https://c.example/", "C", "phone.3"),
          ]),
        ],
      },
      {
        deviceName: "Laptop",
        sessions: [
          windowSession(1_600_000_000, [
            tab("https://d.example/", "D", "laptop.1"),
          ]),
        ],
      },
    ]);

    expect(groups).toEqual([
      {
        key: "0:Phone",
        name: "Phone",
        lastModified: 1_700_000_200_000,
        tabs: [
          { key: "phone.1", url: "https://a.example/", title: "A" },
          { key: "phone.2", url: "https://b.example/", title: "B" },
          { key: "phone.3", url: "https://c.example/", title: "C" },
        ],
      },
      {
        key: "1:Laptop",
        name: "Laptop",
        lastModified: 1_600_000_000_000,
        tabs: [{ key: "laptop.1", url: "https://d.example/", title: "D" }],
      },
    ]);
  });

  it("skips tabs Chrome withheld the URL of and devices left without tabs", () => {
    const groups = toDeviceGroups([
      {
        deviceName: "Scrubbed",
        sessions: [windowSession(1, [tab(undefined)])],
      },
      { deviceName: "Idle", sessions: [] },
      {
        deviceName: "Laptop",
        sessions: [
          windowSession(2, [tab(undefined), tab("https://example.com/")]),
        ],
      },
    ]);

    expect(groups).toEqual([
      {
        key: "2:Laptop",
        name: "Laptop",
        lastModified: 2000,
        // Falls back to the URL as title and to its position as key.
        tabs: [
          {
            key: "2:0:1",
            url: "https://example.com/",
            title: "https://example.com/",
          },
        ],
      },
    ]);
  });

  it("keeps devices with the same name apart", () => {
    const device = {
      deviceName: "Chrome",
      sessions: [windowSession(1, [tab("https://example.com/")])],
    };

    const keys = toDeviceGroups([device, device]).map((group) => group.key);

    expect(new Set(keys).size).toBe(2);
  });
});

describe("filterDeviceGroups", () => {
  const groups: DeviceGroup[] = [
    {
      key: "0:Phone",
      name: "Phone",
      lastModified: 0,
      tabs: [
        { key: "1", url: "https://github.com/", title: "GitHub" },
        { key: "2", url: "https://news.example/", title: "Morning News" },
      ],
    },
    {
      key: "1:Laptop",
      name: "Laptop",
      lastModified: 0,
      tabs: [{ key: "3", url: "https://docs.example/", title: "Docs" }],
    },
  ];

  it("returns every group without a query", () => {
    expect(filterDeviceGroups(groups, "")).toBe(groups);
  });

  it("matches titles and URLs case-insensitively and drops empty devices", () => {
    expect(filterDeviceGroups(groups, "NEWS")).toEqual([
      { ...groups[0], tabs: [groups[0].tabs[1]] },
    ]);
    expect(filterDeviceGroups(groups, "github.com")).toEqual([
      { ...groups[0], tabs: [groups[0].tabs[0]] },
    ]);
    expect(filterDeviceGroups(groups, "nothing")).toEqual([]);
  });
});

describe("formatSyncedAgo", () => {
  const now = Date.UTC(2026, 9, 9, 12);
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  it.each([
    [0, "just now"],
    [59_000, "just now"],
    [60_000, "1 minute ago"],
    [5 * 60_000, "5 minutes ago"],
    [3 * 3_600_000, "3 hours ago"],
    [24 * 3_600_000, "yesterday"],
    [3 * 24 * 3_600_000, "3 days ago"],
    // Clocks on different devices can disagree.
    [-60_000, "just now"],
  ])("formats %d ms ago as '%s'", (age, expected) => {
    expect(formatSyncedAgo(now - age, now, format)).toBe(expected);
  });
});

describe("Chrome APIs", () => {
  const contains =
    vi.fn<(p: chrome.permissions.Permissions) => Promise<boolean>>();
  const request =
    vi.fn<(p: chrome.permissions.Permissions) => Promise<boolean>>();
  const getDevices = vi.fn<() => Promise<chrome.sessions.Device[]>>();

  beforeEach(() => {
    vi.stubGlobal("chrome", {
      permissions: { contains, request },
      sessions: { getDevices },
    });
  });

  it("checks and requests both sessions and tabs", async () => {
    contains.mockResolvedValue(false);
    request.mockResolvedValue(true);

    await expect(hasDevicePermissions()).resolves.toBe(false);
    await expect(requestDevicePermissions()).resolves.toBe(true);

    const permissions = { permissions: ["sessions", "tabs"] };
    expect(contains).toHaveBeenCalledExactlyOnceWith(permissions);
    expect(request).toHaveBeenCalledExactlyOnceWith(permissions);
  });

  it("requests the permission synchronously, within the user gesture", () => {
    request.mockResolvedValue(true);

    void requestDevicePermissions();

    expect(request).toHaveBeenCalledOnce();
  });

  it("loads device groups", async () => {
    getDevices.mockResolvedValue([
      {
        deviceName: "Phone",
        sessions: [windowSession(1, [tab("https://example.com/", "Example")])],
      },
    ]);

    await expect(getDeviceGroups()).resolves.toEqual([
      expect.objectContaining({ name: "Phone" }),
    ]);
  });

  it("recognises changes to either permission", () => {
    expect(affectsDevicePermissions({ permissions: ["tabs"] })).toBe(true);
    expect(affectsDevicePermissions({ permissions: ["sessions"] })).toBe(true);
    expect(affectsDevicePermissions({ permissions: ["history"] })).toBe(false);
    expect(affectsDevicePermissions({ origins: ["https://*/*"] })).toBe(false);
  });

  it.each([undefined, {}])(
    "rejects when Chrome APIs are unavailable (%j)",
    async (chromeApi) => {
      vi.stubGlobal("chrome", chromeApi);

      await expect(hasDevicePermissions()).rejects.toThrow(
        "Chrome permissions API not available",
      );
      await expect(getDeviceGroups()).rejects.toThrow(
        "Chrome sessions API not available",
      );
    },
  );
});
