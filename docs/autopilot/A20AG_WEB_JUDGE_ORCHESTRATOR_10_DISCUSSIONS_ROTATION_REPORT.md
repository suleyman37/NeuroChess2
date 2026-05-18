# A20AG Web Judge Orchestrator 10 Discussions Rotation Report

## 1. Mission Summary

A20AG created a central web judge orchestrator for ChatGPT/Gemini browser judge sessions.

It centralizes:

- ChatGPT discussion pool labels A-J;
- private local URL storage;
- message counters;
- rotation after 35 outgoing Codex messages;
- bootstrap context generation;
- CDP/session setup;
- email pause/resume routing;
- problem-to-solution mapping;
- no-prompt operator defaults.

This mission did not launch A21, Night Mode, a 3h rehearsal, or product integration work.

Final verdict: `WEB_JUDGE_ORCHESTRATOR_READY`

Recommended next mission: `A20AH_SETUP_WEB_JUDGE_SESSIONS_AND_RERUN_CANARY`

## 2. Why A20AG Was Required After A20AF

A20AF fixed the zero-friction canary bootstrap preconditions, but the overall web judge flow was still fragmented across single-purpose scripts. A20AG establishes one control plane so future runs do not expose low-level paths, repeat email-secret setup, lose track of ChatGPT discussion length, or route auth/human-verification states inconsistently.

## 3. ChatGPT Discussion Pool A-J

Registered: yes.

The user-provided private ChatGPT discussion URLs A-J were written only to:

`ops/autopilot/local/web_judge_conversation_pool.local.json`

Runtime state was written only to:

`ops/autopilot/runtime/web_judge_session_state.json`

Both locations are ignored and were not staged or committed. Reports and status output show only labels A-J, counters, and `url_configured: true`.

## 4. Rotation Threshold

Rotation threshold: `35` messages per discussion.

Counted as messages:

- bootstrap context;
- normal supervisor prompt;
- judge prompt;
- correction prompt;
- handoff prompt;
- any text submitted to ChatGPT.

Not counted:

- CDP checks;
- page open;
- attachment without send;
- resume checks.

When the active discussion reaches 35, it is marked exhausted and the next available label is selected. If J is exhausted and no discussion remains, the orchestrator requests an email notification for a new pool.

## 5. Bootstrap Context

Created:

- `docs/autopilot/WEB_JUDGE_BOOTSTRAP_CONTEXT_TEMPLATE.md`
- `ops/autopilot/build_web_judge_bootstrap_context.ps1`

The bootstrap includes the product definition, doctrine, safety rules, design rules, current mission fields, recent outcomes, and concise response requirements. It excludes secrets and private URLs. The builder enforces a 2500-word limit and compresses if needed.

## 6. Message Counter Behavior

Dry-run validation confirmed:

- bootstrap increments the current discussion counter by 1;
- `SendChatGPT` increments the counter by 1;
- missing `MessageFile` returns `MESSAGE_FILE_REQUIRED` rather than prompting;
- exhausted discussions are not reused.

## 7. Human Action Email Behavior

Auth, consent, CAPTCHA, 2FA, and human verification are routed to pause/resume:

- keep Chrome open;
- send or stage email alert;
- wait for manual action;
- poll read-only resume state;
- no bypass, no verification click, no credential entry.

Dry-run validation confirmed `AUTH_OR_CONSENT_WALL`, `HUMAN_VERIFICATION_REQUIRED`, and `TWO_FACTOR_REQUIRED` route to email pause behavior.

## 8. CDP Session Strategy

The orchestrator uses the A20AF CDP bootstrap:

- check `http://127.0.0.1:9222/json/version`;
- if unreachable, launch Chrome/Edge with remote debugging port 9222 and the configured local profile;
- keep browser open;
- never kill user Chrome;
- never use unstable persistent context for this lane.

## 9. Email Secret Cache Integration

The orchestrator calls the A20AF email setup flow:

1. `NC_ALERT_SMTP_PASSWORD`
2. DPAPI encrypted local cache
3. secure one-time prompt only when allowed

`NoPrompt` mode returns configuration status and does not hang.

## 10. Problem Solution Matrix

Created:

- `docs/autopilot/WEB_JUDGE_PROBLEM_SOLUTION_MATRIX.md`
- `ops/autopilot/web_judge_problem_solution_matrix.yaml`

The matrix covers:

- `CDP_UNREACHABLE`
- `AUTH_OR_CONSENT_WALL`
- `HUMAN_VERIFICATION_REQUIRED`
- `TWO_FACTOR_REQUIRED`
- `CHATGPT_CONVERSATION_TOO_LONG`
- `CHATGPT_DISCUSSION_NOT_BOOTSTRAPPED`
- `EMAIL_SECRET_CACHE_MISSING`
- `OPERATOR_PROMPT_LEAK`
- `UPLOAD_ATTACHMENT_NOT_CONFIRMED`
- `JSON_INVALID`
- `SESSION_CLOSED`
- `PAGE_NOT_EXPECTED_DISCUSSION`
- `MESSAGE_SEND_FAILED`
- `GEMINI_DISABLED_NO_URL`

## 11. No-Prompt Guarantee

No prompts for:

- `EvidencePath`
- `OutputPath`
- `ArtifactPath`
- SMTP host/user/from/to
- Chrome profile path
- CDP endpoint
- discussion URL during send mode
- conversation counters

Allowed prompts remain:

- one-time Gmail app password only if encrypted cache is missing and prompting is allowed;
- READY gate before live browser actions if a live runner uses it;
- manual action in Chrome when auth/consent/human verification appears.

## 12. Gemini Strategy

Gemini is optional. If Gemini mode is requested without a URL, the orchestrator returns `GEMINI_DISABLED_NO_URL` and does not block ChatGPT operations.

## 13. Artifacts

External artifacts were written under:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\web_judge_orchestrator\A20AG_web_judge_orchestrator_10_discussions_20260518`

Key artifacts:

- `manifest.json`
- `init_pool_result.json`
- `status_result_redacted.json`
- `dry_run_problem_matrix_result.json`
- `rotation_test_result.json`
- `bootstrap_context_sample.md`
- `email_event_samples.json`
- `no_prompt_test_result.json`

No artifacts were committed.

## 14. What Remains Before Live Canary Retry

Before the next live canary:

1. Ensure ChatGPT auth/consent state is cleared manually in the correct Chrome profile.
2. Use the orchestrator `Setup` or `EnsureSessions` mode to verify CDP and current label.
3. Use the zero-friction canary runner or orchestrator send mode with A-J rotation state active.
4. Stop and email on any auth/consent/human-verification wall.

## 15. Validation

Passed:

- `git diff --check`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_web_judge_orchestrator.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_email_secret_cache.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_autopilot_mission_path_resolver.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_chatgpt_cdp_session_bootstrap.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_zero_friction_chatgpt_canary_runner.ps1`
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

Frontend build and V1 smoke were not run because no frontend files changed.

## 16. Safety Statements

- A21 was not launched.
- Night Mode was not launched.
- `road-to-V2` was not pushed.
- `road-to-V2` was not merged.
- No backend product code was touched.
- No frontend product code was touched.
- No package files were touched.
- No DB files were touched.
- No screenshots or QA artifacts were committed.
- No `ops/autopilot/local/**` files were committed.
- No `ops/autopilot/runtime/**` files were committed.
- No SMTP password was printed.
- No secrets were printed.
- No credentials were committed.
- No local URLs were committed.
- No human verification bypass was attempted.
- No CAPTCHA bypass was attempted.
- No 2FA bypass was attempted.
- No consent bypass was attempted.
