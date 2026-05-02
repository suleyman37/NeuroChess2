# Engine Analysis Data Model

- Source: `docs/data_model.md`.
- `position_analyses` idempotence key: `(fen, engine, engine_version, depth, multipv, analysis_kind, schema_version)`; keep all key columns non-null.
- Status values: `pending`, `running`, `done`, `failed`.
- Analysis kinds: `shallow` for immediate visible eval, `deep` for durable review. V4+ Review should read only `analysis_kind='deep' AND status='done'`.
- Rich engine output lives in `analysis_json`, not separate SQL columns: top moves, PV, evals, mate, analysis time, schema version.
- `eval_cp` and `mate_in` are POV White. `eval_pov_side_to_move_cp` is derived per line and must not replace canonical White POV.
- PV stores UCI only; SAN in PV is fragile and must be derived by replay when needed.
- Schema bumps require a new version constant, tests, backwards-readable old rows, and no silent reinterpretation.
- Shallow/live must not be used as review-stabilized deep evidence.