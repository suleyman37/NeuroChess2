# A20Y ChatGPT Visual Lane Forensic Capability Audit

## 1. Mission Summary

A20Y was a forensic diagnostic mission only. It inspected the historical
ChatGPT/Gemini transport evidence, the current Visual Court capture scripts,
redacted local session/config shape, and external QA artifacts to answer one
root question:

Was there ever a working autonomous ChatGPT visual image-upload lane?

Answer: yes, but only as a simple synthetic screenshot-upload smoke. It did not
prove the current A20P Visual Court contact-sheet judge path or valid ChatGPT
visual judge JSON.

No implementation fixes were made.

## 2. Source Branch And Commit

- Source branch:
  `auto/a20x-decisive-live-visual-judge-recovery-experiment-20260518`
- Source commit verified before branch creation: `27e93cc`
- A20Y branch:
  `auto/a20y-chatgpt-visual-lane-forensic-capability-audit-20260518`

## 3. Why This Forensic Audit Was Requested

The user reported that earlier Codex and ChatGPT Web could communicate and
handle screenshots. Recent Visual Court missions repeatedly found the ChatGPT
visual lane unavailable or blocked before upload.

This audit separates capabilities that were previously conflated:

- ChatGPT text transport.
- Codex/browser local screenshot generation.
- Gemini screenshot/contact-sheet upload.
- ChatGPT screenshot/contact-sheet upload.
- ChatGPT text response extraction.
- ChatGPT image-aware response extraction.
- Gemini image-aware response extraction.
- JSON normalization and validation.

## 4. Files, Docs, Scripts, And Artifacts Inspected

Repo docs and scripts inspected included:

- `docs/autopilot/A20Q_LIVE_GEMINI_CHATGPT_VISUAL_COURT_BRIDGE.md`
- `docs/autopilot/A20Q_LIVE_GEMINI_CHATGPT_VISUAL_COURT_BRIDGE_REPORT.md`
- `docs/autopilot/A20R_LIVE_VISUAL_COURT_SAFE_RUN_REPORT.md`
- `docs/autopilot/A20S_MANUAL_IMPORT_REAL_JUDGES_FOR_VISUAL_COURT_REPORT.md`
- `docs/autopilot/A20S_PHASE2_REAL_JUDGE_MERGE_REPORT.md`
- `docs/autopilot/A20T_AUTONOMOUS_REAL_JUDGE_CAPTURE_AND_MERGE_REPORT.md`
- `docs/autopilot/A20U_VISUAL_JUDGE_CAPTURE_HARDENING_REPORT.md`
- `docs/autopilot/A20V_CHATGPT_VISUAL_UPLOAD_LANE_IMPLEMENTATION_REPORT.md`
- `docs/autopilot/A20W_LIVE_VISUAL_JUDGE_INFRASTRUCTURE_DIAGNOSTIC_REPORT.md`
- `docs/autopilot/A20X_LIVE_VISUAL_JUDGE_RECOVERY_V1_REPORT.md`
- `docs/autopilot/CDP_ATTACH_LIVE_SMOKE_RESULTS.md`
- `docs/autopilot/CHATGPT_CDP_ATTACH_MODE.md`
- `docs/autopilot/PERSISTENT_CHATGPT_TRANSPORT.md`
- `docs/autopilot/GEMINI_VISUAL_COURT_SCREENSHOT_SMOKE.md`
- `docs/autopilot/GEMINI_VISUAL_COURT_SMOKE_RESULTS.md`
- `ops/autopilot/ask_chatgpt_web.ps1`
- `ops/autopilot/run_chatgpt_cdp_attach_smoke.ps1`
- `ops/autopilot/run_chatgpt_cdp_request.ps1`
- `ops/autopilot/capture_chatgpt_visual_judge.ps1`
- `ops/autopilot/browser/chatgpt_bridge.mjs`
- `ops/autopilot/browser/chatgpt_cdp_attach_loop.mjs`
- `ops/autopilot/test_chatgpt_visual_upload_lane.ps1`

External artifacts inspected included:

- `C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\screenshot_upload_tests\20260516_005839`
- `C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\screenshot_upload_tests\20260516_010022`
- `C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\screenshot_upload_tests\20260516_010205`
- `C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\chatgpt_cdp_attach\A18I_cdp_attach_20260517_154131`
- `C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20V_chatgpt_visual_upload_lane_20260518`
- `C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20X_decisive_live_visual_judge_recovery_20260518`

Local files under `ops/autopilot/local/*.json` were inspected for redacted shape
only. Values, URLs, tokens, cookies, and session secrets were not recorded in
this report.

## 5. Capability Ladder C0-C9

