# Gemini Pro Web Setup

The user has Gemini Pro, but A16G does not automate Gemini login and does not call Gemini live.

Future live integration must:

- use an explicit user-approved Gemini access path;
- avoid login automation, CAPTCHA bypass, and credential handling;
- keep Gemini in auditor mode only;
- validate nonce-bound NC_GEMINI_AUDIT responses before use;
- never let Gemini generate Codex prompts by default;
- never let Gemini override deterministic safety gates.

A16G is protocol-only. It creates the audit packet builder, response validator, decision mapper, prompts, fixtures, and tests needed before any live smoke.
