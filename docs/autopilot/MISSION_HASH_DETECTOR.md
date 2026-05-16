# Mission Hash Detector

## Purpose

A16B adds a deterministic mission hash detector so longer autonomous sessions
cannot loop on the same or near-identical mission. ChatGPT may propose work, but
the local Control Plane must detect repeats before Codex executes them.

## Hash Inputs

The mission hash is computed from normalized mission contract fields:

- `mission_id` when stable;
- `risk_tier`;
- `work_type`;
- `goal`;
- `allowed_paths`;
- `forbidden_paths`;
- `expected_changed_files`;
- `max_files`;
- `max_diff_lines`;
- `required_checks`;
- `stop_conditions`;
- `codex_prompt` or `compact_intent` when present.

`allowed_paths` and `expected_changed_files` are intentionally strong inputs
because they define the shape of the actual diff.

## Normalization

The detector normalizes before hashing:

- trims leading and trailing whitespace;
- collapses repeated whitespace;
- normalizes path separators to `/`;
- sorts arrays alphabetically;
- lowercases stable enum fields such as `risk_tier` and `work_type`;
- preserves meaningful goal text after whitespace normalization.

Whitespace-only edits, line wrapping, and harmless comma/newline differences in
list-like fields must not create different mission hashes.

## Stop Behavior

If the same normalized hash appears again in one night session, the Control
Plane treats it as a loop risk. Night Mode defaults to
`max_same_mission_hash_repeats: 1`, so the first detected repeat is a hard stop:
`STOP_REPEAT_MISSION_HASH`.

This detector does not run live in A16B. It is scaffolded and tested for future
Control Plane integration.
