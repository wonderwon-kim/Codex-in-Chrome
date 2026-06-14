import { CODEX_EXTENSION_CONFIG, getRuntimeConfig, isApiConfigured } from "./config.js";
import { getAccessToken } from "./oauth.js";

export class ApiConfigurationError extends Error {
  constructor() {
    super("Codex API base URL is not configured. Set api.baseUrl in src/config.js.");
    this.name = "ApiConfigurationError";
  }
}

export async function createChromeTask(payload, config = CODEX_EXTENSION_CONFIG) {
  config = config === CODEX_EXTENSION_CONFIG ? await getRuntimeConfig() : config;
  if (!isApiConfigured(config)) throw new ApiConfigurationError();

  const accessToken = await getAccessToken(config);
  if (!accessToken) throw new Error("Sign in to Codex before starting a browser task.");

  const url = new URL(config.api.taskPath, config.api.baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message || body.message || `Codex task request failed with ${response.status}`);
  }
  return body;
}
