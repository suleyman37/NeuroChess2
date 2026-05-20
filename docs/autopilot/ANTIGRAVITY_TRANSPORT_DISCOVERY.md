# Antigravity Transport Discovery

## Goal

A20BK discovers whether Codex can automate Antigravity safely as a sandbox agent.

## Transport Order

1. CLI command
2. Local server / localhost endpoint
3. Protocol handler
4. File inbox/outbox workflow
5. Browser/web UI with MCP Playwright
6. Desktop GUI with screenshot-first control
7. Manual fallback

## Safe Transport Criteria

A transport is safe only if it:

- targets Antigravity specifically;
- operates in an external sandbox/worktree;
- cannot modify the official repo directly;
- emits a Patch Proposal Pack;
- requires no secrets or paid APIs;
- does not bypass human verification;
- is bounded and stoppable;
- creates auditable artifacts.

## Unsafe Transport Criteria

A transport is unsafe if it:

- types into an unidentified window;
- uses the official repo as workspace;
- can commit or push directly;
- requires credentials;
- hides outputs;
- cannot prove the sandbox path;
- cannot produce a proposal pack;
- modifies files without a pack.

## Current Discovery Bias

File inbox/outbox is the preferred bridge when no CLI/server/protocol is safely available. Desktop GUI control is only allowed after screenshot evidence and sandbox proof.

Implementation:

`ops/autopilot/antigravity_transport_discovery.ps1`
