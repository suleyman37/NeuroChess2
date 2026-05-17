# Evidence Index Protocol

Morning Report must not depend on random filesystem discovery. Long runs should append every important artifact to an evidence index as it is created.

Default external index:

```text
C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\runtime\evidence_index.jsonl
```

Repo-local runtime indexes remain ignored under `ops/autopilot/runtime/**`.

## Entry Shape

Each JSONL entry records schema version, run id, mission id, branch, commit SHA, artifact id, artifact type, path, timestamp, producer, whether it is required for E2E, existence at append time, optional hash, and notes.

Required artifact types include test logs, screenshots, contact sheets, visual briefs, Gemini JSON, ChatGPT JSON, reports, DB snapshots, git diffs, console logs, network logs, and other.

## Validation

`ops/autopilot/validate_evidence_index.ps1` parses the JSONL, verifies required fields, optionally checks artifact paths, and stops on missing required E2E evidence:

```json
{
  "evidence_index_result": "STOP_MISSING_REQUIRED_EVIDENCE"
}
```
