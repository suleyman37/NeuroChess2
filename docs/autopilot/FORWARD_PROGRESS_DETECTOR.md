# Forward Progress Detector

## Purpose

A16B adds a deterministic forward progress detector. A controller can be alive
and still waste a session by retrying prompts, refreshing bridges, or creating
no useful evidence. This detector makes that state visible and stoppable.

## Counts As Progress

A mission counts as forward progress if at least one of these is true:

- a commit was created;
- an ephemeral branch was created and an evidence pack was produced;
- an external product, audit, or report artifact was created;
- tests or smokes produced meaningful PASS/FAIL evidence;
- Strategic Pulse changed direction based on evidence;
- a Mission Contract mismatch exposed a real bug and produced a repairable stop
  report.

## Does Not Count As Progress

A mission does not count as progress when it only produces motion:

- no files changed;
- no commit;
- no branch;
- no evidence pack;
- no useful report;
- repeated prompt repair only;
- repeated bridge retries only;
- same mission hash repeated;
- noise cleanup only;
- no-op reports without new evidence.

## Strategic Pulse Relationship

Strategic Pulse remains advisory unless a deterministic stop condition is
already reached. Three no-progress missions inside a five-mission window require
a Strategic Pulse, but two consecutive no-progress missions stop the session
first.
