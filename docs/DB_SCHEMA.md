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
- `training_items`
- `daily_plan_items`
- `review_practice_sessions`
- `review_practice_attempts`
- `user_aliases`

`review_practice_sessions.items_json` is exported as derived
`practice_session_items`.

`review_practice_attempts.due_at` is exported as derived `due_reviews` when
present.

## Planned Or Optional Tables

The export/delete service is tolerant of these Plan3/future tables being absent:

- `skilltrace_states`
- `telemetry_events`
- `user_settings`
- `local_profile`

When those tables exist, `GET /api/export` should return their rows and
`DELETE /api/user-data?confirm=SUPPRIMER` should clear them.

## Training Items V1

Migration `0019_v5_6_training_items_daily_plan` creates durable
`training_items` generated from `review_moments`.

Required V1 columns:

- `id`
- `source_type`
- `source_game_id`
- `source_ply`
- `source_moment_id`
- `fen`
- `side_to_move`
- `best_move`
- `accepted_moves_json`
- `domain`
- `primary_tag`
- `secondary_tags_json`
- `difficulty_proxy`
- `criticality_score`
- `explanation_short`
- `takeaway`
- `created_at`
- `updated_at`
- `status`

Idempotency is enforced by a unique index on
`source_game_id + source_ply`. V1 generation creates at most five active items
per completed Review and never launches Stockfish.

## Daily Plan V1

Migration `0019_v5_6_training_items_daily_plan` creates `daily_plan_items`.

Required V1 columns:

- `id`
- `user_id`
- `plan_date`
- `item_id`
- `order_index`
- `selection_reason`
- `selection_score`
- `source_bucket`
- `created_at`

`user_id` is `local` in V1. A unique index on
`user_id + plan_date + item_id` keeps plan creation idempotent. The ordered
index on `user_id + plan_date + order_index` supports
`GET /api/training/daily-plan/today`.

## Profile / Privacy Delete Order

Deletion is ordered to avoid foreign-key or stale-reference problems:

1. Daily plan items.
2. Training items.
3. Practice attempts.
4. Practice sessions.
5. Review moments.
6. Review summaries.
7. Review jobs.
8. Engine analyses.
9. Moves.
10. Game opening classifications.
11. Games.
12. Optional telemetry/skill/settings/profile tables.
13. User aliases.

The delete flow must never remove Stockfish, migrations, docs, repo files, or
global Codex configuration.
