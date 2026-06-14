import { CODEX_EXTENSION_CONFIG, getRuntimeConfig, isOAuthConfigured } from "./config.js";
import { clearAuth, getAuth, setAuth, tokenIsExpired } from "./storage.js";

const CODE_VERIFIER_KEY = "codex_oauth_code_verifier";

export class OAuthConfigurationError extends Error {
  constructor() {
    super("Codex OAuth is not configured. Set authorizationEndpoint, tokenEndpoint, and clientId in src/config.js.");
    this.name = "OAuthConfigurationError";
  }
}

export async function signIn(config = CODEX_EXTENSION_CONFIG) {
  config = await resolveConfig(config);
  if (!isOAuthConfigured(config)) throw new OAuthConfigurationError();

  const redirectUri = chrome.identity.getRedirectURL("oauth2");
  const verifier = createVerifier();
  const challenge = await createChallenge(verifier);
  await chrome.storage.session.set({ [CODE_VERIFIER_KEY]: verifier });

  const authUrl = new URL(config.oauth.authorizationEndpoint);
  authUrl.searchParams.set("client_id", config.oauth.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", config.oauth.scope);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const callbackUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true
  });

  const callback = new URL(callbackUrl);
  const error = callback.searchParams.get("error");
  if (error) throw new Error(callback.searchParams.get("error_description") || error);

  const code = callback.searchParams.get("code");
  if (!code) throw new Error("OAuth callback did not include an authorization code.");

  const token = await exchangeCodeForToken(code, redirectUri, config);
  await setAuth(normalizeToken(token));
  await chrome.storage.session.remove(CODE_VERIFIER_KEY);
  return getAuth();
}

export async function getAccessToken(config = CODEX_EXTENSION_CONFIG) {
  config = await resolveConfig(config);
  const auth = await getAuth();
  if (!auth) return null;
  if (!tokenIsExpired(auth)) return auth.accessToken;
  if (!auth.refreshToken) return null;

  const token = await refreshToken(auth.refreshToken, config);
  const nextAuth = normalizeToken(token, auth.refreshToken);
  await setAuth(nextAuth);
  return nextAuth.accessToken;
}

export async function signOut(config = CODEX_EXTENSION_CONFIG) {
  config = await resolveConfig(config);
  const auth = await getAuth();
  if (auth?.refreshToken && config.oauth.revocationEndpoint) {
    try {
      await fetch(config.oauth.revocationEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: auth.refreshToken,
          client_id: config.oauth.clientId
        })
      });
    } catch {
      // Local sign-out must still succeed if network revocation fails.
    }
  }
  await clearAuth();
}

async function exchangeCodeForToken(code, redirectUri, config) {
  const { [CODE_VERIFIER_KEY]: verifier } = await chrome.storage.session.get(CODE_VERIFIER_KEY);
  const response = await fetch(config.oauth.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.oauth.clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier
    })
  });
  return readTokenResponse(response);
}

async function refreshToken(refreshTokenValue, config) {
  const response = await fetch(config.oauth.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.oauth.clientId,
      refresh_token: refreshTokenValue
    })
  });
  return readTokenResponse(response);
}

async function readTokenResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error_description || body.error || `OAuth token request failed with ${response.status}`);
  }
  return body;
}

function normalizeToken(token, fallbackRefreshToken = null) {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || fallbackRefreshToken,
    idToken: token.id_token || null,
    tokenType: token.token_type || "Bearer",
    expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000
  };
}

function createVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return base64Url(bytes);
}

async function createChallenge(verifier) {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes) {
  let value = "";
  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function resolveConfig(config) {
  return config === CODEX_EXTENSION_CONFIG ? getRuntimeConfig() : config;
}
