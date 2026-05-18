# A20T Autonomous Real Judge Capture And Merge Report

## Mission Summary

A20T built the Visual Court packet for A20P evidence and attempted autonomous
real judge capture through existing approved bridge tooling.

Result:

- Gemini safe-live capture was attempted.
- ChatGPT safe-live capture was blocked before send by precheck.
- No valid real judge JSON output was produced.
- No merge was run.
- No Creative Director verdict was generated from real judge evidence.
- The visual automation score remains 17.5/20.

Final verdict:

`VISUAL_COURT_OUTPUTS_INVALID_NO_SCORE_GAIN`

## Source Branch And Commit

- protected road branch: `road-to-V2`
- expected road HEAD: `7a71b0e`
- A20S phase-2 source branch:
  `auto/a20s-phase2-real-judge-merge-20260518`
- A20S phase-2 source commit verified: `88ef103`
- A20T branch:
  `auto/a20t-autonomous-real-judge-capture-and-merge-20260518`

## Why A20T Was Required After A20S Phase 2

A20S Phase 2 correctly stopped because no real Gemini or ChatGPT judge files
were present. The blocker was not validation logic; the blocker was absent real
judge capture.

A20T therefore attempted to capture real judge outputs directly, without asking
the user to copy-paste them manually and without using fixtures as real
evidence.

## Evidence Path Inspected

A20P evidence path:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_training\A20P_screenshot_to_patch_a20l_20260518\`

Inspected or packetized:

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

No screenshots or QA artifacts were copied into the repo.

## Safe Live Capture Precheck

Artifact path:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20T_autonomous_real_judge_capture_20260518\`

The mission created the requested folders and packet files outside the repo.

Gemini precheck:

- Gemini visual bridge script exists: yes
- Gemini visual court available: yes
- Gemini image upload available: yes
- Gemini profile locked: no
- Safe bounded Gemini capture allowed: yes

ChatGPT precheck:

- ChatGPT web bridge script exists: yes
- ChatGPT upload-capable web bridge enabled: no
- CDP attach script exists: yes
- CDP endpoint reachable: yes
- Active session configured: yes
- Approved screenshot upload path for CDP visual judge evidence: no
- Safe ChatGPT visual judge capture allowed: no

ChatGPT was not sent a prompt because the safe visual evidence upload path was
not available through approved configuration.

## Gemini Capture Attempted

Gemini capture attempted: yes.

Gemini was called through:

`ops/autopilot/ask_gemini_web.ps1`

The mission submitted only A20P visual evidence and prompt text. It did not send
source code, credentials, tokens, secrets, local config, database files, Git
metadata beyond mission context, or unrelated user files.

Two bounded attempts were made:

1. Initial visual judge request.
2. One JSON-only correction attempt, allowed by mission contract.

Both attempts ended with:

`GEMINI_RESPONSE_TIMEOUT_OR_DONE_MISSING`

The bridge saved raw/partial external evidence, but it did not produce a stable
nonce-bound extracted response or a normalized
`gemini_visual_observation.json`.

## ChatGPT Capture Attempted

ChatGPT capture attempted: no.

Reason:

The upload-capable ChatGPT web bridge is disabled in `ops/autopilot/config.json`.
CDP attach is available for manually verified sessions, but the approved CDP
request path does not provide the required screenshot/contact-sheet upload lane
for a visual judge output. Sending text-only path references would not satisfy
the Visual Court screenshot evidence requirement.

## Human Verification / Login / CAPTCHA / 2FA / Consent Status

- human verification encountered: no
- login prompt encountered by Codex: no
- CAPTCHA encountered: no
- 2FA encountered: no
- consent wall encountered: no
- credentials touched: no
- bypass attempted: no

## Judge Validation Results

| Judge | Capture Result | Validation Result |
|---|---|---|
| Gemini | `GEMINI_RESPONSE_TIMEOUT_OR_DONE_MISSING` | `MISSING_INPUT` for normalized judge JSON |
| ChatGPT | `SAFE_LIVE_JUDGE_CAPTURE_UNAVAILABLE` | `MISSING_INPUT` |

Raw Gemini text was not treated as a valid judge output because no stable
extractable normalized JSON file was produced.

## Invalid Or Missing Judge Handling

- No fixture output was used as real judge evidence.
- Missing normalized judge JSON was not converted into PASS.
- Gemini partial/raw output was not accepted as a valid judge verdict.
- ChatGPT was not faked through text-only evidence.

## Merge Result

Merge was not run.

Reason:

No real judge output validated successfully.

## Creative Director Verdict

No Creative Director verdict was produced from real judge evidence.

Temporary status:

`NOT_RUN_NO_VALID_REAL_JUDGE_OUTPUTS`

## Next Prompt Generated

No next prompt was generated from a real judge verdict.

Reason:

The mission did not produce a valid merged Visual Court summary.

## Score Update

- previous score: 17.5/20
- new score: 17.5/20
- 18/20 reached: no

Reason:

Gemini was genuinely called but did not return a stable extractable judge JSON
after one correction attempt. ChatGPT was blocked before send by the absence of
an approved screenshot upload path in enabled configuration. No valid real
external judge output was merged.

## What Remains For 19/20

19/20 remains impossible until multiple screenshot-to-patch loops succeed with
human-calibrated review and the system repeatedly handles real external judge
critique without weakening deterministic hard gates.

## A21 Visual Lane Status

The A21 visual lane remains blocked.

The system still lacks validated real Gemini and ChatGPT outputs merged into a
Creative Director verdict.

## Safety Statements

- A21 was not launched.
- Night Mode was not launched.
- `road-to-V2` was not pushed.
- `road-to-V2` was not merged.
- Backend was not touched.
- Frontend was not touched.
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

## Recommended Next Mission

`A20U_VISUAL_JUDGE_CAPTURE_HARDENING`

This should be a narrow implementation mission for the actual blocker: make
real judge capture produce stable, extractable, validated JSON without relying
on manual copy-paste, while preserving all login, CAPTCHA, 2FA, consent, and
human-verification stops.

## Final Verdict

`VISUAL_COURT_OUTPUTS_INVALID_NO_SCORE_GAIN`
