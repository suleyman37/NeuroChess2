# Marginal Value Gate

After initial quota is met, additional work must prove it is worth doing.

An objective may continue only if it adds at least one real value:

- creates a new E2E deliverable;
- improves confidence in an existing branch;
- adds missing test or smoke evidence;
- adds missing visual proof;
- reduces branch integration risk;
- reduces a named player or product friction;
- improves evidence index or morning report completeness;
- safely resolves a `NEEDS_REWORK` branch;
- runs a due visual canary;
- consolidates branch dependencies.

Reject objectives that are docs-only filler, repeat a mission hash, reduce no
product friction, create merge conflict risk, request broad refactor, request
cosmetic pixel pushing, require a meta-fix during A20.5/A21, or exceed the
remaining safe time window.

Default thresholds:

- value >= 70 and risk <= 40: continue;
- value 50-69: only consolidation or evidence work may continue;
- value < 50: reject unless safety-critical;
- risk > 70: reject or quarantine.
