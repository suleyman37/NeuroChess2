# A20Q Live Gemini ChatGPT Visual Court Bridge Report

## 1. Mission Summary

A20Q created a safe Visual Court Bridge for combining Gemini visual perception,
ChatGPT product/art-direction critique, Codex patch planning, hard-gate vetoes,
and Creative Director synthesis. The bridge defaults to offline fixture and
manual packet workflows. It does not require live providers.

Final verdict: VISUAL_COURT_BRIDGE_READY_MANUAL_MODE_SCORE_17_5.

## 2. Why A20Q Was Required After A20P

A20P improved the A20L North Star Board Stage and moved the design automation
score from 16/20 to 17/20. It did not reach 18/20 because no Gemini or ChatGPT
judge outputs were validated and merged. A20Q adds the missing bridge layer so
future visual missions can import live or manual judge critique safely.

## 3. Source Branch And Commit

- protected road branch: road-to-V2
- expected road HEAD: 7a71b0e
- A20P source branch: auto/a20p-screenshot-to-patch-real-run-on-a20l-20260518
- A20P source commit: 786ff78
- A20Q branch: auto/a20q-live-gemini-chatgpt-visual-court-bridge-20260518

## 4. Bridge Modes Created

- `OFFLINE_FIXTURE_MODE`: default, fixture judge outputs only.
- `MANUAL_PACKET_MODE`: generates packets and validates operator-saved outputs.
- `SAFE_LIVE_READONLY_MODE`: optional; currently stops cleanly if no approved
  bridge is configured.

Live mode is not required for mission success.

## 5. Prompt Templates Created

- `docs/design/GEMINI_VISUAL_PERCEIVER_PROMPT.md`
- `docs/design/CHATGPT_PRODUCT_ART_DIRECTOR_PROMPT.md`
- `docs/design/CODEX_VISUAL_PATCH_PLANNER_PROMPT.md`
- `docs/design/CREATIVE_DIRECTOR_SYNTHESIS_PROMPT.md`

The prompts require strict JSON, screenshot evidence, concrete defects, and
hard-gate veto awareness.

## 6. Scripts Created

- `ops/autopilot/run_visual_court_bridge.ps1`
- `ops/autopilot/validate_visual_judge_output.ps1`
- `ops/autopilot/test_visual_court_bridge.ps1`

The bridge writes packets, prompts, manual templates, validation results,
merged summaries, Creative Director verdicts, safety reports, and next mission
prompts.

## 7. Schemas Created

- `ops/autopilot/schemas/visual_court_bridge_run.schema.json`
- `ops/autopilot/schemas/visual_judge_output_validation.schema.json`
- `ops/autopilot/schemas/visual_court_merged_summary.schema.json`
- `ops/autopilot/schemas/visual_court_safety_report.schema.json`

These are compatible with the existing A20O visual packet, judge, patch, and
Creative Director schemas.

## 8. Fixtures Created

- `a20p_gemini_visual_observation_good.json`
- `a20p_chatgpt_art_direction_review_good.json`
- `a20p_codex_patch_plan_good.json`
- `gemini_placeholder_praise_invalid.json`
- `chatgpt_text_only_overapproval_invalid.json`
- `codex_self_congratulatory_patch_invalid.json`
- `hard_gate_fail_with_gemini_praise.json`
- `missing_screenshot_public_ready_invalid.json`
- `conflicting_judges_creative_director_patch.json`

The fixtures prove good merge behavior and rejection of unsafe or fake judge
outputs.

## 9. Manual Packet Workflow

Created:

- `docs/autopilot/VISUAL_COURT_MANUAL_PACKET_WORKFLOW.md`

The workflow explains how to generate the packet, upload/reference A20P
evidence, save Gemini and ChatGPT JSON outputs, merge them, select a Creative
Director verdict, and generate the next Codex mission prompt.

## 10. Safe Live Policy

Created:

- `docs/autopilot/SAFE_LIVE_VISUAL_COURT_POLICY.md`

