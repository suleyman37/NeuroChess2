# Shadow Plan Stop Policy

## STOP_BEFORE_WORK

Use `STOP_BEFORE_WORK` when the Shadow Plan itself is unsafe or outside scope.
No mission execution should begin.

Examples:

- planned write outside contract;
- missing required check;
- forbidden path in planned read/write;
- destructive command planned;
- backend/frontend mixed unexpectedly.

## STOP_FOR_SUPERVISOR

Use `STOP_FOR_SUPERVISOR` when the comparison cannot be evaluated reliably or
the policy is ambiguous.

## REPAIR_PROMPT

Use `REPAIR_PROMPT` when the mission is basically valid but missing mechanical
fields or evidence declarations.

## SPLIT_MISSION

Use `SPLIT_MISSION` when the Shadow Plan combines scopes that must be separate,
such as frontend and backend work.

## No Continuation

There is no automatic continuation after an unsafe Shadow Plan. The next action
must be repair, split, supervisor review, or stop.
