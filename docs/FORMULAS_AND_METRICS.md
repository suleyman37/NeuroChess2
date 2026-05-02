# NeuroChess2 Formulas and Metrics

This document is the scientific governance layer for NeuroChess2 formulas.
It documents what is implemented now, what is heuristic, what is future, and
what must remain research-only.

This is a docs-only canon. It does not change formulas in code.

## Mandatory Rules

- Do not invent a formula to make a metric look more mature.
- If the code has an implementation, document the real implementation.
- If a formula is conceptual or future, mark it as future.
- If a metric is heuristic, mark it as `heuristic_v0` or `needs_corpus`.
- If a metric is not calibrated, never describe it as scientific truth.
- If a metric drives training, it must have a calibration plan.
- If a metric is communication-only, it must not drive training.
- If a metric is research-only, it must not appear in normal user UI.
- Do not merge different metric families without explicit versioning.
- Prefer honest uncertainty over impressive formulas.
- Any metric visible to users must be simple, understandable, and honest.

## Formula Families

1. Public reliable math
   - User-facing precision score.
   - Understandable, comparable, stable, and cloneable.

2. Internal useful math
   - Moment selection, diagnostic, and training preparation.
   - Useful without being shown directly.

3. Future math
   - Bayesian Transfer Gap.
   - Expected Training Value.
   - Difficulty Fit.
   - User Skill Model.

4. Research-only math
   - Creativity, plan scoring, embeddings, causal claims, HMMs, advanced bandits,
     full IRT/BKT/FSRS.

## Product Decision: NeuroScore

The product should keep a motivating visible score named `NeuroScore`.

`NeuroScore` visible means:

- coach communication score;
- severity-aware blend of Lichess-like precision and NeuroDiagnostic score;
- backed by the existing `headline_neurochess_score_v1` implementation and
  exposed as `coach_neuro_score_v1`;
- useful for user motivation and coaching friction, not a scientific truth.

`NeuroScore` visible must not mean:

- a neurological score;
- a brain score;
- an opaque diagnostic score;
- a raw Diagnostic Gap;
- a calibrated medical/scientific measurement.

The training diagnostic remains separate:

- `NeuroDiagnostic` or `neuro_severity_raw` is internal, audit, and training-facing.
- `diagnostic_gap` is audit-only.
- Lichess-like precision is the reference precision score, displayed
  separately from the coach NeuroScore.

Target UI semantics:

```text
NeuroScore 82 / 100
Coach score, corrected by critical moments.
Reference precision: 89%.
Tactically fragile game.
Priority: Tactical.
Action: Train.
```

Do not show in the main UI:

- NeuroDiagnostic;
- Diagnostic Gap;
- Headline Score;
- raw criticality;
- raw domain scores.

## Formula Registry

### 1. white_percent_lichess_v1

- formula_id: `white_percent_lichess_v1`
- version: `lichess_like_white_percent_v1`
- implementation_status: `implemented_now`
- purpose: communication / base public score
- inputs: `eval_cp`, `mate_in`
- output: `white_percent` in `[0, 100]`
- formula:
  - If `mate_in > 0`, `white_percent = 100`.
  - If `mate_in < 0`, `white_percent = 0`.
  - If `mate_in == 0`, current code returns `50`.
  - Otherwise:

```text
white_percent = 100 / (1 + exp(-0.00368208 * eval_cp))
```

- interpretation: approximate winning-chance display from White's point of view.
- used_by: review scoring, evaluation display, win-loss calculations.
- calibration_status: `external_reference / lichess_like`
- limitations:
  - Not a universal win probability.
  - Semantics come from a Lichess-like human-calibrated display family.
  - May diverge if Lichess changes its formula.
  - Future Stockfish WDL must stay a separate audit family.
- example: `eval_cp = 0` gives `50`; `mate_in > 0` gives `100`.
- registry_link: `white_percent_v1`
- source_semantics:
  - `eval_cp` stored in NeuroChess must be POV White.
  - If an engine source returns POV side-to-move, convert before storage.
  - Current source files: `backend/neurochess/metrics/review_metrics.py` and
    `backend/neurochess/core/evaluation_display.py`.

### 2. player_win_percent_lichess_v1

- formula_id: `player_win_percent_lichess_v1`
- version: `player_pov_win_percent_v1`
- implementation_status: `implemented_now`
- purpose: communication / base public score
- inputs: `white_percent`, `player_color`
- output: player POV win percent in `[0, 100]`
- formula:

```text
if player_color == white:
    P = white_percent
if player_color == black:
    P = 100 - white_percent
```