Policy additions were made to:

- `ops/autopilot/all_night_readiness_policy.yaml`

The policy states that live mode is optional, manual mode is allowed, missing
judges are not PASS, placeholder praise is invalid, hard gates veto praise, and
human verification stops live mode.

## 11. Whether Live Gemini Was Called

Live Gemini was not called.

## 12. Whether Live ChatGPT Was Called

Live ChatGPT was not called.

## 13. Manual/Fixture Mode Proof

The bridge was run on A20P evidence in `OFFLINE_FIXTURE_MODE` and generated
external artifacts under:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20Q_live_gemini_chatgpt_bridge_20260518\`

Output included:

- `manifest.json`
- `bridge_mode_report.json`
- `visual_court_packet.json`
- `gemini_prompt.md`
- `chatgpt_prompt.md`
- `codex_patch_planner_prompt.md`
- `manual_input_templates/`
- `fixture_judge_outputs/`
- `merged_visual_court_summary.json`
- `creative_director_verdict.json`
- `next_visual_mission_prompt.md`
- `bridge_test_report.json`
- `safety_report.json`
- `console_log.txt`

Bridge result: `BRIDGE_READY_MANUAL_FIXTURE`.

## 14. Judge Validation Behavior

`validate_visual_judge_output.ps1` returns:

- `VALID_OUTPUT`
- `INVALID_OUTPUT`
- `MISSING_INPUT`

It checks required fields, screenshot references, placeholder enum text,
generic praise, text-only overapproval, and Codex self-approval.

## 15. Placeholder Praise Rejection Behavior

The fixture `gemini_placeholder_praise_invalid.json` is rejected because it
contains enum placeholder text and no concrete visual critique.

## 16. Hard-Gate Veto Behavior

The fixture `hard_gate_fail_with_gemini_praise.json` proves hard-gate failure
overrides praise. The Creative Director cannot accept a candidate when the
hard-gate summary contains a chess fidelity block.

## 17. Creative Director Synthesis Behavior

In the A20P fixture bridge run:

- Gemini fixture: valid concrete visual observation.
- ChatGPT fixture: valid product/art-direction critique.
- Codex fixture: valid patch feasibility.
- Hard gates: pass.
- Creative Director verdict: `PRODUCT_GRADE_WITH_DEBT`.
- Selected action: `patch`.

This is correct because A20P is improved but still caveated, not final public
or hero-ready.

## 18. Next Mission Prompt Generation Behavior

`next_visual_mission_prompt.md` is generated automatically and includes:

- objective;
- allowed paths;
- forbidden paths;
- exact stop conditions;
- evidence requirements;
- screenshot requirements;
- hard gates;
- validation commands;
- no road push;
- no merge.

## 19. Updated Design Automation Score Estimate

Previous score: 17/20.

New score estimate: 17.5/20.

A20Q earns a half-step because the bridge works in fixture/manual mode and
validates/merges judge outputs safely. It does not reach 18/20 because no real
or manually imported Gemini/ChatGPT outputs were used on A20P evidence.

## 20. Whether 18/20 Was Reached

18/20 was not reached.

To reach 18/20, the system needs a safe live or manually imported Gemini and
ChatGPT visual court run on real A20P screenshots, with validation and merge
passing.

## 21. What Remains For 19/20

19/20 remains blocked until multiple screenshot-to-patch loops succeed with
human-calibrated review and the system repeatedly rejects visually tempting but
chess-unsafe designs.

## 22. A21 Not Launched

A21 was not launched.

## 23. Night Mode Not Launched

Night Mode was not launched.

## 24. Road-To-V2 Not Pushed

road-to-V2 was not pushed or merged.

## 25. Recommended Next Mission

Recommended next mission: A20R_LIVE_VISUAL_COURT_SAFE_RUN.

Reason: A20Q proved the bridge in fixture/manual modes. The next missing proof
for 18/20 is a safe live or manually imported visual court run using real A20P
screenshots, with immediate stop on verification or login friction.
