# Antigravity Agent Bridge

## Purpose

The bridge defines a safe handoff between Codex and Antigravity without giving Antigravity write authority over the official repo.

## Preferred Shape

1. Codex writes a work order to an external inbox.
2. Antigravity reads the inbox in an external sandbox/worktree.
3. Antigravity writes a Patch Proposal Pack to an external outbox.
4. Codex validates the outbox pack.
5. Codex either rejects, imports, or asks for retry constraints.

## Required Outbox Pack

- `proposal.json`
- `patch.diff`
- `summary.md`
- `risk_report.json`
- `test_report.json`
- `files_touched.txt`
- `integration_notes.md`

## Bridge Statuses

- `ANTIGRAVITY_INBOX_PREPARED`
- `PROPOSAL_NOT_FOUND`
- `PROPOSAL_PACK_FOUND`
- `ANTIGRAVITY_BRIDGE_PROPOSAL_VALID`
- `ANTIGRAVITY_BRIDGE_PROPOSAL_REJECTED`
- `ANTIGRAVITY_MANUAL_BRIDGE_CREATED`

## Safety

The bridge never types into a window, never commits, never pushes, and never applies a patch. It only prepares or validates external artifacts.

Implementation:

`ops/autopilot/antigravity_agent_bridge.ps1`
