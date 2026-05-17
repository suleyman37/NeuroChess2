# Dynamic Objective Replanning

A20.5 proved that the control plane can create safe E2E deliverables quickly.
It also showed that static quotas can stop a run before the target wall clock is
meaningfully used.

Dynamic Objective Replanning changes the post-quota behavior. When initial
quotas are reached early, the run enters `ADAPTIVE_EXTENSION` instead of
automatic `DRAIN`. ChatGPT Architect may propose the next useful objective, but
the local Control Plane remains the authority.

The Control Plane must still require:

- bridge availability and human-verification guards;
- Policy Kernel Freeze;
- budget/quota checks;
- kill switch check;
- branch orthogonality;
- environment hygiene;
- Mission Contract and Shadow Plan;
- Goldilocks and Product Impact gates;
- visual halting and canary policy when visual work is involved.

ChatGPT Architect may choose one structured action:

- `EXTEND_PRODUCT_OBJECTIVE`
- `CONSOLIDATE_EXISTING_BRANCHES`
- `ADD_TEST_OR_SMOKE_EVIDENCE`
- `RUN_VISUAL_REVIEW_OR_CANARY`
- `EVIDENCE_AMPLIFICATION`
- `PREPARE_MORNING_REPORT`
- `DRAIN`
- `STOP`

The Control Plane can reject any action. A21 must not accept a new objective
without a Marginal Value Gate pass, a safe branch plan, and enough remaining
time for meaningful work.
