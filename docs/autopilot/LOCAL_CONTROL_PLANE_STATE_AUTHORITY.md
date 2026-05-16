# Local Control Plane State Authority

## Purpose

A16A introduces a local deterministic Control Plane for future night sessions.
It does not run Night Mode and does not execute missions. It defines who owns
session state before the system grows beyond short live pilots.

## Control Plane Vs Data Plane

The Control Plane owns:

- night session state;
- mission counters;
- failure counters;
- mission hashes;
- forward progress indicators;
- stop reasons;
- event sequencing;
- branch/session metadata.

The Data Plane performs bounded work only after authorization:

- ChatGPT proposes;
- Codex executes;
- tests/checks produce evidence;
- git operations happen only when policy allows.

The Data Plane must not mutate `night_session.json` directly.

## Authority Rule

ChatGPT is advisory. Codex is the executor. The local Control Plane is the
deterministic authority that decides whether the session may continue.

Normal order:

1. ChatGPT proposes a micro-prompt.
2. Prompt Firewall and Mission Contract validate it.
3. Codex executes only within scope.
4. Components emit events.
5. The Control Plane updates state as the single writer.
6. The Control Plane authorizes continue, drain, stop, or recovery.

## Single-Writer State

Only `control_plane_state.ps1` may write `night_session.json`.

Other components must write events to the inbox. This prevents two scripts from
silently disagreeing about mission counts, failure counts, branch state, or stop
reasons.

## Live Status

A16A is scaffold-only:

- live Control Plane integration is disabled;
- Night Mode is not started;
- ChatGPT Web is not called;
- product missions are not executed.

The next mission may add mission hash and forward-progress detection, still
without enabling live Night Mode.
