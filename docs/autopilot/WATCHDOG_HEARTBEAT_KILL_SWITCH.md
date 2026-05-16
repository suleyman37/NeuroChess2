# Watchdog Heartbeat Kill-Switch Scaffold

The watchdog scaffold separates two ideas that must not be confused:

- the controller is alive;
- the operation the controller is waiting for may legitimately be long.

Codex, ChatGPT Web, checks, tests, and push operations can take time. The
controller should keep writing a heartbeat while it waits. The watchdog observes
that heartbeat and state budget, not raw wall-clock duration alone.

A11B is scaffold only. It does not integrate a live watchdog into the controller,
does not run Night Mode, and does not kill any process.

## Runtime Location

Runtime files live outside the repo by default:

```text
%USERPROFILE%\AgentOS\runtime\
```

Runtime files:

- `heartbeat.json`
- `state.json`
- `mission_log.jsonl`
- `watchdog.log`
- `STOP`
- `PAUSE`
- `DRAIN`
- `KILL`
- `rescue\`

Generated runtime files must not be committed.

## Heartbeat Policy

Default heartbeat interval:

```text
heartbeat_interval_seconds: 30
```

Heartbeat age phases:

| Phase | Age | Default action |
| --- | --- | --- |
| GREEN | less than 60 seconds | NONE |
| YELLOW | 60-90 seconds | WARN |
| ORANGE | 90-300 seconds | WRITE_STOP |
| RED | 300-360 seconds | POLITE_KILL_DRY_RUN |
| BLACK | more than 360 seconds | FORCE_KILL_DRY_RUN |

Hard kill remains disabled by default. RED and BLACK actions are dry-run only in
this mission.

## Heartbeat Schema

Heartbeat JSON fields:

- `schema_version`
- `timestamp_iso`
- `timestamp_unix`
- `controller_pid`
- `controller_started_at_iso`
- `state`
- `state_entered_at_iso`
- `state_max_duration_seconds`
- `current_mission_id`
- `current_mission_risk_tier`
- `current_mission_timebox_minutes`
- `missions_completed_this_session`
- `missions_failed_this_session`
- `missions_quarantined_this_session`
- `session_id`
- `session_started_at_iso`
- `branch`
- `last_commit_sha`
- `stop_flag_observed`
- `next_heartbeat_due_iso`
- `anomalies`

The heartbeat should be written atomically with a temp file followed by a move or
replace operation.

## Stop Flags

User/operator flags:

- `STOP`: graceful stop after the current atomic operation.
- `PAUSE`: finish the current mission, then do not start another.
- `DRAIN`: finish the session, write final report/pulse, then exit.
- `KILL`: reserved extreme hard stop.

A11B only detects flags and reports recommended actions. It does not stop or
kill real processes.

## State Budgets

Each heartbeat can declare `state_max_duration_seconds`.

State budget examples:

- waiting for ChatGPT Web response;
- waiting for tests;
- waiting for push;
- waiting for Codex subprocess;
- writing final report.

If the heartbeat is fresh but the state budget is exceeded, the watchdog should
recommend an ORANGE soft stop instead of assuming the controller is dead.

## Dry-Run Kill-Switch Rule

RED and BLACK phases may report:

- `POLITE_KILL_DRY_RUN`
- `FORCE_KILL_DRY_RUN`

A11B must never kill a real process. A later integration mission must prove the
watchdog in dry-run mode before any real termination is considered.
