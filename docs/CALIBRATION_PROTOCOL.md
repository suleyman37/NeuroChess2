# NeuroChess2 Calibration Protocol

This document defines how NeuroChess2 metrics must be calibrated empirically.
Many current metrics are useful heuristics. They must not be presented as
scientific truth until they have been tested against annotated data.

This is a docs-only protocol. It does not change formulas or engine behavior.

## 1. Why Calibrate

Calibration prevents NeuroChess from sounding more rigorous than it is.

NeuroChess must calibrate metrics to:

- avoid pseudo-rigor;
- avoid false diagnosis;
- tune hyperparameters;
- compare automated Review to human judgment;
- avoid selecting the wrong critical moments;
- avoid decorative NeuroMonitor/domain metrics;
- avoid showing Transfer Gap without enough data;
- separate public precision from internal diagnostic signals.

Core rule:

```text
If a metric drives training, it needs a calibration plan.
If it is not calibrated, it must not be shown as truth.
```

## 2. Calibration Corpus

Initial corpus size:

- minimum: 20 annotated games;
- recommended: 50 annotated games.

Each annotated game must include:

- `game_id`
- PGN
- `player_color`
- `time_control`
- `estimated_level`
- result
- `human_key_moments`

Each human annotated moment must include:

- `ply`
- `move_san`
- `domain`: `opening | tactical | calculation_candidate_required | conversion | defense | endgame | other`
- `severity`: `low | medium | high | decisive`
- reason
- `should_train`: `true | false`
- `recommended_exercise_type`
- notes

The corpus must preserve the engine/review profile used to generate automated
candidates, including Stockfish version, Review profile, formula versions, and
pipeline version.

## 3. Annotation Guidelines

Annotate a moment when:

- it clearly changes the game dynamic;
- it reveals a weakness;
- it deserves an exercise;
- it is pedagogically understandable;
- a human coach could explain why the user should revisit it.

Do not annotate:

- tiny micro-inaccuracies;
- engine-only moves that are not humanly meaningful;
- losses with no training value;
- repeated nearby moments from the same collapse unless they teach different things;
- book exits with no meaningful downstream issue.

Human annotations should prefer:

- teachability over engine purity;
- robust patterns over one-ply tactics that disappear immediately;
- explicit domain labels over vague labels.

## 4. Metrics To Evaluate

### Lichess-Like Clone

Evaluate:

- exact match on reference examples for `white_percent_lichess_v1`;
- MAE against a reference implementation for `move_accuracy_lichess_v1`;
- MAE against a reference implementation for `game_accuracy_lichess_like_v1`;
- formula version stability.

### Criticality Score

Evaluate:

- `precision@5`;
- `recall@5`;
- top-k hit rate;
- rank correlation with human severity;
- false positives;
- false negatives;
- bootstrap stability of top-k.

### Domain Tagging

Evaluate:

- accuracy per domain;
- confusion matrix;
- precision and recall for tactical, conversion, defense, opening;
- rate of `other` or uncertain labels.

### Opening Reality

Evaluate:

- exact opening exit detection;
- linked moment relevance;
- immediate vs delayed association;
- false causal wording risk.

### Practice Items

Evaluate:

- training relevance;
- not too hard;
- not too obscure;
- accepted move quality;
- solution clarity;
- retry value.

### Future Transfer Gap

Evaluate only after enough longitudinal data:

- Brier score;
- calibration curve;
- credible interval coverage;
- probability threshold reliability.

### Future Learning Engine

Evaluate:

- predicted vs actual success;
- recommended programme completion rate;
- uplift on future performance;
- redundancy and fatigue effects;
- user autonomy preservation through alternative actions.

## 5. Acceptance Thresholds V1

Initial thresholds:

