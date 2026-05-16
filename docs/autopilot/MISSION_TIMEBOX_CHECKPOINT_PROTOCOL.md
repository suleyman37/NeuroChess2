# Mission Timebox Checkpoint Protocol

## 1. Purpose

Mission timebox prevents Codex from spending too long in a bad direction. It creates a soft stop and checkpoint report before work turns into an uncontrolled spiral.

A8C creates the protocol and offline scripts only. It does not enable live enforcement or hard-kill behavior.

## 2. Defaults

Default policy:
- warning after 8 minutes;
- checkpoint after 10 minutes;
- maximum repair attempts before checkpoint: 2;
- soft stop enabled;
- hard kill disabled.

## 3. Soft Stop

Soft stop means:
- stop the current mission flow safely;
- do not commit;
- do not push;
- build a checkpoint report;
- preserve diff, patch, status, checks, and notes;
- ask supervisor later or stop for review.

## 4. Hard Kill

Hard kill terminates a process. It is dangerous and must remain disabled by default.

A8C does not implement destructive process killing.

## 5. Separate Clocks

Codex active work time:
- default max is 10 minutes before checkpoint.

Check/test time:
- measured separately;
- long checks must be explicit in the mission prompt;
- backend full suite or frontend build can exceed 10 minutes only when allowed.

Browser or ChatGPT wait time:
- handled by bridge `max_wait_seconds`;
- should not count as Codex active work while waiting for a response.

Red-tier work:
- stricter by default;
- checkpoint or supervisor stop required before retries.

## 6. Integration Points

Future live loops should call the timebox checker:
- before expensive repair attempts;
- after each failed check cycle;
- before asking for another supervisor prompt;
- before committing a long-running mission.

Live enforcement remains disabled until a later pilot.
