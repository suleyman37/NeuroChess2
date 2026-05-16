# Prompt Quality Learning Loop

## Loop

Future runs can use the Prompt Ledger to improve prompt style:

1. Record structured outcome.
2. Score execution from actual gates.
3. Analyze repeated failures.
4. Propose prompt-style improvements.
5. Review the change through existing gates.
6. Use the improved style only after safe approval.

## Recurring Failures

The analyzer should surface repeated repair use, Mission Contract mismatches,
low product value, REQUEST_MORE, and stop codes.

## Safe Style Updates

Learned prompt style must not auto-execute. It should update guidance only when
evidence is clear and the change does not weaken safety constraints.
