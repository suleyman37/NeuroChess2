# Formula And Score Rules

- Sources: `docs/FORMULAS_AND_METRICS.md` and `docs/FORMULA_IMPLEMENTATION_AUDIT.md`.
- Do not change formulas without explicit human/product decision. If changed, update docs, registry, schema/version fields, and tests/golden tests.
- Do not invent maturity. Mark heuristic/future/research states honestly.
- User-visible metrics must be understandable and honest; uncalibrated metrics must not be scientific truth.
- Visible Review NeuroScore is the coach communication score `coach_neuro_score_v1`, backed by `headline_neurochess_score_v1` aliases per V5.4 decision; reference precision remains separate.
- Do not expose NeuroDiagnostic, Diagnostic Gap, Headline Score, raw criticality, or raw domain scores in main beginner UI.
- Lichess-like public math and Stockfish WDL expected score are separate metric families; never merge them without explicit versioning.
- Practice result is an event, not a skill score by itself.
- Future Transfer Gap must be Bayesian and uncertainty-aware before visibility.