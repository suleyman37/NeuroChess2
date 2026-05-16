# Night Session State Schema

## Purpose

`night_session.json` is the local session snapshot for future Product-Safe
Night Mode runs. It records counters, hashes, branch state, stop reasons, and
the next deterministic action.

## Required Fields

The A16A schema requires:

- `schema_version`
- `session_id`
- `started_at`
- `initial_head`
- `current_head`
- `branch`
- `status`
- `max_steps`
- `max_hours`
- `missions_attempted`
- `missions_succeeded`
- `missions_failed`
- `missions_quarantined`
- `current_step`
- `current_mission_id`
- `current_mission_hash`
- `mission_hashes_seen`
- `total_diff_lines`
- `total_failures`
- `consecutive_failures`
- `last_commit_sha`
- `last_successful_mission_id`
- `last_stop_reason`
- `active_branch`
- `active_risks`
- `disabled_features`
- `allowed_lanes`
- `forbidden_zones`
- `pending_events`
- `last_event_sequence`
- `last_state_update`
- `recommended_next_action`

## Session Lifecycle

Suggested statuses:

- `INITIALIZED`
- `READY`
- `AWAITING_SUPERVISOR`
- `MISSION_RUNNING`
- `CHECKING_RESULTS`
- `DRAINING`
- `STOPPED`
- `RECOVERING`
- `CORRUPT`

Only the local Control Plane may change these values.

## Stop Reasons

`last_stop_reason` should record the first blocking reason, such as:

- Mission Contract mismatch;
- forbidden path touched;
- Prompt Firewall rejection limit;
- bridge failure;
- watchdog checkpoint;
- strategic STOP or QUARANTINE;
- state corruption;
- event sequence gap.

No automatic continuation is allowed after state corruption or an unexplained
event gap.

## Relationship To Night Mode

A16A does not enable live Night Mode. The schema is a prerequisite for future
longer pilots where local state must outlive one prompt, one ChatGPT
conversation, or one Codex action.
