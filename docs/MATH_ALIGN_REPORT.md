# V5.4.REVIEW-SCORE-UX-R1 - Coach NeuroScore Restoration

Date: 2026-05-02

## Summary

V5.4.REVIEW-SCORE-UX-R1 restores the visible Review `NeuroScore` as a
coach communication score:

- visible `NeuroScore` now uses the severity-aware coach composite score;
- the source is `coach_neuro_score` / `*_coach_neuro_score`, backed by the
  existing `headline_neurochess_score_v2` family;
- Lichess-like precision remains visible as `Precision de reference`;
- diagnostic gap remains internal/audit and does not explain the main Review
  summary;
- NeuroMonitor uses the coach score for its overall score and keeps domain
  signals qualitative until calibrated.

This is a UX/payload mapping correction. It does not change engine analysis,
Stockfish, Lichess constants, NeuroDiagnostic formulas, migrations, endpoints,
LLM, V6, or Memory Loop.

## Visible NeuroScore Source

Coach aliases are exposed in the Review payload:

- `white_coach_neuro_score`
- `black_coach_neuro_score`
- `user_coach_neuro_score`
- `opponent_coach_neuro_score`
- `coach_neuro_score`
- `coach_score_formula_version = "coach_neuro_score_v1"`

Mapping:

- `white_coach_neuro_score = white_headline_neurochess_score`
- `black_coach_neuro_score = black_headline_neurochess_score`
- `user_coach_neuro_score = user_headline_neurochess_score`
- `opponent_coach_neuro_score = opponent_headline_neurochess_score`
- `coach_neuro_score = headline_neurochess_score`

The coach score is a severity-aware communication metric. It is not presented
as a scientific or neurological truth.

Current implementation:

```text
coach_neuro_score_v1 =
  headline_neurochess_score_v2 =
  clamp(0.35 * lichess_like_precision + 0.65 * neuro_diagnostic_score, 0, 100)
```

When diagnostic score is unavailable, the existing legacy fallback can use the
diagnostic-gap path or fall back to reference precision. This mission did not
change those formula constants.

Frontend visible score fallback order:

1. `*_coach_neuro_score`
2. `*_headline_neurochess_score`
3. `*_public_neuro_score` / Lichess-like precision when no coach score exists
4. score unavailable

## Reference Precision Source

Reference precision remains the public Lichess-like score family:

- `white_public_neuro_score`
- `black_public_neuro_score`
- `user_public_neuro_score`
- `opponent_public_neuro_score`
- `public_neuro_score`
- `public_score_formula_version = "public_neuro_score_lichess_like_v1"`

Mapping remains:

- `white_public_neuro_score = white_lichess_like_accuracy`
- `black_public_neuro_score = black_lichess_like_accuracy`
- `user_public_neuro_score = user_lichess_like_accuracy`
- `opponent_public_neuro_score = opponent_lichess_like_accuracy`

UI copy: `Precision de reference : XX %`.

## Headline Score Status

`headline_neurochess_score_v2` is no longer rejected as a visible coach signal.
It is the existing implementation backing `coach_neuro_score_v1`.

Rules:

- it may drive the visible `NeuroScore` coach value;
- it must not be described as a calibrated scientific truth;
- it must not be labelled `Headline Score` in user-facing UI;
- its diagnostic components remain in technical/audit details.

## Diagnostic Gap Visibility

`diagnostic_gap` remains available for payload compatibility and audit.

It must not drive:

- the main Review score card;
- the main coach summary;
- the visible player comparison;
- any user-facing quality claim.

Allowed location: collapsed `Details techniques / audit`, described as an
internal uncalibrated audit metric.

## Qualitative Game Label

The Review label now prioritizes:

- coach score;
- number of critical/decisive moments;
- dominant tags such as `missed_opportunity`, `conversion_issue`,
  `defensive_resource_missed`, and `cluster`;
- public precision only as a secondary signal, especially when high precision
  hides severe moments.

Examples:

- `Partie solide`
- `Partie irreguliere`
- `Partie fragile`
- `Partie gagnee malgre erreurs`
- `Partie a bascule`
- `Partie tactique`
- `Partie mal convertie`
- `Partie defensive difficile`
- `Partie a analyser`

This remains a communication metric. It does not drive training.

## NeuroMonitor Domain Display

NeuroMonitor now uses the coach score for the overall visible score.

Domain cards still use internal numeric signals for color, glow, and priority,
but the UI exposes qualitative states only:

- `Prioritaire`
- `Fragile`
- `Stable`
- `Solide`
- `Critique`
- `Profil en construction`

The `Plan` domain remains exploratory. Calculation must not appear as a
calibrated score without candidate logs.

## Review Learn Friction

The correction step keeps line comparison collapsed by default. The narrative
card remains the primary surface:

- played move;
- problem;
- correction;
- reason;
- impact;
- quality.

The challenge step still hides solution, PV, best branch, comparison, and
`Voir la ligne` before correction.

## Remaining Risks

- `coach_neuro_score_v1` is severity-aware but still heuristic and needs
  calibration before being described as more than a coach communication score.
- Legacy cached Reviews may need metric cache refresh to expose coach aliases;
  frontend fallbacks handle old payloads.
- NeuroMonitor domain visuals still depend on heuristic internal scores for
  rendering, even though percentages are hidden.

## Next Recommended Mission

Recommended:

```text
V5.4.SCORE-CALIBRATION-1 - Coach NeuroScore Calibration Corpus
```

Goals:

- build a small labelled corpus for coach-score severity perception;
- compare pure Lichess-like precision against coach composite score;
- tune only after empirical review, not in this R1 mission;
- preserve audit visibility for diagnostic components.

## Confirmation

- Review UX/payload mapping only;
- no engine change;
- no formula constant change;
- no Stockfish change;
- no LLM;
- no V6;
- no Memory Loop.
