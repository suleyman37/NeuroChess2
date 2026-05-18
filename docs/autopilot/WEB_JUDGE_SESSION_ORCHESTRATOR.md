# Web Judge Session Orchestrator

The web judge orchestrator is the single control plane for ChatGPT/Gemini browser judge sessions.

Primary command:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/run_web_judge_orchestrator.ps1 -MissionId A20_NEXT -Mode Status
```

## Private URL Storage

Real ChatGPT discussion URLs are stored only in:

`ops/autopilot/local/web_judge_conversation_pool.local.json`

That file is gitignored. Reports and status output show labels A-J and counters only.

## Runtime State

Runtime state is stored in:

`ops/autopilot/runtime/web_judge_session_state.json`

That file is gitignored. It may contain private operational URLs, counters, and browser status, but never cookies, tokens, credentials, SMTP passwords, or browser profile data.

## Rotation

- Each outgoing Codex message to ChatGPT Web increments the active discussion counter.
- Bootstrap context counts as one message.
- Attach-only, CDP status, page open, and resume checks do not count.
- At `35` messages, the active discussion is exhausted and the next available label is selected.
- If J is exhausted and no discussion remains, the orchestrator sends or stages an email request for a new pool.

## Human Action

Auth, consent, CAPTCHA, 2FA, and human verification are pause states:

- keep Chrome open;
- send an ntfy iPhone alert first;
- use Gmail only as an explicitly enabled fallback;
- wait for manual action;
- poll read-only resume checks;
- never click verification or enter credentials.

Gmail SMTP preflight is no longer the primary live-web gate. If ntfy is
configured and working, Gmail failure is recorded as fallback unavailable and
does not block Web Judge automation.

## Gemini

Gemini is optional. If Gemini is requested without a configured URL, the orchestrator returns `GEMINI_DISABLED_NO_URL` and does not block ChatGPT operations.
