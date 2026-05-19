# ChatGPT Supervisor Session Bootstrap

Mission: A20BC

## Purpose

`ops/autopilot/chatgpt_supervisor_session_bootstrap.ps1` prepares and verifies a dedicated ChatGPT supervisor browser session for the A-J discussion pool. It keeps session state in a gitignored profile and parks the lane when ChatGPT requires manual login or verification.

## Dedicated Profile

Profile path:

```text
ops/autopilot/local/playwright_supervisor_profile/
```

Rules:

- The profile is gitignored and never committed.
- The profile persists across runs.
- Random user Chrome windows are not used.
- User browser processes are not killed.
- Cookies and tokens are never printed.

## Modes

- `Status`
- `InitProfile`
- `OpenDiscussion`
- `ClassifyPage`
- `WaitForHumanResume`
- `VerifySessionReady`
- `BuildReport`

## Session Classifications

- `SESSION_READY`
- `HUMAN_ACTION_REQUIRED`
- `SESSION_NOT_AUTHENTICATED`
- `SESSION_LOADING`
- `SESSION_UNCLASSIFIED`
- `PROFILE_MISSING`
- `PROFILE_READY_BUT_PAGE_BLOCKED`

## Human Action Handling

When ChatGPT shows login, consent, CAPTCHA, 2FA, or human verification signals:

- The lane is parked.
- An ntfy alert is attempted.
- No credentials are entered.
- No verification UI is clicked.
- No message is sent.
- A one-command resume path is written for a later manual-authenticated rerun.

Resume command:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/playwright_chatgpt_supervisor_harness.ps1 -Mode E2EProof -MissionId A20BC -NoPrompt
```

## A20BC Result

A20BC opened Discussion A in the dedicated profile but classified the page as `HUMAN_ACTION_REQUIRED`. The session is not considered restored until a later rerun returns `SESSION_READY` and the harness detects a usable composer.
