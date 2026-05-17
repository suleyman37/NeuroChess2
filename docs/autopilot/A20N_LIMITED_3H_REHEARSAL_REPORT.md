# A20N Limited 3H Rehearsal Report

## 1. Mission Summary

A20N ran a bounded rehearsal of the product-safe Night Mode control loop. It did
not run the full A21 all-night mission. The rehearsal used the A20M objective
reservoir and selected a small, product-relevant design governance objective
instead of trying to create volume.

The rehearsal produced one meaningful product/design deliverable:

- NeuroChess Creative Director Gate
- North Star Public Teaser Standard

It also produced the required A20N morning report, next decision report, and
external run artifacts.

## 2. Start Branch And Commit

- Protected road branch: `road-to-V2`
- Road HEAD at precheck: `7a71b0e`
- `origin/road-to-V2` at precheck: `7a71b0e`
- A20M source branch: `auto/a20m-visual-court-and-all-night-readiness-gate-20260518`
- A20M source commit: `07bcd51`
- A20N branch: `auto/a20n-limited-3h-all-night-rehearsal-20260518`

## 3. Rehearsal Duration

- Start time: 2026-05-18T01:32:04+02:00
- End time: 2026-05-18T01:35:25+02:00 before validation
- Recorded rehearsal execution duration: about 00:03:21 before validation
- Maximum allowed duration: 180 minutes

This was a limited rehearsal, not an attempt to fill three hours.

## 4. Full Run Status

- Full A21 launched: no
- Full Night Mode run launched: no
- All-night run started: no
- Road-to-V2 pushed: no
- Road-to-V2 merged: no
- Product code merged to road-to-V2: no

## 5. Objective Reservoir Read

Source reservoir:

`docs/autopilot/A21_OBJECTIVE_RESERVOIR_DRAFT.md`

The reservoir contained 12 candidate objectives. The rehearsal prioritized
product/design value over pure governance.

## 6. Objectives Selected

### Selected Objective 1 - Creative Director And Public Teaser Standard

Source:

- derived from the preferred design/product objective lane in the A20N mission;
- aligned with A21-01, A21-10, and A21-12 from the A20M reservoir.

Why selected:

- It directly addresses the gap between A20L as a strong internal North Star
  candidate and future public/product-grade visual direction.
- It helps prevent future visual work from becoming merely safe, generic, or
  busy.
- It strengthens product judgment without touching frontend, backend, packages,
  DB, or road.

Outputs:

- `docs/design/NEUROCHESS_CREATIVE_DIRECTOR_GATE.md`
- `docs/design/NORTH_STAR_PUBLIC_TEASER_STANDARD.md`

### Selected Objective 2 - Rehearsal Evidence And Morning Decision

Source:

- A20N required outputs;
- aligned with A21-11 and A21-12 from the A20M reservoir.

Why selected:

- The rehearsal has value only if the next morning decision is clear.
- It tests whether the run can stop cleanly with evidence rather than continuing
  into low-value work.

Outputs:

- `docs/autopilot/A20N_LIMITED_3H_REHEARSAL_REPORT.md`
- `docs/autopilot/A20N_REHEARSAL_MORNING_REPORT.md`
- `docs/autopilot/A20N_NEXT_DECISION.md`
- `ops/autopilot/a20n_limited_rehearsal_result.json`
- external QA artifacts under the A20N rehearsal artifact root.

## 7. Objectives Rejected And Why

| Objective | Decision | Reason |
|---|---|---|
| A21-02 Visual Firewall Evidence Index Backfill | skipped | Useful, but lower product value than a Creative Director gate. |
| A21-03 Strict Gemini Packet Builder Dry Run | skipped | Mostly provider plumbing; live Gemini was intentionally not called. |
| A21-04 A20L Browser Recheck | skipped | A20L already has fresh browser evidence; no frontend files changed in A20N. |
| A21-05 DEV Route Inventory | skipped | Useful but mostly inventory; less strategic than visual direction hardening. |
| A21-06 Sacred Board Fixture Expansion | skipped | Useful static hardening, but not the highest product/design objective. |
| A21-07 Frontend Read-Only UX Friction Audit | skipped | Would need a separate visual/browser evidence mission to be meaningful. |
| A21-08 V1 Shell Smoke Strengthening | skipped | No frontend route changed in A20N; existing A20L V1 shell check passed. |
| A21-09 Read-Only Backend Proof Audit | skipped | Backend risk not needed for a design-focused rehearsal. |
| A21-11 Morning Report Template | partially selected | Morning-style report created specifically for A20N. |
| A21-12 Limited Rehearsal Controller Dry Run | selected in spirit | This mission executed the bounded rehearsal manually, without launching A21. |

