# A20AL Configure ntfy Topic And Real iPhone Alert Test Report

## 1. Mission Summary

A20AL configured the local ntfy alert router topic and sent a real ntfy test
notification through `https://ntfy.sh`.

The topic was stored only in the gitignored local alert-router config. The real
test returned `ALERT_SENT_NTFY` with HTTP 200. User receipt was not confirmed in
the Codex thread before this report was written.

Final verdict: `ALERT_SENT_NTFY_BUT_USER_NOT_CONFIRMED`

Recommended next mission: `A20AM_RERUN_CHATGPT_CANARY_WITH_NTFY_ALERTS`

## 2. Why A20AL Was Required After A20AK

A20AK created the ntfy-first alert router and integrated it with the Web Judge
Orchestrator, but no real local ntfy topic was configured. A20AL was required to
store the topic locally and prove the alert delivery path before another
ChatGPT canary attempt.

## 3. ntfy Topic Configured

ntfy topic configured: yes.

The first two topic-entry attempts were rejected because the entered topic was
16 characters. The accepted topic is 44 characters and was marked not guessable
by the router check.

Only a redacted preview was emitted by scripts and artifacts.

## 4. Topic Stored Only Locally

Topic stored only locally: yes.

Local path:

`ops/autopilot/local/alert_router.local.json`

That path is gitignored and was not staged or committed.

## 5. Topic Redaction

Topic redacted in report: yes.

The full topic does not appear in this report.

## 6. iPhone Notification Test Result

Script result: `ALERT_SENT_NTFY`

HTTP status: `200`

Notification title:

`NeuroChess alert test`

Notification body:

`If you see this on iPhone, NeuroChess ntfy alerts are working.`

User confirmed receipt: no confirmation available in-thread at report time.

## 7. Gmail Fallback Status

Gmail fallback enabled: no.

Gmail SMTP is not required for human alerts when ntfy is configured and working.

## 8. Web Orchestrator Integration Status

Web orchestrator integration status: ready.

`run_web_judge_orchestrator.ps1 -Mode Status -NoPrompt` loaded the local A-J
pool with private URLs redacted.

`run_web_judge_orchestrator.ps1 -Mode DryRunProblemMatrix -NoPrompt` returned
`PROBLEM_MATRIX_DRY_RUN_PASS` and mapped:

- `AUTH_OR_CONSENT_WALL` to `ntfy_alert_pause_resume`
- `HUMAN_VERIFICATION_REQUIRED` to `ntfy_alert_pause_resume`
- `TWO_FACTOR_REQUIRED` to `ntfy_alert_pause_resume`

Dry `EnsureSessions` reported:

- `alert_router_status: ALERT_ROUTER_DRY_RUN_READY`
- `email_preflight_status: GMAIL_NOT_REQUIRED_WHEN_NTFY_READY`
- `gmail_blocks_live_flow: false`

## 9. Gmail Requirement For Human Alerts

Gmail SMTP is still required for human alerts: no.

ntfy is now the primary alert channel. Gmail remains disabled fallback-only.

## 10. Next Canary Readiness

Next canary mission can proceed: yes, with one caveat.

The ntfy server accepted the notification, but user receipt was not confirmed in
the thread. The next mission can run with ntfy alerts, and the operator should
watch the iPhone for the human-action notification.

## 11. Artifacts

External artifacts were written under:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\alert_router\A20AL_configure_ntfy_topic_real_test_20260518`

Key artifacts:

- `manifest.json`
- `alert_router_status_redacted.json`
- `alert_router_init_result.json`
- `ntfy_real_test_result.json`
- `orchestrator_integration_check.json`
- `orchestrator_ensure_sessions_dryrun.json`

No artifacts were committed.

## 12. Validation

Validation passed:

- `git diff --check`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_alert_router.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_web_judge_orchestrator.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_human_verification_pause_resume_email_gate.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_chatgpt_visual_upload_lane.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_visual_judge_capture_hardening.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_visual_court_bridge.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_neurochess_visual_training_system.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_all_night_readiness_gate.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_strict_visual_firewall.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_design_intelligence_layer.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_autonomous_design_judgment.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_3d_board_stage_architecture.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_visual_auditor_canary_halting.ps1`
- `python tools/plan_guard.py`

## 13. Safety Statements

- A21 was not launched.
- Night Mode was not launched.
- `road-to-V2` was not pushed.
- `road-to-V2` was not merged.
- No backend product code was touched.
- No frontend product code was touched.
- No package files were touched.
- No screenshots or QA artifacts were committed.
- No `ops/autopilot/local/**` files were committed.
- No `ops/autopilot/runtime/**` files were committed.
- No private ntfy topic was committed.
- No SMTP password was printed.
- No secrets were printed.
- No private ChatGPT URLs were committed.
- No CAPTCHA bypass was attempted.
- No 2FA bypass was attempted.
- No consent bypass was attempted.
- No human verification automation was attempted.
