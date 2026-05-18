# A20P Screenshot-To-Patch Real Run On A20L

## 1. Mission Summary

A20P ran the first real NeuroChess Visual Training System loop on the A20L
DEV-only North Star Board Stage. The mission built a visual director packet,
used offline court inputs, selected one constrained patch, implemented it on the
DEV-only route, regenerated screenshots outside the repo, and measured the
before/after visual delta.

Final verdict: PATCH_IMPROVED_PUBLIC_TEASER_READINESS.

## 2. Source Branch And Commit

- protected road branch: road-to-V2
- expected road HEAD: 7a71b0e
- A20O source branch: auto/a20o-neurochess-visual-training-system-20260518
- A20O source commit: b295ff6
- A20P branch: auto/a20p-screenshot-to-patch-real-run-on-a20l-20260518
- A20L route under review: /app?boardStageNorthStar=1

## 3. Why This Was Required After A20O

A20O created the visual training system but could not honestly claim 18/20
visual automation competence because no real screenshot-to-patch loop had
improved a real artifact. A20P supplied that missing proof attempt on A20L.

## 4. Baseline Evidence Inspected

Baseline evidence path:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\board_stage_tournaments\A20L_revolutionary_board_stage_upgrade_20260518\`

Reviewed:

- contact_sheet_northstar_states.png
- contact_sheet_before_after_a20j3_vs_a20l.png
- northstar observe/try/success/miss/replay screenshots at 1366 and 1440
- northstar_observe_1920.png
- visual_ambition_score.json
- sacred_board_contract_check.json
- anti_spoiler_check.json
- browser_smoke_report.json
- manifest.json

Baseline classification: INTERNAL_NORTH_STAR_CANDIDATE.

## 5. Visual Director Packet Generated

Packet output path:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_training\A20P_screenshot_to_patch_a20l_20260518\`

Actual command used:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/build_visual_director_packet.ps1 -MissionId A20P_SCREENSHOT_TO_PATCH_REAL_RUN_ON_A20L -ArtifactPath "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\board_stage_tournaments\A20L_revolutionary_board_stage_upgrade_20260518\" -TargetVisualLevel "PUBLIC_TEASER_READY_WITH_CAVEATS" -OutDir "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_training\A20P_screenshot_to_patch_a20l_20260518\"
```

Note: the actual script uses `-OutDir`; the mission prompt's `-OutputPath`
form was not the supported parameter.

## 6. Gemini Live Input Status

Gemini was not called live. Gemini input was offline prompt-only and treated as
MISSING_INPUT, not PASS.

## 7. ChatGPT Live Input Status

ChatGPT was not called live. ChatGPT input was offline prompt-only and treated
as MISSING_INPUT, not PASS.

## 8. Codex Patch Planner Result

Codex identified four concrete baseline weaknesses:

- visible side controls and state panels;
- board captions reading like evidence/proof labels;
- prototype residue in the public screenshot frame;
- clear but simple post-feedback trace language.

Three patch options were considered:

- Patch A: conservative cleanup;
- Patch B: public-teaser composition upgrade;
- Patch C: feedback-language refinement.

The selected patch was a mixed Patch B plus Patch A: remove public-facing
prototype chrome first, then reframe the state controls as product-native
teaser UI.

## 9. Creative Director Verdict

Creative Director verdict: PRODUCT_GRADE_WITH_DEBT.

Selected action: patch.

The patch was allowed because it did not require packages, backend work,
production V1 changes, external assets, board distortion, or pre-feedback
traces.

## 10. Selected Patch

Implemented one focused DEV-only visual patch:

- added optional teaser mode through `&teaser=1`;
- changed teaser headline to "NeuroChess Decision Chamber";
- hid side control panels in teaser mode;
- replaced dominant state controls with a compact Decision Phase Rail;
- added a small state card above the board;
- hid proof-like board caption text in teaser mode;
- preserved the original A20L route controls outside teaser mode;
- preserved the sacred board and post-feedback-only traces.

## 11. Files Changed

Frontend DEV-only:

- `frontend/src/dev/board-stage-north-star/NorthStarBoardStage.tsx`
- `frontend/src/dev/board-stage-north-star/NorthStarBoardStage.css`

Browser evidence:

- `scripts/browser_a20p_screenshot_to_patch_smoke.mjs`

Mission records:

