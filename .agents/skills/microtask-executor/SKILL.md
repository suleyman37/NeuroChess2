# Microtask Executor

Use this skill to execute one NeuroChess autopilot queue item in isolation.

## Contract

- One task per run.
- One worktree per task.
- One controlled diff.
- One report under the external QA artifact root.

## Steps

1. Read `ops/autopilot/queue.yaml`.
2. Select the first ready item that is not completed in external runtime state.
3. Create or reuse a worktree under
   `C:\Users\suley\Documents\Dev\NeuroChess2_worktrees\<task-id>`.
4. Execute the task prompt non-interactively when Codex CLI is available.
5. Run the task `checks_profile`.
6. Run local text/vision critics when required and available.
7. Promote or quarantine based on `ops/autopilot/policies.yaml`.
8. Write the report and exit.

## Failure Rule

Do not loop on a failing task. Increment attempts, write an incident report if
failure thresholds are reached, then exit cleanly.
