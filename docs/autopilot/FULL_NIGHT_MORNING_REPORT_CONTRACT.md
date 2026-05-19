# Full Night Morning Report Contract

Every true full-night run must end with a morning report matching `ops/autopilot/morning_report_schema.json`.

## Required Fields

1. Runtime.
2. Iterations.
3. Pixel deltas.
4. Useful pixel deltas.
5. Weak deltas.
6. Screenshots path.
7. Mission Doctor summary.
8. Failure Ledger summary.
9. Protocol Memory update.
10. Score before/after.
11. NightReadinessV2 result.
12. Safety scan.
13. Final git status.
14. Recommended next step.
15. Go/No-Go.

## Go/No-Go Values

- `GO_FOR_REVIEW`
- `GO_FOR_SECOND_REHEARSAL`
- `NO_GO_SAFETY`
- `NO_GO_WEAK_OUTPUT`
- `NO_GO_TEST_FAILURE`

The report must not claim public release, A21 launch, or road merge unless those were separately authorized and performed, which A20AX does not authorize.
