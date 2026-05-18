# A20AK iPhone ntfy Alert Router And Web Orchestrator Recovery Report

## 1. Mission Summary

A20AK added an ntfy-first alert router for NeuroChess web automation and wired
the Web Judge Orchestrator human-action path to that router.

The implementation makes ntfy iPhone push the primary alert channel, keeps Gmail
SMTP disabled by default as fallback-only, and prevents Gmail preflight failure
from blocking live web flow when ntfy is configured.

Final verdict: `ALERT_ROUTER_READY_NEEDS_TOPIC`

Recommended next mission: `A20AL_RERUN_CHATGPT_CANARY_WITH_NTFY_ALERTS`

## 2. Why A20AK Was Required

A20AI proved that the Web Judge Orchestrator correctly blocked live web actions
when email alerting was unavailable, but Gmail SMTP became the blocker. A20AJ
was interrupted and remained incomplete, dirty, and unpushed, so A20AK used the
latest completed safe branch, A20AI.

The user need is iPhone notification on human action, not Gmail SMTP reliability.

## 3. Gmail SMTP Is No Longer Primary

Gmail fallback status: disabled by default.

Gmail SMTP failure blocks live flow: no, as long as ntfy is configured and
working.

SMTP password prompt when ntfy is primary: no.

## 4. ntfy Setup Status

ntfy setup status: not configured.

The setup command prompted locally for the ntfy topic, but no topic was received
by the terminal prompt. No topic was written, printed, staged, or committed.

Config target:

`ops/autopilot/local/alert_router.local.json`

That path is gitignored.

## 5. iPhone Notification Test Result

iPhone notification test result: not sent.

Reason: `ALERT_ROUTER_NOT_CONFIGURED`

The real ntfy test was attempted with `setup_alert_router.ps1 -Action Test`, but
there was no local topic config yet.

## 6. Expected iPhone Notification

The user should receive an iPhone notification after entering the private ntfy
topic locally with:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/setup_alert_router.ps1 -Action InitNtfy
```

Then verify with:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/setup_alert_router.ps1 -Action Test
```

Expected result after topic setup: `ALERT_SENT_NTFY`

## 7. Gmail Fallback Status

Gmail fallback enabled: no.

Gmail fallback-only behavior is supported by the router, but the local alert
router example and default runtime config keep it disabled.

## 8. Web Orchestrator Integration

Integrated: yes.

`run_web_judge_orchestrator.ps1` now uses alert-router preflight for live modes
instead of requiring Gmail preflight. Dry-run modes use an alert-router dry-run
state. Human-action pause mode routes through the alert router.

## 9. Auth Wall Alert Behavior

Auth wall alert behavior: ntfy alert first, Gmail only if local fallback is
explicitly enabled.

Safe smoke result without topic: `ALERT_ROUTER_NOT_CONFIGURED`

The orchestrator did not proceed to live browser work when the alert router was
missing.

## 10. No-Prompt Behavior

Forbidden prompts appeared: no.

No prompts exist for:

- EvidencePath
- OutputPath
- ArtifactPath
- SMTP host
- SMTP user
- SMTP password when ntfy is primary
- Chrome profile path
- CDP endpoint
- ChatGPT URLs during send mode

Allowed ntfy-topic prompt was attempted once by `setup_alert_router.ps1`.

## 11. Live Web Without Gmail

Live web can proceed without Gmail SMTP: yes, after ntfy topic setup.

Until the topic is configured locally, live web remains blocked by
`ALERT_ROUTER_NOT_CONFIGURED`.

## 12. What Remains For Canary

Before a ChatGPT canary retry:

1. Configure the private ntfy topic locally.
2. Run `setup_alert_router.ps1 -Action Test` and verify `ALERT_SENT_NTFY`.
3. Rerun the ChatGPT canary using ntfy alerts.

## 13. Artifacts

External artifacts were written under:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\alert_router\A20AK_ntfy_iphone_alert_router_20260518`

Key artifacts:

- `manifest.json`
- `alert_router_status.json`
- `alert_router_init_result.json`
- `ntfy_test_result.json`
- `orchestrator_alert_integration_result.json`
- `auth_wall_alert_smoke_result.json`
- `no_prompt_result.json`
- `gmail_fallback_status.json`

No artifacts were committed.

## 14. Validation

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

Frontend build was not run because no frontend files changed.

## 15. Safety Statements

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
