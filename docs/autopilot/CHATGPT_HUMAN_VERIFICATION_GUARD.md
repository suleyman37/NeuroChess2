# ChatGPT Human Verification Guard

## Purpose

A18E prevents long automation runs from waiting on ChatGPT Web human
verification, loading interstitials, missing composers, or wrong Project
context. The bridge must stop before READY or micro-prompt send when the page is
not available.

Human verification must not be automated. Codex must not click challenge,
captcha, consent, login, or verification controls. The user completes those
steps manually, then Codex may run a bounded READY smoke.

## Detection

The guard classifies the current Project conversation page as:

- `READY`: Project/session URL is correct, composer is visible, no blocker.
- `LOADING_INTERSTITIAL`: loading or verification interstitial, no composer.
- `HUMAN_VERIFICATION_REQUIRED`: explicit human verification, captcha,
  challenge, or browser-check wording.
- `COMPOSER_NOT_FOUND`: Project page loaded but no usable composer exists.
- `WRONG_PROJECT_OR_CONTEXT`: URL or visible context is not NeuroChess
  Supervisor.
- `UNKNOWN_BLOCKED_STATE`: unusable state that does not match a known class.

## Stop Reasons

- `STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED`
- `STOP_PROJECT_LOADING_INTERSTITIAL`
- `STOP_COMPOSER_NOT_FOUND`
- `STOP_WRONG_CHATGPT_PROJECT_CONTEXT`
- `STOP_BRIDGE_AVAILABILITY_UNKNOWN_BLOCKED`
- `STOP_CHATGPT_READY_NOT_AVAILABLE`

All stop reasons are pre-send stops. They must not execute product work, request
a micro-prompt, or continue a rolling loop.

## Evidence

When live bridge diagnostics are available, blocked states should save:

- current URL;
- sanitized DOM summary;
- composer candidate summary when applicable;
- screenshot;
- bridge availability JSON;
- explicit `bridge_error.md` stop reason.

Evidence is for manual recovery only. It must not include tokens, cookies,
browser profile data, or secrets.
