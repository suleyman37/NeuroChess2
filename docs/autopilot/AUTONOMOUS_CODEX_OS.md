# Autonomous Codex OS

NeuroChess AgentOS turns repo work into small autonomous queue items that can be
checked, reported, committed, pushed, or quarantined without using the user as a
message relay.

## Components

- Durable rules: `AGENTS.md`, `.agent/PLANS.md`, `.codex/rules/`
- Queue: `ops/autopilot/queue.yaml`
- Policies: `ops/autopilot/policies.yaml`
- Runtime state: external QA artifact root
- Worktrees: `C:\Users\suley\Documents\Dev\NeuroChess2_worktrees`
- Logs: `C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot`
- Runner: Windows Scheduled Task `NeuroChessCodexAutopilot`

## Cycle

1. Precheck main repo.
2. Select one ready queue item.
3. Create a worktree.
4. Execute the task.
5. Run deterministic checks.
6. Run local critics if available and required.
7. Promote or quarantine based on policy.
8. Write report.
9. Exit.

The loop is intentionally not a long-lived process. The scheduler can restart it
frequently.

## Public Repo Safety

The GitHub repository is treated as public unless proven otherwise. Public repos
must not receive a self-hosted runner by default because pull requests and
workflow edits can become a runner attack surface. The local Windows scheduler
is the primary automation path.

## Bootstrap Limitation

Local models are judges only. If Ollama or the requested models are unavailable,
the queue continues for docs/tooling with deterministic checks and records
`critic_unavailable`. UI/backend tasks can be quarantined when policy requires a
critic.
