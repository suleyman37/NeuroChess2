# Control Plane Dry Run Reporting

A17 writes an external report under:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\control_plane_dry_runs\`

## Report Fields

The report records:

- session id;
- runtime directory;
- initial phase;
- final phase;
- simulated missions;
- selected skills;
- NC-MP/2 parse and lint results;
- Mission Contract results;
- Shadow Plan results;
- Product Gate results;
- Mission Hash results;
- Forward Progress results;
- Prompt Ledger results;
- Goldilocks results;
- E2E scores;
- Gemini decision fixture result, when present;
- phase transitions;
- final verdict;
- live ChatGPT/Gemini flags;
- product execution flag.

## Verdicts

- `PASS_CONTROL_PLANE_DRY_RUN`
- `FAIL_CONTROL_PLANE_INTEGRATION`
- `STOP_DETERMINISTIC_GATE`
- `QUARANTINE_REQUIRED`
- `PASS_EARLY_EXCELLENCE_DRY_RUN`
- `FAIL_NO_E2E_DELIVERABLE`
- `FAIL_REPEAT_MISSION_HASH`
- `FAIL_NO_FORWARD_PROGRESS`

Morning reports can later consume these fields to explain which branches are
reviewable, which gates stopped execution, and which system friction should be
fixed before the next run.
