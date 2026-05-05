# Release Radar

Release Radar summarizes current V1 posture. It is not a product plan and does
not override Plan1, Plan2, or Plan3.

## Completed V1 Trust Blocks

- Profile/Privacy V1.
- Training items / Daily Plan V1.
- Board exploration/runtime stabilization.
- Degraded states / anti-tilt.
- Mobile/responsive/a11y minimum.
- Standard analysis last-ply hang fixed.
- NeuroScore weighting updated to
  `0.35 * reference_accuracy + 0.65 * neuro_score_diag`.
- Practice feedback contradiction fixed.

## Current P0 Status

- No known open P0 after `f308568`.
- Real-user manual validation remains recommended because browser smokes use
  controlled temp environments and fixtures.

## Current External User Posture

- Controlled local testers: possible after QA release gate and manual pilot
  checklist.
- Public or broad external users: NO-GO until release candidate evidence and
  manual pilot checklist are complete.

## Recommended Next Missions

1. `P1.I18N-STRINGS-CATALOG-V1`
2. `P1.QA-RELEASE-CANDIDATE-V1`
3. `P1.SKILLTRACE-BETA-SHADOW-V1` only after QA/i18n readiness
4. `P1.PROGRESSION-COMPACT-POLISH-V1`
5. `P1.APP-STRUCTURE-SAFE-EXTRACTION-V1`

## Blocked Until Later

- Candidate Trainer.
- LLM coach.
- Intent Layer.
- Transfer Gap visible.
- V2/V3 features.

## Release Gate Reminder

Before any external release candidate:

- run plan guard;
- run backend suite;
- run frontend build/typecheck;
- run Golden Flow browser smokes;
- verify Profile/Privacy export/delete on temp DB;
- verify no forbidden V1 labels;
- verify no raw formulas, raw evidence JSON, or internal metrics in normal UI;
- write an evidence pack;
- make a Go/No-Go decision in the final report.
