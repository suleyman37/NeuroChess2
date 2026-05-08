# Metrics And Algorithms Validation Harness V1

Mission: `P1.METRICS-AND-ALGORITHMS-VALIDATION-HARNESS-V1`

Status: validation harness only. This mission adds deterministic fixtures,
backend tests, and documentation. It does not change formulas, thresholds,
Stockfish, PV5 behavior, Review moment filtering, training item selection,
Daily Plan, `due_at`, UI, LLM, or Candidate Trainer.

## What Is Validated

The harness validates representative NeuroChess metric and routing contracts:

- `eval_cp` and `mate_in` are interpreted as White POV.
- White and Black player Win% are symmetric conversions from White POV.
- `win_loss` is measured in player Win% percentage points.
- move accuracy stays bounded and decreases as win loss grows.
- mate values use explicit mate overrides and do not rely on naive centipawn
  conversion.
- legal out-of-list try moves are classified only with stable resulting-position
  evidence.
- missing stable evidence returns `needs_rebuild`, not false `wrong`.
- PV5 candidates are accepted only when close enough to the best move.
- low-impact opening/equal-position drift is not forced as priority training.
- early tactical mistakes can still be priority training.
- meaningful middlegame and conversion losses become priority training.
- already-lost small losses remain non-priority.
- good decisions can be recognized without becoming forced retry items.
- no-major Review state is honest when only micro-gaps/good decisions exist.
- micro-gap, informational, and good-decision moments do not create forced
  Review Practice items by default.
- simple V1 `due_at` semantics are unchanged for soft results and success/fail
  results.

## What Is Not Validated

- No live Stockfish call is made.
- No external Lichess/Stockfish reference corpus is used.
- No formula calibration is performed.
- No threshold changes are proposed.
- No frontend/browser UI is validated by this harness.
- No real full-game annotated corpus is validated.
- No transfer validation is claimed.
- No explicit forced-recapture/triviality detector is proven beyond the safe
  non-priority fallback case.
- Good-decision validation remains inferential because durable `positive_gain`
  is not yet persisted as a first-class field.

## Golden Case List

| case_id | Risk Covered | Expected Contract |
|---|---|---|
| `pov_symmetry_white` | Wrong POV for White | White player receives White POV Win%. |
| `pov_symmetry_black` | Wrong POV for Black | Black player receives `100 - white_percent`. |
| `near_equal_micro_drift` | Equal-position noise | `micro_gap`, not priority. |
| `opening_harmless_preference` | Opening noise | low-impact opening preference is `micro_gap`. |
| `early_tactical_real_blunder` | Over-filtering early moves | early tactical loss is `priority_training`. |
| `legal_outside_list_playable` | Legal outside list = wrong | stable playable-band move is `playable`. |
| `legal_outside_list_imprecise` | Moderate legal outside-list loss | stable band is `imprecise`. |
| `legal_outside_list_wrong` | Meaningful legal outside-list loss | stable band is `wrong`. |
| `accepted_close_pv5_candidate` | PV5 alternative handling | close candidate is `acceptable`. |
| `pv5_candidate_not_close_enough` | PV5 over-acceptance | far candidate is not accepted automatically. |
| `stable_evaluation_unavailable` | False wrong from missing data | result is `needs_rebuild`. |
| `meaningful_middlegame_mistake` | Missed real training moment | meaningful loss is `priority_training`. |
| `already_lost_small_further_loss` | Overtraining lost positions | non-priority `secondary_training`. |
| `winning_position_throws_win` | Conversion blunder | priority training. |
| `good_decision_non_trivial` | Ignoring good decisions | `good_decision`, no forced retry. |
| `trivial_forced_recapture` | Trivial exercise risk | safe informational fallback. |
| `hard_only_move_defensive_resource` | Filtering hard resources | `good_decision`, not trivialized. |
| `clean_high_accuracy_no_major` | Fake challenge in clean game | no-major state. |
| `training_item_safety_non_training_categories` | Overtraining micro/good/info | only priority item enters Practice. |
| `daily_plan_safety_due_at_unchanged` | Scheduling pollution | existing V1 due delays unchanged. |
| `mate_terminal_edge_case` | Mate/terminal crash | mate overrides stay bounded and priority-safe. |

## Expected Behavior Table

| Domain | Expected Behavior |
|---|---|
| POV | `eval_cp` is White POV; player POV is derived from mover color. |
| Win% | Values are 0-100, not 0-1. |
| Win loss | `max(0, before - after)` in player Win% percentage points. |
| Move accuracy | Bounded 0-100 and monotonic with loss. |
| Try move | Best/accepted candidates succeed; legal unknown moves require stable eval. |
| Stable fallback | Missing stable eval gives `needs_rebuild`. |
| PV5 | Close alternatives can be accepted; far alternatives are not automatically accepted. |
| Moment importance | Categories are user-safe labels, not raw numeric scores. |
| Micro-gaps | Low-impact/balanced/book-ish moments do not become forced exercises. |
| Good decisions | Recognized as consolidation material, not retry failures. |
| Training items | Only training-recommended priority moments are forced by default. |
| Daily Plan | The harness verifies no semantic change to simple V1 due delays. |

## Known Limitations

- Thresholds remain heuristic and require annotated corpus calibration.
- The fixture matrix is synthetic and deterministic by design; it is not a
  real-game empirical validation.
- `positive_gain` persistence remains future work, so good-decision detection
  uses quality/category and `strong_find` signals.
- Trivial/forced move detection is not a dedicated algorithm today.
- Daily Plan safety is tested at the schedule helper/Practice filtering layer,
  not by a new browser smoke.

## Thresholds Requiring Future Calibration

- Review move category bands in `move_categories.py`.
- Try-move delta bands in `try_move.py`.
- Review criticality threshold, NMS/top-k, and low-impact opening gates in
  `review_service.py`.
- Moment importance routing thresholds in `review_moment_importance.py`.
- Future good-decision thresholds once `positive_gain` is persisted.
- Future forced/trivial detector if NeuroChess wants to separate trivial forced
  moves from genuinely hard only-move resources.

## Recommended Future Missions

1. `P1.METRICS-CALIBRATION-CORPUS-SEED-V1`
   Build a small annotated corpus of real game moments and compare current
   routing against coach labels.

2. `P1.POSITIVE-GAIN-PERSISTENCE-V1`
   Persist explicit `positive_gain` and validate good-decision mining without
   relying only on inferred quality.

3. `P1.FORCED-TRIVIAL-MOVE-DETECTOR-V1`
   Add an explicit non-spoiler, backend-authoritative detector for trivial
   forced recaptures versus hard only-move defensive resources.

4. `P1.METRIC-THRESHOLD-REGRESSION-DASHBOARD-INTERNAL`
   Internal-only, non-user-facing audit report for threshold drift across a
   curated fixture set.

## Protection Against Regressions

Wrong POV:

- White and Black symmetry cases fail if White POV is accidentally treated as
  side-to-move or player POV.

Opening noise:

- Near-equal and book/opening cases fail if harmless drift becomes priority
  training.

Legal-outside-list = wrong:

- Playable/imprecise/wrong stable cases and stable-unavailable case fail if
  legal out-of-list moves are blindly punished.

Fake good decisions:

- Good-decision fixtures verify only safe inferred categories are surfaced, and
  future corpus work is documented instead of overclaiming.

Overtraining micro-gaps:

- Practice item filtering tests fail if micro-gap, informational, or
  good-decision moments create forced retry items.

Due-at pollution:

- Scheduling tests fail if soft result bands or moment categories change simple
  V1 due delays.
