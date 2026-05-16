# Shadow Plan Integration With NC-MP/2

## NC-MP/2 Inputs

NC-MP/2 provides normalized mission fields:

- id;
- tier;
- type;
- allowed paths;
- denied paths;
- max files;
- max diff;
- required checks;
- stop conditions;
- intent.

## Shadow Plan Inputs

The Shadow Plan expands those compact fields into execution intent:

- planned read paths;
- planned create/modify/delete paths;
- planned commands;
- planned checks;
- planned artifacts;
- branch strategy;
- evidence plan.

## Why Both Are Needed

NC-MP/2 can be linted quickly, but it does not prove how Codex plans to execute
the mission. The Shadow Plan makes the local execution plan explicit and
comparable before work starts.

## Live Status

A16D does not enable live Shadow Plan enforcement. Future integration should run
Shadow Plan after prompt linting and Mission Contract pre-registration, but
before file edits, branch creation, commits, or pushes.