- interpretation: converts the White POV display to the player who made the move.
- used_by: `win_loss_lichess_v1`, `criticality_score_v1`, Review audit rows.
- calibration_status: `external_reference / lichess_like`
- limitations: inherits the limitations of `white_percent_lichess_v1`.
- example: `white_percent = 70`, Black POV gives `30`.
- registry_link: `win_loss_v1`
- source_semantics: player color must be the mover color, not side-to-move after the move.

### 3. win_loss_lichess_v1

- formula_id: `win_loss_lichess_v1`
- version: `win_percent_loss_v1`
- implementation_status: `implemented_now`
- purpose: base common metric
- inputs: `P_before`, `P_after`
- output: loss of player win percent in `[0, 100]`
- formula:

```text
win_loss = max(0, P_before - P_after)
```

- interpretation: how many winning-chance points the mover lost.
- used_by: move accuracy, game accuracy, criticality, move categories.
- calibration_status: `external_reference / lichess_like`
- limitations:
  - Does not reward improvements; it only measures loss.
  - Sensitive to evaluation quality and mate handling.
- example: `P_before = 62`, `P_after = 49`, `win_loss = 13`.
- registry_link: `win_loss_v1`
- source_semantics: POV is always the player who made the move.

### 4. move_accuracy_lichess_v1

- formula_id: `move_accuracy_lichess_v1`
- version: `lichess_exp_uncertainty_v1`
- implementation_status: `implemented_now`
- purpose: communication
- inputs: `win_loss`
- output: move accuracy in `[0, 100]`
- formula:

```text
move_accuracy = clamp(
    103.1668100711649 * exp(-0.04354415386753951 * max(0, win_loss))
    - 3.166924740191411
    + 1,
    0,
    100
)
```

- interpretation: exponential conversion from loss of win chances to a familiar
  0-100 move precision score.
- used_by: public game accuracy, Review audit rows, move categories.
- calibration_status: `external_reference / lichess_like`
- limitations:
  - The `+1` adjustment exists in current code and is documented here explicitly.
  - This is a communication metric, not a skill model.
- example: `win_loss = 0` clamps to `100`; larger loss decays exponentially.
- registry_link: `move_accuracy_lichess_like_v1`
- source_semantics: implemented in `backend/neurochess/metrics/review_metrics.py`.

### 5. game_accuracy_lichess_like_v1

- formula_id: `game_accuracy_lichess_like_v1`
- version: `lichess_weighted_harmonic_v1`
- implementation_status: `implemented_now`
- purpose: communication
- inputs: analyzed moves with `move_accuracy`, `player_percent_before`,
  `player_percent_after`
- output: game/player accuracy in `[0, 100]`
- formula:

```text
n = number of analyzed moves
window_size = clamp(floor(n / 10), 2, 8)

For each move i:
    local_values = player win percents before/after inside the local window
    volatility_i = population_stdev(local_values)
    weight_i = clamp(volatility_i, 0.5, 12.0)

weighted_mean = sum(move_accuracy_i * weight_i) / sum(weight_i)
harmonic_mean = n / sum(1 / max(move_accuracy_i, 0.000001))
game_accuracy = clamp((weighted_mean + harmonic_mean) / 2, 0, 100)
```

- interpretation: public precision score across the analyzed game/player moves.
- used_by: Review score payload as `*_lichess_like_accuracy` and legacy
  `*_review_score` alias.
- calibration_status: `heuristic_v0 / lichess_like`
- limitations:
  - It is Lichess-like, not documented as an exact Lichess clone.
  - Local volatility weighting is implementation-specific.
  - Short or quiet games can still be noisy.
- example: a game with all moves near `100` produces a high public score.
- registry_link: `game_accuracy_lichess_like_v1`
- source_semantics: implemented in `lichess_like_game_accuracy`.

### 6. neuro_score_public_v1

- formula_id: `neuro_score_public_v1`
- version: `public_neuro_score_lichess_like_v1`
- implementation_status: `implemented_now`
- purpose: communication
- inputs: `game_accuracy_lichess_like_v1` or a future validated
  `game_accuracy_lichess_v1`
- output: reference precision score in `[0, 100]`
- formula:

```text
public_neuro_score = public game precision score
```

Current product target:

```text
public_neuro_score = game_accuracy_lichess_like_v1
```

- interpretation: reference precision score displayed near the coach NeuroScore.
- used_by: Review score details and reference precision line.
- calibration_status: `heuristic_v0` until exact reference validation.
- limitations:
  - Does not drive training.
  - Does not summarize all diagnosis.
  - Is not neurological.
  - Is not proprietary scientific proof.
  - Measures precision through loss of Win%.
- example: `Precision de reference : 82 %` means public precision score.
- registry_link: `neuro_score_public_v1`
- source_semantics: current payload fields `*_public_neuro_score`.

