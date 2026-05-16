# Product Friction Register

## Purpose

The Product Friction Register is the product-intelligence memory for future
mission selection. A mission should reduce, unblock, or clarify at least one
friction unless it is a necessary safety-critical mission.

## Fields

Each friction entry contains:

- `friction_id`;
- `title`;
- `surface`;
- `severity` from 1 to 5;
- `status`: `active`, `reduced`, `blocked`, or `resolved`;
- `related_loop_steps`;
- `evidence`;
- `next_possible_mission`.

## Lifecycle

Friction starts as `active`, may become `blocked` when a safety dependency is
missing, becomes `reduced` when a mission creates measurable relief, and becomes
`resolved` only when the player-facing problem is no longer present.

## Seed Frictions

The seed register lives at
`ops/autopilot/product_friction_register.seed.jsonl` and includes stable IDs F1
through F15. Future Product Impact Reviews should reference these IDs when
possible.
