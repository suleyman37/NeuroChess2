# Visual Halting Limit

Codex should not spend a long run blindly tweaking CSS. Visual audits are evidence gates, not an invitation to pixel-push.

## Verdict Handling

- `PASS_VISUAL`: continue if all other gates pass.
- `WARNING_VISUAL`: allow at most one semantic fix attempt.
- `BLOCK_VISUAL`: classify the branch as `NEEDS_REWORK` or `QUARANTINE_REQUIRED`; do not perform cosmetic retries during the long run.

## One-Shot Fix

A semantic fix may address a clear truthfulness issue, missing state, or desktop layout failure. It may not be arbitrary spacing, padding, color, or "make it prettier" work.

After one failed warning fix, classify the branch as `READY_TO_REVIEW_WITH_VISUAL_DEBT` or `NEEDS_REWORK` and stop visual tweaking.

## Forbidden During Long Runs

- repeated CSS value tweaking
- broad redesign
- package installation for styling
- new visual system adoption
- shadcn/component installation without a dedicated mission
