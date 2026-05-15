# A5 Two-Step Micro-Loop Pilot

## 1. Purpose

A5 tests whether the supervised micro-loop can chain two safe docs-only missions without drifting into open-ended autonomy.

The pilot proves only the orchestration path:
- ask ChatGPT Web Supervisor for one bounded micro-prompt;
- validate the response through Prompt Firewall;
- execute exactly one allowed file;
- run deterministic checks;
- commit and push when clean;
- repeat once;
- stop after exactly two successful micro-missions.

## 2. Scope

A5 is docs-only.

Allowed outputs are limited to:
- `docs/autopilot/A5_TWO_STEP_MICRO_LOOP_PILOT.md`;
- one later docs/rebuild decision document if the second supervised prompt passes.

Forbidden scope:
- frontend changes;
- backend changes;
- plan changes;
- package changes;
- `App.tsx`;
- product implementation;
- autonomous continuation after the second mission.

## 3. Bridge Gates

Before each live supervisor call, the executor must confirm:
- dedicated ChatGPT profile is not locked;
- dry-run bridge path still passes;
- live request uses a nonce-bound response;
- Prompt Firewall accepts the extracted MICRO_PROMPT.

If any gate fails, the pilot stops and writes an external report.

## 4. One-File Rule

Each micro-mission may create or edit one expected file only.

Micro-mission 1:
- `docs/autopilot/A5_TWO_STEP_MICRO_LOOP_PILOT.md`

Micro-mission 2:
- one docs/rebuild decision document, only after micro-mission 1 is committed and pushed.

## 5. Commit And Push Rule

Each step may commit and push only when:
- the changed path exactly matches the allowed file;
- `git diff --check` passes;
- no staged file exists before controlled staging;
- no product code changed.

Staging must use explicit file paths. `git add -A` is forbidden.

## 6. Failure Rules

Stop immediately if:
- ChatGPT returns an invalid response;
- Prompt Firewall rejects the micro-prompt after one repair attempt;
- REQUEST_MORE cannot be satisfied within the configured limit;
- more than one file changes;
- any forbidden path changes;
- deterministic checks fail.

No broad repair or third mission is allowed in this pilot.

## 7. What A5 Proves

A successful A5 run proves:
- one supervised docs-only mission can lead into one more supervised docs-only mission;
- commit/push can happen between steps;
- the loop can stop cleanly after the configured mission count;
- the repo can remain clean after chained promotion.

## 8. What A5 Does Not Prove

A5 does not prove:
- multi-step autonomous product work;
- UI mission safety;
- backend mission safety;
- red-tier promotion;
- long scheduler operation;
- visual judge integration.

## 9. Stop Condition

After exactly two successful micro-missions, the executor must stop.

Do not ask for a third supervisor prompt.
Do not continue into another stage.
