# Budget Quota Meter

ChatGPT Web and Gemini Web do not expose exact token cost to the local Control Plane. A20A therefore tracks measurable proxies instead of pretending to know exact tokens.

## Counters

The meter tracks wall clock minutes, missions attempted and succeeded, ChatGPT and Gemini live calls, image uploads, REQUEST_MORE rounds, format repairs, prompt and response bytes, branches, commits, pushes, screenshots, contact sheets, evidence artifacts, retry categories, bridge failures, visual audits, and Strategic Pulse calls.

## Warning And Stop

`ops/autopilot/check_budget_quota_meter.ps1` compares a state JSON file to configurable thresholds in `ops/autopilot/long_run_safety_policy.yaml`.

- `PASS`: continue.
- `WARN_QUOTA_NEAR_CAP`: enter or prepare DRAIN.
- `STOP_QUOTA_NEAR_CAP` or `STOP_QUOTA_EXCEEDED`: stop the long run and report.

The default policy warns at 80 percent. A20.5 and A21 use separate caps so the pilot can be stricter than the later night run.
