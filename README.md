# Codex in Chrome

Production Chrome extension for using Codex from a Chrome side panel. It follows the same product shape as Claude for Chrome: a top-line assistant label, side panel, site permissions, active-tab context extraction, native host status, and browser-task submission.

## What is implemented

- Chrome Manifest V3 extension with side panel, popup, options page, keyboard shortcut, and content script.
- Codex-branded top row and panel UI replacing the Claude label.
- PKCE OAuth flow using `chrome.identity.launchWebAuthFlow`.
- Configurable OAuth endpoints, client ID, scopes, API base URL, task path, and native messaging host.
- Access token storage and refresh-token support in `chrome.storage.local`.
- Active-tab page context extraction for headings, selected text, viewport, and an accessibility-style interaction tree.
- Automatic `Codex` Chrome tab grouping when the side panel opens, matching the Claude for Chrome workflow shape.
- Codex task submission adapter that posts browser task payloads to the configured service API.
- Native messaging host probe for a Codex desktop/app bridge.
- Bridge contract and a native host implementation starter under `docs/` and `examples/native-host/`.

## Required production configuration

OpenAI's public Codex Chrome documentation describes installing the official Codex Chrome extension through the Codex Chrome plugin flow, but it does not publish a third-party Codex OAuth client endpoint. To ship this as a real service, configure an OAuth client and backend that are authorized to issue Codex-compatible browser-task tokens.

Set these values in `src/config.js` for a packaged build, or open the extension options page and save runtime overrides:

- `oauth.authorizationEndpoint`
- `oauth.tokenEndpoint`
- `oauth.revocationEndpoint`
- `oauth.clientId`
- `oauth.scope`
- `api.baseUrl`
- `api.taskPath`
- `nativeHost`
- `taskTransport`

The extension does not include any non-production login path. If OAuth is not configured, sign-in fails closed and reports the missing configuration.

See `docs/BRIDGE_CONTRACT.md` for the native messaging and HTTPS task API schema. The native host starter at `examples/native-host/node-host.mjs` implements Chrome native messaging framing and forwards task payloads to a configured service.

## Validate

Run:

```powershell
npm run validate
```

The validator checks the manifest, required files, JavaScript syntax, and accidental Claude/demo strings in extension runtime files.

## Package

Run:

```powershell
npm run package
```

The release package is written to `dist/codex-in-chrome.zip` and contains only extension runtime files.

## Native Host On Windows

After loading or publishing the extension, copy its extension ID and run:

```powershell
.\examples\native-host\install-windows.ps1 -ExtensionId "YOUR_EXTENSION_ID"
```

The script installs the native host under `%LOCALAPPDATA%\CodexChromeNativeHost` and registers `com.openai.codex_chrome` under the current user's Chrome native messaging registry key.

## Load locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select `C:\Users\david\OneDrive\문서\Codex in Chrome`.
5. Open the extension options and enter service configuration.
6. Pin Codex, open the popup, then open the side panel.

## Reference sources used

- Claude Chrome documentation: `https://code.claude.com/docs/ko/chrome`
- Reference clone package: `https://github.com/cocodem/claude-for-chrome`
- OpenAI Codex Chrome extension documentation: `https://developers.openai.com/codex/app/chrome-extension`
