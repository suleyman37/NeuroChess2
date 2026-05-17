# Persistent ChatGPT Transport

## Purpose

A18G adds a bounded persistent transport mode for long live automation runs.
The old one-shot bridge opens a browser/page, sends one request, waits for one
response, and closes the browser context. That is fine for short smokes, but it
is risky for A19X/A21-style runs because repeated open/close cycles can trigger
human verification, lose page state, or drift away from the bound NeuroChess
Supervisor conversation.

## Policy

Persistent transport is still a procedure, not permission to run product work.
It must:

- use the gitignored active ChatGPT Project session URL;
- open the dedicated Chrome profile once;
- verify the NeuroChess Supervisor project context;
- check bridge availability before every send;
- stop before any send if human verification, loading interstitial, missing
  composer, wrong project, or browser crash is detected;
- never automate login, CAPTCHA, consent, or human verification;
- never fall back to generic ChatGPT;
- close only at final stop or explicit cleanup.

## A18G Implementation

A18G implements a single-process Playwright smoke mode in
`ops/autopilot/browser/chatgpt_bridge.mjs`. The mode sends READY plus two
non-mission transport echo messages inside one Node process and one browser
context. It does not create a daemon and it does not enable the live rolling
loop.

The PowerShell wrappers provide:

- `start_persistent_chatgpt_transport.ps1`: dry-run or bounded live smoke;
- `check_persistent_chatgpt_transport.ps1`: fixture-based state classification;
- `send_persistent_chatgpt_message.ps1`: guardrail helper that refuses product
  prompt requests in this mission;
- `stop_persistent_chatgpt_transport.ps1`: report-only cleanup by default.

## What This Does Not Enable

- No Night Mode.
- No product mission execution.
- No product micro-prompt request.
- No backend/frontend work.
- No unrestricted persistent daemon.

If a future controller needs arbitrary multi-message planning during one coding
run, it should build on this proof with a single-process live loop controller.
