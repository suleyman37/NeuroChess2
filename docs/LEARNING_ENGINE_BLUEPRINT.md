# NeuroChess2 Learning Engine Blueprint

This document defines the future mathematical prescription engine for
NeuroChess2.

It is a blueprint, not an implementation. It does not add a feature, endpoint,
migration, model, LLM, Stockfish change, V6, or Memory Loop.

## 1. Mission

The Learning Engine answers one question:

```text
Which exercise is most useful for this user, now?
```

It should reduce decision load. The user should not first choose a mode. The
system should recommend a simple plan, while preserving autonomy.

## 2. Global Pipeline

```text
REAL GAME
-> Review
-> move_annotations
-> tags/domains
-> training_items
-> practice_result_events
-> user_skill_model
-> priority_score_additive_v1
-> recommended_plan
-> future games
-> prediction_validation
```

The revolutionary loop is not one opaque score. It is:

```text
diagnostic
-> prescription
-> attempt
-> user model update
-> validation in real games
```

## 3. Training Item Model

Future `training_item` fields:

- `id`
- `source_type`: `review | lichess_puzzle | syzygy | opening | generated | manual`
- `source_id`
- `fen`
- `side_to_move`
- `best_move`
- `accepted_moves`
- `pv`
- `domain_vector`
- `difficulty_proxy`
- `criticality`
- `transfer_relevance`
- `memory_state`
- `evidence_json`
- `created_at`

Example `domain_vector`:

```json
{
  "opening": 0.1,
  "tactical": 0.8,
  "calculation": 0.0,
  "conversion": 0.0,
  "defense": 0.1,
  "endgame": 0.0
}
```

Rules:

- `calculation` must remain `0` or `unknown` unless candidate logs exist.
- `syzygy` as `source_type` is only a future data source placeholder here, not a
  Syzygy Trainer implementation.
- `evidence_json` must be versioned and bounded before any LLM layer can use it.

## 4. Practice Event Model

V1 `practice_result_event` fields:

- `item_id`
- `session_id`
- `game_id`
- `ply`
- `result`
- `move_played` / `attempted_uci`
- `time_spent_ms`
- `hint_used`
- `reveal_used`
- `attempt_number`
- `source_context`
- `timestamp`
- `due_at`

Current Review Practice stores:

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
- `item_id`
- `time_spent_ms`
- `hint_used`
- `reveal_used`
- `source_context`
- `due_at`
- `created_at`

Future optional fields:

- `item_difficulty`
- optional `self_confidence`

Role:

- future BKT;
- future IRT;
- V1 simple revision scheduling, future FSRS-like scheduling;
- future Learning Engine validation.

This is event data, not a skill score by itself.

V1 simple revision rules:

- `wrong` / `illegal`: review tomorrow.
- `revealed`: review tomorrow.
- success with hint: review in 3 days.
- success without help: review in 7 days.
- `skipped`: no scheduled revision in V1.

The UI may show due/scheduled counts and plain-language copy only. It must not
show FSRS, ETV, SkillTrace, BKT, IRT, Transfer Gap, or mastery posteriors.

## 5. User Skill Model V1

For each observable domain:

- `estimate`
- `uncertainty`
- `training_success_count`
- `training_failure_count`
- `practical_success_count`
- `practical_failure_count`
- `last_updated`

V1 observable domains:

- opening
- tactical
- conversion
- defense

Future domains:

- calculation
- endgame
- time_pressure
- post_blunder_recovery
- candidate_generation

Rules:

- Do not show precise domain scores without enough data.
- Show `profile in construction` when the posterior is too uncertain.
- Calculation requires candidate logs before it can become a normal domain score.

## 6. Bayesian Transfer Model

For each domain `d`:

```text
theta_train_d ~ Beta(alpha + s_train, beta + f_train)
theta_practical_d ~ Beta(alpha + s_practical, beta + f_practical)
Delta_d = theta_train_d - theta_practical_d
```

Display only:

- weak/medium/strong signal;
- interval;
- probability of gap;
- or `profile in construction`.

Do not display a fake precise number.

Transfer Gap is future action math. It is visible only when:

- minimum sample size is met;
- credible interval is narrow enough;
- `P(Delta_d > threshold)` is high enough.

## 7. Expected Training Value / Priority Score V1

V1 uses an additive score:

