export const SERVICE_CONFIG_KEY = "codex_service_config";

export const DEFAULT_CODEX_EXTENSION_CONFIG = {
  oauth: {
    authorizationEndpoint: "",
    tokenEndpoint: "",
    revocationEndpoint: "",
    clientId: "",
    scope: "openid profile email codex.chrome"
  },
  api: {
    baseUrl: "",
    taskPath: "/v1/chrome/tasks"
  },
  nativeHost: "com.openai.codex_chrome",
  taskTransport: "native-first"
};

export const CODEX_EXTENSION_CONFIG = DEFAULT_CODEX_EXTENSION_CONFIG;

export async function getRuntimeConfig() {
  if (!globalThis.chrome?.storage?.local) return DEFAULT_CODEX_EXTENSION_CONFIG;
  const result = await chrome.storage.local.get(SERVICE_CONFIG_KEY);
  return mergeConfig(DEFAULT_CODEX_EXTENSION_CONFIG, result[SERVICE_CONFIG_KEY] || {});
}

export async function setRuntimeConfig(config) {
  await chrome.storage.local.set({
    [SERVICE_CONFIG_KEY]: mergeConfig(DEFAULT_CODEX_EXTENSION_CONFIG, config)
  });
}

export function isOAuthConfigured(config = CODEX_EXTENSION_CONFIG) {
  return Boolean(
    config.oauth.authorizationEndpoint &&
    config.oauth.tokenEndpoint &&
    config.oauth.clientId
  );
}

export function isApiConfigured(config = CODEX_EXTENSION_CONFIG) {
  return Boolean(config.api.baseUrl);
}

export function isTaskTransportConfigured(config = CODEX_EXTENSION_CONFIG) {
  return config.taskTransport === "native" ||
    config.taskTransport === "native-first" ||
    isApiConfigured(config);
}

function mergeConfig(base, override) {
  return {
    oauth: { ...base.oauth, ...(override.oauth || {}) },
    api: { ...base.api, ...(override.api || {}) },
    nativeHost: override.nativeHost || base.nativeHost,
    taskTransport: override.taskTransport || base.taskTransport
  };
}
