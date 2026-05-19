# A20AX Final Autopilot Hardening Before Full Night Report

## 1. Mission Summary

A20AX added the final operational gates required before allowing a true unattended full-night pixel run. The mission did not launch A21, did not launch full Night Mode, did not merge to `road-to-V2`, and did not modify backend, package, database, or V1 product behavior.

Final hardening status: ready for full-night run gate.

## 2. Why A20AX Was Required After A20AW

A20AW proved a full-night pixel rehearsal candidate with 8 useful pixel deltas, external-only screenshots, no live web dependency, `NIGHT_READY`, and a conservative 19.5 candidate score. Before a real unattended run, the system still needed explicit operational controls: kill switch, runtime budget, branch quarantine, alert readiness, morning report schema, meta-drift prevention, score inflation prevention, and a final go/no-go gate.

## 3. Full Night Control Contract Summary

Created `docs/autopilot/FULL_NIGHT_CONTROL_CONTRACT.md` and `ops/autopilot/full_night_control_policy.yaml`.

The contract defines:

- max runtime: 480 minutes
- max iterations: 12
- minimum target: 6 pixel deltas
- stretch target: 10 pixel deltas
- allowed work: DEV-only frontend visual work, screenshot scripts, external artifacts, OMEGA state, failure ledger, protocol memory, morning report, and small necessary tests
- forbidden work: backend product logic, DB writes, package installs, V1 behavior changes, road push/merge, secrets, local/runtime commits, public release, A21 launch, paid studies, live GPT/Gemini dependency, and human verification flows
- stop conditions: hard runtime/iteration budget, kill switch, forbidden paths, screenshots staged, weak/meta streaks, V1 risk, test failure, or no useful pixel objective

## 4. Kill Switch Result

Created `ops/autopilot/full_night_kill_switch.ps1`, `ops/autopilot/test_full_night_kill_switch.ps1`, and `docs/autopilot/FULL_NIGHT_KILL_SWITCH.md`.

Runtime stop flag:

`ops/autopilot/runtime/STOP_FULL_NIGHT.flag`

Result:

- absent flag allows run
- armed flag returns `STOPPED_BY_KILL_SWITCH`
- OMEGA rehearsal stops before hidden iterations when flag exists
- runtime flag remains gitignored

## 5. Ntfy Alert Readiness

Created `ops/autopilot/full_night_alerts.ps1` and `ops/autopilot/test_full_night_alerts.ps1`.

Supported alert events:

- full night started
- iteration failure
- kill switch detected
- safety stop
- full night completed
- morning report ready

Result:

- ntfy is optional
- missing ntfy config writes local runtime alert and continues safely
- dry-run alert path works
- mock ntfy success path works
- cooldown suppresses repeated alerts per event/reason
- no secrets, private URLs, or ntfy topic are printed

## 6. Branch Quarantine Result

Created `docs/autopilot/FULL_NIGHT_BRANCH_QUARANTINE.md`, `ops/autopilot/full_night_branch_policy.yaml`, and `ops/autopilot/test_full_night_branch_policy.ps1`.

Rules enforce:

- dedicated timestamped full-night branch
- no `road-to-V2` push or merge
- no tag release
- no branch deletion during run
- no broad staging
- screenshots, QA artifacts, `ops/autopilot/local/**`, and `ops/autopilot/runtime/**` never staged

Result: branch quarantine test passes.

## 7. Morning Report Contract Result

Created `docs/autopilot/FULL_NIGHT_MORNING_REPORT_CONTRACT.md`, `ops/autopilot/morning_report_schema.json`, and `ops/autopilot/test_morning_report_contract.ps1`.

Required Go/No-Go labels:

- `GO_FOR_REVIEW`
- `GO_FOR_SECOND_REHEARSAL`
- `NO_GO_SAFETY`
- `NO_GO_WEAK_OUTPUT`
- `NO_GO_TEST_FAILURE`

Result: schema contract test passes.

## 8. Meta Drift Guard Result

Created `ops/autopilot/full_night_meta_drift_guard.ps1` and `ops/autopilot/test_full_night_meta_drift_guard.ps1`.

Rules:

- docs-only, YAML-only, score-only, test-only, and report-only iterations do not count as pixel deltas
- two consecutive non-pixel iterations stop with `META_DRIFT_STOP`
- non-pixel objectives are rejected while visual production remains the bottleneck

Result: guard test passes.

## 9. Score Inflation Guard Result

Created `ops/autopilot/full_night_score_guard.ps1` and `ops/autopilot/test_full_night_score_guard.ps1`.

Rules:

- no score increase without proof
- no arbitrary rise beyond 19.5
- no 20/20 claim
- visual score cannot rise without screenshots
- night readiness cannot rise if tests fail
- human validation cannot rise without owner/crowd data
- external judge score cannot rise without external decision packets

Result: guard test passes.

## 10. Final Go/No-Go Result

Created `docs/autopilot/FULL_NIGHT_GO_NO_GO.md`, `ops/autopilot/final_full_night_go_no_go.ps1`, and `ops/autopilot/test_final_full_night_go_no_go.ps1`.

Final gate result:

`READY_FOR_FULL_NIGHT`

Evidence:

- A20AW report contains full-night pixel rehearsal candidate verdict
- NightReadinessV2 returns `NIGHT_READY`
- kill switch reports `FULL_NIGHT_RUN_ALLOWED`
- alert dry-run returns `ALERT_DRY_RUN`
- branch quarantine valid
- morning report contract valid
- meta drift guard passes
- score guard passes
- no forbidden paths found in git status

## 11. Whether A20AY_FULL_NIGHT_REAL_PIXEL_RUN Is Allowed

Yes. A20AY is allowed as the next mission, provided it uses the full-night control contract and remains bounded, DEV-only, branch-quarantined, external-artifact-only for screenshots, and no-live-web by default.

Allowed next mission:

`A20AY_FULL_NIGHT_REAL_PIXEL_RUN`

## 12. What Remains If Not Allowed

No hard blocker remains from A20AX. If any future preflight fails, the fallback mission is `A20AY_FIX_FINAL_HARDENING` or `A20AY_SECOND_FULL_NIGHT_REHEARSAL`, depending on whether the failure is safety/control-plane related or output-quality related.

## 13. A21 Statement

A21 was not launched.

## 14. Full Night Mode Statement

Full Night Mode was not launched in this mission.

## 15. Road Statement

`road-to-V2` was not pushed.

## Final Verdict

`FINAL_AUTOPILOT_HARDENING_READY_FOR_FULL_NIGHT`

## Recommended Next Mission

`A20AY_FULL_NIGHT_REAL_PIXEL_RUN`
