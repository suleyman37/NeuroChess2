# Objective Reservoir Protocol

The Objective Reservoir is a ranked list of safe continuation candidates. It
prevents long runs from depending on a single static quota.

Sources:

- Product Friction Register;
- R3K/R3L/R3M/R3N/R3O/R3P/R3Q context docs;
- A19X, A20, and A20.5 reports;
- existing branch classifications;
- Night Mode phase;
- branch file locks;
- environment hygiene;
- evidence index;
- remaining time and budget.

Candidate categories:

- `PRODUCT_CORE`
- `PRODUCT_ENABLER`
- `BACKEND_READONLY_E2E`
- `FRONTEND_VISUAL_E2E`
- `TEST_OR_SMOKE_EVIDENCE`
- `BRANCH_CONSOLIDATION`
- `VISUAL_REVIEW_OR_CANARY`
- `EVIDENCE_AMPLIFICATION`
- `MORNING_REPORT_PREP`
- `DISTRACTION`

Every candidate records expected files, expected time, branch overlap risk,
red-tier risk, evidence expected, marginal value, confidence, why now, why not,
and recommended phase.

The reservoir refreshes after every mission. A candidate is only an option; it
does not authorize execution.
