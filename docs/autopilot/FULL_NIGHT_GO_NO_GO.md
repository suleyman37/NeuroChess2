# Full Night Go/No-Go

The final Go/No-Go gate decides whether the next mission may be `A20AY_FULL_NIGHT_REAL_PIXEL_RUN`.

## Inputs

- NightReadinessV2.
- Full Night Control Policy.
- Kill switch test.
- ntfy alert dry-run/local fallback test.
- Branch quarantine test.
- Morning report contract test.
- Meta drift guard test.
- Score guard test.
- Safety scans.
- Latest A20AW report.

## Outputs

- `READY_FOR_FULL_NIGHT`
- `READY_FOR_LIMITED_SECOND_REHEARSAL`
- `NO_GO`

## Ready Criteria

`READY_FOR_FULL_NIGHT` requires all hardening tests to pass, no safety violations, no live or user dependency, a working kill switch, a valid morning report contract, valid branch quarantine, valid meta-drift and score guards, and A20AW evidence showing a full-night candidate.

Anything less must return a limited second rehearsal or no-go result.