### 7. qualitative_game_label_v1

- formula_id: `qualitative_game_label_v1`
- version: `qualitative_review_summary_v1`
- implementation_status: `heuristic`
- purpose: communication
- inputs: coach score, public reference precision, review sections, tags, critical moments
- output: human-readable game label or summary sentence
- formula:

```text
Rules are transparent heuristic predicates over:
- coach score bands
- public precision as a secondary reference signal
- repeated tags such as conversion_issue, cluster, missed_opportunity
- presence of priority moments
```

Target labels include:

- `Solid game`
- `Irregular game`
- `Fragile game`
- `Won despite errors`
- `Swing game`
- `Tactical game`
- `Poorly converted game`
- `Difficult defensive game`

- interpretation: summarizes the pattern without claiming scientific diagnosis.
- used_by: Review summary text.
- calibration_status: `heuristic_v0`
- limitations:
  - Needs calibration against human labels.
  - Must stay qualitative.
- example: high accuracy and few moments can map to `Solid game`.
- registry_link: `qualitative_game_label_v1`
- source_semantics: current code uses `_build_review_summary_sentence`.

### 8. leverage_weight_v1

- formula_id: `leverage_weight_v1`
- version: `criticality_leverage_weight_v1`
- implementation_status: `implemented_now`
- purpose: action
- inputs: `player_percent_before`
- output: multiplier
- formula:

```text
leverage_weight =
    0.75 + 0.5 * (P_before * (100 - P_before) / 2500)
```

- interpretation: positions around 50 percent receive more weight than already
  decided positions.
- used_by: `criticality_score_v1`
- calibration_status: `needs_corpus`
- limitations:
  - Heuristic.
  - Needs annotated corpus validation.
- example: `P_before = 50` gives `1.25`; `P_before = 0` gives `0.75`.
- registry_link: `leverage_weight_v1`
- source_semantics: implemented in `review_service.leverage_weight`.

### 9. transition_weight_v1

- formula_id: `transition_weight_v1`
- version: `criticality_transition_weight_v1`
- implementation_status: `implemented_now`
- purpose: action
- inputs: `zone_before`, `zone_after`, `mate_event`
- output: multiplier
- formula:

```text
if mate_event: 1.40
same zone in won/winning/lost: 0.80
won -> winning: 0.85
winning -> better: 0.90
better/winning/won -> worse/losing/lost: 1.40
balanced -> worse: 1.35
balanced -> losing/lost: 1.40
better -> balanced: 1.25
worse -> losing: 1.15
losing -> lost: 1.10
default: 1.00
```

Player zones are:

```text
>= 90 won
>= 75 winning
>= 60 better
>= 40 balanced
>= 25 worse
>= 10 losing
else lost
```

- interpretation: weights changes in game state, not only magnitude of loss.
- used_by: `criticality_score_v1`, moment type labels.
- calibration_status: `needs_corpus`
- limitations:
  - Heuristic boundaries.
  - Needs annotated transition validation.
- example: `balanced -> worse` multiplies by `1.35`.
- registry_link: `transition_weight_v1`
- source_semantics: implemented in `review_service.transition_weight`.

### 10. persistence_weight_v1

- formula_id: `persistence_weight_v1`
- version: `criticality_persistence_weight_v1`
- implementation_status: `implemented_now`
- purpose: action
- inputs: `player_percent_before`, `immediate_loss`, next player win percents
- output: multiplier
- formula:

```text
future_avg = average(player Win% over next 10 plies when available)
persistent_loss = max(0, P_before - future_avg)
ratio = clamp(persistent_loss / max(immediate_loss, 1), 0, 1)
persistence_weight = 0.75 + 0.5 * ratio
```

If no future percents exist:

```text
persistence_weight = 1.0
```

- interpretation: observed persistence in post-game review.
- used_by: `criticality_score_v1`
- calibration_status: `needs_corpus`
- limitations:
  - This is observed persistence, not pure causal persistence.
  - It uses future positions and is valid only post-game.
  - It is not valid in live analysis.
  - If the opponent gives the advantage back, persistence can be reduced.
- example: a loss that remains in the next positions receives more weight.
- registry_link: `persistence_weight_v1`
- source_semantics: implemented in `review_service.persistence_weight`.

### 11. reliability_weight_v1

- formula_id: `reliability_weight_v1`
- version: `review_moment_reliability_weight_v1`
- implementation_status: `implemented_now`
- purpose: action / audit
- inputs: reliability scores attached to before/after analyses
- output: multiplier
- formula:

Current moment selection formula:

