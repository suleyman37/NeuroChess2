# NeuroChess API Contracts

Date: 2026-05-04

This document records V1 API contracts that are visible to the frontend or QA.
Plan1, Plan2, and Plan3 remain authoritative.

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
  - `daily_plan_items`
  - `skilltrace_states`
  - `user_settings`
  - `local_profile`
- Response summary includes:
  - `deleted_at`
  - `games_deleted`
  - `moves_deleted`
  - `engine_analysis_deleted`
  - `reviews_deleted`
  - `practice_sessions_deleted`
  - `practice_attempts_deleted`
  - `due_items_deleted`
  - `telemetry_deleted`
  - `settings_deleted`
  - `total_deleted`

## QA Evidence

- Backend tests: `backend/tests/test_profile_privacy.py`.
- Static frontend guard: `backend/tests/test_frontend_profile_privacy_static.py`.
- Browser smoke: `scripts/browser_profile_privacy_smoke.mjs`.