| Level | Historical ChatGPT Status | Current Status | Meaning |
| --- | --- | --- | --- |
| C0_REPO_AND_CONFIG_FOUND | yes | yes | Scripts/config/docs exist. |
| C1_BROWSER_PROFILE_AVAILABLE | yes | yes, currently locked by running Chrome profile | Dedicated profile/session exists. |
| C2_CDP_ATTACH | yes | TCP port open; full attach not run in A20Y | A18I proved existing Chrome/page reuse. |
| C3_CHATGPT_TEXT_INPUT_VISIBLE | yes | unknown current | A18I found composer; A20X failed before page opened. |
| C4_CHATGPT_TEXT_SEND_AND_RESPONSE | yes | not tested in A20Y | A18I message 1/2 PASS. |
| C5_LOCAL_SCREENSHOT_GENERATION | yes | yes | Local screenshots are separate from ChatGPT seeing them. |
| C6_CHATGPT_UPLOAD_CONTROL_VISIBLE | yes via hidden file input | unknown current | Old smoke found `input[type=file]` accepting `image/*`. |
| C7_CHATGPT_IMAGE_ATTACHMENT_CONFIRMED | yes for synthetic image | no current Visual Court proof | Old smoke confirmed attachment; A20V/A20X did not. |
| C8_CHATGPT_IMAGE_PROMPT_SENT | yes for synthetic image | no current Visual Court proof | Old smoke sent prompt plus image. |
| C9_CHATGPT_IMAGE_AWARE_JSON_RESPONSE_CAPTURED | partial, non-JSON smoke only | no | Old response was image-aware XML, not Visual Court JSON. |

Highest historically proven ChatGPT capability: C8 plus partial C9
image-aware non-JSON smoke.

Highest currently proven ChatGPT capability in A20Y: C2 by safe probe, with C4
preserved as historical proof but not re-run because A20Y forbade submitting
messages.

## 6. Old Working Proofs

Strongest old visual proof:

- Artifact: `screenshot_upload_tests\20260516_005839`
- Upload result: `ok=true`
- Strategy: `input_set_files`
- Accepted MIME: `image/*`
- Attachment signal: file count became 1 and attachment-like UI count increased.
- Send result: `ok=true`, method `keyboard_enter`.
- Raw response: ChatGPT returned the hidden visual code and described the blue
  square and orange circle in the image.

Second confirming proof:

- Artifact: `screenshot_upload_tests\20260516_010022`
- Same upload strategy and successful image-aware response.

Best old text-transport proof:

- Artifact: `chatgpt_cdp_attach\A18I_cdp_attach_20260517_154131`
- Result: `PASS_CDP_ATTACH_TRANSPORT`
- Existing Chrome reused: yes.
- Existing page reused: yes.
- READY, message 1, and message 2: PASS.
- This was text-only transport; it did not prove image upload.

Gemini visual upload proof:

- Gemini visual smoke artifacts prove a separate Gemini filechooser image lane.
- They do not prove ChatGPT image upload.

## 7. What Actually Worked Before

Three separate things worked before:

1. ChatGPT text transport through CDP attach.
2. ChatGPT synthetic image upload through a hidden file input using
   `setInputFiles`.
3. Gemini visual upload through Gemini's filechooser flow.

Only item 2 proves ChatGPT saw an image. It was not a Visual Court run and did
not produce valid Visual Court judge JSON.

## 8. What Did Not Prove Visual Upload

These are not sufficient proofs of a ChatGPT visual upload lane:

- A18I CDP attach PASS. That proves text transport only.
- Local screenshot generation. That proves Codex can create screenshots, not
  that ChatGPT received them.
- Gemini upload success. That proves Gemini upload, not ChatGPT upload.
- Manual human upload. That would not prove autonomous Codex upload.
- Text-only ChatGPT visual critique. That cannot count as image-aware review.

## 9. Current ChatGPT Lane State

A20V stopped before browser probing:

- `chatgpt_web_bridge.enabled=false`
- capture result: `UPLOAD_LANE_UNAVAILABLE`
- live ChatGPT called: no
- upload adapter reached: no

A20X used the mission-scoped `-AllowChatGPTVisualProbe` override:

- `approved_upload_lane_available=true`
- live bridge attempted: yes
- result: Playwright `launchPersistentContext` closed before page/composer/upload
  adapter.
- file input adapter: not reached.
- clipboard adapter: not reached.
- drag/drop adapter: not reached.
- image attachment confirmed: no.
- prompt sent with confirmed image: no.

## 10. `chatgpt_web_bridge.enabled` Source And Meaning

Source:

- `ops/autopilot/config.json`
- key: `chatgpt_web_bridge.enabled`
- current tracked value: `false`

Code paths:

