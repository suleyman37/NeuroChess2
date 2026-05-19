# Full Night Kill Switch

The full-night kill switch is a runtime-only file:

`ops/autopilot/runtime/STOP_FULL_NIGHT.flag`

The path is covered by `.gitignore` through `ops/autopilot/runtime/**`.

## Rules

- The full-night loop checks the flag before each iteration.
- If the flag exists, the loop stops gracefully with `STOPPED_BY_KILL_SWITCH`.
- Artifacts and reports are preserved.
- No hidden background work continues after the stop result.
- The runtime file is never staged or committed.

## Operator Use

Creating the flag is enough to stop the next iteration boundary. The script `ops/autopilot/full_night_kill_switch.ps1` can check, arm, or clear the flag.
