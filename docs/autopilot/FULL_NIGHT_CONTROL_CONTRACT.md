# Full Night Control Contract

This contract governs a true unattended full-night pixel run. It does not launch Night Mode by itself.

## Runtime Budget

- `max_runtime_minutes`: 480
- `max_iterations`: 12
- `minimum_pixel_deltas_target`: 6
- `stretch_pixel_deltas_target`: 10

## Allowed Work

- DEV-only frontend visual routes and components.
- Screenshot scripts and browser smoke scripts.
- External QA artifacts under `NeuroChess_QA_Artifacts`.
- OMEGA score state, Failure Ledger, Protocol Memory, and morning report.
- Small tests when required to prove the run is safe.

## Forbidden Work

- Backend product logic.
- Database writes.
- Package installs or lockfile edits.
- V1 behavior changes.
- `road-to-V2` push or merge.
- Public release, tag release, or A21 launch.
- Secrets, private URLs, private ntfy topic, API keys, or PII.
- `ops/autopilot/local/**` or `ops/autopilot/runtime/**` commits.
- Paid studies.
- Live GPT/Gemini as a dependency.
- CAPTCHA, 2FA, consent, or human verification automation.

## Required Proof

- Every pixel delta has a screenshot stored outside the repo.
- Every iteration has a Mission Doctor result.
- Morning report is generated.
- NightReadinessV2 runs after the full-night run.
- No safety violation occurs.
- Final git status is clean or explicitly explained.

## Stop Conditions

- Test matrix failure is not safely fixable.
- V1 risk is detected.
- A forbidden path is touched.
- Screenshots or QA artifacts are staged.
- `ops/autopilot/local/**` or `ops/autopilot/runtime/**` is staged.
- No useful pixel objective remains.
- Runtime or iteration budget is reached.
- Two consecutive meta-drift detections occur.
- Two consecutive weak pixel deltas occur.
- `ops/autopilot/runtime/STOP_FULL_NIGHT.flag` exists.

## Verdict

A run is eligible for `FULL_NIGHT_CONFIRMED_19_5` only when the required proof, stop discipline, branch quarantine, and morning report contract all pass.
