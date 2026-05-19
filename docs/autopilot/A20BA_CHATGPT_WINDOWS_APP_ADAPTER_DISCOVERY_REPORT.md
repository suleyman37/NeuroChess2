# A20BA ChatGPT Windows App Adapter Discovery Report

## Mission Summary

A20BA explored whether the installed ChatGPT Windows desktop app can act as a
safe optional live-supervisor transport for NeuroChess autopilot. This was a
transport discovery and safety mission only. It did not launch A21, did not
publish a product release, did not merge or push `road-to-V2`, and did not
change V1 product behavior.

## Why Desktop App Adapter Was Explored

A20AZ proved strong offline OMEGA autonomy but left live supervision weak:
ChatGPT Web/CDP attempts were parked as unavailable, Gemini was not configured,
and external packets did not influence decisions. The user has the ChatGPT
Windows app installed, so A20BA tested whether the desktop app could be a safer
transport than Chrome/CDP.

## Discovery Result

- Installed status: yes.
- Running status: yes.
- Window detection: yes.
- Windows UI Automation: available.
- Composer detection: no.
- Auth or human-verification wall: no detected wall.
- Safe send: no.
- Test message sent: no.
- Response read: no.
- A-J URL support: unknown.

The adapter returned `CHATGPT_DESKTOP_COMPOSER_NOT_FOUND`. Because the composer
was not safely detected, A20BA did not send the harmless transport test message.

## Safety Result

The adapter never typed blindly. It did not use active-window keystrokes, did
not enter credentials, did not bypass login, CAPTCHA, 2FA, consent, or human
verification, and did not call paid APIs. UI Automation inspection was redacted
because desktop UI trees can expose private conversation labels.

## Transport Priority Update

The supervisor transport ladder is now:

1. ChatGPT Windows desktop app adapter, only if ready.
2. ChatGPT Web A-J pool via Chrome/CDP, only if ready.
3. Local OMEGA fallback, always available.

`ops/autopilot/supervisor_transport_fabric.ps1` checks the desktop adapter and
parks it when not ready. In A20BA it selected `local_omega_fallback`.

## Better Than Chrome/CDP?

Unknown to no for the current machine state. The desktop app is easier to
discover than the Chrome/CDP lane, but it is not currently automatable because
the composer was not safely detected. It should not be used for live supervisor
messages until a safe composer path is proven.

## Future Full-Night Use

Future full-night live-supervised runs cannot rely on the desktop app yet. The
desktop lane may remain in the transport ladder as optional and parked. Local
OMEGA fallback remains available and authoritative.

## Validation

- `git diff --check`: pass.
- `test_chatgpt_windows_app_adapter.ps1`: pass.
- `test_supervisor_transport_fabric.ps1`: pass.
- `test_external_judge_sre.ps1`: pass.
- `test_neurorelay_loop.ps1`: pass.
- `test_omega_autopilot.ps1`: pass.
- `test_alert_router.ps1`: pass.
- `test_web_judge_orchestrator.ps1`: pass.
- `test_neurochess_visual_training_system.ps1`: pass.
- `test_all_night_readiness_gate.ps1`: pass.
- `test_strict_visual_firewall.ps1`: pass.
- `test_design_intelligence_layer.ps1`: pass.
- `test_autonomous_design_judgment.ps1`: pass.
- `test_3d_board_stage_architecture.ps1`: pass.
- `test_visual_auditor_canary_halting.ps1`: pass.
- `python tools/plan_guard.py`: pass.

## State Updates

- `failure_ledger.yaml` records the desktop adapter as parked because the
  composer was not safely detected.
- `protocol_memory.yaml` records that desktop UI Automation output must be
  redacted and that no desktop send is allowed without high-confidence composer
  detection.
- NeuroRelay now records desktop transport health and selected fallback in each
  iteration.

## Explicit Safety Statements

- No bypass was attempted.
- No credentials were entered.
- No private ChatGPT URLs, Gemini URLs, ntfy topics, tokens, cookies, or secrets
  were committed.
- A21 was not launched.
- `road-to-V2` was not pushed.
- No public or product release was made.
- No backend, package, database, or V1 product behavior was changed.

## Final Verdict

`CHATGPT_WINDOWS_APP_INSTALLED_BUT_NOT_AUTOMATABLE`

## Recommended Next Mission

`A20BB_CHATGPT_WEB_CDP_REPAIR`
