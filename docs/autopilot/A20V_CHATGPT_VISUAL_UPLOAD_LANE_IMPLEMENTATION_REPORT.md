# A20V ChatGPT Visual Upload Lane Implementation Report

## Mission Summary

A20V implemented the safe ChatGPT visual upload wrapper contract and made one
bounded attempt to use it on A20P evidence.

Result:

- The wrapper now supports `SAFE_LIVE_READONLY_MODE`, a contact sheet path,
  bounded wait, one optional JSON-only correction, raw capture, normalization,
  and validation.
- The wrapper refuses text-only visual review.
- The low-level ChatGPT bridge already contains attachment mechanics.
- The bounded attempt stopped before browser send because
  `chatgpt_web_bridge.enabled=false`.
- No live ChatGPT call was made.
- Optional A20U Gemini raw revalidation remained invalid because Gemini returned
  out-of-range judge scores.
- The design automation score remains 17.5/20.

Final verdict:

`CHATGPT_VISUAL_UPLOAD_LANE_UNAVAILABLE`

## Source Branch And Commit

- protected road branch: `road-to-V2`
- expected road HEAD: `7a71b0e`
- A20U source branch:
  `auto/a20u-visual-judge-capture-hardening-20260518`
- A20U source commit verified: `8f05cea`
- A20V branch:
  `auto/a20v-chatgpt-visual-upload-lane-implementation-20260518`

## Why A20V Was Required After A20U

A20U hardened Gemini capture enough to classify a real raw Gemini response, but
ChatGPT stayed blocked by a missing approved screenshot/contact-sheet upload
lane. A20V was the final bounded attempt to solve or close that blocker.

## A20P Evidence Inspected

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

A20V external artifacts were written under:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20V_chatgpt_visual_upload_lane_20260518\`

The artifact folder includes evidence inventory, upload lane audit, compact
input packet, ChatGPT prompt, capture report, validation report, score update,
and morning review.

## ChatGPT Lane Audit

Session and bridge:

- local project URL configured: yes
- local active session configured: yes
- profile locked: no
- low-level `chatgpt_bridge.mjs` exists: yes
- low-level attachment mechanics exist: yes
- tracked `chatgpt_web_bridge.enabled`: false
- approved upload lane available: no

Upload control:

- live upload control visibility: not probed
- reason: approved bridge disabled before browser send

Evidence attachment:

- A20P contact sheet supplied to wrapper: yes
- attachment sent to ChatGPT: no
- reason: upload lane unavailable before live call

## Exact A20U Blocker

A20U blocker:

`CHATGPT_VISUAL_CAPTURE_LANE_MISSING`

A20V refined this to:

`CHATGPT_VISUAL_UPLOAD_LANE_UNAVAILABLE`

The lane is unavailable because the approved web bridge is disabled in tracked
config. Sending a text-only prompt would not satisfy the Visual Court screenshot
evidence requirement.

## Implementation Details

Updated:

- `ops/autopilot/capture_chatgpt_visual_judge.ps1`
- `ops/autopilot/normalize_visual_judge_response.ps1`
- `ops/autopilot/browser/chatgpt_bridge.mjs`
- `ops/autopilot/test_visual_judge_capture_hardening.ps1`

Created:

- `ops/autopilot/test_chatgpt_visual_upload_lane.ps1`
- `ops/autopilot/a20v_chatgpt_capture_score_result.json`

The ChatGPT capture script now supports:

- `EvidencePath`
- `PromptPath`
- `OutputPath`
- `ContactSheetPath`
- `AttachmentPath`
- `Mode SAFE_LIVE_READONLY_MODE`
- `MaxWaitSeconds`
- `AllowOneJsonCorrection`

The script behavior:

1. Verifies local project/session state without logging secrets.
2. Requires a supplied contact sheet or screenshot attachment.
3. Requires `chatgpt_web_bridge.enabled=true` before live send.
4. Calls the existing attachment-capable bridge only when approved.
5. Saves raw output externally when available.
6. Normalizes only schema-valid judge JSON.
7. Rejects invalid JSON, out-of-range scores, missing screenshots, generic
   praise, and placeholder enum output.
8. Returns explicit statuses such as `CAPTURED_VALID_JSON`,
   `CAPTURED_INVALID_JSON`, `UPLOAD_LANE_UNAVAILABLE`,
   `SAFE_SESSION_UNAVAILABLE`, `STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED`,
   `TIMEOUT_OR_DONE_MISSING`, and `NO_RESPONSE_CAPTURED`.

The low-level bridge now accepts a bounded `--max-wait-seconds` override from
the wrapper.

## Real Capture Attempt Result

Command mode:

`SAFE_LIVE_READONLY_MODE`

Result:

`UPLOAD_LANE_UNAVAILABLE`

Stop reason:

`chatgpt_web_bridge.enabled=false`

The wrapper counted the A20P contact sheet, verified local project/session
configuration, and stopped before any browser send.

## Raw Response Status

- raw ChatGPT response saved: no
- reason: no live ChatGPT call was made

## Normalized JSON Status

- normalized ChatGPT JSON valid: no
- normalized ChatGPT JSON written: no
- reason: no raw response existed

## Validation Result

ChatGPT:

- validation result: `MISSING_INPUT`
- missing input is not PASS

Gemini optional revalidation:

- attempted: yes, using A20U raw Gemini response only
- validation result: `INVALID_OUTPUT`
- invalid reasons:
  - `awwwards_app_craft_score_out_of_range`
  - `visual_competence_score_out_of_range`

The normalizer no longer writes invalid extracted JSON as a normalized judge
file.

## Merge Result

Merge was not run.

Reason:

No valid ChatGPT output exists, and Gemini revalidation remains invalid.

## Creative Director Verdict

No Creative Director verdict was generated from real judge evidence.

Temporary status:

`NOT_RUN_NO_VALID_CHATGPT_OUTPUT`

## Public Screenshot Level

The previous A20P classification remains the latest valid visual
classification:

`PUBLIC_TEASER_READY_WITH_CAVEATS`

A20V does not promote or demote the product artifact because no valid real judge
merge occurred.

## Score Update

- previous score: 17.5/20
- new score: 17.5/20
- 18/20 reached: no

Why:

- ChatGPT did not receive visual evidence through an approved upload lane.
- Gemini revalidation remains invalid.
- No valid real external judge output was merged with hard-gate evidence.

## Whether Further Capture Hardening Is Justified

Further generic capture hardening is not justified.

The specific blocker is not parser or prompt quality; it is that live ChatGPT
visual upload is not enabled as an approved lane. Until that policy/configuration
changes, future missions should pivot to an offline/local visual review strategy
instead of repeating live capture attempts.

## Visual Lane Status

The A21 visual lane remains blocked from real external Visual Court claims.

The offline Visual Training System remains usable, but the system cannot claim
18/20 from live judges.

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
- Live ChatGPT was not called.
- Live Gemini was not called by A20V.

## Validation

Validation commands and results are recorded in the final response.

## Recommended Next Mission

`A20W_STOP_LIVE_JUDGE_CAPTURE_AND_USE_OFFLINE_VISUAL_GYM`

Reason:

A20V was the final bounded upload-lane implementation attempt. The safe strategy
now is to stop live judge capture attempts and rely on the offline Visual
Training Gym or a local/human visual review fallback until an explicitly
approved ChatGPT visual upload lane exists.

## Final Verdict

`CHATGPT_VISUAL_UPLOAD_LANE_UNAVAILABLE`
