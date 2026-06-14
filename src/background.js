import { getRuntimeConfig } from "./config.js";
import { checkNativeHost } from "./native.js";
import { getAuth } from "./storage.js";

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-side-panel") return;
  const tab = await getActiveTab();
  if (!tab?.id) return;
  await openCodexPanelForTab(tab.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  routeMessage(message, sender).then(sendResponse, (error) => {
    sendResponse({ ok: false, error: error.message });
  });
  return true;
});

async function routeMessage(message, sender) {
  switch (message?.type) {
    case "OPEN_SIDE_PANEL": {
      const tabId = message.tabId || sender?.tab?.id || (await getActiveTab())?.id;
      if (!tabId) throw new Error("No active tab is available.");
      return openCodexPanelForTab(tabId);
    }
    case "GET_STATUS": {
      const auth = await getAuth();
      const config = await getRuntimeConfig();
      const native = await checkNativeHost();
      return {
        ok: true,
        connected: Boolean(auth?.accessToken),
        native,
        nativeHost: config.nativeHost
      };
    }
    case "CHECK_NATIVE_HOST":
      return { ok: true, native: await checkNativeHost() };
    case "PAGE_CONTEXT_FROM_TAB": {
      const tabId = message.tabId || sender?.tab?.id;
      if (!tabId) throw new Error("No active tab is available.");
      return chrome.tabs.sendMessage(tabId, { type: "COLLECT_CODEX_PAGE_CONTEXT" });
    }
    case "ENSURE_CODEX_TASK_GROUP": {
      const tabId = message.tabId || sender?.tab?.id;
      if (!tabId) throw new Error("No active tab is available.");
      const groupId = await ensureCodexTaskGroup(tabId);
      return { ok: true, groupId };
    }
    case "HIDE_CODEX_INDICATOR": {
      const tabId = message.tabId || sender?.tab?.id;
      if (tabId) await chrome.tabs.sendMessage(tabId, { type: "HIDE_CODEX_INDICATOR" }).catch(() => null);
      return { ok: true };
    }
    default:
      return { ok: false, error: "Unknown message type." };
  }
}

async function openCodexPanelForTab(tabId) {
  const groupId = await ensureCodexTaskGroup(tabId);
  if (chrome.sidePanel?.setOptions) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: `src/sidepanel.html?tabId=${encodeURIComponent(tabId)}`,
      enabled: true
    });
  }
  if (chrome.sidePanel?.open) {
    await chrome.sidePanel.open({ tabId });
  }
  return { ok: true, groupId };
}

async function ensureCodexTaskGroup(tabId) {
  const tab = await chrome.tabs.get(tabId);
  let groupId = tab.groupId;
  if (groupId === chrome.tabGroups.TAB_GROUP_ID_NONE || groupId === undefined) {
    groupId = await chrome.tabs.group({ tabIds: [tabId] });
  }
  await chrome.tabGroups.update(groupId, { title: "Codex", color: "grey" });
  await chrome.tabs.sendMessage(tabId, { type: "SHOW_CODEX_INDICATOR" }).catch(() => null);
  return groupId;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}