```text
known_scores = reliability_score(before), reliability_score(after)
if no known_scores:
    reliability_weight = 0.8
elif min(known_scores) < 0.75:
    reliability_weight = 0.7
else:
    reliability_weight = 1.0
```

Underlying analysis reliability currently scores depth, MultiPV/top-move
availability, PV legality, and mate presence in `analysis_reliability_v1`.

Product governance target:

```text
required review profile satisfied, complete, current pipeline: 1.0
required profile satisfied but weak quality signals / timeout / low nodes: 0.8
legacy compatible but not current quality gate: 0.5 or not candidate
live/shallow only: not candidate
missing analysis: not candidate
```

- interpretation: weak analysis evidence should not select moments with full force.
- used_by: `criticality_score_v1`
- calibration_status: `heuristic_v0 / needs_corpus`
- limitations:
  - Current implementation is heuristic.
  - It is not a statistical confidence interval.
  - Future revisions must depend on required Review profile satisfaction.
- example: before/after scores both high gives `1.0`; one low score gives `0.7`.
- registry_link: `reliability_weight_v1`
- source_semantics: implemented in `_moment_reliability` and
  `core/analysis_reliability.py`.

### 12. criticality_score_v1

- formula_id: `criticality_score_v1`
- version: `moment_selection_criticality_v4`
- implementation_status: `implemented_now`
- purpose: action
- inputs: win loss, leverage, transition, persistence, reliability, novelty,
  mate event
- output: criticality score
- formula:

```text
criticality_score =
    win_loss
    * reliability_weight
    * leverage_weight
    * transition_weight
    * persistence_weight
    * novelty_weight
```

Current `novelty_weight` is set to `1.0`.

Candidate rule:

```text
candidate if mate_event
candidate if criticality_score >= 10.0
mate_event candidates are floored at threshold 10.0
```

Temporal non-maximum suppression:

```text
order candidates by criticality_score descending, then ply ascending
window = 2 plies
override_ratio = 1.5
mate_event can override nearby selected moment
max moments = 5
final selected order = ply ascending
```

- interpretation: internal selection score for Review and Practice moments.
- used_by: Review moments, Practice candidate item ranking.
- calibration_status: `needs_corpus`
- limitations:
  - Must not be shown as a user score.
  - Thresholds and weights are heuristic.
  - Requires annotated corpus validation.
- example: a `balanced -> worse` persistent loss can outrank a similar raw loss
  in an already lost position.
- registry_link: `criticality_score_v1`
- source_semantics: implemented in `review_service.criticality_score` and
  `_select_review_moments`.

### 13. player_review_score_v0

- formula_id: `player_review_score_v0`
- version: `legacy_weighted_review_score_v0`
- implementation_status: `implemented_now`
- purpose: audit / legacy compatibility
- inputs: `(move_accuracy, weight)` pairs
- output: weighted score in `[0, 100]`
- formula:

```text
player_review_score_v0 = sum(move_accuracy_i * weight_i) / sum(weight_i)
```

Current helper for weights:

```text
if criticality is not None:
    weight = 1 + min(4, max(0, criticality) / 20)
else:
    weight = 1 + min(2, max(0, win_loss) / 15)
```

There is also an unused `player_review_score_v1` helper in code:

```text
weighted_mean = sum(weight_i * move_accuracy_i) / sum(weight_i)
weighted_harmonic = sum(weight_i) / sum(weight_i / max(move_accuracy_i, 5))
worst_count = max(1, ceil(0.15 * analyzed_moves))
worst_tail = mean(worst move accuracies)
raw_score = 0.50 * weighted_mean + 0.30 * weighted_harmonic + 0.20 * worst_tail
final_score = min(raw_score, score_cap_from_max_win_loss(max_win_loss))
```

- interpretation: legacy score experiments, not current product direction.
- used_by: compatibility and historical docs; current payload aliases
  `*_review_score` to `lichess_like_accuracy`.
- calibration_status: `heuristic_v0`
- limitations:
  - Legacy.
  - Non-visible.
  - Not strategic product direction.
- example: a critical move can receive a higher weight.
- registry_link: legacy score entries / rejected direction.
- source_semantics: source file `backend/neurochess/review_service.py`.

### 14. neuro_severity_raw_v1

- formula_id: `neuro_severity_raw_v1`
- version: `neuro_diagnostic_regularized_v1_raw`
- implementation_status: `implemented_now`
- purpose: audit / internal diagnostic
- inputs: per-move win loss, future player percents, cluster memory
- output: internal diagnostic loss components
- formula:

For each move:

