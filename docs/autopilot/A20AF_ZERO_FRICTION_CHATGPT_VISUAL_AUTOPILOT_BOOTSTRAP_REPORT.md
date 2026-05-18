# A20AF Zero-Friction ChatGPT Visual Autopilot Bootstrap Report

## 1. Mission Summary

A20AF implemented a one-command ChatGPT visual canary bootstrap runner:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/run_chatgpt_visual_canary_autopilot.ps1 -MissionId A20AF
```

The runner resolves mission paths automatically, loads the email alert secret from a DPAPI-encrypted local cache when present, bootstraps Chrome/CDP on `127.0.0.1:9222`, generates the canary packet, and passes all required paths to the ChatGPT capture script without prompting for `EvidencePath`, `OutputPath`, or `ArtifactPath`.

This mission did not run A21, Night Mode, a 3h rehearsal, or product integration work.

Final verdict: `CDP_SESSION_BOOTSTRAP_READY`

Recommended next mission: `A20AG_RERUN_CANARY_WITH_ZERO_FRICTION_RUNNER`

## 2. Why A20AF Was Required After A20AE

A20AE failed before human verification because the ChatGPT file-input probe could not connect to Chrome DevTools Protocol at `127.0.0.1:9222`. It also exposed operator friction from repeated path prompts and repeated email-secret prompts.

A20AF addresses those preconditions before the next live canary attempt.

## 3. Implemented Files

- `ops/autopilot/manage_email_alert_secret.ps1`
- `ops/autopilot/setup_email_alert_env.ps1`
- `ops/autopilot/resolve_autopilot_mission_paths.ps1`
- `ops/autopilot/ensure_chatgpt_cdp_session.ps1`
- `ops/autopilot/run_chatgpt_visual_canary_autopilot.ps1`
- `ops/autopilot/capture_chatgpt_visual_judge.ps1`
- `ops/autopilot/send_human_verification_email_alert.ps1`
- `ops/autopilot/test_email_secret_cache.ps1`
- `ops/autopilot/test_autopilot_mission_path_resolver.ps1`
- `ops/autopilot/test_chatgpt_cdp_session_bootstrap.ps1`
- `ops/autopilot/test_zero_friction_chatgpt_canary_runner.ps1`
- `ops/autopilot/a20af_zero_friction_canary_score_result.json`
- `.gitignore`

## 4. Operator Prompt Elimination

- `EvidencePath` prompt eliminated: yes.
- `OutputPath` prompt eliminated: yes.
- `ArtifactPath` prompt eliminated: yes.
- SMTP host/user/from/to prompts eliminated: yes.
- Chrome profile prompt eliminated: yes.
- Allowed prompts remaining: READY gate, and one-time secure Gmail app password prompt only when no env var or DPAPI cache exists.

`capture_chatgpt_visual_judge.ps1` now fails with `PARAMETER_REQUIRED` instead of letting PowerShell prompt interactively when low-level callers omit required paths.

## 5. Email Secret Cache

A20AF added a DPAPI current-user cache at:

`ops/autopilot/local/email_alert.secret.dpapi.json`

That file is gitignored and was not committed.

Load order:

1. `NC_ALERT_SMTP_PASSWORD`
2. encrypted DPAPI cache
3. one-time secure prompt if missing

Offline tests proved a fake secret can be stored and loaded, the stored file does not contain plaintext, `-NoPrompt` does not hang, and the email alert script can use the process secret without printing it.

Current mission run did not have a real stored secret cache available, so the non-live validation path did not use a real email secret. This is not a readiness failure for the bootstrap code.

## 6. Path Resolver

`resolve_autopilot_mission_paths.ps1` resolves A20AF to:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20AF_zero_friction_chatgpt_visual_autopilot_20260518`

It creates `canary`, `raw_outputs`, `normalized_outputs`, and `logs` automatically. It also knows the existing A20P visual training evidence path for future runs.

## 7. CDP Bootstrap

Initial read-only CDP check:

- `127.0.0.1:9222` reachable initially: no.
- Status: `CDP_SESSION_UNAVAILABLE`.

Real bootstrap attempt:

- Chrome launched: yes.
- CDP attached: yes.
- Status: `CDP_SESSION_BOOTSTRAPPED`.
- Chrome closed by script: no.
- Credentials entered: no.
- Bypass attempted: no.

Read-only page snapshot after bootstrap:

- Browser reachable: yes.
- CDP attached: yes.
- Page title: `ChatGPT`.
- URL class: `CHATGPT_PAGE`.
- Composer-like elements observed: yes.
- Image-accepting file inputs observed: yes.
- Current state: `HUMAN_OR_AUTH_WALL`.
- Human verification detected: no.
- Login/auth markers detected: yes.
- Consent markers detected: yes.

No message, upload, paste, drag/drop, or verification action was attempted.

## 8. Canary Status

The non-live runner test generated:

- `canary/canary_image.png`
- `canary/canary_expected.json`
- `canary/canary_prompt.md`

The canary code is hidden from the prompt. The live canary was not sent in A20AF because the page snapshot showed auth/consent markers. Highest capability reached in the mission result remains `C5_LOCAL_CANARY_IMAGE_GENERATED`; CDP bootstrap is now ready for the next controlled canary run.

## 9. Score Update

- Previous score: `17.5/20`.
- New score: `17.5/20`.
- 18/20 reached: no.
- Reason: no live image attachment, image-aware response, A20P judge output, or Gemini valid judge output was captured.
- No claim of 19/20 was made.

## 10. Operator Prompt Leak Check

Operator prompt leak detected: no.

The runner and tests verify no prompt exists for:

- `EvidencePath`
- `OutputPath`
- `ArtifactPath`
- SMTP host/user/from/to
- Chrome profile path

## 11. Validation

Passed:

- `git diff --check`
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

Frontend build and V1 smoke were not run because frontend files were not changed.

## 12. Safety Statements

- A21 was not launched.
- Night Mode was not launched.
- `road-to-V2` was not pushed.
- `road-to-V2` was not merged.
- No backend product code was touched.
- No frontend product code was touched.
- No package files were touched.
- No DB files were touched.
- No screenshots or QA artifacts were committed.
- No external assets were committed.
- No `ops/autopilot/local/**` files were committed.
- No `ops/autopilot/runtime/**` files were committed.
- No credentials were committed.
- No SMTP password was printed.
- No secrets were printed.
- No human verification bypass was attempted.
- No CAPTCHA bypass was attempted.
- No 2FA bypass was attempted.
- No consent bypass was attempted.

## 13. What Remains For 18/20

The next proof must use the zero-friction runner with the operator ready:

1. Clear the visible ChatGPT auth/consent state manually in the opened Chrome profile if required.
2. Run the zero-friction canary command.
3. Confirm C7 attachment, C8 prompt send, C9 image-aware response, and C10 valid canary JSON.
4. Only after C10, run A20P Visual Court ChatGPT judge with the same runner pattern.

Recommended next mission: `A20AG_RERUN_CANARY_WITH_ZERO_FRICTION_RUNNER`.
