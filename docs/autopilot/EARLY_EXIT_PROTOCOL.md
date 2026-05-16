# Early Exit Protocol

## 1. Purpose

Early exit stops mechanically broken missions before they consume more runtime or drift into unsafe scope. It is for deterministic failures only.

Local scripts may stop for facts such as forbidden paths, invalid file counts, or whitespace errors. They must not decide product strategy or architecture direction.

## 2. Local STOP_MECHANICAL

The system may stop locally when it detects:
- forbidden path touched;
- docs-only task touched code;
- frontend/backend mixed without permission;
- package files touched without explicit permission;
- `.serena`, `.venv`, `qa_artifacts`, or generated opening book touched;
- `git diff --check` fails;
- changed file count exceeds max files;
- red-tier keyword appears outside red-tier/quarantine;
- TDD separation violation;
- branch policy violation;
- repeated check failures over the configured limit.

## 3. STOP_FOR_SUPERVISOR

Ambiguous cases should stop for supervisor review, not local judgment.

Examples:
- a failing test may be expected in a test-first mission;
- UX quality uncertainty;
- route safety uncertainty;
- product scope uncertainty;
- architecture tradeoff;
- diff size exceeds the prompt contract but may still be intentional.

## 4. No Product Judgment

Early exit scripts do not choose features, rewrite missions, or approve product scope. They only report mechanical safety decisions.

## 5. No Destructive Kill By Default

A8 does not enable process killing, branch deletion, product task cancellation, or autonomous intervention. It creates reports and stop decisions only.
