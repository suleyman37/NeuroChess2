# Control Plane Event Log

## Purpose

The event log is the communication layer between future Night Mode components
and the local Control Plane.

Components do not write `night_session.json`. They write events. The Control
Plane reads events, validates them, updates state, and appends durable log
entries.

## Runtime Layout

Default runtime root:

```text
%USERPROFILE%\AgentOS\runtime\
```

Event folders:

- `events\inbox\`
- `events\processing\`
- `events\processed\`
- `events\failed\`
- `logs\mission_log.jsonl`

## Atomic Writes

Event writers must write a temporary file first, validate it, then move it into
the inbox. A partial event must never appear as a ready event.

The same rule applies when the Control Plane moves an event from inbox to
processing and then to processed or failed.

## Sequence Numbers

Each event carries a positive sequence number. The Control Plane must detect
sequence gaps before silently continuing.

If a gap appears, the recommended action is `STOP_FOR_SUPERVISOR` until the
missing event is explained or the recovery procedure is run.

## Schema Validation

Every event must include:

- `schema_version`
- `event_id`
- `session_id`
- `sequence`
- `event_type`
- `created_at`
- `payload`

Unsupported event types are rejected.

## Append-Only Mission Log

Processed or failed events append one JSON line to `mission_log.jsonl`. The log
is append-only evidence. It is not a mutable source of truth; the Control Plane
state file remains the current session snapshot.
