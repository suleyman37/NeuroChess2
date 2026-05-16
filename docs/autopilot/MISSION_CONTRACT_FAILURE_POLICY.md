# Mission Contract Failure Policy

A mission contract mismatch is treated as a stop signal. The system must not
continue automatically after the expected-vs-actual comparison fails.

## STOP_MECHANICAL

Use `STOP_MECHANICAL` when the mismatch is deterministic and local:

- forbidden path changed;
- docs-only mission touched code;
- package files changed without permission;
- required field missing from the contract;
- required check missing;
- expected artifact missing;
- commit or push occurred when policy forbade it.

The next action is to stop, preserve evidence, and repair the mechanical issue
in a later explicit mission.

## STOP_FOR_SUPERVISOR

Use `STOP_FOR_SUPERVISOR` when the mismatch may be legitimate but exceeds the
registered scope:

- actual diff is larger than declared;
- actual file count exceeds declared;
- expected file is missing but the rest of the work may still be useful;
- harmless formatting/title drift is present but needs review;
- product scope ambiguity appears.

The next action is to build a compact evidence report and ask the supervisor or
human operator for a smaller follow-up plan.

## QUARANTINE_REQUIRED

Use `QUARANTINE_REQUIRED` when the mismatch touches dangerous surfaces:

- red-tier path or keyword appears outside quarantine;
- Practice, `due_at`, Daily Plan, training item, practice attempt, scoring, or
  XP/rank/Transfer surfaces are touched without approval;
- backend/frontend write boundaries are crossed unexpectedly;
- forbidden product code is changed during an automation-only mission.

If work occurred on an ephemeral branch, archive it before cleanup. If work
occurred on the base branch, stop immediately and require manual review before
any recovery operation.

## Archive Evidence

Contract failure evidence should include:

- mission contract;
- actual result JSON;
- changed files;
- diff stat;
- patch;
- check logs;
- contract comparison output;
- Codex notes.

Do not delete failed branch evidence before the archive manifest exists.

## Harmless Warnings

Warnings are allowed only when all of these are true:

- changed file paths match exactly;
- diff line limits are respected;
- required checks ran;
- no forbidden paths were touched;
- no product safety boundary was crossed.

Examples include a documentation heading wording difference or a small artifact
filename normalization.

## No Automatic Continuation

After any `FAIL`, `STOP_FOR_SUPERVISOR`, or `QUARANTINE_REQUIRED`, the loop must
stop. A later mission may repair or split the work, but the current loop must
not ask for another product prompt or continue to the next mission.
