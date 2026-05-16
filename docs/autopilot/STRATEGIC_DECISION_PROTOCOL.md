# Strategic Decision Protocol

## 1. Decision Meanings

- `CONTINUE`: keep the current direction.
- `NARROW`: reduce scope before continuing.
- `SPLIT`: split one broad direction into smaller tracks.
- `PIVOT`: change direction because the current track is no longer best.
- `HARDEN`: improve automation or safety before more product work.
- `RETURN_TO_PRODUCT`: resume concrete NeuroChess product progress.
- `QUARANTINE`: isolate risky work before considering continuation.
- `STOP`: stop for review.

## 2. Allowed Next Actions

The next action must be exactly one mission or one stop action. It must not be a multi-step roadmap.

`RETURN_TO_PRODUCT` should point to the safest bounded product mission, usually a read-only contract or test-first mission when sensitive state is nearby.

`HARDEN` should name the blocking automation gap.

`QUARANTINE` should identify the risk that must be isolated.

## 3. When To Return To Product

Return to product when:
- automation friction is low;
- risk exposure is contained;
- recent missions were mostly automation hardening;
- product progress is lagging;
- the next product step can be bounded safely.

## 4. When To Harden

Harden when:
- bridge instability blocks reliable supervision;
- promotion or branch safety is uncertain;
- evidence capture is incomplete;
- checks are inconsistent;
- automation friction score is high.

## 5. When To Stop

Stop when:
- risk exposure is high and cannot be isolated;
- product or automation direction is unclear;
- evidence contradicts the current plan;
- repeated failures suggest the loop is no longer trustworthy.
