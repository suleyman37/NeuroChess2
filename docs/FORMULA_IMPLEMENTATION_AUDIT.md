# Formula Implementation Audit - V5.4.MATH-AUDIT-1

Date: 2026-05-02

Scope: audit only. No formula, code, UI, backend, engine, endpoint, migration,
LLM, V6, or Memory Loop change was made by this audit.

Post-audit note, 2026-05-02: V5.4.REVIEW-SCORE-UX-R1 intentionally restored
the visible `NeuroScore` as a coach composite backed by
`headline_neurochess_score_v2`, with Lichess-like precision shown separately as
reference precision. The high risk below is therefore resolved by changing the
product contract, not by changing engine formulas or Lichess constants.

Audited sources:

- `backend/neurochess/metrics/review_metrics.py`
- `backend/neurochess/review_service.py`
- `backend/neurochess/metrics/move_categories.py`
- `backend/neurochess/metrics/pedagogy.py`
- `backend/neurochess/metrics/pv_contrast.py`
- `backend/neurochess/metrics/try_move.py`
- `backend/neurochess/metrics/opening_reality.py`
- `backend/neurochess/review_practice_service.py`
- `backend/neurochess/analysis_service.py`
- `backend/neurochess/engines/stockfish_service.py`
- `backend/neurochess/live_analysis_service.py`
- `frontend/src/api/client.ts`
- `frontend/src/components/review/*`
- `frontend/src/components/ReviewPanel.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/neuro3d/*`
- `frontend/src/components/NeuroFlowPanel.tsx`

## 1. Executive Summary

### Public formulas

The backend Lichess-like primitive formulas are aligned with the current
documentation:

- `white_percent_lichess_v1` uses `100 / (1 + exp(-0.00368208 * eval_cp))`.
- `player_win_percent_lichess_v1` converts White POV to mover POV.
- `win_loss_lichess_v1` uses `max(0, P_before - P_after)`.
- `move_accuracy_lichess_v1` includes the documented `+1` adjustment.
- `game_accuracy_lichess_like_v1` implements the documented NeuroChess
  Lichess-like weighted/harmonic aggregation, including sliding window,
  window-size clamp, local volatility weights, weighted mean, harmonic mean,
  and final average.

The code should continue to call it Lichess-like, not an exact Lichess clone,
because exact upstream Lichess aggregation parity is not proven in this repo.

### eval_cp POV convention

Current engine paths store `eval_cp` as POV White and store
`eval_pov_side_to_move_cp` separately. Review scoring uses `eval_cp` or
`stabilized_eval.final_eval_cp`, which are intended as POV White. No current
Review scoring path was found using `eval_pov_side_to_move_cp` as canonical
Win% input.

Audit result: no blocker found for POV convention in current code.

### Visible NeuroScore

The current visible "Score NeuroChess" / "NeuroChess ... / 100" in the Review
summary is not the new documented public NeuroScore target.

Current frontend summary path:

```text
ReviewCockpitSummary
-> headlineScoreForReview(...)
-> review.user_headline_neurochess_score / headline_neurochess_score
-> backend headline_neurochess_score(...)
-> 0.35 * lichess_like_accuracy + 0.65 * neuro_score_diag
```

Target docs say:

```text
NeuroScore public = game_accuracy_lichess_like_v1
```

Audit result: high risk. The visible score still uses the legacy/rejected
headline fusion direction.

### Critical divergences

No formula implementation blocker was found in the Lichess-like backend core.
The main risks are product/UI semantics:

- visible NeuroScore uses headline fusion instead of public accuracy;
- diagnostic score and diagnostic gap are visible in normal score details;
- NeuroMonitor 3D creates visible domain scores from heuristics and headline
  fallbacks;
- reliability weight does not directly inspect the required Review profile in
  the weight function, though the Review pipeline has separate profile gates.

### Corrections needed later

Recommended next mission:

```text
V5.4.MATH-ALIGN-1 - Align Public NeuroScore and Lichess-like Accuracy Semantics
```

It should align UI labels and selectors so the public NeuroScore uses
`*_lichess_like_accuracy`, while diagnostic/headline fields move to debug,
technical details, or legacy compatibility.

## 2. Formula Comparison Table

