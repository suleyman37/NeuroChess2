# Playwright ChatGPT Supervisor Harness

Mission: A20BC

## Purpose

`ops/autopilot/playwright_chatgpt_supervisor_harness.ps1` is the free browser transport for ChatGPT A-J supervision. It uses Codex MCP Playwright readiness as the preferred configured capability, then uses native Playwright as the script-level executor when available.

## Modes

- `Discover`
- `Status`
- `OpenCurrentDiscussion`
- `ClassifyPage`
- `DetectComposer`
- `SendTestMessage`
- `ReadLastResponse`
- `RotateIfNeeded`
- `E2EProof`
- `DryRun`
- `BuildReport`

## Transport Order

1. MCP Playwright configured in Codex local config.
2. Native Playwright executor with the dedicated profile.
3. Legacy CDP only if already available.
4. Local OMEGA fallback.

The PowerShell harness records MCP readiness but does not claim direct MCP tool execution from inside the script. In A20BC, native Playwright used a system browser channel because bundled Chromium was absent.

## A-J Pool Rules

Pool path:

```text
ops/autopilot/local/web_judge_conversation_pool.local.json
```

Rules:

- Load labels A-J.
- Start from current label or A.
- Rotation threshold is 50 messages.
- Private URLs are redacted.
- Counters increment only after confirmed send.
- Missing pool parks the lane and leaves OMEGA fallback available.

## Composer Safety

The harness sends only if:

- The page is classified usable.
- A ChatGPT composer is positively detected.
- A send mechanism is available.
- No auth, consent, CAPTCHA, 2FA, or human-verification wall is detected.

Forbidden:

- Blind typing.
- Active-window SendKeys.
- Coordinate-only typing.
- Credential entry.
- Human-verification automation.

## E2E Test Message

The only live proof message is:

```text
NeuroChess supervisor transport test. Reply with JSON only:
{"transport":"mcp_playwright_chatgpt_web","status":"ok","mission":"A20BC"}
```

A20BC did not send this message because the page required human action before a composer was available.

## A20BC Result

The harness proved:

- MCP Playwright local config ready.
- Native Playwright fallback ready.
- Dedicated profile ready.
- A-J pool loaded.
- Discussion A opened.
- Page classified `HUMAN_ACTION_REQUIRED`.
- ntfy alert sent.
- No message sent.
- Counter not incremented.
- OMEGA fallback preserved.