## 8. Child Branches Created

Child branches created: none.

Reason:

The selected objectives were docs/design and rehearsal evidence outputs that
belong on the A20N rehearsal branch. Creating child branches for two small
docs-only deliverables would have added branch overhead without improving safety.
No frontend, backend, package, DB, or product data paths were touched.

## 9. Deliverables Completed

Completed:

- Creative Director Gate
- North Star Public Teaser Standard
- A20N rehearsal report
- A20N morning report
- A20N next decision
- A20N result JSON
- external artifact manifest, timeline, selected objectives, objective results,
  branch matrix, evidence index, morning report copy, and final decision JSON

E2E deliverable count:

- product/design E2E deliverables: 1
- evidence/reporting deliverables: 1

## 10. Deliverables Skipped Or Failed

Skipped:

- browser screenshot recheck;
- V1 shell smoke;
- frontend build/typecheck;
- live Gemini or ChatGPT visual review;
- backend read-only proof.

Reason:

A20N changed no frontend, backend, package, or runtime product files. Running
browser and frontend checks would have produced evidence volume without matching
the actual diff.

Failures:

- none recorded.

## 11. Tests Run

Required validation:

- `git diff --check`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_all_night_readiness_gate.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_strict_visual_firewall.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_design_intelligence_layer.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_autonomous_design_judgment.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_3d_board_stage_architecture.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_visual_auditor_canary_halting.ps1`
- `python tools/plan_guard.py`

Frontend build/typecheck:

- not run because no frontend files changed.

V1 unchanged smoke:

- not run because no frontend route or App file changed in A20N.

## 12. Evidence Produced

External artifact root:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\limited_rehearsals\A20N_limited_3h_rehearsal_20260518`

Artifacts:

- `manifest.json`
- `run_timeline.json`
- `selected_objectives.json`
- `objective_results.json`
- `branch_matrix.json`
- `evidence_index.json`
- `morning_report.md`
- `final_decision.json`

No screenshots or contact sheets were created because no visual/browser
objective was executed.

## 13. Safety Incidents

Safety incidents: none.

- Red-tier incident: no
- Human verification incident: no
- Login/CAPTCHA/2FA/consent encountered: no
- Bypass attempted: no
- Backend mutation risk: no
- Product data write risk: no
- Package mutation: no
- Unsafe cleanup/reset: no

## 14. Visual Gate Incidents

Visual gate incidents: none.

No visual implementation branch was created. The new design standards preserve
A20K/A20L hard gates and explicitly prevent weaker visual claims.

## 15. Marginal Value Assessment

Marginal value result:

`CONTINUE_FOR_ONE_DESIGN_GOVERNANCE_DELIVERABLE_THEN_DRAIN`

Why:

- The Creative Director Gate improves future product visual judgment.
- The Public Teaser Standard directly addresses the A20L gap: strong internal
  candidate, not public-ready.
- Additional work would likely drift into docs volume or implementation risk.

## 16. Drain Decision

Drain decision:

`DRAIN_AFTER_HIGH_VALUE_LIMITED_DELIVERABLE`

Reason:

The rehearsal produced one useful product/design deliverable and the required
morning decision artifacts. Continuing would have encouraged process generation
instead of product progress.

## 17. Road-To-V2 Status

Road-to-V2 remained protected.

- Road HEAD expected: `7a71b0e`
- Road pushed: no
- Road merged: no
- Product code merged: no

## 18. Final Readiness Verdict

Final readiness verdict:

`GO_FOR_VISUAL_CREATIVE_DIRECTOR_HARDENING`

Reason:

The system behaved safely and selected a product-relevant objective, but this
was still a short docs/design rehearsal. It did not exercise child product
branches, browser smokes, or multiple E2E deliverables. The next best step is to
formalize the Creative Director and Awwwards-grade application visual system
before full A21.