- `ops/autopilot/ask_chatgpt_web.ps1` stops live mode with
  `BRIDGE_DISABLED` when this value is false.
- `ops/autopilot/capture_chatgpt_visual_judge.ps1` computes probe availability
  from either the config value or mission-scoped `-AllowChatGPTVisualProbe`.

Interpretation:

The default policy/config blocks live ChatGPT browser send. A mission runtime
flag can bypass this config gate without editing local config, but A20X then
failed at session launch before upload probing.

## 11. Session/CDP State

Historical CDP attach:

- Existing browser reused.
- Existing page reused.
- Text messages succeeded.
- Browser was not closed by Codex.
- The CDP attach loop has no image upload helper.

Current safe probes:

- Dedicated profile exists.
- A running Chrome profile was detected.
- CDP port `127.0.0.1:9222` was open.
- No message was sent.
- No image was uploaded.
- No browser verification was bypassed.

Diagnosis:

The stable historical text path uses `connectOverCDP` against an already-running
browser/page. The failing A20X visual path used `launchPersistentContext`, which
tries to launch a persistent context for the same profile and closed before the
page opened. That is a session-routing mismatch.

## 12. Upload Adapter State

Historical adapter state:

- `input[type=file]` existed.
- It accepted `image/*`.
- `setInputFiles` attached the synthetic PNG.
- Attachment was visible enough for ChatGPT to answer from the image.

Current Visual Court adapter state:

- File input adapter: not reached.
- Clipboard paste adapter: not implemented/reached.
- Drag/drop adapter: not implemented/reached.
- No A20P contact sheet attachment was confirmed.

## 13. Why Adapters Were Not Reached

Adapters were not reached for two different reasons:

- A20V stopped at the config gate:
  `chatgpt_web_bridge.enabled=false`.
- A20X passed the config gate with a mission flag, then failed before page open:
  Playwright persistent context closed before composer/upload probing.

So the current problem is not that the old upload proof was fake. The current
problem is that the Visual Court capture path no longer reaches the known old
file-input capability.

## 14. Regression Diff

Old working path:

- Direct screenshot-upload smoke using `chatgpt_bridge.mjs`.
- Persistent profile launch reached the ChatGPT UI.
- Hidden file input accepted a synthetic PNG.
- Prompt was sent.
- ChatGPT produced image-aware output.

Current Visual Court path:

- `capture_chatgpt_visual_judge.ps1` wrapper.
- Default path blocked by tracked config.
- Mission override path reaches `chatgpt_bridge.mjs`.
- Browser context closes before page/composer/upload adapter.
- No A20P contact-sheet upload.
- No ChatGPT Visual Court JSON.

Classification:

- `CONFIG_DISABLED_REGRESSION`: confirmed.
- `CDP_CONTEXT_CLOSED_REGRESSION`: confirmed.
- `UPLOAD_ADAPTER_MISSING_CONFIRMED`: confirmed for the Visual Court path,
  because adapters are not reached there.
- `OLD_SUCCESS_WAS_TEXT_ONLY_NOT_VISUAL_UPLOAD`: rejected as the full story,
  because screenshot-upload smoke artifacts prove a real simple image upload.
  It remains true only for A18I CDP attach.

## 15. Safe Probe Results

A20Y ran only read-only/safe probes:

- Tracked config audit: `chatgpt_web_bridge.enabled=false`.
- Local config shape audit: project/session config present, values redacted.
- Profile lock check: profile exists and is currently used by running Chrome.
- CDP TCP probe: `127.0.0.1:9222` open.
- Script grep: `chatgpt_bridge.mjs` has input/filechooser upload helpers;
  `chatgpt_cdp_attach_loop.mjs` does not.

A20Y did not:

- submit a ChatGPT message;
- upload an image;
- paste an image;
- drag/drop an image;
- click through login, CAPTCHA, 2FA, consent, or human verification.

## 16. Root Cause Tree

Root problem: ChatGPT visual judge output missing.

Confirmed current branches:

- Evidence not sent.
- Bridge disabled in default config.
- Upload adapter not reached.
- Persistent browser context closed before page open.

Likely/possible branches:

- Current selector state unknown.
- Upload UI may still exist but was not queried in the current path.
- Response extraction for Visual Court remains unproved because send never
  happened.

Rejected branches:

- No historical ChatGPT visual upload at all. Rejected: synthetic image-upload
  smoke proves it existed.
- Local config missing. Rejected by redacted shape audit.

## 17. Blocker Taxonomy

Primary blockers:

