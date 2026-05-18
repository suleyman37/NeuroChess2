# A20X Live Visual Judge Recovery V1 Report

## 1. Mission Summary

A20X ran one bounded live visual judge recovery experiment against the A20P
North Star visual evidence. The mission created an enum-first Minimal Visual
Judge Contract V2, attempted one Gemini recovery call, attempted one
mission-scoped ChatGPT visual probe, validated the outputs strictly, and refused
to merge missing or placeholder evidence.

Final verdict: `STOP_LIVE_CAPTURE_AND_USE_OFFLINE_VISUAL_GYM`.

## 2. Source Branch And Commit

- Source branch: `auto/a20w-live-visual-judge-infrastructure-diagnostic-20260518`
- Source commit verified before branch creation: `c7d4463`
- A20X branch:
  `auto/a20x-decisive-live-visual-judge-recovery-experiment-20260518`

## 3. Why A20X Was Required After A20W

A20W diagnosed two different blockers:

- Gemini could receive A20P visual evidence and return raw output, but its
  score-heavy contract caused invalid out-of-range values.
- ChatGPT remained blocked before visual send because no approved upload lane
  had proven it could attach the A20P contact sheet safely.

A20X tested the narrow recovery path: remove numeric judge scores, ask for an
enum-first contract, run one bounded Gemini attempt, and run one bounded ChatGPT
visual evidence delivery probe.

## 4. A20P Evidence Used

Evidence root:
`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_training\A20P_screenshot_to_patch_a20l_20260518`

Primary visual evidence:
`generation_1_patch\contact_sheet_generation_1_states.png`

Supporting evidence inspected:

- `visual_delta_report.json`
- `visual_delta_report.md`
- `public_teaser_check.json`
- `sacred_board_contract_check.json`
- `anti_spoiler_check.json`
- `browser_smoke_report.json`
- `manifest.json`

No screenshot or QA artifact was committed.

## 5. Minimal Visual Judge Contract V2 Created

Created:

- `docs/design/MINIMAL_VISUAL_JUDGE_CONTRACT_V2.md`
- `ops/autopilot/schemas/minimal_visual_judge_contract_v2.schema.json`

The contract removes aggregate numeric scores and uses enums for hard-gate
observations, public screenshot level, app craft level, visual competence level,
and recommended action. Validation requires real image evidence, concrete
screenshot references, at least three concrete strengths, at least three
concrete defects, and no placeholder critique text.

## 6. Gemini Enum Prompt Summary

The Gemini prompt used one contact sheet, short context, strict JSON-only
instructions, no numeric scores, no percentages, and the v2 contract. Gemini was
asked to evaluate board readability, anti-spoiler discipline, piece readability,
board pollution, public screenshot level, app craft level, and next action.

## 7. Gemini Live Attempt Result

- Live Gemini attempted: yes.
- Raw output captured: yes.
- Normalized JSON present: yes.
- Normalization result: `NORMALIZED_JSON_WRITTEN`.
- Strict validation result: `INVALID_OUTPUT`.

Invalid reasons:

- `placeholder_critique_text`
- `insufficient_concrete_strengths`
- `insufficient_concrete_defects`

Gemini reached the v2 shape, which is progress over the old out-of-range numeric
failure, but it filled the key critique fields with template placeholder text.
That is not usable real visual judgment.

## 8. Gemini Validation Result

Gemini did not count as a valid visual judge output. A v2-shaped response is not
enough; it must include concrete visible observations from the A20P contact
sheet.

## 9. ChatGPT Adapter Probe Results

- File input adapter: not reached.
- Clipboard image paste adapter: not reached.
- Drag/drop adapter: not reached.

The mission-scoped probe flag was used without modifying local configuration.
The bridge attempted to open the approved ChatGPT session path, but the browser
context closed before any adapter could confirm image attachment or response
capture.

## 10. ChatGPT Upload/Send Result

- ChatGPT mission-scoped visual probe attempted: yes.
- ChatGPT bridge config remained disabled in tracked config:
  `chatgpt_web_bridge.enabled=false`.
- Mission-scoped override used: yes.
- Evidence attached: no.
- Prompt sent with confirmed visual evidence: no.
- Raw response captured: no.
- Validation result: `MISSING_INPUT`.

No text-only review was treated as visual review.

## 11. ChatGPT Validation Result

ChatGPT did not produce a visual judge output. Since no image attachment was
confirmed and no response was captured, the expected judge file stayed missing.

## 12. Text-Only Review Rejection

A20X preserved the rule that text-only ChatGPT output cannot count as visual
review. The ChatGPT lane never reached a valid image-attached send, so no
ChatGPT visual judgment was accepted.

## 13. Merge Result

Merge was skipped:
`SKIPPED_NO_VALID_REAL_JUDGE_OUTPUTS`.

No valid Gemini output existed, and no ChatGPT output existed. Missing or invalid
judge input was not converted into PASS.

## 14. Creative Director Verdict

No Creative Director verdict was generated because there were no valid real
judge outputs to synthesize.

## 15. Score Update

- Previous score: 17.5/20.
- New score estimate: 17.5/20.
- 18/20 reached: no.

The v2 contract and stricter validator improve infrastructure, but the mission
did not produce a valid real external judge merge.

## 16. Whether Live Mode Is Viable

Live mode is not currently viable enough to justify another generic capture
hardening loop.

Gemini may become viable only if the provider can be forced to replace template
critique with concrete observations. ChatGPT remains blocked at the session or
visual attachment layer, before confirmed image evidence reaches the model.

## 17. Continue Live Capture Or Stop

Stop generic live capture attempts for now. The next strategy should be the
offline Visual Training Gym, a local visual review fallback, or a separate
manual/human calibration path unless a new approved visual evidence channel is
explicitly provided.

## 18. Safety Statements

- A21 was not launched.
- Night Mode was not launched.
- road-to-V2 was not pushed.
- road-to-V2 was not merged.
- Frontend product code was not modified.
- Backend product code was not modified.
- Package files were not modified.
- No screenshots, QA artifacts, local config, credentials, or session files were
  committed.
- No login, CAPTCHA, 2FA, consent, or human-verification bypass was attempted.

## 19. Recommended Next Mission

Recommended next mission:
`A20Y_STOP_LIVE_CAPTURE_AND_USE_OFFLINE_VISUAL_GYM`.