| metric_id | documented_formula | implementation_location | implemented_formula_summary | exact_match | severity | user_visible | drives_training | required_action_later | notes |
|---|---|---|---|---|---|---|---|---|---|
| `white_percent_lichess_v1` | Logistic `100 / (1 + exp(-0.00368208 * eval_cp))`; mate > 0 => 100, mate < 0 => 0. | `metrics/review_metrics.py`, `core/evaluation_display.py` | Same coefficient and mate handling; `mate_in == 0` returns 50. | yes | info | yes | no | Keep formula versioned; verify against external reference examples. | Display helper rounds to 0.1, metric helper keeps raw float. |
| `player_win_percent_lichess_v1` | White POV if White, `100 - white_percent` if Black. | `metrics/review_metrics.py`, `review_service.py` wrappers | Same. | yes | info | indirect | no | None. | Used by scoring and criticality. |
| `win_loss_lichess_v1` | `max(0, P_before - P_after)`. | `metrics/review_metrics.py` | Same, rounded to 3 decimals in mover helper. | yes | info | indirect | no | None. | Canonical loss signal. |
| `move_accuracy_lichess_v1` | Exponential with constants and `+1`, clamped 0-100. | `metrics/review_metrics.py` | Same constants and `raw_accuracy + 1.0`. | yes | info | yes | no | Keep reference tests. | No missing `+1` issue found. |
| `game_accuracy_lichess_like_v1` | Window size `clamp(floor(n/10),2,8)`, local volatility weights, weighted mean, harmonic mean, average. | `metrics/review_metrics.py` | Same NeuroChess documented aggregation. | yes for docs; partial for exact Lichess clone | low | yes | no | Keep naming `lichess_like`, not exact clone unless externally verified. | Code returns weighted/harmonic debug fields. |
| `neuro_score_public_v1` | Product-visible NeuroScore should equal public precision score, currently `game_accuracy_lichess_like_v1`. | Target not implemented; current UI in `ReviewCockpitSummary.tsx` and `reviewViewModel.ts`. | Visible UI uses headline fusion fields, not public accuracy. | no | high | yes | no | Align visible NeuroScore to `user_lichess_like_accuracy` / side equivalents. | Highest product-semantic mismatch. |
| `qualitative_game_label_v1` | Transparent UX label from score bands, tags, critical moments. | `review_service._build_review_summary_sentence`, `reviewViewModel.reviewSummaryForPov`. | Heuristic sentence logic using headline score, diagnostic gap, tags, and sections. | partial | medium | yes | no | After NeuroScore alignment, update summaries to use public accuracy plus qualitative tags, not headline/gap as truth. | Useful UX, but currently depends on legacy headline/gap. |
| `leverage_weight_v1` | `0.75 + 0.5 * (P_before * (100 - P_before) / 2500)`. | `review_service.leverage_weight` | Same, rounded 4 decimals. | yes | info | debug/indirect | yes | Calibrate on annotated corpus. | Internal action metric. |
| `transition_weight_v1` | Documented transition table. | `review_service.transition_weight` | Same table, including mate event 1.4 and same-zone dampening. | yes | info | debug/indirect | yes | Calibrate on annotated corpus. | Internal action metric. |
| `persistence_weight_v1` | Future average over next plies; `0.75 + 0.5 * ratio`; no future => 1.0. | `review_service.persistence_weight`, `_future_player_percents` | Same for criticality; next 10 plies via `PERSISTENCE_WINDOW_PLIES`. | yes | info | debug/indirect | yes | Calibrate; document that opponent return can reduce persistence. | Separate from diagnostic persistence weight. |
| `reliability_weight_v1` | Target should depend on required Review profile satisfaction and quality gates. | `review_service._moment_reliability`, `core/analysis_reliability.py`, coverage gates in `review_service`. | Weight uses min before/after `reliability_score`: none=>0.8, low<0.75=>0.7, else 1.0. Profile satisfaction is enforced elsewhere, not inside the weight. | partial | medium | debug/indirect | yes | Later align reliability contract so weight explicitly reflects required profile/pipeline satisfaction. | Not a direct "deep only" check, but also not full target. |
| `criticality_score_v1` | `win_loss * reliability * leverage * transition * persistence * novelty`; threshold 10, mate override, NMS. | `review_service.criticality_score`, `_select_review_moments`, `temporal_non_max_suppression`. | Same formula; `novelty_weight` currently 1.0; threshold 10; NMS window 2, override 1.5, max 5; selection adds a low-impact opening trust gate for near-equal early drift. | yes | info | debug/indirect | yes | Keep hidden as raw score; audit any UI that derives visible scores from it. | Drives Review moment and Practice candidate selection; trust gate does not alter the formula. |
| `temporal_nms_moment_selection_v1` | Select top non-overlapping critical moments by score, mate can override. | `review_service.temporal_non_max_suppression` | Same documented behavior. | yes | info | no | yes | Calibrate top-k stability. | Final selected moments sorted by ply. |
| `player_review_score_v0` | Legacy weighted average of move accuracy. | `review_service.player_review_score_v0`, `player_review_score_v1` helper. | Legacy helpers exist; current payload marks `*_review_score` as alias of `lichess_like_accuracy`. | legacy | low | legacy/unknown | no | Keep deprecated; do not revive as product direction. | `player_review_score_v1` helper appears unused in current scoring path. |
| `neuro_severity_raw_v1` | Diagnostic loss with persistence and cluster weights. | `metrics/review_metrics.py neuro_diagnostic_score` | Same current documented implementation: diagnostic loss = win loss * omega. | yes | medium | debug/details/indirect | no | Keep internal until calibrated. | Current UI exposes related diagnostic values in score details. |
| `neuro_score_diag_v1` | `100 * exp(-0.035 * Z)` with mean/tail diagnostic loss. | `metrics/review_metrics.py`, `review_service._review_score_payload`. | Same. | yes | medium | yes in details/indirect | no | Move out of normal UI details or label clearly as audit/internal. | Current frontend labels include "Score diagnostic brut" / "diagnostic". |
| `diagnostic_gap_v1` | `lichess_like_accuracy - neuro_score_diag`. | `metrics/review_metrics.py`, `review_service._review_score_payload`, `reviewViewModel`. | Same. | yes | high | yes in details and summary logic | no | Restrict to debug/technical details; remove from normal narrative logic. | Target registry says audit/debug only. |
| `headline_score_v0` | Legacy fusion: `0.35 * accuracy + 0.65 * diagnostic`, with fallback penalty. | `metrics/review_metrics.py headline_neurochess_score`, `review_service._review_score_payload`, `reviewViewModel.headlineScoreForReview`. | Same, and still used as visible main score. | yes formula; no product alignment | high | yes | no | Stop using headline as public NeuroScore; keep only legacy/audit compatibility. | Product decision says rejected/legacy direction. |
| `expected_score_wdl_sfXX_v1` | Future Stockfish WDL expected score `(W + 0.5D)/(W+D+L)`. | No implementation found. | No `UCI_ShowWDL` or WDL scoring path found. | yes as future/unimplemented | info | no | no | None now; keep separate if introduced later. | No mixing with Lichess Win% found. |
| `tail_mean_topk_v1` | Mean of top diagnostic losses; current docs say top 10% with min 3 behavior. | `metrics/review_metrics.py neuro_diagnostic_score` | `tail_count = min(max(3, ceil(0.10*n)), n)` for diagnostic and win losses. | yes | info | debug/details | no | Avoid CVaR naming in UI; add bootstrap CI later. | No `CVaR_90` implementation found. |
| `domain_scores_v1` | Future Bayesian domain estimates; visible only when data sufficient. | No backend skill model; frontend heuristics in `neuroBrainVisualModel.ts`, `NeuroFlowPanel.tsx`, `reviewViewModel.ts`. | Domain visuals score opening/tactical/conversion/defense/plan via counts/loss heuristics. | no for future target | high | yes | indirect | Move visible domain scores to qualitative/status display or mark as heuristic until calibrated. | NeuroMonitor 3D shows `/100` domain scores. |
| `domain_calculation_score_v1` | Research/planned, requires candidate logs. | No calibrated calculation score found. | No candidate-log model; some plan/positional heuristics exist in UI. | yes as unimplemented | info | no | no | Keep unimplemented until candidate logs exist. | Calculation score is not currently exposed as a normal domain. |
| `practice_result_event_v1` | Event with item/session/result/move/time/hint/reveal/attempt/difficulty/context. | `review_practice_service.py`, `api/game_routes.py`, `api/client.ts`, `App.tsx`. | Stores session_id, game_id, ply, color, attempted_uci/san, expected_best_uci, result, attempt_number, evidence_snapshot_json, item_id, time_spent_ms, hint_used, reveal_used, source_context, due_at, created_at; result bands now include `playable`, `imprecise`, and `needs_rebuild`. | implemented_v1 | medium | yes | yes future | Keep item_difficulty and self_confidence future-only until needed; new soft bands do not schedule due revisions in V1. | Current event supports V1 learning loop but remains not a skill diagnosis. |
| `revision_due_simple_v1` | Simple V1 scheduling from latest Practice result per item. | `review_practice_service.py`, `api/client.ts`, `App.tsx`. | Computes due/scheduled counts and due Review Practice sessions from result, hint/reveal flags, and due_at. | implemented_v1 | medium | yes | yes | Keep plain counts only; do not expose FSRS/ETV/SkillTrace or mastery. | Useful V1 bridge, not a calibrated memory model. |
| `transfer_gap_beta_v1` | Future Bayesian train vs practical posterior gap. | No implementation or placeholder found. | Not present. | yes as future/unimplemented | info | no | no | None now; introduce only with corpus and uncertainty. | No false Transfer Gap UI found. |
| `priority_score_additive_v1` | Future additive ranking over criticality, weakness, transfer, difficulty, memory, information, fatigue, redundancy. | No ETV implementation; `review_practice_service._practice_item_sort_key` exists. | Current Practice sort uses primary/tag priority, coach_priority_rank, `-win_loss`, ply. | partial/future | medium | no | yes | Do not call current sort ETV; later replace or wrap with additive priority once calibrated. | Current sort is simple and auditable. |
| `expected_training_value_additive_v1` | Future additive item usefulness score. | No implementation found. | Not present. | yes as future/unimplemented | info | no | no | None now. | No multiplicative ETV found. |
| `difficulty_fit_target_success_v0` | Future Gaussian-like fit around target success ~0.65. | No implementation found. | Not present. | yes as future/unimplemented | info | no | no | Add only after user skill model exists. | No fake difficulty fit UI found. |
| `candidate_move_metrics_future_v1` | Future candidate instrumentation metrics. | No candidate-log model found. | Not present. | yes as future/unimplemented | info | no | no | Add only with explicit candidate logging. | Try Move uses engine top moves, not user candidate logs. |
| `post_blunder_resilience_future_v1` | Future metrics over 2-5 moves after blunder. | No implementation found. | Not present. | yes as future/unimplemented | info | no | no | None now. | No psychological-state claims found in formulas. |
| `opening_association_trace_future_v1` | Future non-causal association trace; current opening evidence may use window/threshold. | `metrics/opening_reality.py`, frontend opening domain helpers. | Current evidence links first critical/loss moment within 8 plies after book exit; threshold 7 Win%. | partial | medium | yes | indirect | Rename/word as association, not causality; calibrate relevance. | Some frontend copy says the opening exit "led to" a critical moment, which can sound causal. |
| `position_similarity_future_v1` | Future/research similarity engine. | No implementation found. | Not present. | yes as future/unimplemented | info | no | no | None now. | No puzzle similarity engine found. |
| `prediction_validation_future_v1` | Future prediction validation: Brier, calibration curve, observed uplift. | No implementation found. | Not present. | yes as future/unimplemented | info | no | no | None now. | No prediction claims found. |
| `accepted_moves_try_move_v1` | Not a public formula registry entry; docs require audit of accepted/candidate move thresholds. | `metrics/try_move.py`, `review_try_move_stabilization.py` | Best move accepted; other PV5/candidate moves accepted if delta from best player Win% <= 2 (`very_good`) or <= 5 (`acceptable`); <= 8 becomes `playable`, <= 14 becomes `imprecise`; legal out-of-list moves require stabilized resulting-position evaluation before final classification. | documented here only | medium | yes | yes in practice | Keep bands conservative and hidden from raw metric UI; do not change scheduling without explicit decision. | Uses cached candidates first, then bounded stable eval fallback, not live/shallow UI snapshots. |
| `eval_cp_pov_convention` | `eval_cp` must be POV White; side-to-move POV must be stored separately. | `engines/stockfish_service.py`, `live_analysis_service.py`, `analysis_service.py`, `core/stabilized_eval.py` | `score.pov(chess.WHITE)` populates `eval_cp`; `eval_pov_side_to_move_cp` is separately normalized. | yes | info | no | yes indirectly | Add regression tests if not already present for black-to-move positions. | No current blocker found. |

