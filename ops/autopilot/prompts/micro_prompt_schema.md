# Micro Prompt Schema

Required fields:

- id
- risk_tier
- work_type
- goal
- allowed_paths
- forbidden_paths
- max_files
- max_diff_lines
- timebox_minutes
- required_checks
- stop_conditions
- commit_policy
- codex_prompt

Valid supervisor responses must include either CONTINUE_WITH_MICRO_PROMPT with
PROMPT_SELF_AUDIT and MICRO_PROMPT, or STOP with STOP_REASON.

Every response must end with:

```text
<NC_DONE nonce="{{NONCE}}">DONE</NC_DONE>
</NC_SUPERVISOR_RESPONSE>
```
