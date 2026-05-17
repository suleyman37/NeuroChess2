# Rolling Loop Mission Queue

The dry-run queue is a JSON fixture with a scenario name, initial phase, and a
list of simulated mission entries.

Each queue entry points to an audited fixture payload. A payload represents what
a future planner proposal would provide: mission descriptor, NC-MP/2 text,
Mission Contract, Shadow Plan, Product Impact review, Goldilocks metadata, and
simulated execution evidence.

Future live ChatGPT proposals may enter only after a bridge converts them into
the same normalized queue shape. External skills, raw prompts, or unvalidated
planner prose are never executed directly.

The queue runner processes one entry at a time. If a deterministic stop condition
fires, the remaining queue is left unprocessed and the report records what would
happen next in live mode.