```text
future_avg = average(next player Win% values over up to 10 plies)
persistent_loss = max(0, player_percent_before - future_avg)
persistence_ratio = clamp(persistent_loss / max(win_loss, 1), 0, 1)
persistence_weight_diag = 1.0 + 0.25 * persistence_ratio

cluster_weight = 1.0 + 0.25 * clamp(cluster_memory / 50, 0, 1)
omega = clamp(persistence_weight_diag * cluster_weight, 1.0, 1.75)
diagnostic_loss = win_loss * omega

cluster_memory_next = 0.6 * cluster_memory + win_loss
```

- interpretation: internal severity before converting to a diagnostic 0-100 score.
- used_by: `neuro_score_diag_v1`, debug score payloads.
- calibration_status: `needs_corpus`
- limitations:
  - Current implementation exists but requires formula stabilization and calibration.
  - Not visible as a main score.
  - Does not drive training until calibrated.
- example: repeated losses can increase `cluster_weight`.
- registry_link: `neuro_severity_raw_v1`
- source_semantics: implemented in `neuro_diagnostic_score`.

### 15. neuro_score_diag_v1

- formula_id: `neuro_score_diag_v1`
- version: `neuro_diagnostic_regularized_v1`
- implementation_status: `implemented_now`
- purpose: audit / internal diagnostic
- inputs: `neuro_severity_raw_v1` move losses
- output: internal diagnostic score in `[0, 100]`
- formula:

```text
tail_count = min(max(3, ceil(0.10 * n_moves)), n_moves)
mean_diagnostic_loss = mean(diagnostic_loss_i)
tail_diagnostic_loss = mean(top tail_count diagnostic_loss_i)
Z = 0.65 * mean_diagnostic_loss + 0.35 * tail_diagnostic_loss
neuro_score_diag = clamp(100 * exp(-0.035 * Z), 0, 100)
```

- interpretation: internal regularized diagnostic score.
- used_by: current dual score payload, diagnostic gap, debug.
- calibration_status: `needs_corpus`
- limitations:
  - Internal/audit only.
  - Must not be the main visible NeuroScore.
  - Not calibrated enough to drive product truth.
- example: higher persistent or clustered diagnostic losses lower the score.
- registry_link: `neuro_score_diag_v1`
- source_semantics: implemented in `review_metric_bundle`.

### 16. diagnostic_gap_v1

- formula_id: `diagnostic_gap_v1`
- version: `diagnostic_gap_v1`
- implementation_status: `implemented_now`
- purpose: audit
- inputs: `lichess_like_accuracy`, `neuro_score_diag`
- output: score difference
- formula:

```text
diagnostic_gap = lichess_like_accuracy - neuro_score_diag
```

- interpretation: audit signal that public precision and internal diagnostic diverge.
- used_by: debug payloads and legacy summary text.
- calibration_status: `needs_corpus`
- limitations:
  - Audit only.
  - A raw difference between two derived scores is not a user truth.
  - Future version should be standardized and calibrated before any product use.
- example: `82 - 70 = 12`.
- registry_link: `diagnostic_gap_v1`
- source_semantics: implemented in `review_metric_bundle`.

### 17. coach_neuro_score_v1 / headline_score_v0

- formula_id: `coach_neuro_score_v1`
- version: current code label `headline_neurochess_score_v1`
- implementation_status: `implemented_now`
- purpose: coach communication / severity-aware UX score
- inputs: `lichess_like_accuracy`, `neuro_score_diag`, optional `diagnostic_gap`
- output: blended score in `[0, 100]`
- formula:

Current code when diagnostic score exists:

```text
headline_score = clamp(
    0.55 * lichess_like_accuracy + 0.45 * neuro_score_diag,
    0,
    100
)
```

Fallback when diagnostic score is missing but diagnostic gap exists:

```text
headline_score = clamp(lichess_like_accuracy - 0.45 * max(0, diagnostic_gap), 0, 100)
```

Fallback when no diagnostic signal exists:

```text
headline_score = clamp(lichess_like_accuracy, 0, 100)
```

- interpretation: visible coach score, severity-aware and not calibrated as
  scientific truth.
- used_by: main Review NeuroScore display via `coach_neuro_score` aliases.
- calibration_status: `heuristic_v0`
- limitations:
  - Restored as a coach communication score after user testing showed pure
    public precision was too flattering.
  - Does not drive training.
  - Must be displayed separately from public reference precision.
  - example: `0.55 * 82 + 0.45 * 70 = 76.6`.
- registry_link: `coach_neuro_score_v1`, legacy alias `headline_score_v0`
- source_semantics: implemented in `headline_neurochess_score`.

### 18. expected_score_wdl_sfXX_v1

- formula_id: `expected_score_wdl_sfXX_v1`
- version: `future_stockfish_wdl_expected_score_v1`
- implementation_status: `future`
- purpose: audit / internal engine metric
- inputs: Stockfish WDL tuple `W`, `D`, `L`
- output: expected score in `[0, 1]`
- formula:

