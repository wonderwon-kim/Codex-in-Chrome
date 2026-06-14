const AUTH_KEY = "codex_auth";
const SETTINGS_KEY = "codex_settings";

const DEFAULT_SETTINGS = {
  alwaysAllowBrowserContent: false,
  allowedHosts: [],
  blockedHosts: [],
  historyAccessAllowed: false
};

export async function getAuth() {
  if (!globalThis.chrome?.storage?.local) return null;
  const result = await chrome.storage.local.get(AUTH_KEY);
  return result[AUTH_KEY] || null;
}

export async function setAuth(auth) {
  if (!globalThis.chrome?.storage?.local) return;
  await chrome.storage.local.set({ [AUTH_KEY]: auth });
}

export async function clearAuth() {
  if (!globalThis.chrome?.storage?.local) return;
  await chrome.storage.local.remove(AUTH_KEY);
}

export async function getSettings() {
  if (!globalThis.chrome?.storage?.local) return DEFAULT_SETTINGS;
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
}

export async function setSettings(settings) {
  if (!globalThis.chrome?.storage?.local) return;
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...DEFAULT_SETTINGS, ...settings } });
}

export function tokenIsExpired(auth, skewMs = 60000) {
  if (!auth?.expiresAt) return true;
  return Date.now() + skewMs >= auth.expiresAt;
}
