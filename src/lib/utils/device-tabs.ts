// Tabs open on the user's other signed-in devices, from Chrome's tab sync.
// Reading their URLs and titles needs "tabs" as well as "sessions"; without
// it, Chrome strips both from every synced tab.
const DEVICE_PERMISSIONS: chrome.permissions.Permissions = {
  permissions: ["sessions", "tabs"],
};

export type DeviceTab = {
  /** Unique within the device list, for keyed rendering. */
  key: string;
  url: string;
  title: string;
};

export type DeviceGroup = {
  /** Device names need not be unique, so cards are keyed by this instead. */
  key: string;
  name: string;
  /** When the device last synced a change, in milliseconds since the epoch. */
  lastModified: number;
  tabs: DeviceTab[];
};

function permissionsApi(): typeof chrome.permissions {
  const api = globalThis.chrome?.permissions;
  if (!api) throw new Error("Chrome permissions API not available");
  return api;
}

export async function hasDevicePermissions(): Promise<boolean> {
  return permissionsApi().contains(DEVICE_PERMISSIONS);
}

/** Must be called from a user gesture, before any other await. */
export async function requestDevicePermissions(): Promise<boolean> {
  return permissionsApi().request(DEVICE_PERMISSIONS);
}

/** Whether a permission change can affect access to device tabs. */
export function affectsDevicePermissions(
  changed: chrome.permissions.Permissions,
): boolean {
  return !!changed.permissions?.some((permission) =>
    DEVICE_PERMISSIONS.permissions!.includes(permission),
  );
}

export async function getDeviceGroups(): Promise<DeviceGroup[]> {
  const api = globalThis.chrome?.sessions;
  if (!api) throw new Error("Chrome sessions API not available");
  return toDeviceGroups(await api.getDevices());
}

/**
 * One group per device, keeping Chrome's order: most recently synced device
 * first, and the most recently used window and tab first within it. Windows
 * are flattened into one list, as on Chrome's own page.
 */
export function toDeviceGroups(
  devices: chrome.sessions.Device[],
): DeviceGroup[] {
  const groups: DeviceGroup[] = [];
  devices.forEach((device, deviceIndex) => {
    let lastModified = 0;
    const tabs: DeviceTab[] = [];
    device.sessions.forEach((session, sessionIndex) => {
      lastModified = Math.max(lastModified, session.lastModified * 1000);
      const windowTabs =
        session.window?.tabs ?? (session.tab ? [session.tab] : []);
      windowTabs.forEach((tab, tabIndex) => {
        // Chrome omits the URL when the extension may not read it.
        if (!tab.url) return;
        tabs.push({
          key: tab.sessionId ?? `${deviceIndex}:${sessionIndex}:${tabIndex}`,
          url: tab.url,
          title: tab.title || tab.url,
        });
      });
    });
    if (tabs.length)
      groups.push({
        key: `${deviceIndex}:${device.deviceName}`,
        name: device.deviceName,
        lastModified,
        tabs,
      });
  });
  return groups;
}

export function filterDeviceGroups(
  groups: DeviceGroup[],
  query: string,
): DeviceGroup[] {
  if (!query) return groups;
  const normalized = query.toLowerCase();
  return groups.flatMap((group) => {
    const tabs = group.tabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(normalized) ||
        tab.url.toLowerCase().includes(normalized),
    );
    return tabs.length ? [{ ...group, tabs }] : [];
  });
}

const relativeTime = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

/** "just now", "5 minutes ago", "yesterday", … */
export function formatSyncedAgo(
  time: number,
  now = Date.now(),
  format = relativeTime,
): string {
  const seconds = Math.max(0, (now - time) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return format.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return format.format(-hours, "hour");
  return format.format(-Math.floor(hours / 24), "day");
}
