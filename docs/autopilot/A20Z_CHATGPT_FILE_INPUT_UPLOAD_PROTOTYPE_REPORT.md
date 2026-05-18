# A20Z ChatGPT File Input Upload Prototype Report

## 1. Mission Summary

A20Z was a targeted ChatGPT file-input visual proof mission. It restored the
old proven `input[type=file]` path behind strict proof gates, generated a
harmless canary image, and attempted Stage 1 only. The probe stopped safely on
human verification before any attachment, prompt send, or response capture.

Stage 2 A20P Visual Court judging was not executed.

## 2. Source Branch And Commit

- Source branch: `auto/a20y-chatgpt-visual-lane-forensic-capability-audit-20260518`
- Source commit: `435715b`
- Mission branch: `auto/a20z-chatgpt-file-input-visual-proof-canary-a20p-20260518`

## 3. Why A20Z Was Required After A20Y

A20Y found that live ChatGPT visual upload was recoverable with a targeted
file-input prototype, but not proven in the current Visual Court path. It also
showed that older screenshot upload tests used `input[type=file]` and produced
image-aware ChatGPT responses, while recent A20X capture failed through an
unstable persistent-context route before upload adapters were reached.

## 4. Old Working Path Identified

Historical evidence:

- `screenshot_upload_tests\20260516_005839`
- `screenshot_upload_tests\20260516_010022`

Old path characteristics:

- selector: `input[type=file]`
- file assignment: Playwright `setInputFiles`
- transport: existing browser/page CDP-style reuse
- proof: synthetic image attachment followed by image-aware response with
  hidden visual code and shape/color description

## 5. What Was Reused

A20Z reused the targeted pieces that were actually proven:

- existing Chrome/page CDP attach;
- `input[type=file]` enumeration;
- Playwright file input assignment;
- image-aware canary gate before any A20P evidence;
- strict refusal to treat text-only output as visual review.

## 6. What Changed Versus A20X

A20X used a persistent browser context path that closed before upload adapters
could run. A20Z added a CDP attach helper:

`ops/autopilot/browser/chatgpt_file_input_visual_probe.mjs`

The helper does not launch or close a persistent context. It attaches to an
existing Chrome CDP endpoint, checks for unsafe session states, confirms a file
attachment before send, and stops if login, consent, CAPTCHA, 2FA, or human
verification appears.

## 7. Persistent Context Avoided

Yes. A20Z avoids `launchPersistentContext` for this lane.

## 8. CDP Attach Path Used

Yes. The Stage 1 canary probe reached `C2_CDP_ATTACH` against an existing
Chrome page/session.

## 9. File Input Selector Result

`input[type=file]` was the target selector, but it was not safely reached in
the live canary attempt because the session stopped on human verification
before composer/file-input inspection could proceed.

## 10. Canary Image Generation Result

Canary generated: yes.

The canary image was written externally under:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20Z_chatgpt_file_input_visual_proof_canary_a20p_20260518\canary\canary_image.png`

The visual code was not included in the canary prompt text.

## 11. Canary Attachment Result

Attachment confirmed: no.

The probe stopped before attachment because the ChatGPT session showed a
human-verification/safe-session blocker.

## 12. Canary Image-Aware Result

Image-aware response captured: no.

No canary prompt was sent, no raw ChatGPT response was captured, and no JSON was
normalized.

## 13. A20P Run Executed

No. Because Stage 1 did not pass, the A20P contact sheet was not submitted to
ChatGPT.

## 14. A20P Attachment Result

Not run. No A20P image attachment was attempted.

## 15. A20P Prompt Send Result

Not run. No A20P prompt was sent.

## 16. Raw Response Result

No raw ChatGPT response was captured.

## 17. JSON Normalization Result

Not run. There was no raw canary or A20P response to normalize.

## 18. Validation Result

Validation did not run against a real ChatGPT judge output. The mission result
is blocked before evidence submission, not invalid JSON.

## 19. Visual Court Merge Result

Skipped. No valid ChatGPT Minimal Visual Judge Contract V2 output existed, and
Gemini remains invalid or missing for a two-judge merge.

## 20. Creative Director Verdict

No Creative Director verdict was generated.

## 21. Capability Ladder Achieved

Highest proven level: `C2_CDP_ATTACH`.

- `C0_REPO_AND_CONFIG_FOUND`: yes
- `C1_BROWSER_PROFILE_AVAILABLE`: yes, existing session shape present
- `C2_CDP_ATTACH`: yes
- `C3_CHATGPT_TEXT_INPUT_VISIBLE`: no
- `C4_CHATGPT_TEXT_SEND_AND_RESPONSE`: no
- `C5_LOCAL_IMAGE_GENERATED`: yes, but this is local-only and does not prove
  ChatGPT visual upload
- `C6_CHATGPT_FILE_INPUT_FOUND`: no
- `C7_CHATGPT_IMAGE_ATTACHMENT_CONFIRMED`: no
- `C8_CHATGPT_IMAGE_PROMPT_SENT`: no
- `C9_CHATGPT_IMAGE_AWARE_RESPONSE_CAPTURED`: no
- `C10_CHATGPT_VALID_VISUAL_JUDGE_JSON_CAPTURED`: no
- `C11_VISUAL_COURT_MERGE_WITH_CHATGPT_JUDGE`: no

## 22. Score Update

Previous score: 17.5/20.

New estimated score: 17.5/20.

No score gain was taken because the mission reached only C2 and correctly
stopped before any image attachment or visual judge output.

## 23. Whether ChatGPT Visual Upload Is Recovered

No. The old path was restored in code and guarded by canary proof, but the live
session stopped at human verification before upload could be proven.

## 24. Whether 18/20 Was Reached

No. 18/20 still requires valid real visual judge outputs, including a confirmed
ChatGPT visual output and a valid Gemini or equivalent external judge output,
merged with hard gates and a Creative Director verdict.

## 25. What Remains For 18/20

Required:

- a safe session without human-verification blocker;
- confirmed ChatGPT image attachment;
- image-aware ChatGPT response;
- valid Minimal Visual Judge Contract V2 JSON;
- valid Gemini or equivalent external judge output;
- Visual Court merge and Creative Director verdict.

## 26. A21 Not Launched

A21 was not launched.

## 27. Night Mode Not Launched

Night Mode was not launched.

## 28. road-to-V2 Not Pushed

`road-to-V2` was not pushed and was not merged.

## 29. Recommended Next Mission

`A20AA_STOP_LIVE_CAPTURE_AND_USE_OFFLINE_VISUAL_GYM`

## Final Verdict

`STOP_MANUAL_HUMAN_VERIFICATION_REQUIRED`
