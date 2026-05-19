# A20AQ Perception-Grade Visual Evidence Foundry Report

## 1. Mission Summary

A20AQ converted the A20AP ten-probe gallery into judge-ready visual evidence. The gallery route remains available at `/app?visualProbeGallery=1`, and each probe now has an isolated DEV-only route at `/app?visualProbe=<probe_id>&evidence=primary`.

## 2. Why A20AQ Was Required After A20AP

A20AP proved that ten visual probes existed, but its contact sheet put ten small UIs into one image. That is not reliable evidence for Gemini, ChatGPT Vision, or human review because typography, material, board safety, and signature details become too small to judge.

## 3. Why 10 Tiny UIs In One Screenshot Is Invalid Evidence

A 10-up image lets a judge critique the grid instead of the individual probe. It compresses the signal, hides details, and makes model critique vague. A20AQ therefore treats contact sheets as overview-only and requires one full-size primary screenshot per probe.

## 4. Isolated Route Strategy

DEV-only isolated routes were added:

- `/app?visualProbe=sacred_board_chamber`
- `/app?visualProbe=piece_identity_system`
- `/app?visualProbe=decision_feedback_language`
- `/app?visualProbe=critical_moment_sigil`
- `/app?visualProbe=verdict_wax_seal`
- `/app?visualProbe=aftermath_timeline`
- `/app?visualProbe=memory_cabinet`
- `/app?visualProbe=piece_breath`
- `/app?visualProbe=position_resonance`
- `/app?visualProbe=decision_pressure_field`

Optional evidence modes are supported through `&evidence=primary`, `&evidence=detail`, and `&evidence=states`. Normal `/app` behavior remains unchanged.

## 5. Screenshot Engine Summary

Created `scripts/browser_signature_probe_evidence_smoke.mjs`.

It launches the app, verifies the gallery, visits each isolated route, captures full primary screenshots, captures clipped main-surface screenshots, captures detail screenshots, writes an evidence manifest, creates overview and pairwise contact sheets externally, and generates judge packets.

Artifact root:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_evidence\A20AQ_perception_grade_visual_evidence_foundry_20260518`

## 6. Pixel Budget Summary

Result: `VISUAL_PIXEL_BUDGET_PASS`

Rules verified:

- primary screenshot width >= 1200;
- primary screenshot height >= 800;
- main surface width >= 700;
- main surface height >= 450;
- main surface area ratio >= 35%;
- board width >= 360 when a board is visible;
- overview contact sheet is not primary evidence;
- pairwise sheets contain at most two probes.

## 7. Per-Probe Evidence Readiness

| Probe | Score | Main area ratio | Board visible | Ready |
|---|---:|---:|---|---|
| sacred_board_chamber | 100 | 0.497 | yes | yes |
| piece_identity_system | 100 | 0.497 | no | yes |
| decision_feedback_language | 100 | 0.497 | yes | yes |
| critical_moment_sigil | 100 | 0.497 | no | yes |
| verdict_wax_seal | 100 | 0.497 | no | yes |
| aftermath_timeline | 100 | 0.497 | no | yes |
| memory_cabinet | 100 | 0.497 | no | yes |
| piece_breath | 100 | 0.497 | no | yes |
| position_resonance | 100 | 0.497 | yes | yes |
| decision_pressure_field | 100 | 0.497 | yes | yes |

Weak probes: none.

## 8. Judge Packet Readiness

Created packet builder and packet tests:

- 10 Gemini one-probe packets.
- 10 ChatGPT one-probe packets.
- 5 pairwise comparison packets.
- No 10-probe collage is used as primary evidence.

## 9. Pairwise Packet Readiness

Pairwise sheets are comparison-only and contain at most two probes:

- sacred_board_chamber vs decision_pressure_field
- critical_moment_sigil vs verdict_wax_seal
- aftermath_timeline vs memory_cabinet
- piece_identity_system vs piece_breath
- decision_feedback_language vs position_resonance

## 10. Contact Sheet Overview-Only Policy

The overview contact sheet is labelled `OVERVIEW_ONLY` and is explicitly disallowed as primary judge evidence.

## 11. Local Triage Result

Local triage returned `EVIDENCE_READY_FOR_SELECTION`.

Signature Five selection can proceed, but A20AQ did not select the final five.

## 12. NeuroRelay Rehearsal Result

Command:

`powershell -ExecutionPolicy Bypass -File ops/autopilot/run_neurorelay_loop.ps1 -Mode Rehearsal -MissionId A20AQ -MaxIterations 2 -NoLiveWeb`

Result: `NEURORELAY_REHEARSAL_PASS`

Next planned objectives:

1. `A20AR_SIGNATURE_FIVE_SELECTION_FROM_HIGH_QUALITY_EVIDENCE`
2. `A20AR_TRIPLED_VARIANTS_FOR_TOP_2_SIGNATURES`

GPT Web required: no. Gemini required: no.

## 13. Score Update

Previous overall score: 17.7.

New conservative overall score: 18.0.

Updated categories:

- visual_production: 15.8 -> 16.8
- art_direction_concrete: 16.5 -> 17.2
- evidence_quality: 17.8 -> 18.3

No 19 or 19.5 claim was made.

## 14. Whether Signature Five Selection Can Proceed

Yes. A20AR can select Signature Five from high-quality evidence because all ten probes have isolated primary screenshots, main-surface crops, detail crops, and judge packets.

## 15. Recommended Next Mission

`A20AR_SIGNATURE_FIVE_SELECTION_FROM_HIGH_QUALITY_EVIDENCE`

## 16. A21 Statement

A21 was not launched.

## 17. Night Mode Statement

Night Mode was not launched.

## 18. Road Branch Statement

`road-to-V2` was not pushed.

## Final Verdict

`PERCEPTION_GRADE_EVIDENCE_READY`
