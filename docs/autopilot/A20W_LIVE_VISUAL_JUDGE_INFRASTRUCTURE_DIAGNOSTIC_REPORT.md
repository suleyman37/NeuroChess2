# A20W Live Visual Judge Infrastructure Diagnostic Report

## 1. Mission Summary

A20W diagnosed the live Gemini and ChatGPT Visual Court infrastructure after
A20Q through A20V proved the offline/manual bridge but failed to produce a
valid real Gemini plus ChatGPT judge merge.

This mission made no implementation fixes. It did not harden capture scripts,
add capture behavior, run a live judge retry, launch A21, launch Night Mode, or
run a 3h rehearsal.

Diagnostic verdict:

`LIVE_MODE_DIAGNOSIS_COMPLETE_MULTIPLE_PATHS`

Recommended next action:

`CHATGPT_SUPERVISOR_REVIEW_REQUIRED`

## 2. Source Branch And Commit

- Protected road branch verified: `road-to-V2`
- Expected road HEAD verified: `7a71b0e`
- `origin/road-to-V2` verified: `7a71b0e`
- Source branch: `auto/a20v-chatgpt-visual-upload-lane-implementation-20260518`
- Source commit verified: `b03ffea`
- Diagnostic branch: `auto/a20w-live-visual-judge-infrastructure-diagnostic-20260518`

## 3. Why This Diagnostic Was Requested

A20P proved the first screenshot-to-patch improvement and moved the visual
automation score from 16/20 to 17/20. A20Q created the Visual Court bridge and
moved the system to 17.5/20 in manual/fixture mode. A20R, A20S, and A20S Phase
2 correctly refused to fake missing real judge outputs. A20T, A20U, and A20V
attempted bounded live capture infrastructure.

The score remains 17.5/20 because no valid real Gemini plus ChatGPT visual
judge outputs have been captured, validated, merged, and synthesized into a
Creative Director verdict.

## 4. Files And Evidence Inspected

Core governance read:

- `AGENTS.md`
- `docs/PLAN_SOURCE_OF_TRUTH.md`
- `docs/PLAN_CONTEXT_MIN.md`

Visual Court reports read:

- `docs/autopilot/A20Q_LIVE_GEMINI_CHATGPT_VISUAL_COURT_BRIDGE.md`
- `docs/autopilot/A20Q_LIVE_GEMINI_CHATGPT_VISUAL_COURT_BRIDGE_REPORT.md`
- `docs/autopilot/A20R_LIVE_VISUAL_COURT_SAFE_RUN_REPORT.md`
- `docs/autopilot/A20S_MANUAL_IMPORT_REAL_JUDGES_FOR_VISUAL_COURT_REPORT.md`
- `docs/autopilot/A20S_PHASE2_REAL_JUDGE_MERGE_REPORT.md`
- `docs/autopilot/A20T_AUTONOMOUS_REAL_JUDGE_CAPTURE_AND_MERGE_REPORT.md`
- `docs/autopilot/A20U_VISUAL_JUDGE_CAPTURE_HARDENING_REPORT.md`
- `docs/autopilot/A20V_CHATGPT_VISUAL_UPLOAD_LANE_IMPLEMENTATION_REPORT.md`

Policies and runbooks read:

- `docs/autopilot/SAFE_LIVE_VISUAL_COURT_POLICY.md`
- `docs/autopilot/VISUAL_COURT_MANUAL_PACKET_WORKFLOW.md`
- `docs/autopilot/VISUAL_SELF_IMPROVEMENT_RUNBOOK.md`
- `ops/autopilot/all_night_readiness_policy.yaml`

Capture and bridge scripts inspected:

