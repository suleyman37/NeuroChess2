# A20U Visual Judge Capture Hardening Report

## Mission Summary

A20U made one final bounded hardening attempt for autonomous real Visual Court
judge capture on A20P evidence.

Result:

- Gemini capture lane was hardened and attempted.
- Gemini returned real screenshot-grounded raw output.
- The new normalizer extracted Gemini judge JSON from the raw browser text.
- Validation rejected Gemini output because judge scores were out of schema
  range.
- ChatGPT capture was blocked before send because no approved enabled
  screenshot/contact-sheet upload lane exists.
- No valid real judge output was merged.
- The design automation score remains 17.5/20.

Final verdict:

`CHATGPT_VISUAL_CAPTURE_LANE_MISSING`

## Source Branch And Commit

- protected road branch: `road-to-V2`
- expected road HEAD: `7a71b0e`
- A20T source branch:
  `auto/a20t-autonomous-real-judge-capture-and-merge-20260518`
- A20T source commit verified: `784458b`
- A20U branch:
  `auto/a20u-visual-judge-capture-hardening-20260518`

## Why A20U Was Required After A20T

A20T proved that the Visual Court logic was ready but the live judge capture lane
was unreliable:

- Gemini was available enough for a bounded attempt, but the attempt ended as
  `GEMINI_RESPONSE_TIMEOUT_OR_DONE_MISSING`.
- ChatGPT was blocked because there was no approved screenshot/contact-sheet
  upload lane.
- No valid Gemini or ChatGPT judge JSON was captured.

A20U therefore focused only on capture reliability, normalization, strict
validation, and a final bounded live attempt.

## Evidence Path Inspected