## 3. Public Score Audit

### Current backend fields

The backend currently produces all of these fields:

- `white_lichess_like_accuracy`
- `black_lichess_like_accuracy`
- `user_lichess_like_accuracy`
- `opponent_lichess_like_accuracy`
- `white_neuro_score`
- `black_neuro_score`
- `user_neuro_score`
- `opponent_neuro_score`
- `white_diagnostic_gap`
- `black_diagnostic_gap`
- `user_diagnostic_gap`
- `opponent_diagnostic_gap`
- `white_headline_neurochess_score`
- `black_headline_neurochess_score`
- `user_headline_neurochess_score`
- `opponent_headline_neurochess_score`
- `headline_neurochess_score`

The backend also sets:

```text
review_score_deprecated = true
review_score_alias_of = "lichess_like_accuracy"
```

This is good compatibility hygiene: the old `*_review_score` fields are no
longer treated as the diagnostic score.

### Current frontend field usage

The main Review summary currently uses:

```text
ReviewCockpitSummary
-> headlineScoreForReview(review, povContext)
-> user_headline_neurochess_score / side headline fields
```

The visible label is:

```text
Ton score NeuroChess
NeuroChess X / 100
```

This means the visible NeuroScore is currently:

```text
headline_score = 0.35 * lichess_like_accuracy + 0.65 * neuro_score_diag
```

