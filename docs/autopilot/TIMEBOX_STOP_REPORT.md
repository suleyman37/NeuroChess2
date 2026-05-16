# Timebox Stop Report

## 1. Artifact Location

Checkpoint reports are written outside the repo:

```text
C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\timebox_checkpoints\
```

## 2. Required Fields

A report must include:
- mission id;
- risk tier;
- work type;
- start time;
- elapsed time;
- current branch;
- current HEAD;
- git status;
- changed files;
- diff stat;
- `patch.diff` when changes exist;
- checks attempted;
- tests or logs when available;
- what was completed;
- what failed;
- technical problems encountered;
- suspected next action;
- Codex notes when available.

## 3. Missing Data

Do not fabricate missing logs or test output. Mark missing items explicitly.

## 4. Supervisor Use

The supervisor should use a timebox report to decide whether to:
- continue smaller;
- split;
- revert;
- ask for more evidence;
- stop.
