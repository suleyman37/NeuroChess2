# Adaptive Extension Phase

`ADAPTIVE_EXTENSION` sits between quota completion and DRAIN.

Transition:

`EXPANSION quota reached early -> ADAPTIVE_EXTENSION`

Allowed outcomes:

- `EXTEND_PRODUCT_OBJECTIVE`
- `CONSOLIDATE_EXISTING_BRANCHES`
- `ADD_TEST_OR_SMOKE_EVIDENCE`
- `RUN_VISUAL_REVIEW_OR_CANARY`
- `EVIDENCE_AMPLIFICATION`
- `PREPARE_MORNING_REPORT`
- `DRAIN`

Rules:

- ChatGPT Architect proposes; the Control Plane decides.
- No low-value filler.
- No new branch if branch orthogonality risk is high.
- No new product mission when remaining time is too short.
- No visual retry beyond the visual halting limit.
- No meta-fix during A20.5 or the first A21 run.

For A21, `PASS_EARLY_EXCELLENCE` is allowed only after adaptive extension has
been considered and the Drain Permit allows DRAIN.
