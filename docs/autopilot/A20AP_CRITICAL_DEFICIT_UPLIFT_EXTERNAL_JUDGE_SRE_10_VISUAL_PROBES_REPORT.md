# A20AP Critical Deficit Uplift External Judge SRE 10 Visual Probes Report

## 1. Mission Summary

A20AP added a non-blocking External Judge SRE layer for ChatGPT/Gemini lanes and created a DEV-only gallery of 10 visible NeuroChess signature probes with external screenshot evidence.

## 2. Why A20AP Was Required After A20AO

A20AO made NeuroRelay compact and optional-web, but it did not yet improve live-lane reliability or visual production. A20AP targeted those deficits directly: lane health, ntfy-capable failure alerts, park-and-continue behavior, concrete art direction, and actual visible probes.

## 3. External Judge SRE Summary

Created `ops/autopilot/external_judge_sre.ps1`, `ops/autopilot/external_judge_sre_policy.yaml`, and `ops/autopilot/test_external_judge_sre.ps1`. The SRE supports status, health checks, lane probes, parking, retry deferral, dry runs, and alert-failure handling.

## 4. ChatGPT Failure Alert Behavior

ChatGPT failures are classified, parked, and routed to the alert router when action may be useful. Dry-run proof returned `ALERT_DRY_RUN` for `CHATGPT_CDP_UNREACHABLE`, with Codex continuing offline.

## 5. Gemini Failure Alert Behavior

Gemini can be parked as not configured or skipped when no visual evidence exists. Auth/consent/human-wall and invalid-response cases are covered by policy and tests.

## 6. ntfy Alert Status

The SRE calls the existing alert router and never prints the ntfy topic. If ntfy is unavailable, it writes a local runtime alert and continues offline. No real failure spam alert was sent during this mission; dry-run alert behavior passed.

## 7. Constitution Candidate Summary

Created `docs/design/DESIGN_CONSTITUTION_CANDIDATE_V0.md`, locked for five visual probe missions. It defines desktop cockpit density, strict board priority, HSL color direction, motion rules, and a tactical observatory material metaphor.

## 8. 10 Signature Candidates Summary

Created `docs/design/SIGNATURE_CANDIDATES_10.md` with exactly the required candidates: sacred board chamber, piece identity system, decision feedback language, critical moment sigil, verdict wax seal, aftermath timeline, memory cabinet, piece breath, position resonance, and decision pressure field.

## 9. 10 Visual Probes Summary

Created DEV-only probe files under `frontend/src/dev/signature-probes/`. Each probe has a distinct visual form, learning-loop stage label, factual contribution, anti-pattern note, and risk badges.

## 10. Probe Gallery Route

Route: `/app?visualProbeGallery=1`.

The route is gated by `import.meta.env.DEV` and is absent from the normal `/app` product path.

## 11. Screenshot And Contact Sheet Status

Browser smoke passed with all 10 probes visible. Evidence is external only:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_probes\A20AP_critical_deficit_uplift_10_probes_20260518\`

Contact sheet: `contact_sheet_signature_probes.png`.

## 12. NeuroRelay Rehearsal Result

`run_neurorelay_loop.ps1 -Mode Rehearsal -MissionId A20AP -MaxIterations 2 -NoLiveWeb` passed. Next planned objectives were `SIGNATURE_FIVE_SELECTION_FROM_10_PROBES` and `TRIPLED_VARIANTS_FOR_TOP_2_SIGNATURES`.

## 13. Score Update

Conservative overall score moved from 17.0 to 17.7. Visual production moved to 15.8 because screenshots exist, not because probes are selected. External judge reliability architecture is marked 18.5, while external live utilization remains 0 in NoLiveWeb rehearsal.

## 14. Sub-15 Categories Improved

- Visual production: 12.5 to 15.8, supported by 10 visible probes and screenshots.
- Art direction concrete: 16.5 initial tracked score, supported by Constitution V0 and 10 candidates.
- Autonomous loop: 12.0 to 15.0, supported by probe-aware NeuroRelay rehearsal.
- Night readiness: 15.0 to 17.5, because external failures park and offline visual work continues.

## 15. Remaining Work For 18.5

Visual production needs human or external review of the 10 probes, Signature Five selection, and at least two tripled A/B/C signature variants. Gemini visual critique is still optional and not yet live-proven.

## 16. Remaining Work For 19.5 Overall

The system still needs selected signature components, productive pixel rehearsal, reviewed screenshot deltas, and a stronger evidence loop before any 19.5 claim.

## 17. Recommended Next Mission

A20AQ_SIGNATURE_FIVE_SELECTION_FROM_10_PROBES

## 18. A21 Statement

A21 was not launched.

## 19. Night Mode Statement

Night Mode was not launched.

## 20. Road Statement

road-to-V2 was not pushed.

## Final Verdict

CRITICAL_DEFICIT_UPLIFT_PASS
