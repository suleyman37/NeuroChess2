# Morning Report Dry-Run Hook

A long run should not finish with scattered evidence and a broken report generator. A20A adds a dry-run hook that proves the reporting path can read a small fixture or evidence index and produce the required morning sections.

`ops/autopilot/run_morning_report_dryrun.ps1` verifies:

- run summary
- branches
- commits
- E2E deliverables
- evidence
- risks
- branch classifications
- recommended next action

This is not the full A22 Morning Intelligence Report. It is a preflight check that A20.5/A21 can generate a minimal report artifact before starting a long run.
