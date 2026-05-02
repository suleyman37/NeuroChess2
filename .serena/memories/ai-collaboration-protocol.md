# AI Collaboration Protocol

- Source: `docs/AI_COLLABORATION_PROTOCOL.md` and `docs/AI_HANDOFF_TEMPLATE.md`.
- One agent modifies files at a time. Codex is the default implementer.
- ChatGPT 5.5 and Claude/Opus may provide strategy, architecture critique, audit, and prompt/handoff, but must not edit the repo concurrently.
- Classify missions: strategic changes require debate/review before execution; tactical/simple changes can use one model; trivial fixes require explicit human authorization if another tool edits.
- Use one branch/worktree per important mission when possible. Inspect diff after each AI mission.
- If a user-visible bug survives two fixes: stop feature work, reproduce real flow, inspect logs/network/frontend state, create a minimal failing test, then fix.
- Do not advance versions if UX blockers, browser validation, handoff, or scope are unresolved.
- Handoff must list version/scope/files/backend/frontend/db/tests/results/manual tests/limits/risks/next step.