```text
ETV =
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

Term definitions:

- `criticality`: how important the source moment was.
- `weakness_match`: how strongly the item matches a known weak domain.
- `transfer_relevance`: how likely the item helps real-game transfer.
- `difficulty_fit`: how well the item matches the user's current level.
- `memory_need`: whether the item should be revisited.
- `information_gain`: how much the attempt can teach the model.
- `fatigue_cost`: cost of asking for this item now.
- `redundancy_penalty`: penalty for repeating too-similar items.

Rule:

```text
Do not use a multiplicative product as V1.
```

Why additive:

- more stable;
- easier to debug;
- less likely to zero-out a useful item;
- easier to explain in calibration reports.

## 8. Difficulty Fit

Target success probability:

```text
0.60 to 0.75
```

Conceptual formula:

```text
DifficultyFit = exp(-((P_success - target)^2) / (2 * sigma^2))
target ~= 0.65
```

Future adaptations:

- user level;
- fatigue;
- frustration;
- session length;
- recent failures.

## 9. Recommended Plan

The user should not have to choose a mode first.

NeuroChess should propose:

```text
Start my plan
```

Example:

```text
Today - 12 minutes
1. 3 tactics from your own games
2. 2 conversion positions
3. 1 opening exit
```

Autonomy rule:

```text
Always keep an alternative such as "Do something else" on prescriptive screens.
```

The plan should be small, specific, and action-oriented.

## 10. Candidate Move Model

Status: future.

Purpose:

- distinguish generation failure;
- distinguish selection failure;
- distinguish calculation failure.

Required logs:

- generated candidate moves;
- order of candidates;
- best move presence;
- depth of calculated lines;
- chosen move vs best move gap.

Without candidate logs, calculation must not be displayed as a reliable score.

## 11. Post-Blunder Resilience

Status: future.

After a large error, analyze the next 2-5 moves.

Potential metrics:

- `second_blunder_rate`
- `recovery_quality`
- `damage_limitation_score`
- `tilt_resilience_score`

Rule:

Do not claim psychological state as fact. Use behavior labels only.

## 12. Opening Association Trace

Status: future / research.

Purpose:

- link opening exit to later issues;
- explain whether a book exit produced immediate practical problems;
- support opening training only when the association is meaningful.

Rule:

```text
Do not call this causal in V1.
```

Use:

- `opening_association_trace`;
- or `opening_consequence_trace`.

Avoid:

- `opening_causality_score`.

## 13. Position Similarity Engine

Status: future / research.

Purpose:

- retrieve puzzles similar to the user's real mistakes;
- support transfer from personal games to external training items.

Possible signals:

- theme similarity;
- material similarity;
- piece-square similarity;
- king-safety similarity;
- tactical motif similarity;
- opening tag similarity;
- engine pattern similarity.

Rule:

Similarity alone is not training value. It must be combined with difficulty,
domain, and user state.

## 14. Prediction Validation

The Learning Engine must make predictions and verify them.

Future metrics:

- Brier score;
- calibration curve;
- reliability diagram;
- expected vs observed improvement;
- prediction error.

Validation examples:

- predicted item success vs actual item success;
- predicted tactical improvement vs future tactical real-game decisions;
- expected plan completion vs actual completion.

## 15. What Is Revolutionary

What is revolutionary is not a single formula.

The product advantage is the complete feedback loop:

```text
real game
-> honest public score
-> calibrated critical moments
-> training items
-> attempts
-> user model
-> recommended programme
-> future games
-> transfer validation
```

The UI should keep this loop simple:

```text
What happened?
What should I train?
What changed after training?
```

## 16. What Is Not Implemented Now

Not implemented now:

- no full IRT;
- no BKT;
- no full FSRS;
- no contextual bandit;
- no prediction validation;
- no visible Transfer Gap;
- no Lichess puzzle similarity engine;
- no candidate move logging model;
- no Memory Loop;
- no LLM coach;
- no V6 Learning Engine implementation.

## 17. Roadmap Implications

Learning Engine V1 should come after:

- Metric Registry;
- Action Registry;
- Screen Contracts;
- Formulas and Metrics;
- Calibration Protocol;
- stable Practice logging;
- enough annotated calibration data.

Before implementation:

- every new metric must be registered;
- every new action must be registered;
- every new screen must have a contract;
- every training-driving score must have a calibration path.

## Rules for future Codex missions

- Any new metric must be added to the Metric Registry.
- Any new action must be added to Action Registry.
- Any new screen or tab must be added to Screen Contracts.
- Any Learning Engine implementation must update this blueprint or explicitly
  supersede it.
- Any item-selection metric must have a calibration plan.
- Otherwise the mission is incomplete.