or the documented fallback variant.

### Conformity to product decision

Target decision:

```text
NeuroScore public = public precision score = game_accuracy_lichess_like_v1
```

Current implementation:

```text
NeuroScore visible = headline_score_v0/v1 fusion
```

Audit status: not compliant.

Risk: high.

Required future action:

- Change score selectors and labels so the normal visible NeuroScore reads
  `user_lichess_like_accuracy` / `white_lichess_like_accuracy` /
  `black_lichess_like_accuracy`.
- Move headline fusion to legacy/debug only.
- Update score details copy so diagnostics are explicitly audit/internal if
  still accessible.

## 4. Training Metrics Audit

### Criticality

Current criticality is internally coherent with docs:

```text
criticality_score =
    win_loss
    * reliability_weight
    * leverage_weight
    * transition_weight
    * persistence_weight
    * novelty_weight
```

Current selection constants:

- threshold: `10.0`
- persistence window: `10` plies
- NMS window: `2` plies
- NMS override ratio: `1.5`
- max moments: `5`

Raw criticality is not displayed as the main user score. However, it is present
in API types, audit rows, and visible heuristics such as NeuroMonitor domain
penalties. This is acceptable only if framed as internal/derived and not as a
user truth.

### Practice result events

Current attempt storage covers:

- result;
- move played as UCI/SAN;
- attempt number;
- expected best move;
- session/game/ply/color;
- evidence snapshot;
- item id;
- time spent;
- hint/reveal flags;
- source context;
- due_at;
- created timestamp.

