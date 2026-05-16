# Autonomy Limits And Checkpoints

## Purpose

This document defines the operating limits for A9 and later small autonomous
runs. Its job is to keep Codex from turning a bounded pilot into an open-ended
work session.

## A9 Step Limit

A9 has exactly three micro-missions:

- Step 1: create the A9 pilot document.
- Step 2: create this autonomy checkpoint document.
- Step 3: create one safe decision or contract document if the supervisor
  prompt passes the firewall.

After step 3, Codex must stop. It must not ask for step 4, infer a new task, or
continue into implementation work.

## Continuation Gates

Codex may continue from one A9 step to the next only when all gates pass:

- the previous step has exactly one allowed changed file;
- `git diff --check` passes;
- the commit succeeds;
- the push to `origin road-to-V2` succeeds;
- HEAD matches `origin/road-to-V2`;
- no forbidden path changed;
- the next supervisor response has a valid nonce-bound DONE block;
- the Prompt Firewall marks the next MICRO_PROMPT eligible.

## Timebox Checkpoints

A9 uses the A8C timing defaults:

- warning threshold: 8 minutes of active Codex work;
- checkpoint threshold: 10 minutes of active Codex work;
- hard kill: disabled;
- soft stop: enabled.

If a checkpoint is due, Codex must stop the current mission flow, preserve
status and patch evidence, and report the suspected next action. It must not
expand the scope to compensate for lost time.

## Strategic Pulse Before Continuation

Before each next micro-mission, Codex should perform a short direction check:

- latest HEAD;
- origin alignment;
- changed files;
- diff stat;
- check result;
- alarms or bridge issues;
- whether the next step still matches the A9 three-step limit.

The pulse decision is limited to continue, shrink, or stop. It is not a license
to create a new mission outside the pilot.

## Mechanical Stop Rules

Stop immediately if any of these are true:

- a forbidden path changes;
- more than one file changes;
- `git diff --check` fails;
- the bridge cannot produce a stable nonce-bound response;
- the Prompt Firewall rejects the prompt after the allowed repair attempt;
- a response asks for product implementation;
- a response asks for A9 step 4.

## Evidence Before Continuation

Each step must preserve:

- supervisor raw response path;
- extracted MICRO_PROMPT path;
- Prompt Firewall result;
- changed file list;
- diff stat;
- check result;
- commit hash;
- push result;
- explicit statement that forbidden paths were untouched.

## Commit Boundary

For this document, GO requires:

- only `docs/autopilot/AUTONOMY_LIMITS_AND_CHECKPOINTS.md` changed;
- no staged files before controlled staging;
- `git diff --check` passes;
- commit and push complete successfully.

NO-GO requires stopping the pilot before step 3.
