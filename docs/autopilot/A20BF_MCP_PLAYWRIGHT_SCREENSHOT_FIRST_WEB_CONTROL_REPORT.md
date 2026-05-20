# A20BF MCP Playwright Screenshot-First Web Control Report

## Mission Summary

A20BF makes browser-lane control screenshot-first and service-isolated. Browser
state must now be observed from the current visible UI in the service-specific
window before DOM or locators can confirm anything.

The correction from the live debugging pass is encoded: ChatGPT and Gemini are
not checked in the same page or browser context because their Chrome identities
can differ.

## MCP Playwright Availability

MCP Playwright was available. Authoritative browser truth for this mission was
captured from dedicated service windows:

- ChatGPT profile/window: CDP `9222`
- Gemini profile/window: CDP `9223`

Shared-context or wrong-port checks are rejected.

## ChatGPT Screenshot

Captured externally under the A20BF QA artifact directory.

Visual observation: the dedicated ChatGPT window shows the NeuroChess
Supervisor discussion with the composer visible at the bottom and no foreground
login, consent, CAPTCHA, 2FA, or human-verification blocker.

ChatGPT page verdict: `PAGE_USABLE`.

A-J pool status: loaded, current label `A`, threshold `50`, URLs redacted.

## Gemini Screenshot

Captured externally under the A20BF QA artifact directory.

Visual observation: the dedicated Gemini window shows the Gemini prompt screen
with a visible composer, visible `Flash Extended` selector, visible plus/import
control, and no foreground login, consent, CAPTCHA, 2FA, or human-verification
blocker.

Gemini page verdict: `PAGE_USABLE`.

## Gemini Model Selector Visual Result

The screenshot visibly showed `Flash Extended`. Exact `Gemini 3.5 Flash` label
was not asserted beyond what was visible. No paid API or subscription action was
used.

## Gemini Upload Visual Result

The screenshot-first pass revealed the real upload affordance: the visible
plus/import control. The hardened adapter opened the import menu, selected the
safe file import path, and confirmed an isolated screenshot attachment before
any visual prompt was sent.

Upload adapter result: `GEMINI_UPLOAD_CONFIRMED`.

Visual packet result: `GEMINI_VISUAL_PACKET_READY`.

Gemini lane status: `VISUAL_READY`.

## Integration

`mcp_playwright_browser_truth.ps1` now rejects verdicts without screenshot
evidence, rejects DOM-only verdicts, and rejects service checks on the wrong
CDP port.

`gemini_upload_adapter.ps1` now uses the A20BF artifact path, consumes the
current screenshot-first observation, recognizes Gemini's visible import menu,
and refuses to send a visual prompt before attachment confirmation.

OMEGA and NeuroRelay fallback remain available.

## Safety

- No API call was required.
- No paid service was used.
- No credentials were entered.
- No account details, private URLs, cookies, tokens, secrets, or ntfy topic were
  committed.
- No login/consent/CAPTCHA/2FA/human-verification bypass was attempted.
- A21 was not launched.
- Night Mode was not launched.
- `road-to-V2` was not pushed.

## Final Verdict

MCP_SCREENSHOT_FIRST_READY_GEMINI_VISUAL_READY

## Recommended Next Mission

A20BG_TRUE_OVERNIGHT_WITH_CHATGPT_AND_GEMINI_VISUAL