Remaining future fields for `practice_result_event_v1`:

- item difficulty;
- optional self-confidence.

Risk: medium. The V1 event now supports simple revisions and compact progress,
but it is still not enough for future BKT/IRT/FSRS/Learning Engine calibration.

### Accepted moves

Try Move accepted/candidate moves are determined from cached Review candidates
first, then by bounded stabilized resulting-position evaluation for legal moves
outside the cached list:

```text
best move -> quality best
delta <= 2.0 player Win% -> very_good
delta <= 5.0 player Win% -> acceptable
delta <= 8.0 player Win% -> playable
delta <= 14.0 player Win% -> imprecise
otherwise -> wrong only after stable evidence
```

This is a training-driving heuristic. It is documented in this audit but should
remain governed; `playable`, `imprecise`, and `needs_rebuild` do not alter V1
revision scheduling.

### Domain signals

There is no calibrated backend domain score model.

Current visible domain signals are heuristic:

- Review cockpit indicators count tactical/conversion/defense/opening signals.
- NeuroFlow maps counts/loss to severity.
- NeuroMonitor 3D maps annotations to domain scores and displays `/100`.
- `plan` appears in NeuroMonitor domain matching, but docs say Plan is
  research/future, not a V1 calibrated domain score.

Risk: high because some domain signals are user-visible as scores. They should
be reframed as qualitative signals or hidden until calibration/minimum sample
rules exist.

## 5. Research/Future Metrics Audit

### Transfer Gap

