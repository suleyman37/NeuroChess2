# Product Vs Automation Balance

## 1. Principle

Automation should serve NeuroChess. It should not replace product progress.

The system must periodically compare:
- product value delivered;
- automation value delivered;
- friction reduced;
- risk introduced.

## 2. Anti-Yak-Shaving Rules

If there are 5 automation missions in a row without product progress:
- the next Strategic Pulse must justify why not `RETURN_TO_PRODUCT`.

If 2 Strategic Pulses in a row choose `HARDEN`:
- the next pulse must choose `RETURN_TO_PRODUCT`, `STOP`, or provide a blocking safety reason.

If Product Progress score is 1 or lower for two consecutive pulses:
- recommend `RETURN_TO_PRODUCT` unless a red-tier safety blocker exists.

If Automation Friction is 4 or higher:
- recommend `HARDEN` or `STOP`, not product execution.

If Risk Exposure is 4 or higher:
- recommend `QUARANTINE`, `SPLIT`, or `STOP`.

## 3. Ratio

Automation-vs-product ratio is a steering signal, not a hard law. It exists to prevent endless tooling work after enough safety is in place.
