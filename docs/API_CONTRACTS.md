# NeuroChess API Contracts

Date: 2026-05-04

This document records V1 API contracts that are visible to the frontend or QA.
Plan1, Plan2, and Plan3 remain authoritative.

## Review / Practice Board Interaction V1

### `POST /review/practice/sessions/{session_id}/attempts`

- Purpose: persist one Practice attempt from the browser board or explicit
  fallback action.
- Frontend sends UCI through `attempted_uci`; backend remains authoritative for
  legal/correct/wrong/illegal grading.
- V1 accepted results include `best`, `very_good`, `acceptable`, `wrong`,
  `illegal`, `revealed`, and `skipped`.
- Persisted enriched fields include `item_id`, `time_spent_ms`, `hint_used`,
  `reveal_used`, `source_context`, `attempt_number`, and `due_at`.
- Review Practice item IDs may be legacy `review:{game_id}:ply:{ply}`.
- Daily Plan Practice item IDs use `training_item:{id}`.
- `source_context` is `review_practice` for Review sessions and `daily_plan`
  for Daily Plan sessions.
- The endpoint must not call Stockfish and must not change scoring formulas.

### Fake-engine QA timeout hook

- `FAKE_ENGINE_TIMEOUT_ON_INDEX` and `FAKE_ENGINE_TIMEOUT_ON_FEN_KEY` are
  test-only fake-engine hooks for browser/QA stall recovery.
- They raise `engine_hard_timeout` inside `FakeStockfishService`.
- They have no effect on real Stockfish and must not be used as product
  behavior.
- Browser proof: `scripts/browser_analysis_stall_recovery_smoke.mjs`.

### `GET /review/jobs/{job_id}`

- Purpose: return the current Review analysis job state for frontend polling.
- V1 anti-infinite-loop behavior: if a `running` or `finalizing` job is stale
  according to the watchdog, the service materializes it as retryable
  `status = "stalled"` with a calm recovery message instead of continuing to
  present it as active forever.
- Stalled payloads must include `retryable = true`, `current_phase = "stalled"`,
  `stalled_reason`, `error_message`, and `can_reconcile = true`.
- This does not modify Stockfish and does not cache timeout output as valid
  analysis.
- Browser proof: `scripts/browser_real_analysis_no_infinite_loop_smoke.mjs`.

## Training Items / Daily Plan V1

### `GET /api/training/daily-plan/today`

- Purpose: return today's local deterministic Daily Plan if it already exists.
- Side effects: none.
- Response: `daily_plan_v1` JSON with `status`, `item_count`,
  `estimated_minutes`, `message`, and `items`.
- Empty behavior: returns `status = "empty"` and an honest profile-building
  message when no plan exists or no durable item is available.
- User-facing UI must not show `selection_score` or internal debug fields.

### `POST /api/training/daily-plan`

- Purpose: create or return today's deterministic Daily Plan.
- Side effects: inserts rows in `daily_plan_items` only when no plan exists for
  the local user/date.
- Request body:
  - `max_items`: optional, default `6`, clamped by backend.
  - `duration_preference`: optional placeholder input; V1 service ignores it.
- Determinism: same DB input and same `plan_date` return the same ordered item
  IDs; existing daily plans are idempotent.
- Selection buckets, in priority order:
  - `due`
  - `failed_recent`
  - `recent_critical`
  - `diversity_fill`
- Diversity rule: avoid duplicate item IDs, duplicate
  `source_game_id + source_ply`, and more than two same `primary_tag` when
  alternatives exist.
- No Stockfish call, no formula change, no SkillTrace influence.

### `POST /api/training/daily-plan/practice`

- Purpose: create or return today's Daily Plan, then start a Practice session
  from its durable `training_items`.
- Response: normal Review Practice session payload with `scope = "daily_plan"`
  plus a `daily_plan` object.
- Attempts from these sessions keep enriched V1 fields and store
  `item_id = "training_item:{id}"`, `source_context = "daily_plan"`, and
  `due_at` from `simple_spaced_repetition_v1`.

## Profile / Privacy V1

### `GET /api/export`

- Purpose: export local-first V1 user data as JSON.
- Side effects: none.
- Must not start Stockfish, change scores, or mutate the database.
- Response: JSON object with `metadata` and stable sections.
- Metadata:
  - `app_name`
  - `schema_version`
  - `exported_at`
  - `storage_model`
  - `warning`
- Sections currently returned:
  - `games`
  - `moves`
  - `engine_analysis`
  - `review_jobs`
  - `review_summaries`
  - `review_moments`
  - `training_items`
  - `practice_sessions`
  - `practice_session_items`
  - `practice_attempts`
  - `due_reviews`
  - `daily_plan_items`
  - `skilltrace_states`
  - `telemetry_events`
  - `user_settings`
  - `local_profile`
  - `user_aliases`
- `games` includes `pgn_raw` when the game PGN exists.
- Missing V1/V2 tables return empty sections rather than crashing.

### `DELETE /api/user-data?confirm=SUPPRIMER`

- Purpose: delete local user data for V1 privacy control.
- Confirmation: exact query param `confirm=SUPPRIMER` is required.
- Missing or wrong confirmation returns HTTP 400 with
  `detail = "confirmation_required"`.
- Must not delete Stockfish, repo files, migrations, docs, or system files.
- Deletes currently available local user-data tables:
  - `daily_plan_items`
  - `training_items`
  - `review_practice_attempts`
  - `review_practice_sessions`
  - `review_moments`
  - `game_reviews`
  - `review_jobs`
  - `position_analyses`
  - `moves`
  - `game_opening_classifications`
  - `games`
  - `user_aliases`
- If future tables exist, delete also covers:
  - `telemetry_events`
  - `skilltrace_states`
  - `user_settings`
  - `local_profile`
- Response summary includes:
  - `deleted_at`
  - `games_deleted`
  - `moves_deleted`
  - `engine_analysis_deleted`
  - `reviews_deleted`
  - `training_items_deleted`
  - `daily_plan_items_deleted`
  - `practice_sessions_deleted`
  - `practice_attempts_deleted`
  - `due_items_deleted`
  - `telemetry_deleted`
  - `settings_deleted`
  - `total_deleted`

## QA Evidence

- Backend tests: `backend/tests/test_profile_privacy.py`.
- Daily Plan tests: `backend/tests/test_training_items_daily_plan.py`.
- Static frontend guard: `backend/tests/test_frontend_profile_privacy_static.py`.
- Browser smoke: `scripts/browser_profile_privacy_smoke.mjs`.
- Daily Plan browser smoke: `scripts/browser_daily_plan_smoke.mjs`.
