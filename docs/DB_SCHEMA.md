# NeuroChess DB Schema Notes

Date: 2026-05-04

This is a concise V1 schema note for QA and Codex missions. The executable
schema remains `backend/neurochess/data/migrations.py`.

## Current User-Data Tables

The V1 profile/privacy export and delete flow treats these as local user data:

- `games`
- `moves`
- `position_analyses`
- `game_opening_classifications`
- `review_jobs`
- `game_reviews`
- `review_moments`
- `review_practice_sessions`
- `review_practice_attempts`
- `user_aliases`

`review_practice_sessions.items_json` is exported as derived
`practice_session_items`.

`review_practice_attempts.due_at` is exported as derived `due_reviews` when
present.

## Planned Or Optional Tables

The export/delete service is tolerant of these Plan3 tables being absent:

- `daily_plan_items`
- `skilltrace_states`
- `telemetry_events`
- `user_settings`
- `local_profile`

When those tables exist, `GET /api/export` should return their rows and
`DELETE /api/user-data?confirm=SUPPRIMER` should clear them.

## Profile / Privacy Delete Order

Deletion is ordered to avoid foreign-key or stale-reference problems:

1. Practice attempts.
2. Practice sessions.
3. Review moments.
4. Review summaries.
5. Review jobs.
6. Engine analyses.
7. Moves.
8. Game opening classifications.
9. Games.
10. Optional telemetry/daily/skill/settings/profile tables.
11. User aliases.

The delete flow must never remove Stockfish, migrations, docs, repo files, or
global Codex configuration.
