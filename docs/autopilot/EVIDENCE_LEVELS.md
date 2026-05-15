# Evidence Levels

## Level 0 - No ChatGPT

Use when:
- task is green/docs-only;
- exactly allowed paths changed;
- checks pass;
- no alarms;
- no ambiguity.

Behavior:
- no supervisor call needed.

## Level 1 - Supervisor Digest

Default supervisor call.

Includes:
- compact Supervisor Digest only;
- no full patch by default;
- no long logs by default;
- no screenshots by default.

Use when:
- a supervisor decision is useful;
- the task is small enough to summarize;
- no high-risk product write is involved.

## Level 2 - Targeted Evidence

Future protocol support only in A4A.

For cases like:
- failing test;
- prompt rejected;
- UI screenshot needed;
- route ambiguity;
- alarm triggered.

A later REQUEST_MORE protocol may ask for targeted files or screenshots.

## Level 3 - Full Evidence Pack

Future protocol support only in A4A.

For:
- red-tier work;
- Practice/due_at/Daily Plan/training_items/practice_attempts;
- repeated failure;
- major architecture decision;
- quarantine review.

Level 3 should remain exceptional because it is expensive, noisy, and easier to
misread than a focused digest.

## A4A Scope

A4A implements Level 0/1 behavior and documents Level 2/3. It does not implement
REQUEST_MORE, retro every 5 missions, Gemini, or autonomous product execution.