```text
expected_score = (W + 0.5 * D) / (W + D + L)
```

- interpretation: engine WDL expected score from a specific Stockfish version.
- used_by: future audit and calibration comparisons.
- calibration_status: `experimental`
- limitations:
  - Depends on Stockfish version and WDL model.
  - Not the same semantics as Lichess human-calibrated Win%.
  - Must not be merged with `white_percent_lichess_v1`.
- example: `W=300, D=500, L=200` gives `0.55`.
- registry_link: `expected_score_wdl_sfXX_v1`
- source_semantics: future metric from `UCI_ShowWDL`.

### 19. tail_mean_topk_v1

- formula_id: `tail_mean_topk_v1`
- version: `diagnostic_tail_mean_topk_v1`
- implementation_status: `implemented_now`
- purpose: audit
- inputs: diagnostic losses or win losses
- output: mean of largest losses
- formula:

Current diagnostic code:

```text
tail_count = min(max(3, ceil(0.10 * n_moves)), n_moves)
tail_mean_topk = mean(top tail_count losses)
```

Conceptual general version:

```text
k = max(1, ceil(0.10 * n_moves))
tail_mean_topk = mean(top k losses)
```

- interpretation: simple heuristic for worst-tail behavior.
- used_by: `neuro_score_diag_v1`
- calibration_status: `heuristic_v0`
- limitations:
  - Do not call this robust CVaR.
  - `CVaR_90` / Expected Shortfall is not recommended for short-game UI.
  - Best future version should add bootstrap confidence intervals.
- example: in 30 moves, current code uses top 3 losses.
- registry_link: `tail_mean_topk_v1`
- source_semantics: implemented inside `neuro_diagnostic_score`.

### 20. domain_scores_v1

- formula_id: `domain_scores_v1`
- version: `domain_transfer_beta_family_v1`
- implementation_status: `future`
- purpose: action
- inputs: domain-tagged review moments, practice result events, future real-game
  opportunities
- output: domain estimates with uncertainty
- formula:

Recommended primitive:

```text
theta_domain ~ Beta(alpha + successes, beta + failures)
```

Recommended metric IDs:

- `domain_opening_transfer_beta_v1`
- `domain_tactical_detection_beta_v1`
- `domain_conversion_beta_v1`
- `domain_defense_beta_v1`

V1 observable domains:

- opening
- tactical
- conversion
- defense

- interpretation: uncertainty-aware domain profile, visible only with enough data.
- used_by: future Learning Engine.
- calibration_status: `needs_corpus`
- limitations:
  - Domain scores must not be shown as precise percentages too early.
  - If data is insufficient, UI should say `profile in construction`.
  - Plan is research/future, not V1 domain scoring.
- example: `Beta(1 + 8, 1 + 4)` for a domain with 8 successes and 4 failures.
- registry_link: domain score registry entries.
- source_semantics: future; current code has tags, not a calibrated skill model.

### 21. domain_calculation_score_v1

- formula_id: `domain_calculation_score_v1`
- version: `calculation_candidate_logs_future_v1`
- implementation_status: `research_only / planned`
- purpose: research / future action
- inputs: candidate move logs
- output: calculation estimate with uncertainty
- formula:

No implemented formula now. Required instrumentation:

- candidate moves generated;
- candidate order;
- variant depth;
- `best_move_in_candidates`;
- `candidate_diversity`;
- `chosen_vs_best_gap`.

- interpretation: distinguish generation, selection, and calculation failures.
- used_by: future candidate move model.
- calibration_status: `needs_corpus`
- limitations:
  - Must not be displayed as a percentage until candidate logs exist.
- example: not applicable until instrumentation exists.
- registry_link: `calculation_domain_score_v1`
- source_semantics: future only.

### 22. practice_result_event_v1

- formula_id: `practice_result_event_v1`
- version: `review_practice_attempt_event_v1`
- implementation_status: `partial`
- purpose: action event log
- inputs: practice attempt and item context
- output: event record, not a score
- formula:

This is an event, not a numerical formula.

Current stored fields:

- `session_id`
- `game_id`
- `ply`
- `color`
- `attempted_uci`
- `attempted_san`
- `expected_best_uci`
- `result`
- `attempt_number`
- `evidence_snapshot_json`
- `created_at`

Recommended future fields:

- `item_id`
- `time_spent`
- `hint_used`
- `reveal_used`
- `item_difficulty`
- `source_context`
- optional `self_confidence`

Allowed results:

- `best`
- `very_good`
- `acceptable`
- `wrong`
- `illegal`
- `revealed`
- `skipped`

