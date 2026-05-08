---
name: neurochess-add-action
description: Add or modify a NeuroChess training, review, navigation, or user action safely. Use when adding buttons, CTAs, practice actions, lesson actions, training decisions, screen transitions, or action telemetry.
---

# NeuroChess Add Action

## When To Use

- A task adds, removes, renames, or changes a user action.
- A task changes training/practice flow, Review lesson actions, CTAs, or screen
  transitions.
- A task makes an action drive training or persist practice results.

## When Not To Use

- Pure display changes with no action, transition, or side effect.
- Internal backend work that exposes no action and changes no training decision.
- Debug-only instrumentation hidden from normal UI.

## Required Docs

- `docs/ACTION_REGISTRY.md`
- `docs/LEARNING_ENGINE_BLUEPRINT.md`
- `docs/SCREEN_CONTRACTS.md`
- `docs/METRIC_REGISTRY.md` if the action depends on metrics.

## Mandatory Steps

1. Read the required docs before code.
2. Check whether the action is already covered by the Action Registry.
3. Classify the action type: primary, secondary, alternative, contextual,
   advanced, destructive, or debug.
4. Enforce one primary action and at most two secondary actions on prescriptive
   screens.
5. Keep action labels simple and avoid duplicate labels for the same behavior.
6. Keep training decisions backend-authoritative.
7. Do not scatter new action logic inside `frontend/src/App.tsx`.
8. If state changes persist, define backend API/service ownership first.
9. Update Action Registry before or with the implementation.
10. Respect Screen Contracts and progressive disclosure.
11. Add backend tests for side effects and state transitions.
12. Add frontend/static/Playwright checks only when UI behavior changes.

## Validation

- Action is registered and not duplicated.
- Screen still has valid primary/secondary action counts.
- Destructive actions require confirmation.
- Advanced/debug actions are hidden from normal UI.
- Backend owns final training/practice decisions.
- Tests cover success, unavailable state, and failure/retry behavior.

## Stop Conditions

- The action already exists under another label.
- The screen would gain too many visible actions.
- Backend ownership or persistence model is unclear.
- The action depends on an unregistered metric.
- The proposed action contradicts Screen Contracts.

