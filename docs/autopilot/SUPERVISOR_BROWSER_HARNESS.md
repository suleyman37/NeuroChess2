# Supervisor Browser Harness

## Purpose

The Supervisor Browser Harness is the zero-cost ChatGPT Web transport for
NeuroChess live supervision. It uses the existing A-J ChatGPT discussion pool
through a dedicated browser profile and never relies on random user browser
windows, paid APIs, or blind typing.

## Dedicated Profile

The harness profile lives at:

`ops/autopilot/local/supervisor_browser_profile/`

The path is excluded through local git ignore state and must never be committed.
The harness may launch a controlled Chrome or Edge instance with a local CDP
endpoint and this profile. It must not kill user Chrome or require CDP from an
already-open user browser.

## Modes

`ops/autopilot/supervisor_browser_harness.ps1` supports:

- `Status`
- `InitProfile`
- `OpenCurrentDiscussion`
- `ClassifyPage`
- `SendTestMessage`
- `ReadLastResponse`
- `RotateIfNeeded`
- `DryRun`
- `BuildReport`

All modes emit redacted JSON. Private ChatGPT URLs, cookies, tokens, ntfy
topics, and secrets must not be printed or committed.

## A-J Pool Rules

The harness reads:

`ops/autopilot/local/web_judge_conversation_pool.local.json`

This local file is private and must stay uncommitted. Output may show labels
`A` through `J`, URL configured yes/no, and message counts only. URLs are always
redacted.

Rotation threshold is `50` successful submissions per discussion. The counter
increments only after the harness proves a message was submitted. If a
discussion reaches the threshold, `RotateIfNeeded` moves to the next available
label.

## Page Classification

The classifier returns:

- `PAGE_USABLE`: composer is visible and enabled, a send action is available,
  and no auth, consent, CAPTCHA, 2FA, or human-verification wall is detected.
- `HUMAN_ACTION_REQUIRED`: login, consent, CAPTCHA, 2FA, or human-verification
  signals are present.
- `PAGE_LOADING`: bounded wait and recheck may be useful.
- `CHATGPT_COMPOSER_NOT_FOUND`: no safe composer was found.
- `UNCLASSIFIED_PAGE_STATE`: the harness cannot prove usable or blocked.

Only `PAGE_USABLE` allows a send attempt.

## Send Safety

The harness may send only when:

- the current page is classified `PAGE_USABLE`;
- the ChatGPT composer is positively detected;
- the send action is available;
- no auth or human-verification wall is detected.

The harness never uses active-window `SendKeys`, never enters credentials, never
clicks verification UI, and never automates human verification.

## Test Message

The E2E test message is harmless:

```text
NeuroChess supervisor transport test. Reply with JSON only:
{"transport":"chatgpt_web_a_j_pool","status":"ok","mission":"A20BB"}
```

If the message is submitted and the response is readable, the harness reports
`CHATGPT_WEB_SUPERVISOR_E2E_READY`. If submission is proven but the response is
not readable yet, it reports `CHATGPT_WEB_MESSAGE_SUBMITTED_RESPONSE_UNREAD`.

## Transport Order

Free supervisor mode routes in this order:

1. `supervisor_browser_harness`
2. `chatgpt_web_a_j_pool`
3. `chatgpt_windows_app_adapter`
4. `local_omega_fallback`

Blocked live lanes are parked and OMEGA fallback continues.

## A20BB Result

A20BB proved profile creation, A-J pool loading, redaction, threshold 50,
dedicated browser launch, and safe page classification. The live page was
classified `HUMAN_ACTION_REQUIRED`, so no message was sent and the harness
parked the lane with ntfy notification.
