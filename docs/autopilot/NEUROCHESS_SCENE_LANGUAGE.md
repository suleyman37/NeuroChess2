# NeuroChess Scene Language

The NeuroChess Scene Language is a declarative JSON contract for future
code-native 3D board-stage work. It tells the renderer what learning state is
being visualized and what visual behavior is allowed.

The language is metadata and validation first. It does not require Spline,
manual exports, binary assets, or package installation.

Required fields:

- `schema_version`
- `scene_id`
- `learning_state`
- `board_role`
- `board_readability_rule`
- `camera_mode`
- `atmosphere_family`
- `reference_inspirations`
- `allowed_effects`
- `forbidden_effects`
- `artifacts`
- `motion_policy`
- `performance_budget`
- `accessibility_mode`
- `screenshot_requirements`
- `visual_audit_questions`

Allowed learning states:

- `observe`
- `detect`
- `try_before_feedback`
- `feedback_success`
- `feedback_miss`
- `replay`
- `explore`
- `memory`
- `transfer`

Allowed camera modes:

- `locked_orthographic`
- `subtle_parallax`
- `fixed_perspective_low_motion`

Forbidden camera modes:

- `free_camera_spin`
- `dramatic_orbit_loop`
- `zoom_jumps`
- `motion_sickness_camera`

Hard validation failures:

- forbidden camera mode;
- board obscured;
- meaningless glow;
- fake XP/rank/Transfer;
- fake neuroscience;
- fake Elo;
- mobile-first layout;
- missing learning state;
- missing board readability rule;
- missing reduced-motion fallback;
- missing performance budget.

Example core rule:

```json
{
  "board_readability_rule": "Board remains central, stable, readable, and precise; if 3D reduces readability it recedes."
}
```

The scene language is not an animation script. It is a safety and intent
contract that future renderer code must obey.
