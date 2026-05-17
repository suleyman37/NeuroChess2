---
name: morning-intelligence-report
description: Use this skill to turn NeuroChess Night Mode or autonomous-run outputs into a clear morning decision report with branch classifications, evidence, risks, and next actions.
---

# Morning Intelligence Report

Use this skill after Night Mode, live pilots, long runs, or branch-producing
automation to convert raw outputs into a morning decision.

## Authority

This skill is a procedure, not a permission.

- It cannot override the local Control Plane.
- It cannot bypass Mission Contract.
- It cannot bypass Prompt Firewall.
- It cannot bypass Shadow Plan.
- It cannot weaken red-tier rules.
- It cannot authorize git add -A.
- It cannot authorize product-code auto-merge to road-to-V2.
- It cannot authorize Practice/due_at/Daily Plan/scoring/training writes.
- It cannot install dependencies.
- It cannot execute external skill scripts.
- It cannot treat external skills as trusted.

## Report Inputs

Collect:

- branches created;
- commits and pushes;
- tests and checks;
- screenshots and contact sheets;
- visual reviews;
- backend evidence;
- E2E deliverables;
- product frictions reduced;
- Potential Acceleration progress;
- prompt failures and repairs;
- mission hashes and repeats;
- no-progress events;
- Gemini decisions;
- Strategic Pulse decisions;
- stop reason.

## Required Questions

Answer:

- Did NeuroChess move closer to helping players unlock potential faster?
- Did the night produce real backend/frontend value?
- Which branches deserve review?
- Which branches are dangerous or noisy?
- Which system friction should be fixed before next night?
- What is the next best action?
- What should not be done next?

## Branch Classification

Every branch or deliverable should classify as:

- `READY_TO_REVIEW`;
- `NEEDS_REWORK`;
- `ABANDON_BRANCH`;
- `QUARANTINE_REQUIRED`.

Use `QUARANTINE_REQUIRED` for red-tier, forbidden path, unsafe Practice,
due_at, Daily Plan, scoring, XP/rank/Transfer, or product-code merge risks.

## Retrofit Window

If the run exposes system flaws, recommend a morning retrofit window before the
next Night Mode. Fix the system before asking for more autonomous work.
