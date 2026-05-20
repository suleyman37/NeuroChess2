# Playwright Visual Control Protocol

Mission: A20BD

## Doctrine

Current visible UI state wins over historical page text. Every Web supervisor
verdict must be grounded in a screenshot, a redacted DOM probe, and targeted
locator evidence.

## Required Evidence Before Verdict

Before returning `PAGE_USABLE`, `HUMAN_ACTION_REQUIRED`,
`WRONG_ACCOUNT_OR_PLAN`, `MODEL_SELECTOR_AVAILABLE`, `UPLOAD_AVAILABLE`,
`UPLOAD_UNAVAILABLE`, or `UNCLASSIFIED_PAGE_STATE`, the controller captures:

- an external screenshot;
- a redacted DOM probe summary;
- composer visibility/enabled signals;
- send or prompt-submission signals;
- foreground blocker signals;
- model selector and upload-control signals when relevant.

The controller does not dump full body text and does not log private URLs,
cookies, tokens, account emails, or secrets.

## Classification Rules

`PAGE_USABLE` means the current composer is visible and enabled, prompt
submission is possible, and no foreground auth/consent/CAPTCHA/2FA blocker is
visible.

`HUMAN_ACTION_REQUIRED` requires current foreground blocker evidence. Historical
conversation text containing words like CAPTCHA, verification, auth, or consent
does not count.

`WRONG_ACCOUNT_OR_PLAN` is a Gemini-specific parking signal when current visible
UI suggests account/plan mismatch. Codex does not switch accounts.

`UPLOAD_UNAVAILABLE` means the current Gemini page is usable but no safe upload
control is visible. It does not block local OMEGA or ChatGPT.

## Implementation

`ops/autopilot/playwright_visual_control.ps1` supports:

- `CaptureState`
- `ClassifyPage`
- `FindComposer`
- `FindModelSelector`
- `FindUploadControl`
- `CompareScreenshotAndDom`
- `DryRun`

It prefers the current Playwright-capable environment and records
`playwright_fallback_used = true` when MCP Playwright is not the active transport.