- interpretation: foundational event for future BKT, IRT, FSRS, and Learning Engine.
- used_by: Review Practice summaries and future skill model.
- calibration_status: `heuristic_v0`
- limitations:
  - One event is not a skill diagnosis.
  - Current event lacks time and hint/reveal telemetry.
- example: `result=wrong`, `attempt_number=1`.
- registry_link: `practice_result_v1`
- source_semantics: implemented in `review_practice_service`.

### 23. transfer_gap_beta_v1

- formula_id: `transfer_gap_beta_v1`
- version: `bayesian_transfer_gap_v1`
- implementation_status: `future`
- purpose: future action metric
- inputs: training successes/failures and practical real-game successes/failures
  by domain
- output: uncertainty-aware transfer gap
- formula:

For each domain `d`:

```text
theta_train_d ~ Beta(alpha_d + s_train_d, beta_d + n_train_d - s_train_d)
theta_practical_d ~ Beta(alpha_d + s_practical_d, beta_d + n_practical_d - s_practical_d)
Delta_d = theta_train_d - theta_practical_d
```

Do not display only `E[Delta_d]`.

Display numeric signal only when:

- minimum sample size is satisfied;
- credible interval is acceptable;
- `P(Delta_d > threshold)` is high enough.

- interpretation: training success that fails to transfer into real games.
- used_by: future recommended plan.
- calibration_status: `needs_corpus`
- limitations:
  - Hidden until data sufficient.
  - Must be uncertainty-aware.
- example: if training is strong but practical performance remains weak, a
  tactical transfer gap may be flagged.
- registry_link: `transfer_gap_beta_v1`
- source_semantics: future only.

### 24. priority_score_additive_v1

- formula_id: `priority_score_additive_v1`
- version: `training_item_priority_additive_v1`
- implementation_status: `future`
- purpose: action
- inputs: normalized item and user features
- output: ranking score
- formula:

```text
priority =
    w1 * criticality
  + w2 * weakness_match
  + w3 * transfer_relevance
  + w4 * difficulty_fit
  + w5 * memory_need
  + w6 * information_gain
  - w7 * fatigue_cost
  - w8 * redundancy_penalty
```

All terms must be normalized to `[0, 1]`.

- interpretation: interpretable V1 item ranking.
- used_by: future Learning Engine.
- calibration_status: `needs_corpus`
- limitations:
  - Weights require calibration.
  - Additive form is chosen for V1 stability and explainability.
- example: a critical, well-fitted, non-redundant item ranks high.
- registry_link: `priority_score_additive_v1`
- source_semantics: future only.

### 25. expected_training_value_additive_v1

- formula_id: `expected_training_value_additive_v1`
- version: `etv_additive_v1`
- implementation_status: `future`
- purpose: action
- inputs: item features, user model, current context
- output: usefulness ranking score
- formula:

```text
ETV(item, user, context) =
    weighted additive ranking score estimating usefulness of item for current user
```

Default V1 should reuse/extend `priority_score_additive_v1`.

Do not use a multiplicative product as default V1.

- interpretation: choose what exercise helps this user now.
- used_by: future recommended plan.
- calibration_status: `needs_corpus`
- limitations:
  - Product form may remain a research intuition, not default implementation.
  - Future directions include contextual bandits and learning-to-rank.
- example: an item can rank lower if it is redundant or too difficult.
- registry_link: `etv_additive_v1`
- source_semantics: future only.

### 26. difficulty_fit_target_success_v0

- formula_id: `difficulty_fit_target_success_v0`
- version: `difficulty_fit_target_success_v0`
- implementation_status: `future`
- purpose: action
- inputs: predicted success probability `P_success`, target, sigma
- output: fit score in `[0, 1]`
- formula:

```text
DifficultyFit = exp(-((P_success - target)^2) / (2 * sigma^2))
target ~= 0.65
```

- interpretation: prefer items neither too easy nor too hard.
- used_by: future ETV.
- calibration_status: `heuristic_v0`
- limitations:
  - Needs user data.
  - Target may depend on level, fatigue, and frustration.
- example: `P_success` near `0.65` receives high fit.
- registry_link: future difficulty metric.
- source_semantics: future only.

### 27. candidate_move_metrics_future_v1

- formula_id: `candidate_move_metrics_future_v1`
- version: `candidate_move_metrics_future_v1`
- implementation_status: `future`
- purpose: future action / audit
- inputs: candidate move logs
- output: candidate-generation metrics
- formula:

No implemented formula now. Required future metrics:

- `best_move_in_candidates`
- `candidate_coverage`
- `candidate_diversity`
- `chosen_vs_best_gap`
- `candidate_topk_recall`

