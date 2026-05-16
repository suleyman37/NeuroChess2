# Shadow Plan Before Execution Protocol

## Purpose

A16D adds a Shadow Plan gate before execution. The goal is to make Codex declare
what it intends to read, write, run, and produce before any mission touches
files.

## Why It Exists

Prompt linting checks the requested mission. Mission Contract pre-registration
declares expected changes. Result comparison checks what actually happened. The
Shadow Plan closes the gap between proposal and execution by asking Codex to
state its operational plan first.

If the Shadow Plan exceeds the mission contract, the system stops before work.

## Relationship To Mission Contract

The Mission Contract says what the mission is allowed and expected to change.
The Shadow Plan says what Codex intends to do. The comparison must reject:

- planned writes outside expected files;
- planned reads of forbidden paths;
- missing checks;
- mismatched branch strategy;
- diff budgets above contract limits.

## Relationship To NC-MP/2

NC-MP/2 is compact prompt input. A Shadow Plan is execution intent. Even compact
prompts need an explicit local plan because compactness does not prove safety.

## Relationship To Control Plane

The local Control Plane owns continuation decisions. ChatGPT may suggest work,
and Codex may propose a Shadow Plan, but the Control Plane must authorize
execution.

## Fail-Closed

A failing Shadow Plan stops before file modifications, branch creation, commit,
or push. A16D creates offline scaffolding only; live enforcement remains
disabled.