- `ops/autopilot/run_visual_court_bridge.ps1`
- `ops/autopilot/capture_gemini_visual_judge.ps1`
- `ops/autopilot/capture_chatgpt_visual_judge.ps1`
- `ops/autopilot/normalize_visual_judge_response.ps1`
- `ops/autopilot/validate_visual_judge_output.ps1`
- `ops/autopilot/merge_visual_court_inputs.ps1`
- `ops/autopilot/select_visual_patch_plan.ps1`
- `ops/autopilot/generate_next_visual_mission_prompt.ps1`
- `ops/autopilot/test_visual_judge_capture_hardening.ps1`
- `ops/autopilot/test_chatgpt_visual_upload_lane.ps1`
- `ops/autopilot/test_visual_court_bridge.ps1`
- `ops/autopilot/browser/chatgpt_bridge.mjs`
- `ops/autopilot/browser/chatgpt_cdp_attach_loop.mjs`
- `ops/autopilot/browser/gemini_bridge.mjs`

Transport/session docs and scripts were inspected where present, including
ChatGPT CDP attach docs, ChatGPT human verification guard docs, Gemini visual
court docs, bridge availability docs, and persistent ChatGPT transport scripts.
Local files under `ops/autopilot/local/*.json` were inspected only for
presence and key shape. Values were redacted and no secrets were printed.

