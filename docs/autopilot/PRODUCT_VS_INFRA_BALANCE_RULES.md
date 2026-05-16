# Product Vs Infra Balance Rules

## Categories

- `PRODUCT_CORE`: directly improves the player-facing learning loop.
- `PRODUCT_ENABLER`: unblocks a product feature, test, route, or safety
  condition.
- `AUTOMATION_SAFETY`: protects future work from corruption.
- `AUTOMATION_EFFICIENCY`: makes agents faster or cheaper, but not directly
  player-facing.
- `DISTRACTION`: does not reduce product friction or safety risk.

## Policy

Product-safe Night Mode should prefer `PRODUCT_CORE` and `PRODUCT_ENABLER`.
Automation-only missions must declare the product mission they unblock.

More than two automation missions in a row require Strategic Pulse. Three
missions without product friction reduction require Strategic Pulse or
`RETURN_TO_PRODUCT`.
