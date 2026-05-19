# A20BA Browser State Truth Protocol And Composer-First Classifier Report

## 1. Mission Summary

A20BA fixed the ChatGPT live-web false positive that classified a usable page as
`HUMAN_ACTION_REQUIRED`. The mission added a composer-first browser state
classifier, a web-judge wrapper, a bounded manual ChatGPT conversation test, a
ResumeCheck integration, problem-matrix entries, and protocol memory.

## 2. Root Cause Discovered

The browser was connected and ChatGPT was usable. The user screenshot and CDP
probe showed the project page open, the composer visible, no login wall, no
consent wall, no CAPTCHA, no 2FA, and no active human-verification UI.

The previous classifier looked too broadly at page text. It saw historical
conversation words such as CAPTCHA, bypass, consent, auth wall, and human
verification, then treated them as current UI blockers.

## 3. Why Full-Body Text Classification Was Wrong

ChatGPT conversations can contain old reports and policy text about verification
without being blocked. Full body text includes that history, so it is not a safe
source for current browser state.

Current UI state now wins over historical page text.

## 4. Composer-First Classifier Summary

Added:

- `ops/autopilot/classify_browser_state.ps1`
- `ops/autopilot/classify_web_judge_page_state.ps1`

The classifier returns structured JSON with `classification`, confidence,
service, composer status, send availability, foreground blocker evidence,
history-text handling, screenshot path, and recommended action.

If the composer is visible, enabled, and submission is possible, the result is
`PAGE_USABLE` unless a foreground blocker is visible.

## 5. Screenshot-First Diagnostic Summary

Live classifier proof captured an external screenshot and DOM probe under:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\browser_state_truth\A20BA_composer_first_classifier_20260518\`

Screenshots and diagnostics remain external-only and were not committed.

## 6. False-Positive Test Cases

`ops/autopilot/test_browser_state_truth_protocol.ps1` covers:

- composer visible plus historical CAPTCHA text;
- composer visible plus historical human-verification text;
- composer visible plus historical bypass text;
- login, consent, CAPTCHA, and 2FA foreground blockers;
- composer absent with no blocker;
- page loading;
- user visual observation conflict;
- repeated false-alert suppression behavior.

Result: pass.

## 7. ResumeCheck Fix

`run_web_judge_orchestrator.ps1` now delegates non-dry-run `ResumeCheck` to the
composer-first classifier. `PAGE_USABLE` maps to `RESUME_READY`; unclassified
states do not generate false ntfy alerts.

## 8. Ntfy Alert Rule

Ntfy is only appropriate for `HUMAN_ACTION_REQUIRED` when foreground blocker
evidence exists. `PAGE_USABLE`, `PAGE_LOADING`, and `UNCLASSIFIED_PAGE_STATE`
do not trigger repeated alerts.

## 9. Manual Conversation Test Result

Added `ops/autopilot/chatgpt_manual_conversation_test.ps1`.

Live A20BA result:

- A-J pool loaded: yes
- current label: A
- rotation threshold: 50
- CDP status: `CDP_READY`
- classifier status: `PAGE_USABLE`
- composer detected: yes
- message sent: yes
- response read: yes
- result: `CHATGPT_MANUAL_CONVERSATION_TEST_PASS`
- counter incremented only after send: yes

The test sent only the harmless prompt:

`Return exactly JSON: {"neurochess_live_test":"ok"}`

No credentials, cookies, tokens, private URLs, or ntfy topic were printed.

## 10. A-J Pool Status

The local A-J pool was present and redacted. Current label was `A`. The live
message counter incremented after confirmed send. Exhausted discussions remain
protected by the existing orchestrator.

## 11. ChatGPT Web Usability

ChatGPT Web can now be used when the composer is visible and enabled. Historical
conversation text no longer parks the lane by itself.

## 12. Gemini Remaining Work

Gemini was not solved in this mission. The same composer-first doctrine should
be applied to Gemini when a configured free web lane exists.

## 13. Recommended Next Mission

A20BB_TRUE_OVERNIGHT_SECOND_RUN_WITH_COMPOSER_FIRST_CLASSIFIER

## 14. Explicit Safety Statements

- A21 was not launched.
- Night Mode was not launched.
- road-to-V2 was not pushed.
- No public release was made.
- No paid API was used.
- No backend, package, DB, or frontend product behavior was modified.
- No screenshots or QA artifacts were committed.
- No ops/autopilot/local or ops/autopilot/runtime files were committed.
- No private ChatGPT URLs, Gemini URLs, ntfy topic, cookies, tokens, API keys,
  credentials, or secrets were committed.
- No CAPTCHA, 2FA, consent, login, or human-verification bypass was attempted.

## 15. Validation

- `git diff --check`: pass
- `ops/autopilot/test_browser_state_truth_protocol.ps1`: pass
- `ops/autopilot/test_web_judge_page_state_classifier.ps1`: pass
- `ops/autopilot/test_chatgpt_manual_conversation_test.ps1`: pass
- `ops/autopilot/test_external_judge_sre.ps1`: pass
- `ops/autopilot/test_alert_router.ps1`: pass
- `ops/autopilot/test_web_judge_orchestrator.ps1`: pass
- `ops/autopilot/test_omega_autopilot.ps1`: pass
- `ops/autopilot/test_neurorelay_loop.ps1`: pass
- `ops/autopilot/test_full_night_score_guard.ps1`: pass
- `ops/autopilot/test_full_night_meta_drift_guard.ps1`: pass
- `ops/autopilot/test_night_readiness_v2.ps1`: pass
- `ops/autopilot/test_neurochess_visual_training_system.ps1`: pass
- `ops/autopilot/test_all_night_readiness_gate.ps1`: pass
- `ops/autopilot/test_strict_visual_firewall.ps1`: pass
- `ops/autopilot/test_design_intelligence_layer.ps1`: pass
- `ops/autopilot/test_autonomous_design_judgment.ps1`: pass
- `ops/autopilot/test_3d_board_stage_architecture.ps1`: pass
- `ops/autopilot/test_visual_auditor_canary_halting.ps1`: pass
- `python tools/plan_guard.py`: pass

## Final Verdict

BROWSER_STATE_TRUTH_PROTOCOL_READY_CHATGPT_LIVE_PASS
