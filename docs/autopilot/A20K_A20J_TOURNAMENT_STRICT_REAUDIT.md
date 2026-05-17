# A20K A20J Tournament Strict Re-Audit

Date: 2026-05-18

Road branch reviewed: `road-to-V2`

Road HEAD during re-audit: `762a6ac`

A20J branch reviewed:
`auto/a20j-3d-board-stage-golden-screen-tournament-20260517`

A20J commit: `84a911f Add DEV-only 3D Board Stage design tournament`

Evidence root:
`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\board_stage_tournaments\A20J_golden_screen_tournament_20260517`

## 1. A20J Summary

A20J created three DEV-only Board Stage visual variants:

- Precision Cockpit: design 91, taste 86, SaaS drift 5.
- Atmospheric Artifact: design 89, taste 91, SaaS drift 4.
- Feedback Arena: design 94, taste 90, SaaS drift 4.

The autonomous tournament selected `Feedback Arena`. Browser smoke passed, and
the branch remained separate from `road-to-V2`.

This A20K re-audit does not merge or modify A20J. It applies stricter chess
visual gates that did not exist during A20J.

## 2. Evidence Reviewed

Reviewed external evidence:

- `contact_sheet_all_variants.png`
- `contact_sheet_best_states.png`
- all Precision Cockpit screenshots;
- all Atmospheric Artifact screenshots;
- all Feedback Arena screenshots;
- `tournament_visual_brief.md`;
- `tournament_scoring.json`;
- `autonomous_design_scores.json`;
- `gemini_visual_result.json`;
- `browser_smoke_report.json`;
- `console_log.txt`.

Screenshots remain external evidence and are not committed.

## 3. Gemini Failure Analysis

A20J Gemini was non-decisive. It returned enum-placeholder text such as
`PASS_VISUAL|WARNING_VISUAL|BLOCK_VISUAL` and
`Precision Cockpit|Atmospheric Artifact|Feedback Arena|NO_WINNER` instead of a
concrete verdict, ranking, or visible-detail critique.

Result: `GEMINI_CRITIQUE_INSUFFICIENT`.

The failed Gemini response cannot support `READY_TO_REVIEW`, and it cannot
rescue a deterministic hard-gate failure.

## 4. Variant-By-Variant Strict Audit

### Precision Cockpit

Strengths:

- strongest technical cockpit framing;
- good desktop density;
- clear state labels;
- board remains centered in browser geometry.

Strict defects:

- board is visually trapezoidal rather than top-down enough for product-grade
  chess reading;
- perspective makes square dimensions appear non-uniform;
- yellow pre-feedback diagonal and ring enter the playing surface and can read
  as a candidate/answer line;
- side panels and HUD labels still feel prototype-heavy.

Strict result: `PASS_PROTOTYPE_ONLY`.

### Atmospheric Artifact

Strengths:

- strongest material atmosphere and sense of place;
- board-as-artifact direction is visible;
- lower generic SaaS drift than the precision variant.

Strict defects:

- board still has perspective distortion;
- decorative long diagonal line enters the board even in observe/try states;
- piece treatment remains utilitarian letter tokens;
- atmosphere is promising but not yet product-grade chess clarity.

Strict result: `PASS_PROTOTYPE_ONLY`.

### Feedback Arena

Strengths:

- strongest state energy;
- best autonomous score;
- success, miss, and replay states read more clearly than the other variants;
- avoids fake XP/rank/Transfer, fake neuroscience, fake Elo, and cheap reward
  economy.

Strict defects:

- board is not strict top-down; square geometry appears non-uniform under the
  stage perspective;
- observe and try states include lines crossing the board surface, which is not
  allowed under strict board cleanliness;
- the try state includes a line/ring that can be interpreted as a pre-feedback
  candidate or destination trace;
- DEV/HUD panels remain visually dominant enough to keep this below
  product-grade.

Strict result: `PASS_PROTOTYPE_ONLY`, with winner rework required.

## 5. Chessboard Fidelity Assessment

All variants fail product-grade chessboard fidelity because the screenshot
evidence shows a stylized, trapezoidal/perspective board rather than a true
top-down or near top-down chess grid. Browser measurements show the board is
centered, but the visual evidence does not show uniform square perception.

Additional hard concern: decorative stage artifacts enter the playing surface.
The board is still readable as a prototype, but product-grade NeuroChess must
make the chess position readable before it makes the stage dramatic.

Chessboard fidelity result for A20J winner: `BLOCK_CHESS_FIDELITY`.

## 6. Anti-Spoiler Assessment

`observe` and `try_before_feedback` must not show answer-like lines. The A20J
screenshots show diagonal traces and rings over the board in pre-feedback
states. Even if intended as abstract tension, they can be read as candidate
lines or destination traces.

Anti-spoiler result for A20J winner: `BLOCK_STATE_SEMANTICS`.

## 7. Product-Grade Classification

A20J is a useful technical prototype. It demonstrates a code-native stage, no
dependencies, no external assets, all required states, and safe textual claims.

It does not yet reach product-grade visual quality because:

- strict board fidelity fails;
- anti-spoiler state semantics fail;
- stage artifacts overlap the board surface;
- DEV-HUD/prototype framing is still prominent;
- piece treatment is readable but not premium.

Classification: `TECHNICAL_PROTOTYPE_PASS`.

## 8. Game-Changer Classification

The concept has game-changer potential, especially the Feedback Arena direction,
but the current screenshots do not qualify as `GAME_CHANGER_PASS`.

Reasons:

- state meaning still depends on labels;
- board geometry is not product-grade;
- visual traces feel like prototype overlays rather than mature chess pedagogy;
- the scene is promising, not yet memorable enough to define the future Decision
  Arena.

Game-changer result: `GAME_CHANGER_FAIL_CURRENT_SCREENSHOTS`.

## 9. Cheap UI / DEV-HUD Assessment

Result: `WARN_DEV_HUD`.

The interface is not generic SaaS and not a cheap RPG layer, but the visible
DEV-only labels, scene-language panel, selector panel, footer badges, and HUD
boxes still make the screenshots feel more like a proof scaffold than a
finished NeuroChess direction.

## 10. Feedback Arena Winner Validity

Feedback Arena remains the best of the three A20J variants for energy and
learning-loop feel, but it is not valid for consolidation as-is.

Autonomous winner still valid as a prototype comparison: yes.

Autonomous winner valid for product consolidation: no.

## 11. New Final Recommendation

Recommendation: `REWORK_WINNER`.

Feedback Arena should be the starting direction for a strict rework, not a
winner to consolidate. The next iteration must:

- restore a true top-down or near top-down 8x8 board;
- remove decorative artifacts from the playing surface;
- remove all pre-feedback line/path/ring cues that can imply a solution;
- keep feedback traces only in post-feedback states;
- make pieces more immediately readable and product-grade;
- reduce DEV-HUD dominance in visual judgment;
- preserve no-package, no-assets, no-Spline constraints unless a future
  dedicated mission changes that policy.

## 12. A20J Branch Reclassification

A20J branch reclassification: `NEEDS_REWORK`.

Reason:

The branch remains safe and useful as external prototype evidence, but strict
chessboard fidelity and anti-spoiler gates block product-grade readiness.

Recommended next mission:
`A20J3_REWORK_3D_BOARD_STAGE_TOURNAMENT_WITH_STRICT_VISUAL_FIREWALL`
