# Supervisor Digest Protocol

## Purpose

Supervisor Digest is the default compact evidence message for ChatGPT Web supervision.
It exists to reduce token usage and avoid sending full patches, long logs, screenshots,
or raw Codex transcripts unless a later protocol explicitly asks for richer evidence.

## Default Shape

The digest contains only:

```text
<SUPERVISOR_DIGEST>
mission_id:
current_head:
risk_tier:
work_type:
goal:
allowed_paths:
changed_files:
diff_stat:
checks_summary:
alarms_summary:
codex_confidence:
question_for_supervisor:
</SUPERVISOR_DIGEST>
```

## What Is Excluded By Default

- no full patch;
- no long test logs;
- no screenshots;
- no raw Codex transcript;
- no hidden credentials or local secrets;
- no broad roadmap dump.

## Expected Supervisor Decision

With Level 1 evidence, ChatGPT Web should decide only one of:

- provide one safe MICRO_PROMPT;
- return STOP;
- wait for a future richer protocol.

A4A does not implement REQUEST_MORE yet. It only defines and builds the compact
digest used by future supervisor calls.

## Safety

Digest generation never calls ChatGPT Web, never executes Codex, and never commits
or pushes. It is evidence preparation only.
