# A20J3 Strict Firewall Rework Tournament Report

## 1. Mission Summary

A20J3 created a new DEV-only 3D Board Stage tournament branch from `road-to-V2` at `7a71b0e`:

`auto/a20j3-rework-3d-board-stage-tournament-strict-firewall-20260518`

The mission rebuilt the prior A20J tournament direction under the A20K strict visual firewall. The goal was not to merge product code or launch A21. The goal was to prove whether a code-native, desktop-first board stage can pass strict chessboard fidelity, anti-spoiler, product-grade, and cheap-UI gates before any subjective visual winner is trusted.

Final tournament result:

`STRICT_WINNER_READY_TO_REVIEW`

Selected variant:

`Strict Feedback Arena`

## 2. Base Commit And Branch

- Base branch: `road-to-V2`
- Expected base HEAD: `7a71b0e`
- Mission branch: `auto/a20j3-rework-3d-board-stage-tournament-strict-firewall-20260518`
- DEV-only route: `/app?boardStageStrict=1`
- Product route merge: none
- A21 launched: no
- Night Mode launched: no

## 3. Why A20J Was Not Consolidated

A20J selected `Feedback Arena`, but A20K re-audited that result and found that the branch could not be consolidated safely. The previous tournament was too permissive because the visual scoring and Gemini evidence treated an interesting prototype as if it were product-ready.

Blocking findings from A20K:

- Board perspective and trapezoid effects harmed chess fidelity.
- Squares could read as non-uniform.
- Decorative artifacts entered or competed with the board surface.
- Some pre-feedback traces could be interpreted as candidate or solution hints.
- The overall surface leaned toward DEV-HUD/prototype-grade rather than product-grade.
- Gemini and autonomous scoring were not strict enough to override deterministic board and state-semantics failures.

A20J3 therefore starts from `road-to-V2`, not from the previous tournament branch, and treats A20J only as a reference for what to avoid.

## 4. A20K Gates Used

A20J3 applied these A20K gates before selecting a winner:

- Strict Chessboard Fidelity Gate
- Anti-Spoiler Visual State Gate
- Product-Grade Visual Classification
- Premium/Game-Changer Design Gate
- Cheap UI / Dev-HUD Rejection Policy
- Strict Gemini Visual Court Context
- Gemini PASS override rule

Deterministic hard gates are authoritative. A variant that fails chessboard fidelity, anti-spoiler semantics, or cheap-UI/product-grade checks cannot win even if a taste score or visual provider result is favorable.

## 5. Variant Descriptions

### Strict Feedback Arena

Purpose: preserve the strongest A20J feedback-energy lineage while rebuilding it around a true top-down board.

Characteristics:

- Board remains a stable, uniform 8x8 grid.
- Pre-feedback states keep all traces off the board.
- Feedback energy stays around the stage until success, miss, or replay.
- Post-feedback traces are pedagogical and explicitly state-scoped.
- The arena feeling comes from rim energy and compact state response, not board distortion.

### Top-Down Tactical Artifact

Purpose: explore a premium artifact direction with restrained atmosphere and a board-as-object feeling.

Characteristics:

- Top-down board stays central and readable.
- Surrounding stage emphasizes material depth and artifact presence.
- Feedback states are quieter than Strict Feedback Arena.
- Strong taste alignment, but less immediate one-more-try energy.

### Precision Command Stage

Purpose: explore the clearest technical cockpit direction while keeping the board as the central instrument.

Characteristics:

- Board fidelity and anti-spoiler checks pass.
- Surrounding UI uses restrained cockpit logic.
- State semantics are clear, but the direction is closest to debug/HUD territory.
- Useful as a reference for clarity, not the strongest winner.

## 6. Screenshots And Evidence Path

