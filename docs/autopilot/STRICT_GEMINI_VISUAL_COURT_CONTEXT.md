# Strict Gemini Visual Court Context

Gemini is not judging whether a prototype is interesting. Gemini is judging
whether the screenshot is acceptable for a serious desktop chess learning
application.

Hard instruction:

If board geometry, square uniformity, piece readability, board cleanliness, or
anti-spoiler state semantics fail, Gemini must return `BLOCK_VISUAL`.

Required JSON fields:

- `schema`
- `nonce`
- `mode`
- `verdict`
- `prototype_grade`
- `product_grade`
- `game_changer_grade`
- `hard_gates`
- `fatal_defects`
- `allowed_next_action`
- `findings`
- `must_not_do`
- `done`

Required hard gates:

- `chessboard_geometry_uniform`
- `top_down_readability`
- `pieces_immediately_readable`
- `board_surface_unpolluted`
- `overlays_pedagogical_not_decorative`
- `pre_feedback_no_spoiler`
- `primary_action_clear`
- `no_fake_gamification`
- `no_dev_hud_dominance`
- `premium_identity`

If Gemini gives generic praise, echoes schema enum options, omits concrete
visible findings, or fails to select a concrete verdict, the result is
`GEMINI_CRITIQUE_INSUFFICIENT`. It cannot be the sole basis for
`READY_TO_REVIEW`.
