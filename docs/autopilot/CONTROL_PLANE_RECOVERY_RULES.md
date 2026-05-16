# Control Plane Recovery Rules

## Purpose

Recovery rules prevent a future Night Mode controller from continuing after
state corruption, event loss, or lock ambiguity.

## Last Good Recovery

Every valid state write also refreshes:

```text
state\night_session.last_good.json
```

If `night_session.json` is corrupt, the Control Plane must:

1. stop continuation;
2. validate `night_session.last_good.json`;
3. recover from last good only if it validates;
4. write a recovery event or report;
5. require supervisor or user review before continuing.

## Corrupt State Handling

If both current state and last-good state are invalid, the session is
unrecoverable by automation.

Recommended action:

```text
STOP_MANUAL_REVIEW_REQUIRED
```

## Stale Lock Handling

The Control Plane lock is advisory safety state. A stale lock may be reported
but must not be deleted by default.

Stale lock removal requires an explicit release command or a future human-
approved recovery flow. The lock script must not kill processes.

## Event Failure Handling

Invalid events move to `events\failed\` or remain preserved for diagnosis. They
must not be deleted silently.

Sequence gaps are blocking until explained. A later event with sequence 3 does
not prove that sequence 2 happened.

## No Silent Continuation

After any of these conditions, automation must stop:

- corrupt current state;
- invalid last good state;
- active lock conflict;
- unexplained stale lock;
- invalid event;
- event sequence gap;
- failed atomic write.

Deterministic safety beats LLM advice.
