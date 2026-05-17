# A20M Visual Court And All-Night Readiness Gate

Date: 2026-05-18

## 1. Mission Summary

A20M reviewed the A20L DEV-only North Star Board Stage evidence and assessed
whether the automation system is ready for a controlled long run.

This mission did not implement product features, did not merge A20L, did not
launch A21, did not launch Night Mode, and did not start an all-night run.

Mission branch:

`auto/a20m-visual-court-and-all-night-readiness-gate-20260518`

## 2. Source Branches And Commits

- Protected road branch: `road-to-V2`
- Road HEAD at precheck: `7a71b0e`
- `origin/road-to-V2` at precheck: `7a71b0e`
- A20L source branch: `auto/a20l-revolutionary-board-stage-art-direction-upgrade-20260518`
- A20L source commit: `2d27527`
- A20L route reviewed: `/app?boardStageNorthStar=1`

## 3. Evidence Inspected

External evidence root:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\board_stage_tournaments\A20L_revolutionary_board_stage_upgrade_20260518`

Inspected image evidence:

- `contact_sheet_northstar_states.png`
- `contact_sheet_before_after_a20j3_vs_a20l.png`
- `northstar_observe_1366.png`
- `northstar_try_before_feedback_1366.png`
- `northstar_feedback_miss_1440.png`
- `northstar_reduced_motion_1440.png`
- `northstar_2d_fallback_1440.png`

Inspected JSON/text evidence:

- `visual_ambition_score.json`
- `sacred_board_contract_check.json`
- `anti_spoiler_check.json`
- `browser_smoke_report.json`
- `manifest.json`
- `console_log.txt`

No screenshots, contact sheets, or QA artifacts were copied into the repo.

## 4. Visual Court Methodology

The Visual Court used three bounded judges:

- Chess Arbiter: strict board readability and anti-spoiler semantics only.
- Product Director: product credibility, clarity, usability, and anti-generic fit.
- Art Director: memorability, premium feeling, emotional force, and North Star
  potential.

The review used deterministic A20K gates first. Subjective taste and ambition
scores are allowed only after chessboard fidelity and anti-spoiler semantics
pass.

Gemini was not rerun. The mission used existing screenshot evidence and local
deterministic artifacts only.

## 5. Chess Arbiter Verdict

Verdict: `CHESS_FIDELITY_PASS`

Reasons:

- The board reads as a true 8x8 grid in all inspected states.
- The board is top-down, with no trapezoid distortion.
- The A20L smoke reports 64 visible squares and square board geometry at 1366,
  1440, and 1920 widths.
- `observe` and `try_before_feedback` have no board trace, line, arrow, target,
  destination glow, or candidate path.
- Decorative chamber geometry stays outside the playing surface.
- Post-feedback traces appear only in `feedback_success`, `feedback_miss`, and
  `replay`.

Minor watch item:

- Unicode pieces are materially better than A20J3 letter discs, but future
  consolidation should still evaluate whether bespoke internal piece styling is
  needed for product polish.

## 6. Product Director Verdict

Verdict: `PRODUCT_GRADE_WITH_DEBT`

Reasons:

- The first viewport now feels like a serious desktop chess learning screen,
  not a generic SaaS dashboard or Stockfish GUI clone.
- The board is central and readable.
- The visible control panels are product-like enough for a DEV-only North Star
  review, but still visibly prototype-oriented.
- The route is not wired to real Review or Practice state, so it is not a
  consolidation target by itself.
- There are no fake XP, rank, Elo, Transfer, fake neuroscience, or fake
  Practice-ready claims.

Product debt:

- The right state selector and left current-state panel are still too prominent
  for public hero use.
- The screen remains an internal product prototype, not a user-facing V1 route.

## 7. Art Director Verdict

Verdict: `REVOLUTIONARY_CANDIDATE`

Reasons:

- A20L is a visible leap over A20J3: the tournament chrome is gone, the chamber
  has a stronger sense of place, and the board reads more like an artifact.
- The surrounding stage carries atmosphere without polluting the board core.
- State color and language distinguish calm observation, contained effort,
  insight, reorientation, and replay memory.
- The miss state is corrective and non-humiliating.
- The direction now feels like NeuroChess has a distinct visual ambition.

Limit:

- This is not yet `GAME_CHANGER_PASS`. It is a credible North Star candidate
  that deserves human visual review before any long-term design consolidation.

## 8. Artifact Adversarial Review

| State | What crosses or touches the board | Hint risk | Visual defects searched | Result |
|---|---|---|---|---|
| observe | Nothing crosses the board. Board surface is clean. | None found. | Board geometry, piece readability, decorative overlap, DEV residue. | Pass. Side panels remain prototype-visible. |
| try_before_feedback | Nothing crosses the board. State energy stays in the frame and stage. | None found. | Destination glow, candidate line, answer path, target square. | Pass. The state relies partly on headline and panel text. |
| feedback_success | Green trace crosses the board only post-feedback. | Acceptable because state is after effort. | Trace clarity, board obstruction, fake reward language. | Pass. Trace is clear but still simple. |
| feedback_miss | Orange correction trace crosses the board only post-feedback. | Acceptable because state is after effort. | Punitive mark, crude failure language, piece hiding. | Pass with minor debt. The reorientation idea is better than A20J3, but can be more elegant. |
| replay | Purple memory path appears only post-feedback. | Acceptable because replay follows feedback. | Confusion with pre-feedback hint, board obstruction. | Pass. Replay is understandable but still prototype-simple. |
| reduced motion | Board remains clean; stage motion is subdued. | None found. | Accessibility fallback, board readability. | Pass. |
| 2D fallback | Board remains clean; surrounding stage recedes. | None found. | Usability if visual richness fails. | Pass. |

Defects not found:

- No pre-feedback solution trace.
- No pre-feedback candidate line.
- No pre-feedback destination glow.
- No decorative artifact on the board core.
- No generic metric dashboard.
- No fake gamification or fake science claims.

Remaining weaknesses:

- The screenshot is still an internal prototype surface.
- It is strong enough to review, but not strong enough to call public marketing
  ready.
- The post-feedback trace language is clear, but not yet a final NeuroChess
  teaching language.

## 9. Public Screenshot Shame Test

Classification: `INTERNAL_NORTH_STAR_CANDIDATE`

Would it make a serious chess player curious?

Yes, especially compared with the previous tournament UI. It looks like a
distinct chess-learning chamber rather than a stock analysis dashboard.

Would it embarrass the project if shared publicly?

Not as an internal prototype. It should not be shared as a final public hero
because the control panels and prototype route context are still visible.

Does it look like a real future product or an experimental prototype?

It looks like a real future product direction inside an experimental prototype.
That distinction matters: it deserves review, not production consolidation.

## 10. Final A20L Visual Classification

Final classification:

`REVOLUTIONARY_CANDIDATE_CONFIRMED_FOR_HUMAN_REVIEW`

This means:

- A20L is visually strong enough to be treated as a serious North Star
  direction.
- A20L deserves human visual review.
- A20L may inform future design missions.
- A20L is not automatically accepted as final.
- A20L is not ready for product merge or road consolidation.

## 11. Consolidation And Design Mission Impact

A20L deserves consolidation planning only as a future planning mission after
human visual review. It should not be merged, wired into V1, or used as a
reason to bypass A20K visual gates.

A20L should allow future design missions with restrictions:

- preserve the Sacred Board Contract;
- preserve A20K strict chessboard fidelity;
- preserve anti-spoiler semantics;
- keep visual ambition evidence-based;
- do not label a design `GAME_CHANGER_PASS` without screenshot and human review;
- do not run unbounded visual tweaking during long runs.

## 12. All-Night Readiness Checklist

| Area | Required capability | Status | Notes |
|---|---|---|---|
| Policy Kernel Freeze | `docs/autopilot/POLICY_KERNEL_FREEZE.md` | PASS | Kernel change detection exists conceptually and in ops policy. |
| Budget/Quota Meter | `docs/autopilot/BUDGET_QUOTA_METER.md` | PASS | Tracks live-call, evidence, branch, and runtime counters. |
| Kill Switch | `docs/autopilot/KILL_SWITCH_FILE_PROTOCOL.md` | PASS | `ops/autopilot/STOP_NOW` protocol exists. |
| Evidence Index | `docs/autopilot/EVIDENCE_INDEX_PROTOCOL.md` | PASS | External JSONL index protocol exists. |
| Branch Orthogonality | `docs/autopilot/BRANCH_ORTHOGONALITY_POLICY.md` | PASS | File-lock and overlap policy exists. |
| Environment Hygiene | `docs/autopilot/ENVIRONMENT_HYGIENE_PROTOCOL.md` | PASS | Check-only hygiene protocol exists. |
| Visual Halting Limit | `docs/autopilot/VISUAL_HALTING_LIMIT.md` | PASS | Prevents repeated CSS tweaking. |
| Visual Firewall | A20K strict visual docs and tests | PASS | Hard gates override visual-provider pass. |
| Sacred Board Contract | `docs/design/SACRED_BOARD_CONTRACT.md` | PASS | A20L was built against it. |
| Design Ambition Framework | `docs/design/NEUROCHESS_VISUAL_AMBITION_FRAMEWORK.md` | PASS | Defines ambition levels. |
| Objective Reservoir | `docs/autopilot/OBJECTIVE_RESERVOIR_PROTOCOL.md` plus A21 draft | PASS_WITH_DRAFT | A21 draft is created in this mission. |
| Marginal Value Gate | `docs/autopilot/MARGINAL_VALUE_GATE.md` | PASS | Rejects filler and cosmetic churn. |
| Drain Permit Policy | `docs/autopilot/DRAIN_PERMIT_POLICY.md` | PASS | Prevents early drain and unsafe continuation. |

## 13. Objective Reservoir Assessment

The reservoir system is conceptually ready, and this mission creates a concrete
future A21 draft:

`docs/autopilot/A21_OBJECTIVE_RESERVOIR_DRAFT.md`

Assessment:

- Objectives are product-safe and branch-isolated.
- No objective requires product data mutation.
- No objective requires package mutation.
- No objective requires a direct road merge.
- Visual objectives must preserve the A20K firewall and Sacred Board Contract.
- Backend work is limited to read-only proof only.

Remaining weakness:

- The reservoir should be rehearsed in a limited run before a full all-night
  product-safe run.

## 14. Final All-Night Readiness Verdict

Final verdict:

`GO_FOR_LIMITED_3H_REHEARSAL`

Rationale:

- A20L is strong enough to unblock a limited design/product-safe rehearsal.
- Safety policies, budget controls, kill switch, evidence, branch policy, visual
  firewall, and objective reservoir are present.
- A false full-run GO would be worse than a delayed GO.
- The system should prove it can sustain dynamic objectives, visual gates, and
  branch safety over a bounded rehearsal before a true all-night run.

Not approved yet:

- Full all-night A21.
- Product merge to `road-to-V2`.
- Runtime human design approval dependency.
- Visual missions that bypass A20K hard gates.

## 15. Required Restrictions For A21 If Allowed Later

- Use one queue item per mission.
- Use one controlled diff per branch.
- Use branch isolation and explicit path contracts.
- Never mutate Practice, `due_at`, Daily Plan, `training_items`,
  `practice_attempts`, scoring/results, or DB state unless a future mission
  explicitly authorizes it.
- Never touch package files unless the mission is dedicated to package changes.
- Never auto-merge product code to `road-to-V2`.
- Never call a visual result `GAME_CHANGER_PASS` without screenshot evidence and
  strict visual review.
- Do not rely on Gemini or autonomous scoring when deterministic visual gates
  fail.
- Use A20K hard visual gates for every board-stage visual branch.
- Preserve evidence outside the repo and index required artifacts.
- Enter DRAIN when budget, hygiene, branch overlap, kill switch, or marginal
  value gates require it.

## 16. Explicit Non-Execution Statements

A21 was not launched.

Night Mode was not launched.

An all-night run was not started.

`road-to-V2` was not pushed.

`road-to-V2` was not merged.

Live ChatGPT was not called.

Live Gemini was not called.

No product mission was executed.

No backend files, package files, screenshots, images, QA artifacts, DB files, or
product data were committed.

## 17. Recommended Next Mission

Recommended next mission:

`A20N_LIMITED_3H_ALL_NIGHT_REHEARSAL`

Purpose:

- rehearse the A21 control loop for a bounded duration;
- use the A21 objective reservoir draft;
- prove dynamic objective replanning, evidence indexing, branch isolation,
  visual firewall enforcement, budget governance, and DRAIN behavior under
  realistic pressure;
- still avoid product merge to `road-to-V2` unless a later explicit mission
  authorizes it.
