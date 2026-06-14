const status = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
document.querySelector("#status").textContent = status.connected ? "Connected" : "Not signed in";

document.querySelector("#openPanel").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL", tabId: tab?.id });
  window.close();
});

document.querySelector("#openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
