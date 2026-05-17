# Global File Mutability Lock

The Global File Mutability Lock is an append-only runtime JSONL file. It is external by default:

```text
C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\runtime\branch_file_locks.jsonl
```

## Entry Schema

Each entry records run id, mission id, branch, base branch, optional commit SHA, file path, lock type, status, timestamp, and notes.

Lock types:

- `planned_write`: declared by Shadow Plan before work.
- `actual_write`: confirmed after diff inspection.
- `read_only`: tracked for evidence, not a write conflict.

Statuses:

- `active`: lock is still relevant.
- `released`: branch no longer owns the file.
- `abandoned`: branch was abandoned.
- `quarantined`: branch requires safety review.

Only active planned or actual write locks create overlap. Read-only locks do not block new work.
