# ChatGPT Manual Auth Bootstrap Keep-Open

Mission: A20BD

## Purpose

`ops/autopilot/chatgpt_manual_auth_bootstrap.ps1` keeps a dedicated ChatGPT supervisor browser open long enough for manual login or verification. It fixes the lifecycle problem where a Playwright-owned context can close as soon as classification ends.

## Dedicated Profile

Profile:

```text
ops/autopilot/local/playwright_supervisor_profile/
```

Rules:

- The profile is gitignored.
- The browser is headed and visible.
- The browser is launched as an OS process, not as a temporary Playwright-owned context.
- Playwright attaches through CDP and disconnects by process exit.
- The browser is not closed automatically during manual auth.

## Modes

- `Status`
- `LaunchAuthWindow`
- `PollSessionReady`
- `ResumeE2E`
- `StopSupervisorBrowser`
- `BuildReport`

## Lifecycle Contract

`LaunchAuthWindow` starts a system Chrome/Edge process with:

- `--remote-debugging-port=<port>`
- `--user-data-dir=ops/autopilot/local/playwright_supervisor_profile/`
- `--new-window`
- `about:blank`

The private ChatGPT discussion URL is opened through CDP after launch and is never printed.

If ChatGPT requires manual auth:

- The browser remains open.
- The context is not closed.
- The browser process is not killed.
- ntfy is attempted.
- The lane is parked.
- OMEGA fallback remains available.

## Resume Command

After manual auth is completed in the opened window:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/chatgpt_manual_auth_bootstrap.ps1 -Mode ResumeE2E -MissionId A20BD -NoPrompt
```

`ResumeE2E` attaches to the existing browser/debug port. It does not launch a temporary profile.

## E2E Message

Only after `SESSION_READY` and composer detection:

```text
NeuroChess supervisor transport test after manual auth. Reply with JSON only:
{"transport":"mcp_playwright_chatgpt_web","status":"ok","mission":"A20BD"}
```

The A-J counter increments only after a confirmed send.

## Safety

The bootstrap never enters credentials, clicks verification controls, automates CAPTCHA/2FA/consent/human verification, uses paid APIs, prints cookies/tokens, prints private URLs, or types into an unknown active window.
