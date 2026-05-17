# Drain Permit Policy

DRAIN is a controlled decision, not the default response to an easy quota.

DRAIN is allowed when any of these are true:

- a hard stop condition occurred;
- the drain time window has arrived;
- no high-value safe objectives remain;
- budget or quota is near cap;
- environment hygiene requires DRAIN;
- branch orthogonality blocks safe new work;
- Strategic Pulse recommends DRAIN and the Control Plane agrees;
- all branches are classified and report evidence is complete;
- the kill switch file is present.

DRAIN is denied when:

- quota was just reached but at least 45 minutes remain;
- the Objective Reservoir has high-value safe candidates;
- required evidence is missing;
- branches are unclassified;
- Morning Report dry-run has not passed;
- Strategic Pulse has not run.

When DRAIN is denied, the required next action is one of:

- `ASK_ARCHITECT_FOR_NEXT_OBJECTIVE`
- `CONSOLIDATE`
- `EVIDENCE_AMPLIFICATION`
- `DRAIN`
