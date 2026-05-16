# Watchdog Drill Results

This document defines the expected results for the A11D fake-process watchdog
drill.

## Expected Artifacts

Each drill run should create:

- `fake_process_drill_summary.json`
- `fake_process_drill_summary.md`
- per-scenario runtime folders;
- per-scenario heartbeat or fake process state files;
- rescue pack for hung/stale heartbeat scenario.

The rescue pack should include:

- `git_status.txt`
- `branch.txt`
- `head.txt`
- `diff_stat.txt`
- `changed_files.txt`
- `patch.diff`
- `heartbeat.json`
- `watchdog_reason.txt`
- `post_mortem.md`

## PASS Criteria

The drill passes only if:

- healthy scenario reports GREEN/NONE;
- STOP flag scenario detects STOP and recommends graceful stop;
- hung/stale heartbeat scenario reaches ORANGE or stronger stop phase;
- hung/stale heartbeat scenario writes or would write STOP;
- rescue pack exists and contains required files;
- no real process kill occurs;
- no live ChatGPT call occurs;
- no Codex execution occurs;
- no product mission executes;
- no commit or push occurs during the drill.

## FAIL Criteria

The drill fails if:

- any scenario touches product code;
- any scenario uses real Night Mode runtime without isolation;
- any scenario calls ChatGPT Web;
- any scenario executes Codex;
- any scenario commits or pushes;
- any scenario kills Codex or Chrome;
- rescue evidence is missing for stale heartbeat.

## Scenarios

### Healthy

Expected:

- fake process state is `healthy`;
- heartbeat is fresh;
- watchdog phase is GREEN;
- action is NONE;
- no rescue pack.

### STOP Flag

Expected:

- STOP flag is present in the isolated runtime directory;
- stop flag checker reports `stop_requested: true`;
- fake process state is `stop_observed`;
- no hard kill.

### Hung / Stale Heartbeat

Expected:

- heartbeat is intentionally stale;
- watchdog phase is ORANGE or stronger;
- action is `WRITE_STOP` or a dry-run kill action according to phase;
- STOP flag would be written for ORANGE;
- rescue pack is generated;
- no real process kill.

## Next Step After PASS

Recommended next mission:

```text
A12_CHATGPT_PROJECT_SESSION_ROLLOVER_PROTOCOL
```

Live watchdog and Night Mode remain disabled after A11D.
