# Night Mode Morning Review Report

## Purpose

The morning review report is the handoff from unattended Night Mode to a human
or supervised Codex session. It turns overnight work into reviewable decisions
instead of silently merging risky changes.

## Required Report Fields

Each report must include:

- run id;
- start and end time;
- base branch and base HEAD;
- final branch and final HEAD;
- missions attempted, succeeded, failed, and quarantined;
- branches created;
- commits created;
- files changed;
- checks run;
- evidence pack paths;
- screenshots/contact sheets if frontend-readonly work occurred;
- anti-mutation evidence if backend-readonly work occurred;
- stop reason;
- Strategic Pulse decisions;
- unresolved risks;
- morning recommendation.

## Branch Review Status

Each product branch must receive one status:

- `READY_TO_REVIEW`
- `NEEDS_REWORK`
- `ABANDON_BRANCH`
- `QUARANTINE_REQUIRED`

## Evidence Summary

The report must summarize evidence without embedding long logs or patches by
default. It should link to external artifacts and call out missing evidence as
blocking.

## Next Action

The report must recommend exactly one next action. It must not launch another
mission by itself.