- `CONFIG_BLOCKER`: high confidence, high severity.
- `SESSION_BLOCKER`: high confidence, high severity.
- `CDP_CONTEXT_BLOCKER`: medium-high confidence, high severity.
- `UPLOAD_UI_BLOCKER`: medium confidence, medium severity.
- `FILE_INPUT_BLOCKER`: low current confidence but high historical confidence.

Lower-priority blockers:

- `CLIPBOARD_BLOCKER`: low confidence.
- `DRAG_DROP_BLOCKER`: low confidence.
- `RESPONSE_EXTRACTION_BLOCKER`: not the first blocker; old smoke extracted
  response, current Visual Court never sent.
- `JSON_SCHEMA_BLOCKER`: relevant after transport works.

## 18. Solution Map

Candidate paths:

1. Runtime-enable ChatGPT web bridge probe without committing local config.
2. Restore old CDP text transport and extend it with upload adapter.
3. File-input selector prototype.
4. Clipboard image paste prototype.
5. Drag/drop image adapter prototype.
6. Single contact-sheet only visual packet.
7. Gemini enum-only lane plus internal Creative Director.
8. ChatGPT manual import with reduced user effort.
9. Offline Visual Gym with post-run human calibration.
10. Official API-based vision route only if explicitly authorized later.
11. Stop live ChatGPT visual upload attempts.
12. Limited rehearsal with visual lane disabled.
13. Limited rehearsal with offline visual lane only.

## 19. Top 3 Recommended Solution Candidates

Top candidate:

- Restore the old stable CDP text transport and extend it with the upload
  adapter.

Why:

- A18I proves CDP attach can reuse existing Chrome/page.
- A20Y safe probe found the CDP port open.
- Old screenshot smoke proves `input[type=file]` could attach an image.
- A20X failed because it launched a persistent context instead of reusing the
  stable active CDP session.

Second:

- File-input selector prototype.

Why:

- The strongest old visual proof used `input[type=file]`.
- The next proof should be read-only selector enumeration first, then one
  approved A20P contact-sheet attachment only if the lane is confirmed safe.

Third:

- Runtime-enable ChatGPT web bridge probe without committing local config.

Why:

- It clears the A20V config gate, but it is not sufficient by itself because
  A20X already showed the lower bridge can still fail at session launch.

## 20. Rejected Candidates

Rejected as first-line next steps:

- Clipboard image paste prototype: less evidence than file input.
- Drag/drop prototype: least deterministic and higher UI fragility.
- Text-only ChatGPT visual review: not visual review.
- Public/sandbox image links: not approved and unnecessary.
- API-based vision route: not authorized for this mission and would require a
  separate credentials/policy decision.
- Another generic hardening mission: not useful; the next mission must target a
  concrete capability.

## 21. Required Supervisor Decision

Recommended decision:

`AUTHORIZE_FILE_INPUT_UPLOAD_PROTOTYPE`

The useful next experiment should:

- use runtime authorization without committing local config;
- use the existing CDP session/page where possible;
- enumerate file inputs and upload controls read-only first;
- attach one approved A20P contact sheet only after a safe lane is confirmed;
- verify attachment before send;
- stop on login, CAPTCHA, 2FA, consent, or human verification;
- never count a text-only answer as visual review.

## 22. Is Live ChatGPT Visual Upload Realistically Recoverable?

Yes, with a targeted fix. It is not currently viable in the A20V/A20X Visual
Court wrapper, but it is realistically recoverable because:

- historical ChatGPT synthetic image upload is proven;
- current CDP session availability is plausible;
- the likely failure is routing/session architecture, not model incapability.

The recovery should not be generic hardening. It should specifically bridge the
stable CDP attach path with the old proven file-input upload mechanism.

## 23. Should A21 Remain Blocked Or Proceed With Visual Lane Limited?

A21 should remain blocked for full live Visual Court claims. It may proceed only
with the visual lane limited or disabled if product governance authorizes that
separately.

The system still cannot claim a valid Gemini+ChatGPT real visual judge merge on
A20P evidence.

## 24. No Implementation Fix

No implementation fix was made in A20Y. No capture scripts were changed. No new
capture behavior was added.

## 25. No Image Submitted To ChatGPT During A20Y

A20Y did not submit any screenshot, contact sheet, or prompt to ChatGPT. The
mission inspected historical artifacts and ran read-only/safe probes only.

## 26. A21 Not Launched

A21 was not launched.

## 27. Night Mode Not Launched

Night Mode was not launched.

## 28. road-to-V2 Not Pushed

`road-to-V2` was not pushed and was not merged.

## Final Diagnostic Verdict

`LIVE_CHATGPT_VISUAL_UPLOAD_RECOVERABLE_WITH_TARGETED_FIX`

## Recommended Next Action

`AUTHORIZE_FILE_INPUT_UPLOAD_PROTOTYPE`
