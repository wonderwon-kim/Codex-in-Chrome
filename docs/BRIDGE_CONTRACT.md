# Codex Chrome Bridge Contract

This document defines the extension-facing contract for production services. The extension supports three task transports:

- `native-first`: try Chrome native messaging first, then fall back to HTTPS API when configured.
- `native`: require a local native messaging host.
- `api`: require HTTPS API plus OAuth access token.

## Native Messaging

Default host name:

```text
com.openai.codex_chrome
```

The host must implement Chrome native messaging framing:

1. Read a 4-byte little-endian unsigned length from stdin.
2. Read that many UTF-8 JSON bytes.
3. Write a 4-byte little-endian unsigned length to stdout.
4. Write UTF-8 JSON bytes.

### Ping

Request:

```json
{
  "type": "ping",
  "source": "codex-chrome-extension"
}
```

Response:

```json
{
  "type": "pong",
  "connected": true
}
```

The extension uses this response to show native host status.

### Create Task

Request:

```json
{
  "type": "create_task",
  "source": "codex-chrome-extension",
  "payload": {
    "instruction": "Summarize this tab",
    "tab": {
      "id": 123,
      "title": "Example",
      "url": "https://example.com"
    },
    "pageContext": {
      "title": "Example",
      "url": "https://example.com",
      "selection": "",
      "viewport": {
        "width": 1440,
        "height": 900
      },
      "headings": [],
      "interactiveTree": []
    }
  }
}
```

Success response:

```json
{
  "type": "task_created",
  "id": "task_123",
  "status": "accepted"
}
```

Error response:

```json
{
  "type": "error",
  "message": "Human readable error"
}
```

## HTTPS API

When `taskTransport` is `api` or `native-first` fallback is used, the extension sends:

```http
POST {api.baseUrl}{api.taskPath}
Authorization: Bearer {access_token}
Content-Type: application/json
```

Body:

```json
{
  "instruction": "Summarize this tab",
  "tab": {
    "id": 123,
    "title": "Example",
    "url": "https://example.com"
  },
  "pageContext": {}
}
```

The API should return JSON. If it includes `id`, the side panel shows that task ID.

## OAuth

The extension implements Authorization Code with PKCE through `chrome.identity.launchWebAuthFlow`.

Required runtime config:

```json
{
  "oauth": {
    "authorizationEndpoint": "https://example.com/oauth/authorize",
    "tokenEndpoint": "https://example.com/oauth/token",
    "revocationEndpoint": "https://example.com/oauth/revoke",
    "clientId": "codex-chrome-client",
    "scope": "openid profile email codex.chrome"
  }
}
```

Token response must include:

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

`refresh_token` is optional but required for silent refresh after access token expiry.

## Site Permissions

Before a task starts, the extension checks:

1. `blockedHosts`
2. `alwaysAllowBrowserContent`
3. `allowedHosts`
4. localhost exceptions

Blocked hosts win over allowed hosts.
