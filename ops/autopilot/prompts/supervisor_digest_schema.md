# Supervisor Digest Schema

ChatGPT Web receives this compact digest by default:

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

Required fields:
- mission_id
- current_head
- risk_tier
- work_type
- goal
- allowed_paths
- changed_files
- diff_stat
- checks_summary
- alarms_summary
- codex_confidence
- question_for_supervisor

Valid example:

```text
<SUPERVISOR_DIGEST>
mission_id: A4A_SUPERVISOR_DIGEST
current_head: 6e8cba9
risk_tier: green
work_type: docs_tooling
goal: Validate the Supervisor Digest builder.
allowed_paths:
- ops/autopilot/build_supervisor_digest.ps1
changed_files:
- ops/autopilot/build_supervisor_digest.ps1
diff_stat: |
  1 file changed, 30 insertions(+)
checks_summary: |
  git diff --check: PASS
alarms_summary: |
  none
codex_confidence: 0.91
question_for_supervisor: |
  Is this digest sufficient for one safe MICRO_PROMPT?
</SUPERVISOR_DIGEST>
```

ChatGPT must not receive a full patch unless a later protocol requests richer
evidence. A4A does not implement that richer request protocol.