- `docs/autopilot/A20P_SCREENSHOT_TO_PATCH_REAL_RUN_ON_A20L_REPORT.md`
- `docs/design/SULEYMAN_VISUAL_TASTE_LEDGER.md`
- `docs/design/NEUROCHESS_VISUAL_FAILURE_GALLERY.md`
- `docs/design/NEUROCHESS_VISUAL_COMPETENCE_SCORECARD.md`
- `ops/autopilot/a20p_visual_delta_result.json`

## 12. Screenshots Generated

Patched screenshots were generated outside the repo:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_training\A20P_screenshot_to_patch_a20l_20260518\generation_1_patch\`

Generated:

- a20p_observe_1366.png
- a20p_try_before_feedback_1366.png
- a20p_feedback_success_1366.png
- a20p_feedback_miss_1366.png
- a20p_replay_1366.png
- a20p_observe_1440.png
- a20p_try_before_feedback_1440.png
- a20p_feedback_success_1440.png
- a20p_feedback_miss_1440.png
- a20p_replay_1440.png
- a20p_observe_1920.png
- contact_sheet_generation_1_states.png
- contact_sheet_before_after_a20l_vs_a20p.png

No screenshots were committed.

## 13. Before/After Visual Delta

- first viewport composition: MEANINGFUL_IMPROVEMENT
- prototype residue: MEANINGFUL_IMPROVEMENT
- public screenshot readiness: MEANINGFUL_IMPROVEMENT
- board fidelity: NO_REGRESSION_PASS
- anti-spoiler: NO_REGRESSION_PASS
- product-grade quality: SMALL_IMPROVEMENT
- premium direction: SMALL_IMPROVEMENT
- Awwwards-grade craft translation: SMALL_IMPROVEMENT
- UI density: MEANINGFUL_IMPROVEMENT
- feedback dignity: SMALL_IMPROVEMENT
- NeuroChess identity: SMALL_IMPROVEMENT
- risk introduced: LOW_NO_HARD_GATE_REGRESSION

The first teaser sizing attempt made the board too small at 1366px. The smoke
caught it, the CSS was corrected, and the accepted run restored the board as a
central artifact.

## 14. Hard Gate Status After Patch

- chess fidelity: PASS_CHESS_FIDELITY
- board squares: 64 visible squares
- board shape: square at 1366, 1440, and 1920 observe
- board transform: none
- decorative board pollution: none detected
- observe and try_before_feedback traces: none
- success/miss/replay traces: post-feedback only
- fake XP/rank/Elo/Transfer/science: none

## 15. Public Screenshot Readiness Result

After classification: PUBLIC_TEASER_READY_WITH_CAVEATS.

The teaser screenshot is cleaner and more product-native than A20L, but it is
not HERO_SCREENSHOT_READY. Human review remains required.

## 16. Taste Ledger Update Summary

The Taste Ledger now records that A20P improved by deleting weak chrome before
adding ambition. It also records the constraint that public teaser framing must
never shrink or subordinate the board.

## 17. Failure Gallery Update Summary

The Failure Gallery now records the A20P lesson: screenshot composition can
improve while board scale regresses. Geometry and visual checks must catch this
before any acceptance.

## 18. New Design Automation Score Estimate

Previous estimate: 16/20.

New estimate: 17/20.

A20P earned the increase because it completed a real screenshot-to-patch loop
with before/after evidence and preserved hard gates.

## 19. Whether 18/20 Is Reached

18/20 is not reached.

Reasons:

- no live Gemini visual court was used;
- no live ChatGPT art-direction review was used;
- human review remains required;
- feedback language and piece identity remain visual debt;
- one successful real patch is not repeated proof.

## 20. What Remains To Reach 18/20 Or 19/20

To reach 18/20:

- run a safe live or equivalently strict multi-judge visual court;
- prove missing judge inputs are not treated as PASS;
- complete another focused visual patch or human-reviewed visual decision;
- keep all A20K hard gates green.

To reach 19/20:

- repeat success across multiple visual cases;
- show that the system rejects tempting but unsafe spectacle;
- prove public-ready decisions survive human-calibrated review.

## 21. A21 Not Launched

A21 was not launched.

## 22. Night Mode Not Launched

Night Mode was not launched.

## 23. Road-To-V2 Not Pushed

road-to-V2 was not pushed or merged during A20P.

## 24. Recommended Next Mission

Recommended next mission: A20Q_LIVE_GEMINI_CHATGPT_VISUAL_COURT_BRIDGE.

Reason: A20P proved the offline screenshot-to-patch loop can improve a real
artifact. The next missing proof for 18/20 is a safe, no-bypass visual court
bridge that can bring Gemini and ChatGPT critique into the packet without
treating provider praise as deterministic truth.
