# NeuroChess Autonomous Design Judgment

A20G creates the autonomous design judgment layer. It does not change product
frontend code, call live ChatGPT, call live Gemini, download assets, or require
runtime user approval.

Purpose:

- approximate Suleyman's known visual taste;
- let future autonomous frontend missions compare design candidates;
- block generic SaaS drift before a branch is treated as reviewable;
- keep the user out of the runtime approval loop;
- preserve post-run calibration through the Visual Taste Ledger.

The Control Plane remains final authority. No design judge can override
red-tier policy, Mission Contract, Shadow Plan, Visual Halting Limit, branch
safety, product truth, or the code-native 3D Board Stage doctrine.

## Judgment Stack

1. Deterministic design rubric.
2. Suleyman Taste Proxy.
3. Anti-Generic Brutality Gate.
4. Reference Comparison Harness.
5. Gemini Visual Court when screenshots exist.
6. ChatGPT Visual Court as secondary judge when policy requires it.
7. Tournament resolver.

Allowed autonomous outcomes:

- `AUTO_PASS_DESIGN`
- `AUTO_WARNING_VISUAL_DEBT`
- `AUTO_BLOCK_GENERIC_UI`
- `AUTO_NO_WINNER`
- `NEEDS_HUMAN_REVIEW_AFTER_RUN`

No outcome may ask the user to approve a design during runtime.

## Runtime Rule

If the autonomous jury cannot select a safe winner, it must return
`AUTO_NO_WINNER` or `NEEDS_HUMAN_REVIEW_AFTER_RUN` and preserve evidence for
morning review.
