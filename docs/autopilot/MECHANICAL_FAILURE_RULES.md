# Mechanical Failure Rules

## Deterministic Violations

These can stop locally:
- forbidden path touched;
- docs-only work touched code;
- unexpected package file change;
- `.serena`, `.venv`, `qa_artifacts`, or generated opening book changed;
- `git diff --check` failed;
- file count exceeded;
- diff line count exceeded;
- red-tier keyword appeared outside red-tier/quarantine;
- TDD separation violation;
- branch policy violation;
- timebox exceeded;
- repeated check failure limit exceeded.

## Ambiguous Issues

These require supervisor review:
- expected failing test in a test-contract mission;
- UX quality judgment;
- unclear backend route safety;
- unclear product scope;
- architecture tradeoff;
- large diff that may be intentional but exceeds contract.

## Red-Tier Special Cases

Red-tier terms outside a red-tier quarantine context are mechanical violations. Red-tier missions still require quarantine, evidence, rollback planning, and TDD separation.
