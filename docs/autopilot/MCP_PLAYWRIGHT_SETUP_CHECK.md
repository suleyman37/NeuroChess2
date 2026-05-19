# MCP Playwright Setup Check

Mission: A20BC

## Purpose

`ops/autopilot/mcp_playwright_setup_check.ps1` verifies whether Codex has a local Playwright MCP configuration and whether a free native Playwright fallback can launch a controlled browser profile. It does not modify repository package files and does not use paid APIs.

## Modes And Outputs

The setup check writes redacted JSON artifacts under the mission QA artifact directory:

- `mcp_setup_check.json`
- `native_playwright_fallback_check.json`
- `manifest.json`

Expected statuses:

- `MCP_PLAYWRIGHT_READY`
- `MCP_PLAYWRIGHT_CONFIGURED_NOW_READY`
- `MCP_PLAYWRIGHT_NOT_AVAILABLE_NATIVE_FALLBACK_READY`
- `MCP_PLAYWRIGHT_UNAVAILABLE_NATIVE_FALLBACK_UNAVAILABLE`
- `MCP_PLAYWRIGHT_SETUP_BLOCKED`

## Local Config Rule

If Codex MCP Playwright is missing and the Codex CLI is available, the checker may configure local Codex MCP with:

```powershell
codex mcp add playwright npx "@playwright/mcp@latest"
```

This is local Codex configuration only. It must not touch `package.json`, `package-lock.json`, or repository source.

## Native Fallback

Native Playwright readiness requires:

- Node available.
- Playwright import available.
- A launchable browser path, either bundled Chromium or a system Chrome/Edge channel.
- No package file changes.

A20BC observed MCP ready and native fallback ready through a system browser channel because bundled Chromium was not installed.

## Safety

The setup check prints no cookies, tokens, private URLs, or secrets. It never calls paid APIs and never bypasses login, CAPTCHA, 2FA, consent, or human verification.
