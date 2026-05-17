# Goldilocks Governor

The Goldilocks Governor rejects missions that are too small to matter or too
large to trust before execution. It sits below the Control Plane and supports
the Mission Contract and Shadow Plan.

## Tiny Mission Rejection

Reject tiny work when:

- planned logical delta is below threshold and not docs-approved;
- the mission only creates low-value comments or README text without reducing
  product friction;
- the mission has no E2E deliverable, no product friction reduction, and no
  safety-critical unlock.

Suggested threshold:

- `tiny_logic_delta_lines < 15` returns `TINY_MISSION_REJECT` unless the mission
  is docs-approved and classified as `PRODUCT_ENABLER` or `SAFETY_CRITICAL`.

## Blast Radius Rejection

Reject oversized work when:

- planned modified files exceed 7 for one mission;
- planned diff lines exceed 350 for one mission;
- Night Mode stricter limits are configured.

The safe recommendation is `SPLIT_REQUIRED`; scope should shrink rather than
the limits expanding.

## Anti-Ping-Pong Lock

If the same file is modified unsuccessfully in missions N, N+1, and N+2, mark
the file as `QUARANTINED_FILE` for the current Night Mode session. Future
missions may read it but not write it until morning review.

## Verdicts

- `GOLDILOCKS_PASS`
- `TINY_MISSION_REJECT`
- `BLAST_RADIUS_REJECT`
- `PING_PONG_FILE_LOCK`
- `SPLIT_REQUIRED`