No implementation or placeholder was found for Transfer Gap.

Audit status: compliant with docs as future-only.

### ETV / Priority Score

No `expected_training_value` or additive ETV implementation was found.

Current Practice ranking is simple:

```text
sort by primary/tag priority, coach_priority_rank, descending win_loss, ply
```

This is not ETV and should not be named ETV. It is acceptable as current simple
Practice ordering, but future Learning Engine work must introduce the additive
priority formula explicitly.

### Stockfish WDL

No `UCI_ShowWDL` usage was found. No WDL expected score is mixed with
Lichess-like Win%.

Audit status: compliant.

### Opening association

Current opening evidence links book exit to the first relevant loss within 8
plies, with `SIGNIFICANT_OPENING_EXIT_WIN_LOSS = 7.0`.

This is useful but not causal. Some UI wording should be softened later from
"led to" semantics to "associated with" or "followed by" semantics.

### Position similarity and prediction validation

No implementation found. Compliant with future/research status.

## 6. Risk Ranking

### Blockers

None found.

No current code path was found that invalidates the core public Lichess-like
math or mixes side-to-move POV into Review scoring.

### High

1. Visible NeuroScore uses headline fusion.
   - Current visible score uses `*_headline_neurochess_score`.
   - Target public NeuroScore should use `*_lichess_like_accuracy`.

2. Headline score remains visible as product score.
   - Formula is implemented as documented legacy fusion.
   - Product decision says this direction is rejected.

3. Diagnostic gap participates in normal narrative/details.
   - Target says audit/debug only.
   - Current UI exposes it in score details and summary logic.

4. NeuroMonitor domain scores are visible and heuristic.
   - Domain `/100` values are derived from annotation counts/loss heuristics.
   - No Bayesian sample-size rules exist.

### Medium

1. Reliability weight is only partially aligned with target governance.
   - Weight itself uses reliability score thresholds.
   - Required Review profile satisfaction is enforced elsewhere, not in the
     weight function.

2. Practice result event is incomplete for future Learning Engine.
   - Missing time/hint/reveal/difficulty/context fields.

3. Accepted moves thresholds are training-driving but not formally registered.
   - Delta thresholds are clear and auditable, but need governance entry if kept.

4. Opening association wording can sound causal.
   - Current evidence is temporal association, not causal proof.

5. Qualitative summaries rely on headline/gap.
   - Useful UX, but should be recomposed around public accuracy plus qualitative
     signals after score alignment.

### Low

1. Game accuracy should remain named `lichess_like`, not exact clone.
2. Legacy `player_review_score_v0/v1` helpers remain in code but are not current
   product direction.
3. `white_percent` display helper rounds while metric helper does not; this is
   expected display behavior.

### Info

1. Lichess-like backend primitives are aligned.
2. Stockfish WDL is not used.
3. Transfer Gap, position similarity, prediction validation, and candidate-log
   metrics are not implemented, matching future/research status.

## 7. Recommended Next Codex Mission

Recommended mission:

```text
V5.4.MATH-ALIGN-1 - Align Public NeuroScore and Lichess-like Accuracy Semantics
```

Recommended scope:

- Update frontend score selectors so visible `NeuroScore` uses
  `user_lichess_like_accuracy` or side-specific Lichess-like accuracy.
- Move headline fusion out of the main UI path.
- Reword score details so diagnostic score/gap are clearly audit/internal or
  hidden behind advanced/debug disclosure.
- Reframe NeuroMonitor domain `/100` values as qualitative domain signals until
  calibrated.
- Add static frontend tests that prevent visible NeuroScore from reading
  `*_headline_neurochess_score`.

Do not include in that mission unless explicitly requested:

- formula changes;
- Stockfish changes;
- V6 Learning Engine;
- Transfer Gap implementation;
- FSRS/Memory Loop;
- LLM coach.

### Post-audit status

V5.4.MATH-ALIGN-1 resolved the public score visibility high risk by mapping the
visible Review `NeuroScore` to Lichess-like public precision fields and moving
headline/diagnostic gap usage into legacy/audit paths.

## 8. No-change Confirmation

This audit made no functional change.

Confirmed:

- no formula changed;
- no backend logic changed;
- no frontend logic changed;
- no UI changed;
- no Stockfish or engine change;
- no endpoint;
- no migration;
- no LLM;
- no V6;
- no Memory Loop.
