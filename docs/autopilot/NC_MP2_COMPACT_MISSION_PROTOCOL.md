# NC-MP/2 Compact Mission Protocol

## Purpose

NC-MP/2 is a compact mission format for ChatGPT-to-Codex handoff. It is short,
parseable, auditable, and still human-readable. Compact does not mean opaque:
no hidden encoding, binary compression, Morse-like schemes, or unexplained
tokens are allowed.

## Syntax

An NC-MP/2 block starts with `NC-MP/2`, uses `key=value` lines, and ends with
`DONE` as the final token.

Required fields:

- `id`
- `tier`
- `type`
- `goal`
- `allow`
- `deny`
- `max_files`
- `max_diff`
- `checks`
- `stop`
- `commit`
- `intent`

List fields use commas: `allow`, `deny`, `checks`, and `stop`.

## Valid Example

```text
NC-MP/2
id=R3M_TEST_CONTRACT
tier=green
type=docs-only
goal=existing_exercise_readonly_test_contract
allow=docs/rebuild/25_R3M_EXISTING_EXERCISE_READONLY_BACKEND_ROUTE_TEST_CONTRACT_REX.md
deny=backend/**,frontend/**,plan/**,package.json,package-lock.json,App.tsx,.serena/**,qa_artifacts/**,.venv/**
max_files=1
max_diff=700
checks=git diff --check,tools/plan_guard.py
stop=forbidden_path,max_files,diff_over,missing_check,contract_mismatch
commit=explicit_file_only
intent=Create only the read-only backend route test contract. No code. No tests. No implementation.
DONE
```

## Invalid Examples

Invalid blocks include:

- hidden prose before or after the block;
- missing `DONE`;
- duplicate required fields;
- broad goals such as `improve everything`;
- docs-only prompts that allow backend or frontend paths;
- green prompts that mention red-tier product state such as Practice or
  `due_at`.

## Mission Contract And Mission Hash

NC-MP/2 does not replace Mission Contract. It is a compact proposal format that
can be parsed, linted, normalized, converted into contract fields, and hashed by
the Mission Hash Detector.
