# Control Plane Mission Lifecycle

The A17 dry-run lifecycle is a deterministic sequence. Execution remains a
placeholder; all checks run on fixtures.

1. Proposed mission
2. Internal skill selection
3. NC-MP/2 parse and lint
4. Mission Contract validation
5. Shadow Plan comparison
6. Product Gate / North Star review
7. Mission Hash computation
8. Mission repeat check
9. Goldilocks scope gate
10. Execution placeholder
11. E2E Deliverable Score
12. Forward Progress check
13. Progress Ledger append
14. Prompt Ledger append
15. Night Mode phase transition
16. Integration report

## Deterministic Stops

If red-tier scope, repeated mission hashes, no forward progress, invalid
contracts, Shadow Plan mismatch, or Goldilocks rejection appear, the Control
Plane returns a stop verdict before execution.

## Placeholder Execution

The dry run never executes product work. It records what the Control Plane would
allow or reject, then writes evidence to the external dry-run report.
