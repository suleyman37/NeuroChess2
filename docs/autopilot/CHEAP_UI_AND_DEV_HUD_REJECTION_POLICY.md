# Cheap UI And DEV-HUD Rejection Policy

DEV-only labels are useful for evidence, but they must not dominate visual
judgment. A future NeuroChess surface should feel like a product-grade command
center, not a debug panel wrapped around a board.

Block or warn if:

- DEV labels dominate visual judgment;
- panels feel like debug output;
- the stage feels like a CSS demo;
- generic HUD boxes dominate;
- there is no product-grade first viewport;
- there is no sense of place;
- 3D is decorative rather than meaningful;
- the interface feels like proof scaffold rather than a product direction.

Outputs:

- `PASS_PRODUCT_UI`
- `WARN_DEV_HUD`
- `BLOCK_CHEAP_UI`

If `BLOCK_CHEAP_UI` occurs, a candidate cannot win a tournament. If
`WARN_DEV_HUD` occurs, the candidate may remain prototype-useful but should not
be treated as product-grade without rework.
