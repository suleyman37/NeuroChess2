# Night Mode GO / NO-GO Checklist

Night Mode remains NO-GO until all required gates are true.

## GO Requirements

- Mission Contract is available and required.
- Watchdog dry-run and fake-process drill passed.
- Session rollover protocol passed.
- ChatGPT Project READY smoke passed.
- Local Project URL config exists and tracked config is clean.
- Strategic Pulse live pilot passed.
- A9 three-step pilot passed.
- Product-safe scope checker passed.
- Product code auto-merge is disabled.
- Red-tier is disabled.
- No unresolved quarantine branch exists.
- Repo is clean and aligned with `origin/road-to-V2`.
- External final report path is configured.

## NO-GO Conditions

- Missing local Project URL.
- Failing READY boot test.
- Watchdog disabled for a live run.
- Mission Contract disabled for Night Mode.
- Red-tier enabled.
- Backend/frontend direct road merge enabled.
- Unresolved quarantine branch.
- Dirty repo before run.
- Unreviewed product branch from a prior Night Mode run.
- Disk or artifact storage risk that prevents evidence capture.

## A13 Status

A13 defines the checklist only. It does not enable or run live Night Mode.
