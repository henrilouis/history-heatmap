import {
  affectsDevicePermissions,
  getDeviceGroups,
  hasDevicePermissions,
  requestDevicePermissions,
  type DeviceGroup,
} from "../utils/device-tabs";

// Chrome emits no event when another device syncs its tabs, so the list is
// refreshed while the page is visible and whenever it is shown again.
const REFRESH_INTERVAL = 60_000;

type Access = "unknown" | "denied" | "granted";

let access = $state<Access>("unknown");
// Null until the first successful load; refreshes keep the previous list.
let groups = $state.raw<DeviceGroup[] | null>(null);
let isLoading = $state(false);
let error = $state<string | null>(null);
// Separate counters, so a refresh cannot discard a pending permission check.
let accessId = 0;
let loadId = 0;
let connected = false;

async function checkAccess(): Promise<void> {
  const id = ++accessId;
  try {
    const granted = await hasDevicePermissions();
    if (id !== accessId) return;
    setAccess(granted ? "granted" : "denied");
  } catch (e) {
    if (id !== accessId) return;
    access = "denied";
    error = message(e, "Failed to check permissions");
  }
}

function setAccess(next: Access): void {
  access = next;
  if (next === "granted") {
    void refresh();
  } else {
    // Revoking access must not leave previously read tabs on screen.
    loadId++;
    groups = null;
    isLoading = false;
    error = null;
  }
}

async function refresh(): Promise<void> {
  if (access !== "granted") return;
  const id = ++loadId;
  isLoading = true;
  try {
    const loaded = await getDeviceGroups();
    if (id !== loadId) return;
    groups = loaded;
    error = null;
  } catch (e) {
    if (id !== loadId) return;
    error = message(e, "Failed to load tabs from other devices");
  } finally {
    if (id === loadId) isLoading = false;
  }
}

/** Ask for access; call directly from a click so Chrome allows the request. */
async function requestAccess(): Promise<void> {
  try {
    const granted = await requestDevicePermissions();
    if (!granted) return;
    accessId++;
    setAccess("granted");
  } catch (e) {
    error = message(e, "Failed to request permission");
  }
}

function message(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

function onPermissionsAdded(changed: chrome.permissions.Permissions): void {
  if (affectsDevicePermissions(changed)) void checkAccess();
}

// Losing either permission ends access, so there is nothing to check.
function onPermissionsRemoved(changed: chrome.permissions.Permissions): void {
  if (!affectsDevicePermissions(changed)) return;
  accessId++;
  setAccess("denied");
}

function onVisible(): void {
  if (document.visibilityState === "visible") void refresh();
}

function connect(): () => void {
  if (connected) return () => {};
  connected = true;
  const permissions = globalThis.chrome?.permissions;
  permissions?.onAdded?.addListener(onPermissionsAdded);
  permissions?.onRemoved?.addListener(onPermissionsRemoved);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  const interval = setInterval(onVisible, REFRESH_INTERVAL);
  void checkAccess();

  return () => {
    connected = false;
    accessId++;
    loadId++;
    isLoading = false;
    permissions?.onAdded?.removeListener(onPermissionsAdded);
    permissions?.onRemoved?.removeListener(onPermissionsRemoved);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    clearInterval(interval);
  };
}

export const devicesStore = {
  get access() {
    return access;
  },
  get groups() {
    return groups;
  },
  get isLoading() {
    return isLoading;
  },
  get error() {
    return error;
  },
  connect,
  refresh,
  requestAccess,
};
