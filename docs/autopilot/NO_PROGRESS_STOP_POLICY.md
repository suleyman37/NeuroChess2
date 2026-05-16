# No Progress Stop Policy

## Policy

The Control Plane must not continue silently when a session stops producing
useful progress.

Default behavior:

- one no-progress mission: `WARN_NO_PROGRESS`;
- two consecutive no-progress missions: `STOP_NO_FORWARD_PROGRESS`;
- three no-progress missions in a rolling five-mission window:
  `STRATEGIC_PULSE_REQUIRED`;
- Night Mode should drain or stop, not keep requesting similar prompts.

## Mechanical Stops

`STOP_NO_FORWARD_PROGRESS` is deterministic. ChatGPT may explain or suggest a
repair, but it cannot override the local stop decision.

## Evidence

The detector records the reason a mission did or did not count as progress.
Reports and ledgers must distinguish useful evidence from empty or duplicate
activity.
