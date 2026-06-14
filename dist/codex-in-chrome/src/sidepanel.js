import { getRuntimeConfig, isOAuthConfigured, isTaskTransportConfigured } from "./config.js";
import { OAuthConfigurationError, signIn, signOut } from "./oauth.js";
import { getHostDecision } from "./permissions.js";
import { getAuth } from "./storage.js";
import { createCodexTask } from "./tasks.js";

let currentTab = null;
let currentContext = null;
let signedIn = false;

const statusText = document.querySelector("#statusText");
const connectionPill = document.querySelector("#connectionPill");
const signInButton = document.querySelector("#signInButton");
const inspectButton = document.querySelector("#inspectButton");
const startTaskButton = document.querySelector("#startTaskButton");
const settingsButton = document.querySelector("#settingsButton");
const hostLabel = document.querySelector("#hostLabel");
const prompt = document.querySelector("#prompt");
const activityLog = document.querySelector("#activityLog");

settingsButton.addEventListener("click", () => {
  if (globalThis.chrome?.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    logEvent("Load as an unpacked extension to open settings.");
  }
});
signInButton.addEventListener("click", handleAuthButton);
inspectButton.addEventListener("click", inspectActiveTab);
startTaskButton.addEventListener("click", startTask);

await refreshAuthState();
await inspectActiveTab({ quiet: true });
await ensureTaskGroupForCurrentTab({ quiet: true });

async function refreshAuthState() {
  const auth = await getAuth();
  const config = await getRuntimeConfig();
  signedIn = Boolean(auth?.accessToken);

  if (signedIn) {
    statusText.textContent = "Connected";
    connectionPill.innerHTML = '<span class="dot"></span>Connected to Codex';
    signInButton.textContent = "Sign out";
  } else {
    statusText.textContent = isOAuthConfigured(config) ? "Ready to sign in" : "OAuth setup required";
    connectionPill.innerHTML = '<span class="dot warn"></span>Not signed in';
    signInButton.textContent = "Sign in with Codex";
  }

  startTaskButton.disabled = !signedIn || !isTaskTransportConfigured(config);
}

async function handleAuthButton() {
  try {
    if (!globalThis.chrome?.identity) {
      logError("Load this folder as a Chrome extension to use Codex OAuth.");
      return;
    }
    if (signedIn) {
      await signOut();
      logEvent("Signed out of Codex.");
    } else {
      await signIn();
      logEvent("Signed in to Codex.");
    }
    await refreshAuthState();
  } catch (error) {
    logError(error instanceof OAuthConfigurationError ? error.message : `Sign-in failed: ${error.message}`);
  }
}

async function inspectActiveTab(options = {}) {
  try {
    if (!globalThis.chrome?.tabs) {
      hostLabel.textContent = "Preview mode";
      currentContext = { ok: true, title: "Preview", url: location.href, headings: ["Codex for Chrome"], interactiveTree: [] };
      if (!options.quiet) logEvent("Preview mode: load as an unpacked extension to inspect a real tab.");
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab || null;

    if (!tab?.id) throw new Error("No active tab is available.");
    hostLabel.textContent = new URL(tab.url).host;

    currentContext = await chrome.runtime.sendMessage({
      type: "PAGE_CONTEXT_FROM_TAB",
      tabId: tab.id
    });

    if (!options.quiet) {
      const count = currentContext?.interactiveTree?.length || 0;
      logEvent(`Inspected ${hostLabel.textContent}. Found ${count} visible page references.`);
    }
  } catch (error) {
    if (!options.quiet) logError(`Could not inspect tab: ${error.message}`);
  }
}

async function ensureTaskGroupForCurrentTab(options = {}) {
  if (!currentTab?.id || !globalThis.chrome?.runtime) return;
  try {
    await chrome.runtime.sendMessage({ type: "ENSURE_CODEX_TASK_GROUP", tabId: currentTab.id });
    if (!options.quiet) logEvent("Grouped this tab under Codex.");
  } catch (error) {
    if (!options.quiet) logError(`Could not create Codex tab group: ${error.message}`);
  }
}

async function startTask() {
  const instruction = prompt.value.trim();
  if (!instruction) {
    logError("Enter a task before starting.");
    return;
  }

  try {
    if (!currentContext) await inspectActiveTab({ quiet: true });
    if (currentTab?.url) {
      const decision = await getHostDecision(currentTab.url);
      if (!decision.allowed) {
        throw new Error(`${decision.reason} Host: ${decision.host}`);
      }
    }

    await ensureTaskGroupForCurrentTab({ quiet: true });

    const result = await createCodexTask({
      instruction,
      tab: {
        id: currentTab?.id,
        title: currentTab?.title,
        url: currentTab?.url
      },
      pageContext: currentContext
    });
    logEvent(`Task created: ${result.id || "Codex accepted the request."}`);
  } catch (error) {
    logError(error.message);
  }
}

function logEvent(message) {
  activityLog.prepend(renderEvent(message));
}

function logError(message) {
  activityLog.prepend(renderEvent(message, true));
}

function renderEvent(message, error = false) {
  const node = document.createElement("div");
  node.className = `event${error ? " error" : ""}`;
  node.textContent = message;
  return node;
}
