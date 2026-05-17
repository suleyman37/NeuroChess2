# Asymptotic Drain Policy

Night Mode should stop when valuable work is exhausted. It should not fill time
with noise.

## Stop Early

If deliverable quotas are met early:

1. enter `DRAIN`;
2. generate the morning report;
3. classify outputs;
4. stop with `PASS_EARLY_EXCELLENCE` when evidence is complete.

## Avoid Filling Time

Do not continue expansion only because wall-clock time remains. Repeated tiny
missions, low-value docs churn, and sterile consolidation lower confidence.

## Safety Fuses

Wall clock remains useful as a safety fuse:

- `max_wall_clock`;
- `auto_drain_at_hours`;
- cost/time warnings.

These fuses stop overrun. They do not define success.
