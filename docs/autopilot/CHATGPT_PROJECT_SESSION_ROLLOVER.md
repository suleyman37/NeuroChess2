# ChatGPT Project Session Rollover

## Purpose

A12 defines how Codex keeps ChatGPT Web supervision inside the existing
`NeuroChess Supervisor` Project without relying on one overlong conversation.
The Project is the durable context container. A conversation is a short-lived
supervisor session that should be replaced before it drifts, bloats, or loses
format discipline.

A12 is protocol-only. It does not create a live conversation, automate login,
upload project files, call ChatGPT Web, run Night Mode, or execute product work.

## Project Versus Conversation

The ChatGPT Project stores stable reference material:

- product doctrine and forbidden claims;
- AgentOS response protocols;
- dangerous paths and git rules;
- the current automation stack.

The active conversation stores transient flow:

- recent supervisor requests;
- recent nonces;
- current micro-loop context;
- short-term decisions.

Codex should not create a new conversation for every mission. It should also
not keep using one conversation indefinitely. Rollover creates a new short
conversation in the same Project when thresholds or drift signals appear.

## Normal Rollover Triggers

Normal rollover is due when any of these are true:

- `assistant_responses_in_session >= 15`;
- `missions_in_session >= 5`;
- estimated context tokens exceed the configured threshold when available.

## Strategic Rollover Triggers

Strategic rollover is due after:

- a Strategic Pulse completed;
- 2 invalid supervisor responses;
- repeated REQUEST_MORE rounds;
- bridge instability;
- a supervisor drift canary failed.

## Emergency Rollover Triggers

Emergency rollover is due when the supervisor conversation shows:

- wrong model or mode behavior;
- format drift;
- repeated missing nonce-bound DONE;
- broad prompts twice;
- stale context;
- wrong project/page suspicion.

## Lifecycle

1. Codex detects rollover due.
2. Codex builds a compact Supervisor Handoff Pack.
3. The user or a later approved tool opens a new conversation inside
   `NeuroChess Supervisor`.
4. Codex may bind the active Project conversation URL in the gitignored local
   `ops/autopilot/local/chatgpt_sessions.local.json` file.
5. Codex sends the handoff pack and READY boot request.
6. ChatGPT must answer with `NC_SUPERVISOR_READY`.
7. Codex validates nonce, project name, READY status, and canary checks.
8. Only after READY passes may a later mission request a supervisor decision.

## Stop Conditions

If READY validation fails, Codex must stop for repair. It must not proceed to a
micro-prompt, product mission, Night Mode, or autonomous run from an unverified
conversation.

## Disabled In A12

These remain disabled:

- live rollover automation;
- ChatGPT Web live calls;
- project creation/upload automation;
- Night Mode;
- product mission execution.