External diagnostic artifacts were written under:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20W_live_visual_judge_infrastructure_diagnostic_20260518\`

## 5. A20Q-A20V Failure Timeline

| Mission | Worked | Failed | Blocker Type |
|---|---|---|---|
| A20Q | Fixture/manual bridge, validation, hard-gate veto, next prompt | No real judge outputs | Missing evidence |
| A20R | Safe packet generation and missing-input handling | No real judge files | Missing evidence |
| A20S | Manual import instructions and expected paths | Judge files absent | Missing evidence |
| A20S Phase 2 | Correctly stopped on missing files | Both files absent | Missing evidence |
| A20T | Gemini bounded attempt; ChatGPT precheck | Gemini timeout/done missing; ChatGPT no approved upload lane | Response completion plus upload lane |
| A20U | Gemini raw captured and normalized; ChatGPT blocked safely | Gemini score ranges invalid; ChatGPT lane missing | JSON schema plus policy |
| A20V | ChatGPT wrapper supports attachments and stops safely | Approved bridge disabled before live upload probe | Policy/config block |

The through-line is not one single bug. Gemini is reachable but unreliable at
strict JSON compliance. ChatGPT has a policy/configuration stop before any live
visual upload can be proved.

## 6. Gemini Lane Diagnosis

Gemini lane status:

- Approved profile/session: available enough for A20U bounded attempt.
- Image/contact-sheet lane: available through `ask_gemini_web.ps1 -ImagePath`.
- Prompt comprehension: pass, because A20U captured screenshot-grounded raw
  output.
- Response capture: improved after A20U. Raw output was saved externally.
- JSON extraction: improved after A20U. The normalizer extracted a judge object.
- Validation: failed.

Current Gemini blocker:

`JSON_SCHEMA_BLOCKER` plus `MODEL_COMPLIANCE_BLOCKER`

Evidence:

- A20U normalized Gemini JSON was written.
- Validation result: `INVALID_OUTPUT`.
- Invalid reasons:
  - `awwwards_app_craft_score_out_of_range`
  - `visual_competence_score_out_of_range`
- Observed scores:
  - `awwwards_app_craft_score`: 75, allowed range 0..60
  - `visual_competence_score`: 85, allowed range 0..20

Diagnosis:

Gemini does not primarily fail because it cannot see the image. It fails because
the current live prompt/schema combination lets the model use an intuitive
percentage-like score scale instead of the bridge schema's strict bounded
scales.

Normalization should reject this, not clamp it. Clamping would silently rewrite
external judge output and would weaken the court.

Likely safe improvements, not implemented here:

- Shorten the Gemini prompt.
- Make score bounds impossible to miss.
- Prefer enum-based ratings over numeric scores.
- Use a two-step flow: first visual critique, then strict JSON transform.
- Use one contact sheet rather than many screenshots.

Smallest safe change likely to improve Gemini:

`A20X_GEMINI_PROMPT_SCHEMA_SIMPLIFICATION`

## 7. ChatGPT Lane Diagnosis

ChatGPT lane status:

- Local project config exists: yes, redacted.
- Local active session config exists: yes, redacted.
- Low-level ChatGPT bridge exists: yes.
- CDP attach/text transport exists: yes.
- Attachment-aware low-level bridge code exists: yes.
- Tracked `chatgpt_web_bridge.enabled`: false.
- Approved live visual upload lane: no.
- ChatGPT live call in A20V: no.

Current ChatGPT blocker:

`POLICY_BLOCKER`

Evidence:

- A20V capture result: `UPLOAD_LANE_UNAVAILABLE`
- A20V stop reason: `chatgpt_web_bridge.enabled=false`
- A20V `approved_upload_lane_available`: false
- A20V `upload_control_status`: `NOT_PROBED`
- A20V raw output: none
- A20V normalized output: none

Diagnosis:

ChatGPT did not fail as a model judge. It never received the visual evidence.
The current blocker occurs before browser send. The wrapper correctly refuses a
text-only visual review because ChatGPT cannot certify screenshot reality
without seeing screenshots or a contact sheet.

The low-level browser bridge contains upload mechanics, including file input,
file chooser, attachment detection, and bounded wait logic. However, A20V did
not prove them live because the approved web bridge is disabled. Therefore the
exact UI selector state remains unknown.

## 8. Upload Lane Diagnosis

Upload lane summary:

- A20P contact sheet was supplied to the wrapper: yes.
- Contact sheet counted by wrapper: yes.
- Attachment sent to ChatGPT: no.
- Upload control live-probed: no.
- Reason not probed: approved bridge disabled before browser send.

Possible upload paths:

- Existing file input selector path in `chatgpt_bridge.mjs`.
- Existing file chooser path in `chatgpt_bridge.mjs`.
- Potential clipboard image paste path, not implemented and not proved.
- Potential drag-and-drop path, not implemented and not proved.

Forbidden or insufficient paths:

- Text-only prompt that pretends ChatGPT saw images.
- Public/sandbox link without explicit policy approval.
- Any path that requires login, CAPTCHA, 2FA, consent, or human verification.
- Any path that uploads unrelated files.

## 9. CDP And Session Diagnosis

CDP/text transport exists and is separate from the visual upload lane.

Evidence:

- `ops/autopilot/browser/chatgpt_cdp_attach_loop.mjs` supports CDP attach,
  composer selection, nonce-bound response capture, timeout handling, and
  human-verification detection.
- `ops/autopilot/run_chatgpt_cdp_request.ps1` wraps CDP request mode.
- Local active session config exists, but values were not printed.

Current gap:

The CDP request path is text/response oriented. It does not currently provide an
approved screenshot/contact-sheet upload lane for visual judge evidence.

## 10. Response Extraction Diagnosis

Gemini:

- A20T had timeout/done problems.
- A20U improved raw extraction and normalization.
- A20U saved raw Gemini output externally.
- A20U extracted nested visual judge JSON.

ChatGPT:

- No raw response exists for A20V because no live ChatGPT call was made.
- Therefore ChatGPT response extraction remains unproved for the visual lane.

Normalizer capability:

- Markdown fenced JSON extraction is supported by tests.
- Prose plus JSON block extraction is supported by tests.
- Nested Gemini visual judge extraction is supported.
- Prose-only output is rejected.

## 11. JSON Normalization Diagnosis

Current strictness is correct.

The normalizer should continue to reject:

- out-of-range scores;
- missing screenshot references;
- placeholder enum text;
- generic praise with no concrete defects;
- public-ready claims without evidence;
- prose-only output;
- invalid JSON.

Safe repair:

- Extract the correct JSON object.
- Remove transport wrapping.
- Repair transport-level escaping only when it preserves the exact judge data.

Unsafe repair:

- Clamp out-of-range judge scores.
- Invent missing weaknesses or screenshot references.
- Convert generic praise into specific critique.
- Treat raw text as valid structured judgment.

Schema simplification likely helps more than parser leniency. Numeric ranges are
the live failure point; enum labels may be more reliable for visual judges.

## 12. Evidence Packet Diagnosis

A20P evidence is sufficient but should be presented compactly.

Best primary judge input:

`generation_1_patch/contact_sheet_generation_1_states.png`

Best optional comparison input:

`generation_1_patch/contact_sheet_before_after_a20l_vs_a20p.png`

Supporting JSON evidence:

- `visual_delta_report.json`
- `public_teaser_check.json`
- `sacred_board_contract_check.json`
- `anti_spoiler_check.json`
- `browser_smoke_report.json`
- `manifest.json`

Recommendation:

Use one contact sheet plus a short hard-gate summary. Avoid uploading many
individual screenshots unless the judge explicitly requests them.

Do not include:

- source code;
- credentials;
- tokens;
- session files;
- local config values;
- database files;
- unrelated screenshots;
- private unrelated project data.

## 13. Blocker Taxonomy

| Blocker | Lane | Severity | Confidence | Diagnosis |
|---|---|---:|---:|---|
| `POLICY_BLOCKER` | ChatGPT | fatal | high | `chatgpt_web_bridge.enabled=false` stops before live upload. |
| `UPLOAD_UI_BLOCKER` | ChatGPT | high | medium | Upload control not live-probed because bridge disabled. |
| `FILE_INPUT_BLOCKER` | ChatGPT | medium | medium | Low-level file input code exists but live proof is absent. |
| `JSON_SCHEMA_BLOCKER` | Gemini | high | high | A20U scores exceeded schema ranges. |
| `MODEL_COMPLIANCE_BLOCKER` | Gemini | high | high | Gemini used wrong score scale despite visible critique. |
| `PROMPT_COMPLEXITY_BLOCKER` | Gemini | medium | medium | Long schema likely increased score-scale confusion. |
| `RESPONSE_COMPLETION_BLOCKER` | Gemini | medium | medium | A20T issue, partially resolved by A20U. |
| `RAW_EXTRACTION_BLOCKER` | Gemini | low | medium | Not current primary blocker after A20U. |
| `EVIDENCE_PACKET_BLOCKER` | both | medium | medium | Too many screenshots may reduce live reliability. |

## 14. Solution Candidates

1. Shorten Gemini schema and prompt.
   - Benefit: directly targets current Gemini failure.
   - Risk: low.
   - Recommended: yes.

2. Use enum-based scoring instead of numeric scores.
   - Benefit: avoids out-of-range failures without unsafe clamping.
   - Risk: low.
   - Recommended: yes.

3. Two-step Gemini: critique first, JSON transform second.
   - Benefit: separates visual perception from strict formatting.
   - Risk: low.
   - Recommended: yes if one-step simplification fails.

4. ChatGPT CDP file-input selector prototype.
   - Benefit: may enable real contact-sheet upload.
   - Risk: medium.
   - Recommended: only after Supervisor explicitly approves the live upload
     lane.

5. ChatGPT clipboard image paste lane.
   - Benefit: possible alternative if file input is hidden.
   - Risk: medium.
   - Recommended: not before selector/prototype decision.

6. ChatGPT drag-and-drop image lane.
   - Benefit: another upload alternative.
   - Risk: medium-high and UI-fragile.
   - Recommended: no for next step.

7. Use single contact sheet only.
   - Benefit: smaller evidence load.
   - Risk: low.
   - Recommended: yes.

8. Generated local HTML visual packet opened and screenshotted.
   - Benefit: unifies context into one visual artifact.
   - Risk: low.
   - Recommended: maybe, only if contact sheet lacks context.

9. Offline Visual Gym plus periodic manual human calibration.
   - Benefit: stops live-capture churn while preserving visual improvement.
   - Risk: very low.
   - Recommended: yes if Supervisor declines upload-lane approval.

10. Gemini-only plus internal Creative Director temporarily.
    - Benefit: partial external evidence.
    - Risk: low.
    - Recommended: limited, but it cannot claim 18/20 alone.

11. ChatGPT text-only evidence strictly marked non-visual.
    - Benefit: product reasoning only.
    - Risk: low.
    - Recommended: no for 18/20, because it cannot satisfy visual evidence.

12. API-based vision if future credentials and policy explicitly allow it.
    - Benefit: likely more reliable.
    - Risk: credential/policy dependent.
    - Recommended: no under the current assumptions.

## 15. Recommended Top 3 Solution Paths

1. `A20X_GEMINI_PROMPT_SCHEMA_SIMPLIFICATION`
   - Best narrow technical fix.
   - Clear evidence: Gemini saw the screenshot and failed only strict score
     ranges.

2. Supervisor decision on `A20X_CHATGPT_UPLOAD_SELECTOR_PROTOTYPE`
   - Best chance to enable real ChatGPT visual review.
   - Requires explicit approval because current tracked config disables the web
     bridge before live upload proof.

3. `A20X_STOP_LIVE_CAPTURE_AND_USE_OFFLINE_VISUAL_GYM`
   - Best fallback if live upload approval is denied.
   - Avoids repeating generic hardening with no new approval state.

## 16. What Not To Try Again

Do not try:

- text-only ChatGPT visual review counted as screenshot review;
- clamping or rewriting external judge scores;
- another generic capture-hardening mission without changing the approval
  state;
- repeated live retries around timeouts;
- any path that touches login, CAPTCHA, 2FA, consent, or human verification;
- public 18/20 claims without valid real judge merge.

## 17. What ChatGPT Supervisor Should Decide Next

The Supervisor should decide between two strategy families:

1. Continue live-mode pursuit:
   - approve a narrow ChatGPT upload selector prototype;
   - simplify Gemini prompt/schema;
   - use one contact sheet;
   - preserve hard stops on verification and auth.

2. Stop live capture attempts for now:
   - use offline Visual Gym;
   - add periodic manual human calibration;
   - keep 18/20 blocked until a safe real judge lane exists.

This mission does not recommend a coding fix unconditionally because the ChatGPT
blocker is policy/configuration, not a proved selector bug.

## 18. Whether Live Mode Is Realistically Achievable

Live mode is technically plausible but not currently enabled end to end.

Gemini likely needs prompt/schema simplification. ChatGPT likely needs an
explicitly approved visual upload prototype before selector or file-input
behavior can be tested.

Therefore the honest status is multiple possible paths, not a single certain
fix.

## 19. Whether A21 Should Remain Blocked

A21 visual lane should remain blocked for real external Visual Court claims.

The latest valid product classification remains the A20P result:

`PUBLIC_TEASER_READY_WITH_CAVEATS`

The live judge score remains:

`17.5/20`

## 20. Safety Statements

- No implementation fixes were made.
- A21 was not launched.
- Night Mode was not launched.
- A 3h rehearsal was not launched.
- `road-to-V2` was not pushed.
- `road-to-V2` was not merged.
- Frontend product code was not modified.
- Backend product code was not modified.
- Package files were not modified.
- Screenshots/images were not committed.
- QA artifacts were not committed.
- External assets were not committed.
- Credentials were not touched.
- Secrets were not printed.
- Local session files were not committed.
- Human verification bypass was not attempted.
- CAPTCHA bypass was not attempted.
- 2FA bypass was not attempted.
- Consent bypass was not attempted.

## 21. External Dossier Files

Created externally, not committed:

- `manifest.json`
- `files_read.json`
- `session_config_audit_redacted.json`
- `gemini_lane_diagnostic.json`
- `chatgpt_lane_diagnostic.json`
- `upload_lane_diagnostic.json`
- `cdp_transport_diagnostic.json`
- `response_extraction_diagnostic.json`
- `json_normalization_diagnostic.json`
- `failure_timeline.json`
- `blocker_taxonomy.json`
- `solution_candidates.json`
- `recommended_strategy_matrix.json`
- `console_log.txt`

## 22. Final Diagnostic Verdict

`LIVE_MODE_DIAGNOSIS_COMPLETE_MULTIPLE_PATHS`

## 23. Recommended Next Action

`CHATGPT_SUPERVISOR_REVIEW_REQUIRED`
