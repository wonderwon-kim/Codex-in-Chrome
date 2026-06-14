import { getSettings } from "./storage.js";

export async function getHostDecision(url) {
  const settings = await getSettings();
  const host = new URL(url).host.toLowerCase();

  if (settings.blockedHosts.some((pattern) => hostMatches(host, pattern))) {
    return { allowed: false, host, reason: "This host is blocked." };
  }

  if (settings.alwaysAllowBrowserContent || settings.allowedHosts.some((pattern) => hostMatches(host, pattern))) {
    return { allowed: true, host };
  }

  if (isLocalhost(host)) return { allowed: true, host };

  return { allowed: false, host, reason: "Approve this host in settings before starting a task." };
}

function hostMatches(host, pattern) {
  const value = String(pattern || "").toLowerCase();
  if (!value) return false;
  if (value.startsWith("*.")) {
    const suffix = value.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return host === value || host.replace(/^www\./, "") === value.replace(/^www\./, "");
}

function isLocalhost(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
}
