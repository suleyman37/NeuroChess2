# NeuroChess Visual Taste Ledger

The Visual Taste Ledger captures design feedback over time.

Entry fields:

- `schema_version`
- `timestamp`
- `artifact_path`
- `surface`
- `branch`
- `verdict`
- `reason`
- `visual_traits`
- `what_to_repeat`
- `what_to_avoid`
- `related_reference`
- `neurochess_relevance`
- `notes`

Accepted verdicts:

- `LOVE`
- `LIKE`
- `NEUTRAL`
- `DISLIKE`
- `REJECT`

The ledger should be append-only. It should not store screenshots directly in
the repo. It can point to external evidence artifacts.
