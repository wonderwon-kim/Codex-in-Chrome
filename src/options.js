import { getRuntimeConfig, isApiConfigured, isOAuthConfigured, setRuntimeConfig } from "./config.js";
import { getSettings, setSettings } from "./storage.js";

let settings = await getSettings();
let serviceConfig = await getRuntimeConfig();

renderConfigStatus();
renderServiceForm();
renderSettings();

document.querySelector("#serviceForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  serviceConfig = {
    oauth: {
      authorizationEndpoint: document.querySelector("#authorizationEndpoint").value.trim(),
      tokenEndpoint: document.querySelector("#tokenEndpoint").value.trim(),
      revocationEndpoint: document.querySelector("#revocationEndpoint").value.trim(),
      clientId: document.querySelector("#clientId").value.trim(),
      scope: document.querySelector("#scope").value.trim()
    },
    api: {
      baseUrl: document.querySelector("#apiBaseUrl").value.trim(),
      taskPath: document.querySelector("#taskPath").value.trim()
    },
    nativeHost: document.querySelector("#nativeHost").value.trim(),
    taskTransport: document.querySelector("#taskTransport").value
  };
  await setRuntimeConfig(serviceConfig);
  serviceConfig = await getRuntimeConfig();
  renderConfigStatus();
  renderServiceForm();
});

document.querySelector("#hostForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#hostInput");
  const host = normalizeHost(input.value);
  if (!host || settings.allowedHosts.includes(host)) return;
  settings.allowedHosts = [...settings.allowedHosts, host].sort();
  settings.blockedHosts = settings.blockedHosts.filter((blockedHost) => blockedHost !== host);
  input.value = "";
  await persist();
});

document.querySelector("#blockHostForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#blockHostInput");
  const host = normalizeHost(input.value);
  if (!host || settings.blockedHosts.includes(host)) return;
  settings.blockedHosts = [...settings.blockedHosts, host].sort();
  settings.allowedHosts = settings.allowedHosts.filter((allowedHost) => allowedHost !== host);
  input.value = "";
  await persist();
});

document.querySelector("#alwaysAllowBrowserContent").addEventListener("change", async (event) => {
  settings.alwaysAllowBrowserContent = event.target.checked;
  await persist();
});

document.querySelector("#historyAccessAllowed").addEventListener("change", async (event) => {
  settings.historyAccessAllowed = event.target.checked;
  await persist();
});

function renderConfigStatus() {
  document.querySelector("#configStatus").innerHTML = `
    <dt>OAuth</dt><dd>${isOAuthConfigured(serviceConfig) ? "Configured" : "Missing endpoint or client ID"}</dd>
    <dt>API</dt><dd>${isApiConfigured(serviceConfig) ? escapeHtml(serviceConfig.api.baseUrl) : "Missing API base URL"}</dd>
    <dt>Native host</dt><dd>${escapeHtml(serviceConfig.nativeHost)}</dd>
    <dt>Transport</dt><dd>${escapeHtml(serviceConfig.taskTransport)}</dd>
  `;
}

function renderServiceForm() {
  document.querySelector("#authorizationEndpoint").value = serviceConfig.oauth.authorizationEndpoint;
  document.querySelector("#tokenEndpoint").value = serviceConfig.oauth.tokenEndpoint;
  document.querySelector("#revocationEndpoint").value = serviceConfig.oauth.revocationEndpoint;
  document.querySelector("#clientId").value = serviceConfig.oauth.clientId;
  document.querySelector("#scope").value = serviceConfig.oauth.scope;
  document.querySelector("#apiBaseUrl").value = serviceConfig.api.baseUrl;
  document.querySelector("#taskPath").value = serviceConfig.api.taskPath;
  document.querySelector("#nativeHost").value = serviceConfig.nativeHost;
  document.querySelector("#taskTransport").value = serviceConfig.taskTransport;
}

function renderSettings() {
  document.querySelector("#alwaysAllowBrowserContent").checked = settings.alwaysAllowBrowserContent;
  document.querySelector("#historyAccessAllowed").checked = settings.historyAccessAllowed;
  renderHostList("#allowedHosts", "allowedHosts", settings.allowedHosts);
  renderHostList("#blockedHosts", "blockedHosts", settings.blockedHosts);
}

function renderHostList(selector, key, hosts) {
  document.querySelector(selector).innerHTML = hosts.map((host) => `
    <span class="host-chip">
      ${escapeHtml(host)}
      <button type="button" data-key="${key}" data-host="${escapeHtml(host)}" aria-label="Remove ${escapeHtml(host)}">x</button>
    </span>
  `).join("");

  document.querySelectorAll(`${selector} [data-host]`).forEach((button) => {
    button.addEventListener("click", async () => {
      settings[button.dataset.key] = settings[button.dataset.key].filter((host) => host !== button.dataset.host);
      await persist();
    });
  });
}

async function persist() {
  await setSettings(settings);
  settings = await getSettings();
  renderSettings();
}

function normalizeHost(value) {
  return value.trim().replace(/^https?:\/\//, "").split("/")[0].toLowerCase().replace(/[^a-z0-9.-]/g, "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}
