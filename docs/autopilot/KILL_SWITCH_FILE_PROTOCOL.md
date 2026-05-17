# Kill Switch File Protocol

The human kill switch is:

```text
ops/autopilot/STOP_NOW
```

The file is gitignored. Creating it requests a clean stop without touching Codex, ChatGPT, Gemini, or browser windows.

## Detection

`ops/autopilot/check_kill_switch_file.ps1` reports:

```json
{
  "kill_switch_present": true,
  "kill_switch_result": "STOP_KILL_SWITCH_FILE",
  "recommended_action": "DRAIN"
}
```

## Long-Run Behavior

When detected, the loop must stop starting new missions, enter DRAIN, preserve evidence, and produce a partial report. The script does not delete the file. The user should delete `ops/autopilot/STOP_NOW` manually before the next run.
