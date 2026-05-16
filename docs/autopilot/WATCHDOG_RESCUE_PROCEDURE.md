# Watchdog Rescue Procedure

The rescue procedure preserves evidence when the watchdog detects a stalled or
unsafe controller state.

A11B only builds rescue packs. It does not reset, stash, clean, push, delete
branches, or kill processes.

## Rescue Pack Location

Default external location:

```text
C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\watchdog_rescue\
```

Each rescue pack should include:

- `git_status.txt`
- `branch.txt`
- `head.txt`
- `diff_stat.txt`
- `changed_files.txt`
- `patch.diff`
- `heartbeat.json`, if present
- `watchdog_reason.txt`
- `post_mortem.md`

## Procedure

1. Detect watchdog phase, stop flag, or state budget issue.
2. Build a rescue pack.
3. Stop the autonomous flow.
4. Do not continue to another mission.
5. Do not push unreviewed changes.
6. Require human or supervisor review before recovery.

## Forbidden Recovery Actions In A11B

The rescue pack builder must never run:

- `git stash`
- `git reset`
- `git clean`
- branch deletion;
- force push;
- merge;
- rebase;
- process kill.

The pack is an evidence artifact only.

## How The Supervisor Should Use It

The supervisor or human operator should inspect:

- current branch and HEAD;
- changed files;
- patch size;
- heartbeat state;
- watchdog reason;
- whether the diff is salvageable;
- whether quarantine/archive is required.

If product or red-tier paths were touched unexpectedly, recovery should defer to
the quarantine protocol.
