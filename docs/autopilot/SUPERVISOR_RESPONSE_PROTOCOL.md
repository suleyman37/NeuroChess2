# Supervisor Response Protocol

ChatGPT Web must answer in exactly one of two forms.

## Continue

```text
<NC_SUPERVISOR_RESPONSE nonce="{{NONCE}}">
<VERDICT>CONTINUE_WITH_MICRO_PROMPT</VERDICT>

<PROMPT_SELF_AUDIT>
single_goal: PASS|FAIL
risk_tier_valid: PASS|FAIL
work_type_valid: PASS|FAIL
allowed_paths_precise: PASS|FAIL
forbidden_paths_present: PASS|FAIL
max_files_present: PASS|FAIL
max_diff_lines_present: PASS|FAIL
required_checks_present: PASS|FAIL
stop_conditions_present: PASS|FAIL
no_vague_language: PASS|FAIL
no_forbidden_scope: PASS|FAIL
quality_score_0_to_10: N
main_risks:
- ...
</PROMPT_SELF_AUDIT>

<MICRO_PROMPT>
id:
risk_tier:
work_type:
goal:
allowed_paths:
forbidden_paths:
max_files:
max_diff_lines:
timebox_minutes:
required_checks:
stop_conditions:
commit_policy:
codex_prompt:
</MICRO_PROMPT>

<NC_DONE nonce="{{NONCE}}">DONE</NC_DONE>
</NC_SUPERVISOR_RESPONSE>
```

## Stop

```text
<NC_SUPERVISOR_RESPONSE nonce="{{NONCE}}">
<VERDICT>STOP</VERDICT>
<STOP_REASON>
...
</STOP_REASON>
<NC_DONE nonce="{{NONCE}}">DONE</NC_DONE>
</NC_SUPERVISOR_RESPONSE>
```

Rules:

- nonce must match exactly;
- DONE must be present once;
- DONE must be nonce-bound;
- DONE must be the final meaningful block;
- no markdown outside the supervisor response block;
- no second MICRO_PROMPT;
- PROMPT_SELF_AUDIT is required when MICRO_PROMPT exists;
- quality score must be 8 or higher for execution eligibility.
