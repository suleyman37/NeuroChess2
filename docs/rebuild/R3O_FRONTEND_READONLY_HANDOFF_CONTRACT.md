# R3O - Frontend Read-Only Handoff Contract

## Context From R3M And R3N

R3M defined the test-first boundary for an existing detail route. R3N defined
the replay acceptance boundary for a read-only slice after those tests exist.

R3O keeps the next frontend-facing work honest. It does not authorize frontend
edits in this mission. It defines what a later frontend-read-only inspection
must verify before any UI integration is attempted.

## Single Product Question For The Next Morning Review

Can the current Review/Rejouer/Replay surfaces present a read-only existing
detail entry point without implying that a new training flow, result, schedule,
or score was created?

Morning review should answer that question with evidence before approving any
frontend branch for review.

## Readonly Frontend Inspection Scope

A later frontend-read-only branch may inspect:

- existing Review entry surfaces;
- existing replay or move-detail components;
- API client shape expectations;
- French copy currently used near read-only detail actions;
- empty, loading, and unavailable states;
- places where the UI might imply an active training action.

The inspection must not edit frontend code unless the mission explicitly allows
a frontend-read-only branch. During Night Mode, that branch must remain
separate from `road-to-V2`.

## User-Visible Acceptance Criteria

Any future UI contract should require:

- one clear read-only action;
- no competing primary CTA on the same surface;
- copy that says the detail is read-only;
- no claim that an attempt, score, schedule, or progression event was created;
- clear unavailable state when the backend returns no persisted detail;
- no visible raw diagnostic internals in the normal user path;
- no promise of a solution reveal unless a later contract permits it.

The user should understand that they are inspecting existing game context, not
starting a new training session.

## Evidence To Collect Without Changing Code

The future inspection report should include:

- route/API client references reviewed;
- screenshots or contact sheet if a frontend branch is opened;
- current copy excerpts relevant to read-only detail;
- list of UI entry points that could host the future action;
- risks where current copy could imply a write-like action;
- recommendation: `READY_TO_REVIEW`, `NEEDS_REWORK`, or `ABANDON_BRANCH`.

If screenshots are collected, they belong in external QA artifacts and should
not be committed unless a later mission explicitly asks for that.

## Explicit Non-Goals

R3O does not authorize:

- frontend code changes in this docs-only mission;
- backend route implementation;
- test implementation;
- package edits;
- environment or credential changes;
- direct product-code merge to `road-to-V2`;
- new active user-state flows;
- new score, schedule, or result claims.

## Stop Rules

Stop the future frontend-read-only branch if:

- product code is edited on `road-to-V2`;
- screenshots or visual evidence cannot be produced when required;
- copy implies a write-like action;
- the UI creates competing primary actions;
- the backend contract is missing or not proven;
- any forbidden path or package file changes.

## Handoff Note For The Next Supervisor Step

Next recommended mission:

```text
R3P_FRONTEND_READONLY_SURFACE_AUDIT
```

Type:

```text
frontend-readonly audit on ephemeral branch
```

The next supervisor should request evidence only: current UI surfaces, copy,
screenshots/contact sheet, and a morning-review recommendation. It should not
request implementation or merge product code to `road-to-V2`.
