# A20R Live Visual Court Safe Run Report

## Mission Summary

A20R ran the A20Q Visual Court Bridge against the real A20P screenshot-to-patch
evidence. The mission did not launch A21, did not launch Night Mode, did not run
a 3h rehearsal, and did not modify product code.

The safe live path was probed through the approved bridge script only. It
stopped cleanly because no approved live Gemini/ChatGPT bridge was configured.
The mission then used `MANUAL_PACKET_MODE` and produced the manual judge packet
for real Gemini and ChatGPT import.

## Source Branch And Commit

- protected road branch: `road-to-V2`
- expected road HEAD: `7a71b0e`
- A20Q source branch: `auto/a20q-live-gemini-chatgpt-visual-court-bridge-20260518`
- A20Q source commit verified: `d90c700`
- A20R branch: `auto/a20r-live-visual-court-safe-run-20260518`

## Why A20R Was Required After A20Q

A20Q created the bridge, prompt templates, validation behavior, manual packet
workflow, and safe live policy. It raised the visual automation score to
17.5/20, but it did not validate real Gemini or ChatGPT judge outputs.

A20R tested the bridge on A20P evidence and checked whether real judge inputs
were available. They were not. The score therefore remains 17.5/20.

## A20P Evidence Inspected

Evidence path:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_training\A20P_screenshot_to_patch_a20l_20260518\`

Inspected evidence:

- `manifest.json`
- `visual_court_packet.json`
- `creative_director_verdict.json`
- `visual_delta_report.json`
- `visual_delta_report.md`
- `a20p_morning_review.md`
- `generation_1_patch/contact_sheet_generation_1_states.png`
- `generation_1_patch/contact_sheet_before_after_a20l_vs_a20p.png`
- `browser_smoke_report.json`
- `anti_spoiler_check.json`
- `sacred_board_contract_check.json`
- `public_teaser_check.json`
- `next_visual_mission_prompt.md`

The A20P evidence reports `PATCH_IMPROVED_PUBLIC_TEASER_READINESS`,
`PASS_CHESS_FIDELITY`, `PASS_ANTI_SPOILER`, and
`PUBLIC_TEASER_READY_WITH_CAVEATS`. Human review remains required.

## Bridge Mode Attempted

Primary mode:

`MANUAL_PACKET_MODE`

Command used:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/run_visual_court_bridge.ps1 -MissionId A20R_LIVE_VISUAL_COURT_SAFE_RUN -EvidencePath "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_training\A20P_screenshot_to_patch_a20l_20260518\" -OutputPath "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20R_real_visual_court_safe_run_20260518\" -Mode MANUAL_PACKET_MODE -TargetVisualLevel "PUBLIC_TEASER_READY_WITH_CAVEATS"
```

Result:

- mode result: `BRIDGE_COMPLETED_WITH_MISSING_INPUTS`
- Gemini: `MISSING_INPUT`
- ChatGPT: `MISSING_INPUT`
- Codex judge file: `MISSING_INPUT`
- hard gate packet: `VALID_OUTPUT`
- hard gate override: `false`
- Creative Director verdict: `INSUFFICIENT_VISUAL_EVIDENCE`

## Safe Live Attempt

Safe live mode was probed through the bridge script only.

Result:

`SAFE_LIVE_READONLY_MODE_NOT_CONFIGURED_USE_MANUAL_PACKET_MODE`

No live Gemini call was made. No live ChatGPT call was made. No login,
CAPTCHA, 2FA, consent, credential automation, or human-verification bypass was
attempted.

## Manual Packet Mode

Manual packet mode was generated at:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20R_real_visual_court_safe_run_20260518\`

Generated files include:

- `visual_court_packet.json`
- `gemini_prompt.md`
- `chatgpt_prompt.md`
- `codex_patch_planner_prompt.md`
- `creative_director_decision_template.md`
- `manual_input_templates/GEMINI_INPUT_INSTRUCTIONS.md`
- `manual_input_templates/CHATGPT_INPUT_INSTRUCTIONS.md`
- `manual_input_templates/where_to_save_gemini_output.txt`
- `manual_input_templates/where_to_save_chatgpt_output.txt`
- `manual_input_templates/expected_json_schema.md`
- `validated_judge_outputs/gemini_validation.json`
- `validated_judge_outputs/chatgpt_validation.json`
- `validated_judge_outputs/codex_validation.json`

No real manual Gemini output was imported. No real manual ChatGPT output was
imported.

## Judge Validation Results

| Judge | Result | Meaning |
|---|---|---|
| Gemini | `MISSING_INPUT` | No real Gemini JSON was present. |
| ChatGPT | `MISSING_INPUT` | No real ChatGPT JSON was present. |
| Codex patch planner file | `MISSING_INPUT` | No separate real Codex judge JSON was present. |
| Hard gate packet | `VALID_OUTPUT` | A20P hard-gate evidence was accepted. |

Missing input was not converted to PASS. Placeholder or generic output would be
invalidated by the A20Q validation script.

## Hard Gate Behavior

The hard-gate packet remained green:

- hard gate status: `PASS_HARD_GATES`
- chess arbiter: `CHESS_FIDELITY_PASS`
- anti-generic verdict: `PASS_NON_GENERIC`
- hard gate override: `false`

Gemini and ChatGPT were not allowed to override hard gates because they were
missing.

## Creative Director Final Verdict

Creative Director verdict:

`INSUFFICIENT_VISUAL_EVIDENCE`

Reason: A20P has useful screenshot evidence and green hard gates, but A20R did
not receive real Gemini or ChatGPT judge outputs. The bridge cannot claim
external Visual Court proof from missing inputs.

## Next Mission Prompt

Generated:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20R_real_visual_court_safe_run_20260518\next_visual_mission_prompt.md`

The next prompt is based on missing real judge evidence. The recommended next
mission is `A20S_MANUAL_IMPORT_REAL_JUDGES_FOR_VISUAL_COURT`.

## Updated Design Automation Score

- previous score: 17.5/20
- new score estimate: 17.5/20
- 18/20 reached: no

Why it did not increase:

- no real Gemini output was imported or validated;
- no real ChatGPT output was imported or validated;
- no real external judge disagreement was merged into a Creative Director
  verdict.

## What Remains For 19/20

19/20 remains impossible until multiple screenshot-to-patch loops succeed with
human-calibrated review and the Visual Court repeatedly handles real judge
disagreement without weakening hard visual gates.

## Safety Statements

- A21 was not launched.
- Night Mode was not launched.
- A 3h rehearsal was not launched.
- `road-to-V2` was not pushed.
- `road-to-V2` was not merged.
- Backend was not touched.
- Frontend product code was not touched.
- Package files were not touched.
- No screenshots, images, or QA artifacts were committed.
- No external assets were added.
- Live ChatGPT was not called.
- Live Gemini was not called.
- Human verification was not encountered.
- No bypass was attempted.

## Final Verdict

`VISUAL_COURT_MANUAL_PACKET_READY_SCORE_17_5`

## Recommended Next Mission

`A20S_MANUAL_IMPORT_REAL_JUDGES_FOR_VISUAL_COURT`