External evidence was written outside the repo:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\board_stage_tournaments\A20J3_strict_firewall_rework_20260518\`

Evidence includes:

- Screenshots for all 3 variants across `observe`, `try_before_feedback`, `feedback_success`, `feedback_miss`, and `replay`
- `contact_sheet_all_variants.png`
- `contact_sheet_best_states.png`
- `tournament_visual_brief.md`
- `tournament_scoring.json`
- `strict_firewall_scores.json`
- `browser_smoke_report.json`
- `console_log.txt`
- `final_recommendation.json`
- `manifest.json`

No screenshots, images, or QA artifacts were committed to the repository.

## 7. Chessboard Fidelity Assessment

| Variant | Fidelity Result | Notes |
|---|---|---|
| Strict Feedback Arena | PASS_CHESS_FIDELITY | Top-down 8x8 board; uniform square measurements at 1366, 1440, and 1920 widths; no decorative stage elements inside the playing surface before feedback. |
| Top-Down Tactical Artifact | PASS_CHESS_FIDELITY | Top-down 8x8 board; uniform square measurements at tested desktop widths; atmosphere remains outside the board surface. |
| Precision Command Stage | PASS_CHESS_FIDELITY | Top-down 8x8 board; uniform square measurements at tested desktop widths; cockpit framing does not distort the board. |

Measured desktop evidence:

- 1366 width: board remained square and readable for all variants.
- 1440 width: board measured as a uniform `524 x 524` grid for all variants.
- 1920 width: board remained square and readable for all variants.

## 8. Anti-Spoiler Assessment

| State | Required Rule | Result |
|---|---|---|
| observe | No solution line, candidate line, destination trace, or decorative trace implying a move. | PASS for all variants. |
| try_before_feedback | Tension allowed, but no answer trace, candidate path, destination glow, or best-move language. | PASS for all variants. |
| feedback_success | Pedagogical trace allowed only after feedback. | PASS for all variants. |
| feedback_miss | Correction trace allowed only after feedback. | PASS for all variants. |
| replay | Line playback allowed only after feedback. | PASS for all variants. |

Browser smoke confirmed `postTraceCount: 0` for `observe` and `try_before_feedback`, and `postTraceCount: 1` only for post-feedback states.

## 9. Product-Grade Classification

| Variant | Product-Grade Result | Reason |
|---|---|---|
| Strict Feedback Arena | PRODUCT_GRADE_PASS | Best balance of board centrality, state clarity, feedback energy, and non-generic identity. |
| Top-Down Tactical Artifact | PRODUCT_GRADE_PASS | Strong artifact framing and premium feel, but less decisive feedback energy. |
| Precision Command Stage | PRODUCT_GRADE_PASS | Good readability and cockpit discipline, but closer to tool/HUD territory. |

## 10. Game-Changer Classification

| Variant | Game-Changer Result | Reason |
|---|---|---|
| Strict Feedback Arena | GAME_CHANGER_PASS | Most memorable state response while preserving a strict chessboard. |
| Top-Down Tactical Artifact | GAME_CHANGER_FAIL | Attractive and taste-aligned, but not yet energetic enough to define the future Decision Arena. |
| Precision Command Stage | GAME_CHANGER_FAIL | Strong clarity, but too close to conventional command UI to be the strongest NeuroChess identity. |

## 11. Cheap UI / Dev-HUD Assessment

| Variant | Cheap UI Result | Reason |
|---|---|---|
| Strict Feedback Arena | PASS_PRODUCT_UI | DEV label is present for honesty, but the visual judgment is led by the board and state response. |
| Top-Down Tactical Artifact | PASS_PRODUCT_UI | Minimal scaffold feel; stage supports the central board. |
| Precision Command Stage | WARN_DEV_HUD | Useful technical clarity, but the cockpit treatment is the closest to debug/HUD dominance. |

## 12. Winner Decision

Winner result:

`STRICT_WINNER_READY_TO_REVIEW`

Selected winner:

`Strict Feedback Arena`

Why it won:

- It preserves the strongest A20J lineage without inheriting the old board distortion.
- It passes strict chessboard fidelity at tested desktop widths.
- It passes anti-spoiler semantics in all pre-feedback states.
- It has the clearest post-feedback energy without fake gamification.
- It feels more like a board-centered arena than a dashboard or CSS demo.
- It keeps the board as the hero while allowing the surrounding stage to carry state emotion.

Rejected as winner:

- `Top-Down Tactical Artifact`: strong taste alignment and atmosphere, but weaker feedback clarity.
- `Precision Command Stage`: strong instrument clarity, but carries the most dev-HUD visual debt.

Feedback Arena lineage remains valid as a direction only through the A20J3 strict rework. The original A20J branch remains `NEEDS_REWORK` and should not be consolidated.

## 13. Deterministic Hard Gates Over Subjective Scores

The tournament used subjective design scoring only after hard gates passed. This matters because A20J proved that permissive taste scores and weak visual-provider output can overrate a prototype that violates chess fidelity.

A20J3 selection rule:

- Chessboard fidelity failure blocks the variant.
- Anti-spoiler failure blocks the variant.
- Cheap UI / dev-HUD dominance blocks or downgrades the variant.
- Gemini or autonomous PASS cannot override deterministic hard-gate failure.

Gemini was not called during this mission. No Gemini override was needed because deterministic checks and browser evidence were sufficient for this DEV-only rework tournament.

## 14. Remaining Visual Debt

- The prototype is still DEV-only and not wired to real chess review state.
- Future consolidation must decide whether `Strict Feedback Arena` becomes the reference direction, a route preview, or a reusable component.
- Future strict Gemini review can be rerun with A20K context, but must not override hard gates.
- Piece styling is readable, but product integration should evaluate whether symbolic letters remain sufficient or need an approved internal piece system.
- The DEV-only route must stay hidden until a dedicated consolidation mission decides how to handle it.

## 15. Recommended Next Mission

Recommended next mission:

`A20L_3D_BOARD_STAGE_STRICT_WINNER_CONSOLIDATION_PLAN`

Purpose:

- Plan how to consolidate `Strict Feedback Arena` safely without merging it directly to `road-to-V2`.
- Decide whether the DEV-only strict route should remain a reference branch, become a branch-local component library seed, or feed a future product-safe Decision Arena mission.
- Preserve A20K firewall gates as mandatory acceptance criteria.

## 16. A21 Not Launched

A21 was not launched.

Night Mode was not launched.

## 17. No Product Code Merged To Road

No product code was merged to `road-to-V2`.

The mission branch remains separate. `road-to-V2` remains protected from DEV-only prototype code until an explicit future consolidation mission.
