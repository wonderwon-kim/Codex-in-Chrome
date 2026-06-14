import { getRuntimeConfig } from "./config.js";

export async function checkNativeHost() {
  const config = await getRuntimeConfig();
  if (!globalThis.chrome?.runtime?.connectNative) {
    return { installed: false, connected: false, error: "Native messaging is not available." };
  }

  return new Promise((resolve) => {
    let settled = false;
    let port = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      try {
        port?.disconnect();
      } catch {
        // Ignore disconnect races during status probes.
      }
      resolve(result);
    };

    try {
      port = chrome.runtime.connectNative(config.nativeHost);
    } catch (error) {
      finish({ installed: false, connected: false, error: error.message });
      return;
    }

    port.onMessage.addListener((message) => {
      if (message?.type === "pong" || message?.type === "status") {
        finish({ installed: true, connected: true, status: message });
      }
    });

    port.onDisconnect.addListener(() => {
      const message = chrome.runtime.lastError?.message || "Native host disconnected.";
      finish({ installed: false, connected: false, error: message });
    });

    try {
      port.postMessage({ type: "ping", source: "codex-chrome-extension" });
    } catch (error) {
      finish({ installed: false, connected: false, error: error.message });
    }

    setTimeout(() => {
      finish({ installed: true, connected: false, error: "Native host did not respond to ping." });
    }, 3000);
  });
}

export async function createNativeTask(payload) {
  const config = await getRuntimeConfig();
  if (!globalThis.chrome?.runtime?.connectNative) {
    throw new Error("Native messaging is not available.");
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let port = null;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      try {
        port?.disconnect();
      } catch {
        // Ignore disconnect races after a task response.
      }
      if (error) reject(error);
      else resolve(result);
    };

    try {
      port = chrome.runtime.connectNative(config.nativeHost);
    } catch (error) {
      finish(error);
      return;
    }

    port.onMessage.addListener((message) => {
      if (message?.type === "task_created" || message?.type === "task_response") {
        finish(null, message);
      } else if (message?.type === "error") {
        finish(new Error(message.message || "Native host returned an error."));
      }
    });

    port.onDisconnect.addListener(() => {
      const message = chrome.runtime.lastError?.message;
      if (!settled && message) finish(new Error(message));
    });

    try {
      port.postMessage({
        type: "create_task",
        source: "codex-chrome-extension",
        payload
      });
    } catch (error) {
      finish(error);
    }

    setTimeout(() => {
      finish(new Error("Native host did not return a task response."));
    }, 15000);
  });
}
