# Watchdog GO / NO-GO Night Mode Checklist

Night Mode remains NO-GO until the watchdog and surrounding safety stack are
proven in live dry-run pilots.

## GO Requirements

Night Mode can be reconsidered only after all of these are true:

- Mission Contract is used live in at least 3 missions.
- Watchdog dry-run tests pass.
- STOP flag drill passes.
- 5-step pilot passes with no forbidden scope.
- 10-step pilot passes with Strategic Pulse.
- Rollover session test passes.
- `road-to-V2` is clean and aligned before the run.
- No unresolved quarantine branch exists.
- Red-tier is disabled.
- Backend changes are disabled.
- Frontend changes are disabled.
- Prevent-sleep behavior is considered and documented.
- External final report path is configured.

## NO-GO Conditions

Night Mode is NO-GO if any of these are true:

- watchdog is not proven in dry-run;
- Mission Contract comparison is not enforced;
- STOP, PAUSE, DRAIN, and KILL flags are not detected;
- hard kill is enabled by default;
- product code is allowed without explicit mission scope;
- red-tier is allowed;
- backend/frontend write scopes are enabled;
- road-to-V2 is dirty or diverged;
- unresolved quarantine evidence exists;
- Strategic Pulse is disabled for long sessions.

## A11B Status

A11B creates scaffold only:

- docs;
- policy;
- heartbeat writer;
- stop flag checker;
- watchdog status checker;
- rescue pack builder;
- offline tests.

A11B does not implement Night Mode.
