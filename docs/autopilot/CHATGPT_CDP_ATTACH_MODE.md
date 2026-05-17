# ChatGPT CDP Attach Mode

## Purpose

A18I adds a manual-verified browser transport path for ChatGPT. Instead of
letting automation launch a fresh Chrome profile, the user starts Chrome
manually with remote debugging enabled, completes any verification, opens the
NeuroChess Supervisor conversation, and leaves the composer visible.

Codex then connects to the already-open browser through Chrome DevTools
Protocol on `127.0.0.1:9222`.

## Guarantees

CDP attach mode must:

- connect to existing Chrome with `connectOverCDP`;
- reuse an existing NeuroChess Supervisor project conversation tab;
- never launch a new Chrome process;
- never automate human verification, CAPTCHA, login, 2FA, or consent;
- never close the user's Chrome by default;
- stop before sending if the page is blocked or in the wrong context;
- request only READY and two transport echo JSON messages during the smoke.

## Stop Reasons

- `STOP_CDP_ATTACH_FAILED`
- `STOP_ACTIVE_SESSION_TAB_NOT_FOUND`
- `STOP_COMPOSER_NOT_FOUND`
- `STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED`
- `STOP_PROJECT_LOADING_INTERSTITIAL`
- `STOP_TRANSPORT_ECHO_TIMEOUT`
- `STOP_WRONG_CHATGPT_PROJECT_CONTEXT`

## Scope

This is transport infrastructure only. It does not run A19X, Night Mode,
product missions, Gemini, frontend, backend, or docs/rebuild work.
