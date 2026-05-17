# E2E Deliverable Score

E2E Deliverable Score is produced from Control Plane evidence, not LLM
self-report. A deliverable counts only when required evidence is present and
deterministic gates match.

## Backend E2E Deliverable

Backend evidence requires:

- branch exists;
- commit exists;
- targeted tests ran;
- anti-mutation evidence when read-only;
- Mission Contract `MATCH`;
- Shadow Plan `MATCH`;
- no forbidden path;
- external evidence pack path.

## Frontend E2E Deliverable

Frontend evidence requires:

- branch exists;
- commit exists;
- screenshots and contact sheet;
- visual review brief;
- Gemini or ChatGPT visual decision when available;
- Mission Contract `MATCH`;
- Shadow Plan `MATCH`;
- no forbidden UI claims;
- external evidence pack path.

## Docs Enabler

Docs-only work does not count as E2E by default. It may count as
`ENABLER_DELIVERABLE` only when Product Impact Review says it unblocks a
specific product mission.

## Outputs

- `E2E_DELIVERABLE_PASS`
- `E2E_DELIVERABLE_PARTIAL`
- `E2E_DELIVERABLE_FAIL`
- `ENABLER_DELIVERABLE`
- `NOT_DELIVERABLE`
