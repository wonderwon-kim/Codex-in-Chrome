const REF_PREFIX = "codex_ref_";
let refCounter = 0;
const refs = new Map();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SHOW_CODEX_INDICATOR") {
    showCodexIndicator();
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "HIDE_CODEX_INDICATOR") {
    hideCodexIndicator();
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type !== "COLLECT_CODEX_PAGE_CONTEXT") return false;
  sendResponse(collectPageContext());
  return true;
});

function collectPageContext() {
  refs.clear();
  refCounter = 0;

  return {
    ok: true,
    title: document.title,
    url: location.href,
    selection: window.getSelection()?.toString().slice(0, 2000) || "",
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    headings: textList("h1,h2,h3", 20),
    interactiveTree: buildInteractiveTree(document.body, 0, 5).slice(0, 140)
  };
}

function textList(selector, limit) {
  return [...document.querySelectorAll(selector)]
    .slice(0, limit)
    .map((element) => element.textContent.trim())
    .filter(Boolean);
}

function buildInteractiveTree(root, depth, maxDepth) {
  if (!root || depth > maxDepth) return [];

  const rows = [];
  const role = getRole(root);
  const label = getLabel(root);
  const visible = isVisible(root);
  const relevant = visible && (isInteractive(root) || label || role !== "generic");

  if (relevant) {
    const ref = `${REF_PREFIX}${++refCounter}`;
    refs.set(ref, root);
    rows.push({
      ref,
      role,
      label: label.slice(0, 160),
      tag: root.tagName.toLowerCase()
    });
  }

  [...root.children].forEach((child) => {
    rows.push(...buildInteractiveTree(child, depth + 1, maxDepth));
  });

  return rows;
}

function isVisible(element) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function isInteractive(element) {
  const tag = element.tagName.toLowerCase();
  return ["a", "button", "input", "textarea", "select", "summary"].includes(tag) ||
    element.hasAttribute("onclick") ||
    element.getAttribute("role") === "button" ||
    element.getAttribute("contenteditable") === "true";
}

function getRole(element) {
  const explicit = element.getAttribute("role");
  if (explicit) return explicit;
  const tag = element.tagName.toLowerCase();
  return {
    a: "link",
    button: "button",
    input: "textbox",
    textarea: "textbox",
    select: "combobox",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    form: "form",
    nav: "navigation",
    main: "main"
  }[tag] || "generic";
}

function getLabel(element) {
  return element.getAttribute("aria-label") ||
    element.getAttribute("placeholder") ||
    element.getAttribute("title") ||
    element.getAttribute("alt") ||
    directText(element);
}

function directText(element) {
  return [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent.trim())
    .filter(Boolean)
    .join(" ");
}

function showCodexIndicator() {
  let indicator = document.getElementById("codex-static-indicator-container");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "codex-static-indicator-container";
    indicator.innerHTML = `
      <span class="codex-indicator-mark">C</span>
      <span class="codex-indicator-text">Codex is active in this tab group</span>
      <button id="codex-static-close-button" aria-label="Dismiss Codex indicator">x</button>
    `;
    const style = document.createElement("style");
    style.id = "codex-static-indicator-styles";
    style.textContent = `
      #codex-static-indicator-container {
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px 8px 12px;
        background: #faf9f5;
        color: #141413;
        border: 1px solid rgba(31, 30, 29, 0.28);
        border-radius: 14px;
        box-shadow: 0 40px 80px rgba(0, 0, 0, 0.15);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        font-size: 14px;
      }
      .codex-indicator-mark {
        display: inline-grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 7px;
        background: #111;
        color: #fff;
        font-weight: 800;
      }
      #codex-static-close-button {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: #141413;
        cursor: pointer;
        font: inherit;
      }
      #codex-static-close-button:hover {
        background: #f0eee6;
      }
    `;
    document.documentElement.append(style);
    document.body.append(indicator);
    indicator.querySelector("#codex-static-close-button").addEventListener("click", hideCodexIndicator);
  }
  indicator.style.display = "inline-flex";
}

function hideCodexIndicator() {
  const indicator = document.getElementById("codex-static-indicator-container");
  if (indicator) indicator.style.display = "none";
}
