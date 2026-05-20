# A20BG Web Visual Recovery Rule + ChatGPT/Gemini Live Run Report

## 1. Summary

A20BG added the Web Visual Recovery Rule and ran a bounded live-supervised pixel mission using OMEGA, ChatGPT Web, and Gemini Web.

Final status: `WEB_VISUAL_RECOVERY_READY_CHATGPT_GEMINI_PASS`.

## 2. What Changed

The new rule is:

`try once -> screenshot current UI -> reason from visible UI -> revise once -> park lane and fallback if still blocked`.

The implementation is in `ops/autopilot/web_visual_recovery_rule.ps1` and documented in `docs/autopilot/WEB_VISUAL_RECOVERY_RULE.md`.

The rule forbids repeated blind selector attempts and forbids browser verdicts from body text, hidden DOM, old logs, or conversation history alone.

## 3. ChatGPT Lane

- Profile/window: dedicated ChatGPT lane.
- CDP port: `9222`.
- A-J pool: loaded.
- Rotation threshold: 50.
- Page verdict: `PAGE_USABLE`.
- Screenshot before verdict: yes.
- Composer visible: yes.
- Attempts: 4.
- Successful Decision Packets: 4.
- Counter increment: yes, after confirmed send only.
- Final lane status: `CHATGPT_DECISION_PACKETS_READY`.

Private A-J URLs were not printed.

## 4. Gemini Lane

- Profile/window: dedicated Gemini lane.
- CDP port: `9223`.
- Page verdict: `PAGE_USABLE`.
- Screenshot before verdict: yes.
- Composer visible: yes.
- Visual upload: confirmed.
- Prompt sent after attachment: yes.
- Response read: yes.
- Valid visual packet: yes.
- Final lane status: `AVAILABLE_VISUAL_PACKET_READY`.

Gemini and ChatGPT stayed in separate browser profiles/windows because their account identities may differ.

## 5. Screenshot Recovery Events

The recovery rule was exercised and recorded events under the external artifact path:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\web_visual_recovery\A20BG\`

Recorded recovery shape:

- service;
- action attempted;
- failure or ambiguity;
- screenshot path;
- visible UI analysis;
- revised action;
- result.

The live pass did not require a human auth park. The mission still proved the recovery rule with screenshot-backed events and kept the lane fallback path available.

## 6. Did Screenshots Change The Decision?

Yes. The rule now prevents the old failure mode where scripts keep retrying selectors or infer blockers from text. A recovery attempt must stop, capture the visible UI, and choose the next action from what is visible.

This especially protects:

- ChatGPT: composer visible means usable unless a foreground blocker is visible.
- Gemini: upload cannot be called unavailable unless the screenshot and targeted checks support it.
- Dual accounts: ChatGPT and Gemini are never judged from the same browser context.

## 7. Pixel Deltas

A DEV-only route was added:

`/app?webVisualRecoveryRun=1`

Visible deltas:

1. `WEB_VISUAL_RECOVERY_RULE_VISUAL_RAIL`
   - Shows the screenshot recovery loop as a visual rail with current UI observation and revised action.

2. `CHATGPT_GEMINI_PACKET_COMPARISON_SURFACE`
   - Shows OMEGA authority, ChatGPT strategic packet, and Gemini visual packet as separate advisory inputs.

The route is DEV-only and does not change V1 product behavior.

## 8. Mission Doctor

Mission Doctor result: `PASS`.

Reason:

- visible pixel work exists;
- route is DEV-only;
- OMEGA remains final authority;
- web lanes are advisory;
- no backend, DB, package, or V1 flow changes were made.

## 9. OMEGA / NeuroRelay

- OMEGA rehearsal: `OMEGA_REHEARSAL_PASS`.
- Iterations: 2.
- Pixel objective included: yes.
- NeuroRelay rehearsal: `NEURORELAY_REHEARSAL_PASS`.
- Local fallback: available.

## 10. Validation

Passed:

- `git diff --check`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_web_visual_recovery_rule.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_mcp_playwright_browser_truth.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_gemini_upload_adapter.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_gemini_model_selector_second_pass.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_gemini_web_lane_adapter.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_gemini_visual_packet_smoke.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_playwright_visual_control.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_browser_profile_manager.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_browser_state_truth_protocol.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_web_judge_page_state_classifier.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_chatgpt_manual_conversation_test.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_external_judge_sre.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_alert_router.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_web_judge_orchestrator.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_omega_autopilot.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_neurorelay_loop.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_night_readiness_v2.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_neurochess_visual_training_system.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_all_night_readiness_gate.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_strict_visual_firewall.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_design_intelligence_layer.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_autonomous_design_judgment.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_3d_board_stage_architecture.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_visual_auditor_canary_halting.ps1`
- `cmd /c npm.cmd run build`
- `cmd /c npx.cmd tsc --noEmit`
- `node scripts/browser_web_visual_recovery_run_smoke.mjs`
- `python tools/plan_guard.py`

## 11. Safety Summary

- No road-to-V2 push.
- No road-to-V2 merge.
- A21 was not launched.
- Night Mode was not launched.
- No public release.
- No paid API.
- No OpenAI API call.
- No Gemini API call.
- No backend, DB, or package file changes.
- No screenshots committed.
- No QA artifacts committed.
- No `ops/autopilot/local/**` committed.
- No `ops/autopilot/runtime/**` committed.
- No private URLs, cookies, tokens, account emails, ntfy topic, or secrets committed.
- No CAPTCHA, 2FA, consent, login, or human verification bypass.
- No blind typing.
- V1 product behavior unchanged.

## 12. What Remains

The next step is a true overnight run using the visual recovery rule as a standing web-control doctrine.

Recommended next mission:

`A20BH_TRUE_OVERNIGHT_WITH_VISUAL_RECOVERY_RULE`
