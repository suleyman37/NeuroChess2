# Supervisor READY Boot Test

## Purpose

The READY boot test verifies that a fresh ChatGPT Project conversation inside
`NeuroChess Supervisor` understands the minimum safety protocol before Codex
asks for any micro-prompt.

A12 does not run the live test. It only defines the response format and local
validator.

## Required Response Format

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

## Canary Checks

All canaries must pass:

- `nonce_protocol`;
- `micro_prompt_only`;
- `forbidden_paths_known`;
- `red_tier_known`;
- `git_add_A_forbidden`.

## Failure Behavior

If any field is missing, the nonce does not match, the Project is not
`NeuroChess Supervisor`, READY is not YES, or any canary is not PASS, Codex must
stop and repair the supervisor session. It must not ask for a product prompt or
continue an autonomous loop.
