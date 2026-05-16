# Watchdog Authority Hierarchy

Deterministic safety beats LLM advice.

Authority order:

1. User kill switch flags.
2. Watchdog forced safety stop.
3. Mission Contract violation.
4. Mission Contract mismatch.
5. Prompt Firewall rejection.
6. Early Exit mechanical stop.
7. Strategic Pulse STOP / QUARANTINE / HARDEN.
8. Strategic Pulse NARROW / SPLIT / PIVOT / RETURN_TO_PRODUCT.
9. Normal flow.

## Meaning

If a user creates `STOP`, `PAUSE`, `DRAIN`, or `KILL`, the controller must honor
that before supervisor suggestions.

If the watchdog reports RED or BLACK, the controller must stop or enter rescue
flow before asking for another mission.

If Mission Contract comparison fails, the controller must not continue even if
the supervisor previously gave a good prompt.

If Prompt Firewall rejects a prompt, no downstream automation can override it.

If Early Exit finds a deterministic mechanical issue, local stop beats product
or strategy discussion.

Strategic Pulse can steer direction only after deterministic safety checks are
clear.

## A11B Rule

A11B does not execute these authority actions live. It documents the order and
provides scripts that report what action would be required.
