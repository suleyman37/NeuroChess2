# Environment Hygiene Protocol

Git clean does not mean the runtime environment is clean. A long run can leave ports, browser/test/server processes, DB locks, temp files, or large evidence artifacts behind even when the repository has no diff.

## Check-Only First

A20B adds checks, not cleanup. The system reports dirty environment state and lets the long-run controller enter DRAIN or STOP. It does not kill global processes, delete broad directories, or run destructive Git cleanup.

## Checks

- Registered autopilot process IDs only.
- Configured dev/test ports only.
- Runtime lock indicators.
- DB lock indicators.
- Evidence/runtime disk pressure when configured.

## Long-Run Use

Run hygiene checks before each new mission and after each mission. If the result is `STOP_ENVIRONMENT_POISONED`, the controller should enter DRAIN or QUARANTINE and preserve evidence instead of starting more product work.
