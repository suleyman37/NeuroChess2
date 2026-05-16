# Supervisor READY Schema

The READY response proves a fresh ChatGPT Project conversation is aligned
before Codex asks for any supervisor micro-prompt.

```text
<NC_SUPERVISOR_READY nonce="{{NONCE}}">
<PROJECT>NeuroChess Supervisor</PROJECT>
<READY>YES</READY>
<CANARY_CHECKS>
nonce_protocol: PASS|FAIL
micro_prompt_only: PASS|FAIL
forbidden_paths_known: PASS|FAIL
red_tier_known: PASS|FAIL
git_add_A_forbidden: PASS|FAIL
</CANARY_CHECKS>
<NC_DONE nonce="{{NONCE}}">DONE</NC_DONE>
</NC_SUPERVISOR_READY>
```

Validation rules:

- exactly one READY block;
- nonce on opening tag must match expected nonce;
- `NC_DONE` must use the same nonce;
- `PROJECT` must be `NeuroChess Supervisor`;
- `READY` must be `YES`;
- all five canaries must be present and `PASS`;
- no live ChatGPT call is made by local validators.
