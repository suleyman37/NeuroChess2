# A20BD Persistent Playwright Auth Bootstrap Report

## 1. Mission Summary

A20BD added a keep-open ChatGPT manual-auth bootstrap for the Playwright supervisor lane. The new script launches a visible system browser with the dedicated supervisor profile, opens Discussion A through CDP, leaves the browser running, alerts through ntfy, and provides a resume command for E2E after manual auth.

Final mission status: `AUTH_BOOTSTRAP_READY_WAITING_FOR_MANUAL_AUTH`.

## 2. Why A20BD Was Required After A20BC

A20BC proved the Playwright supervisor could reach Discussion A, but the browser lifecycle was wrong for manual authentication: Playwright could classify `HUMAN_ACTION_REQUIRED` and then exit, closing the browser before the user had time to authenticate. A20BD decouples the browser lifecycle from the Playwright probe.

## 3. Browser Lifecycle Diagnosis

The issue was not only ChatGPT auth. It was ownership. A Playwright-launched persistent context can disappear when the script exits. The A20BD bootstrap launches Chrome/Edge as an OS-owned process and only attaches over CDP.

## 4. Whether The Window Disappeared Before And Why This Fixes It

Before: the auth window could disappear after classification because the automation process owned the browser context.

Now: the browser remains a visible OS process after the script exits. Playwright does not call `browser.close()` and the stop command is explicit-only.

## 5. Dedicated Profile Status

Profile: `ops/autopilot/local/playwright_supervisor_profile/`.

Status: ready and gitignored.

## 6. Browser Keep-Open Status

Window stayed open: yes.

Observed launch state: `AUTH_BROWSER_ALREADY_RUNNING` after rerun, with `browser_process_running: true`, `debug_endpoint: DEBUG_ENDPOINT_READY`, and `keep_open: true`.

## 7. Auth State

Auth state: `HUMAN_ACTION_REQUIRED`.

The page is waiting for manual ChatGPT login or verification in the opened browser window.

## 8. Ntfy Alert Result

ntfy status: `ALERT_SENT_NTFY`.

The alert instructed the user to complete login/verification in the opened browser window and leave it open. No private URL, token, cookie, or secret was included.

## 9. Session Ready

Session ready: no.

The browser is ready for manual auth, but ChatGPT is not yet ready for automated supervisor messages.

## 10. Composer Detection

Composer detected: no.

The page is still in a human-action-required state.

## 11. Message Sent

Message sent: no.

The script correctly refused to send because the composer was not detected.

## 12. Response Read

Response read: no.

No response was expected because no message was sent.

## 13. Counter Increment

Counter incremented: no.

The A-J counter only increments after confirmed send.

## 14. Resume Command

Run this after completing manual auth in the opened browser window:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/chatgpt_manual_auth_bootstrap.ps1 -Mode ResumeE2E -MissionId A20BD -NoPrompt
```

## 15. Explicit Safety Statements

No bypass was attempted.

No credentials were entered by automation.

No blind typing was used.

No paid API was used.

A21 was not launched.

`road-to-V2` was not pushed.

## 16. Validation Summary

Validation passed for:

- `git diff --check`
- `test_chatgpt_manual_auth_bootstrap.ps1`
- `test_mcp_playwright_setup_check.ps1`
- `test_chatgpt_supervisor_session_bootstrap.ps1`
- `test_playwright_chatgpt_supervisor_harness.ps1`
- `test_alert_router.ps1`
- `test_neurorelay_loop.ps1`
- `test_omega_autopilot.ps1`
- `test_external_judge_sre.ps1`
- `test_web_judge_orchestrator.ps1`
- `test_neurochess_visual_training_system.ps1`
- `test_all_night_readiness_gate.ps1`
- `test_strict_visual_firewall.ps1`
- `test_design_intelligence_layer.ps1`
- `test_autonomous_design_judgment.ps1`
- `test_3d_board_stage_architecture.ps1`
- `test_visual_auditor_canary_halting.ps1`
- `python tools/plan_guard.py`
- A20BD setup check
- A20BD launch auth window
- A20BD status
- A20BD BuildReport
- A20BD NeuroRelay rehearsal

No frontend build was required because no frontend files changed.

## 17. Final Verdict

`AUTH_BOOTSTRAP_READY_WAITING_FOR_MANUAL_AUTH`

## 18. Recommended Next Mission

`A20BE_RERUN_E2E_AFTER_MANUAL_AUTH`