- interpretation: separate move generation failure from move choice failure.
- used_by: future calculation model.
- calibration_status: `needs_corpus`
- limitations: requires explicit candidate instrumentation.
- example: if the best move was never listed, the failure is likely generation.
- registry_link: research backlog / future metric registry entry.
- source_semantics: future only.

### 28. post_blunder_resilience_future_v1

- formula_id: `post_blunder_resilience_future_v1`
- version: `post_blunder_resilience_future_v1`
- implementation_status: `future`
- purpose: future action / audit
- inputs: move sequence after a major error
- output: resilience metrics
- formula:

No implemented formula now. Future metrics:

- `second_blunder_rate`
- `recovery_quality`
- `damage_limitation_score`
- `tilt_resilience_score`

- interpretation: measure decisions in the 2-5 moves after a major error.
- used_by: future training and review.
- calibration_status: `needs_corpus`
- limitations:
  - Needs robust definition of a major error and subsequent opportunity.
  - Psychological state must not be inferred as fact.
- example: avoiding a second error after a blunder improves resilience signal.
- registry_link: future metric registry entry.
- source_semantics: future only.

### 29. opening_association_trace_future_v1

- formula_id: `opening_association_trace_future_v1`
- version: `opening_association_trace_future_v1`
- implementation_status: `future`
- purpose: communication / action candidate
- inputs: opening exit, later annotated moments, time window, tags
- output: association trace
- formula:

Current implemented evidence uses:

```text
SEARCH_WINDOW_AFTER_EXIT_PLIES = 8
SIGNIFICANT_OPENING_EXIT_WIN_LOSS = 7.0
first critical or first loss after opening exit
```

Future name:

- `opening_association_trace`
- or `opening_consequence_trace`

- interpretation: temporal association between opening exit and later problems.
- used_by: Opening Reality and future opening training.
- calibration_status: `heuristic_v0 / needs_corpus`
- limitations:
  - Do not call this causal in V1.
  - Association is not proof the opening caused the later issue.
- example: a critical moment within 8 plies after book exit can be linked.
- registry_link: `opening_reality_evidence_v1`
- source_semantics: implemented evidence in `metrics/opening_reality.py`; future
  metric naming must avoid causal claims.

### 30. position_similarity_future_v1

- formula_id: `position_similarity_future_v1`
- version: `position_similarity_future_v1`
- implementation_status: `future / research_only`
- purpose: future research / training retrieval
- inputs: position features, tags, engine patterns, opening tags
- output: similarity score or nearest neighbors
- formula:

No implemented formula now. Future similarity families:

- `theme_similarity`
- `material_similarity`
- `piece_square_similarity`
- `king_safety_similarity`
- `tactical_motif_similarity`
- `opening_tag_similarity`
- `engine_pattern_similarity`

- interpretation: retrieve puzzles similar to personal mistakes.
- used_by: future puzzle recommendation.
- calibration_status: `research_only`
- limitations:
  - Needs dataset and validation.
  - Similarity is not automatically pedagogical relevance.
- example: match a personal back-rank mistake to similar tactical puzzles.
- registry_link: Research Backlog.
- source_semantics: future/research only.

### 31. prediction_validation_future_v1

- formula_id: `prediction_validation_future_v1`
- version: `prediction_validation_future_v1`
- implementation_status: `future`
- purpose: audit / calibration
- inputs: predictions, observed future outcomes, practice attempts, future games
- output: validation metrics
- formula:

Future metrics:

- Brier score
- calibration curve
- reliability diagram
- expected vs observed improvement
- prediction error

- interpretation: verify whether NeuroChess predictions come true.
- used_by: future calibration reports and Learning Engine validation.
- calibration_status: `future`
- limitations:
  - Requires longitudinal data.
  - Should validate predictions before making strong claims.
- example: predicted success probability should match observed success rates.
- registry_link: future audit metric.
- source_semantics: future only.

## Final Product Separation

- Lichess-like public metrics are public/UI-family communication metrics.
- Stockfish WDL metrics are separate audit/internal-family metrics.
- Criticality is an internal action metric.
- Transfer Gap must be Bayesian and uncertainty-aware.
- Expected Training Value V1 is additive.
- Tail mean top-k is preferred over CVaR language for short-game UI.
- Practice result is event-based, not a score.

## Rules for future Codex missions

- Any new metric must be added to the Metric Registry.
- Any new action must be added to Action Registry.
- Any new screen or tab must be added to Screen Contracts.
- Any new formula must be added to this Formulas and Metrics document.
- Any metric that drives training must be linked to a calibration plan.
- Any research-only idea must be parked in Research Backlog until promoted.
- Otherwise the mission is incomplete.
