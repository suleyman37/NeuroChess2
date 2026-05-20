# Antigravity Sandbox Lane

A20BH defines Antigravity as a sandbox explorer only.

Antigravity may explore variants, UI spikes, alternative components, and visual ideas in an isolated worktree. It must not work directly in the official NeuroChess repository branch.

## Roles

- Antigravity explores.
- Codex integrates.
- OMEGA routes.
- Gemini critiques visuals.
- ChatGPT challenges strategy.
- Local fallback continues if any lane fails.

## Worktree Policy

Preferred external sandbox root:

`C:\Users\suley\Documents\Dev\NeuroChess_Agent_Worktrees`

The sandbox must:

- be created from the exact source commit;
- stay isolated from the main working tree;
- be disposable;
- never be `road-to-V2`;
- never contain secrets, cookies, tokens, private URLs, or browser profile data;
- never push to origin;
- produce Patch Proposal Packs only.

## Official Repository Rule

Antigravity does not commit, push, stage, or directly edit the official repo branch.

Codex is the only official integrator. Codex validates proposal packs, applies them only after the gate passes, runs tests, and commits/pushes only allowed branches.

## Manager

The manager script is:

`ops/autopilot/antigravity_worktree_manager.ps1`

Supported modes:

- `Status`
- `PlanSandbox`
- `CreateSandbox`
- `RemoveSandbox`
- `DryRun`

`CreateSandbox` can create a detached external worktree from a base commit. `RemoveSandbox` is explicit only and validates that the path stays under the external sandbox root before removal.

This mission does not require Antigravity to be installed and does not call it live.