A20P evidence path:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_training\A20P_screenshot_to_patch_a20l_20260518\`

Inspected or packetized:

- `manifest.json`
- `visual_delta_report.json`
- `visual_delta_report.md`
- `public_teaser_check.json`
- `sacred_board_contract_check.json`
- `anti_spoiler_check.json`
- `browser_smoke_report.json`
- `generation_1_patch/contact_sheet_generation_1_states.png`
- `generation_1_patch/contact_sheet_before_after_a20l_vs_a20p.png`

No screenshots or QA artifacts were copied into the repo.

## Artifact Path

A20U external artifacts were written under:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20U_visual_judge_capture_hardening_20260518\`

The artifact folder includes the capture lane audit, compact evidence packet,
raw outputs, normalized outputs, validation reports, safety report, score
update, and morning review.

## Capture Lane Audit

Gemini:

- approved profile configured: yes
- profile locked: no
- prompt text lane: available
- image/contact-sheet lane: available through `ask_gemini_web.ps1 -ImagePath`
- completion detection: hardened with nonce-bound wrapper and normalizer
- raw extraction: raw or partial browser output saved externally
- blocker after A20U: response can be captured and normalized, but provider
  output may still be schema-invalid

ChatGPT:

- approved profile configured: yes
- local project config exists: yes
- local session config exists: yes
- attachment-aware bridge exists: yes
- upload-capable web bridge enabled: no
- approved enabled screenshot/contact-sheet lane: no
- CDP screenshot upload lane: not approved
- status: `CHATGPT_VISUAL_CAPTURE_LANE_MISSING`

## Gemini A20T Failure Analysis

A20T saved raw Gemini evidence but did not extract stable normalized judge JSON.
A20U confirmed the failure was not simply absence of content. The raw browser
text can contain both the prompt/template echo and the real response, so the
normalizer must target the actual response section and ignore earlier schema
examples.

## ChatGPT A20T Failure Analysis

ChatGPT was not a model-output problem. It was a transport problem: the enabled
configuration does not provide an approved lane for attaching A20P screenshots
or contact sheets. A text-only visual review would violate the Visual Court
evidence requirement, so A20U continued to block that lane before send.

## Gemini Hardening Done

Created:

- `ops/autopilot/capture_gemini_visual_judge.ps1`
- `ops/autopilot/normalize_visual_judge_response.ps1`

The Gemini wrapper now:

- sends a nonce-bound request;
- limits the run to one live attempt and one supported correction path in the
  lower bridge;
- saves raw output externally;
- asks the normalizer to extract JSON from raw browser text;
- rejects prose-only or malformed output;
- validates normalized JSON through the existing judge validator.

The normalizer now:

- targets response markers such as `Gemini a dit` instead of accepting the
  first schema echo;
- extracts the nested `visual_judge_output` from the older
  `NC_GEMINI_AUDIT_JSON/1` wrapper;
- repairs transport-level Windows path escaping for parseability only;
- keeps schema validation strict and does not clamp or rewrite judge scores.

## ChatGPT Hardening Done

Created:

- `ops/autopilot/capture_chatgpt_visual_judge.ps1`

The ChatGPT wrapper now:

- audits local project and session configuration without exposing credentials;
- requires an enabled approved attachment lane before live send;
- refuses text-only visual review;
- records `CHATGPT_VISUAL_CAPTURE_LANE_MISSING` when the lane is blocked;
- confirms that missing ChatGPT input remains `MISSING_INPUT`, not PASS.

## Evidence Packet Created

A compact A20P Visual Judge Packet was created externally:

- `input_packet/A20P_VISUAL_JUDGE_PACKET.md`
- `input_packet/A20P_VISUAL_JUDGE_PACKET.json`

The packet includes mission context, target visual level, A20P before/after
summary, hard-gate results, known weaknesses, screenshot/contact sheet paths,
schema reminders, public screenshot standard, and anti-generic-praise rules.

## Real Capture Attempt Results

Gemini:

- attempted: yes
- live Gemini called by Codex: yes
- raw output captured: yes
- normalized JSON written: yes
- validation result: `INVALID_OUTPUT`
- invalid reasons:
  - `awwwards_app_craft_score_out_of_range`
  - `visual_competence_score_out_of_range`
- human verification, login, CAPTCHA, 2FA, consent: none encountered
- bypass attempted: no

ChatGPT:

- attempted through live wrapper precheck: yes
- live ChatGPT called by Codex: no
- result: `CHATGPT_VISUAL_CAPTURE_LANE_MISSING`
- stop reason: `chatgpt_web_bridge.enabled=false`
- raw output captured: no
- normalized JSON written: no
- validation result: `MISSING_INPUT`
- human verification, login, CAPTCHA, 2FA, consent: none encountered
- bypass attempted: no

## Judge Validation Results

| Judge | Capture Result | Validation Result |
|---|---|---|
| Gemini | `RAW_CAPTURED_NORMALIZED_BUT_INVALID_SCORES` | `INVALID_OUTPUT` |
| ChatGPT | `CHATGPT_VISUAL_CAPTURE_LANE_MISSING` | `MISSING_INPUT` |

Invalid or missing judge output was not converted into PASS.

## Merge Result

Merge was not run.

Reason:

No valid real judge output existed after validation. Gemini was invalid and
ChatGPT was missing.

## Creative Director Verdict

No Creative Director verdict was generated from real judge evidence.

Temporary status:

`NOT_RUN_NO_VALID_REAL_JUDGE_OUTPUTS`

## Public Screenshot Level

The previous A20P classification remains the latest valid visual classification:

`PUBLIC_TEASER_READY_WITH_CAVEATS`

A20U does not promote or demote the product artifact because no valid real judge
merge occurred.

## Score Update

- previous score: 17.5/20
- new score: 17.5/20
- 18/20 reached: no

Why:

- Gemini returned real visual critique, but the normalized judge JSON was
  invalid under the strict schema.
- ChatGPT did not receive visual evidence through an approved lane.
- No valid real judge output was merged with hard gates.

## Whether Further Capture Hardening Is Justified

Generic capture hardening is not justified.

Concrete next work is justified only if it addresses a specific blocker:

- ChatGPT needs an approved screenshot/contact-sheet upload lane.
- Gemini extraction now works well enough to classify the response honestly, but
  a later run may need stricter prompt pressure for score ranges.

The next mission should not be another broad capture-hardening pass.

## Visual Lane Status

The A21 visual lane remains blocked.

The system still lacks validated Gemini and ChatGPT judge outputs merged into a
Creative Director verdict.

## Safety Statements

- A21 was not launched.
- Night Mode was not launched.
- 3h rehearsal was not launched.
- `road-to-V2` was not pushed.
- `road-to-V2` was not merged.
- Backend product code was not touched.
- Frontend product code was not touched.
- Package files were not touched.
- DB was not touched.
- Screenshots/images were not committed.
- QA artifacts were not committed.
- External assets were not committed.
- Credentials were not touched.
- Human verification bypass was not attempted.
- CAPTCHA bypass was not attempted.
- 2FA bypass was not attempted.
- Consent bypass was not attempted.

## Scripts Created Or Updated

- `ops/autopilot/capture_gemini_visual_judge.ps1`
- `ops/autopilot/capture_chatgpt_visual_judge.ps1`
- `ops/autopilot/normalize_visual_judge_response.ps1`
- `ops/autopilot/validate_visual_judge_output.ps1`
- `ops/autopilot/test_visual_judge_capture_hardening.ps1`

## Validation

New capture hardening test:

`powershell -ExecutionPolicy Bypass -File ops/autopilot/test_visual_judge_capture_hardening.ps1`

Result:

`pass`

Full mission validation is recorded in the final response.

## Recommended Next Mission

`A20V_CHATGPT_VISUAL_UPLOAD_LANE_IMPLEMENTATION`

Reason:

Gemini can now be captured and honestly classified, even when invalid. The
remaining hard blocker for a two-judge Visual Court is the missing approved
ChatGPT screenshot/contact-sheet upload lane.

## Final Verdict

`CHATGPT_VISUAL_CAPTURE_LANE_MISSING`
