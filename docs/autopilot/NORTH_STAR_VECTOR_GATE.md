# North Star Vector Gate

Every Shadow Plan for product or Night Mode work must include a
`north_star_vector`. The vector proves the mission is tied to a real product
friction and the Potential Unlock Loop.

## Required Fields

- `target_friction_id`
- `potential_unlock_loop_steps`
- `player_value_claim`
- `evidence_expected`
- `fake_progress_risk`
- `expected_potential_acceleration_score`
- `why_this_matters`

## Rejection Handling

If Gemini or another auditor rejects the North Star Vector:

- Control Plane blocks the mission;
- ChatGPT Planner receives the rejection reason;
- Planner must propose a different target from the Product Friction Register;
- the same mission hash is forbidden;
- the same `target_friction_id` may be retried once only with `NARROW`;
- after two consecutive North Star rejections, force Strategic Pulse;
- after Strategic Pulse still fails, enter `DRAIN` or
  `STOP_PRODUCT_DIRECTION_UNCLEAR`.

## Relationship To Product Work

The gate prevents safe automation from drifting into low-value work. Product
missions must improve real-game decisions, active replay, honest feedback,
repetition, transfer verification, or adaptive planning.