| metric | V1 acceptance threshold |
|---|---|
| `white_percent_lichess_v1` | exact match on reference examples |
| `move_accuracy_lichess_v1` | MAE <= 1 point vs reference |
| `game_accuracy_lichess_like_v1` | MAE <= 2 points vs reference |
| `criticality_score_v1` | `precision@5 >= 0.60` |
| `criticality_score_v1` | `recall@5 >= 0.70` |
| domain tagging | accuracy >= 60 percent initial target |
| opening linked moment | precision >= 70 percent |

These thresholds are V1 targets. They must be revised after the first corpus
report.

If thresholds fail:

- do not display the metric as reliable;
- do not increase UI prominence;
- update formulas/registry only after a decision log entry.

## 6. Minimum Sample Rules

Do not display a domain as a reliable score if data is insufficient.

Initial sample rules:

| domain or metric | minimum display rule |
|---|---|
| opening | at least 10 rehearsal sessions and at least 8 real occurrences |
| tactical | at least 50 practice items and at least 30 real opportunities |
| conversion | at least 15 winning positions |
| defense | at least 15 defensive positions |
| calculation | at least 100 items with candidate logs |
| Transfer Gap | minimum sample size plus credible interval plus probability threshold |

Transfer Gap rule:

```text
Do not display numeric Transfer Gap without:
- minimum sample size;
- credible interval;
- probability threshold.
```

If insufficient:

```text
Display: profile in construction.
Do not display: precise gap, percentage, or false ranking.
```

## 7. Calibration Reports

Future reports live at:

```text
docs/calibration_reports/YYYY-MM-DD.md
```

Each report must contain:

- corpus size;
- engine profile;
- Stockfish version;
- formula versions;
- Review pipeline version;
- top-5 hit rate;
- domain confusion matrix;
- false positive examples;
- false negative examples;
- bootstrap stability results;
- recommended parameter changes;
- Metric Registry updates;
- Decision Log updates.

No calibration report should silently change product truth. Formula changes must
be versioned.

## 8. Manual Calibration Workflow

1. Collect PGNs.
2. Run Review with the current required profile.
3. Export candidate moments and audit rows.
4. Human annotates moments.
5. Compare automated candidates against human annotations.
6. Bootstrap top-k stability.
7. Adjust thresholds or weights only if evidence supports it.
8. Update formulas and Metric Registry.
9. Log the decision.

Important:

- Review calibration should not launch new product features.
- Calibration scripts must report formula versions.
- Stockfish profile changes must be recorded.
- A formula update without a registry update is incomplete.

## 9. Calibration vs Product UI

Rules:

- Uncalibrated metrics must not be shown as truth.
- Research metrics must never appear in normal UI.
- Audit metrics belong in debug or advanced details.
- Communication metrics must stay simple and honest.
- Action metrics may drive training before being visible, but their calibration
  status must be known.

Public UI examples:

Allowed:

- `NeuroScore 82 / 100`
- `Tactical priority`
- `Profile in construction`
- `Review confidence: indicative`

Avoid:

- raw `criticality_score`
- raw `diagnostic_gap`
- precise Transfer Gap without interval
- `CVaR_90` on short games
- `NeuroDiagnostic` as headline score

## Current Calibration Debt

The following are useful but not scientifically calibrated:

- `criticality_score_v1`
- `leverage_weight_v1`
- `transition_weight_v1`
- `persistence_weight_v1`
- `reliability_weight_v1`
- `neuro_severity_raw_v1`
- `neuro_score_diag_v1`
- domain scores
- Transfer Gap
- ETV/Priority score

The public Lichess-like family has external reference semantics, but
NeuroChess must still verify exact formula compatibility and name it honestly if
the implementation differs.

## Rules for future Codex missions

- Any new metric must be added to the Metric Registry.
- Any new action must be added to Action Registry.
- Any new screen or tab must be added to Screen Contracts.
- Any metric that drives training must have a calibration path in this document
  or in a linked calibration report.
- Any formula update must be versioned and logged.
- Otherwise the mission is incomplete.
