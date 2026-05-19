# A20AU OMEGA Autonomy Kernel And Self-Improving Pixel Lab Report

## 1. Mission Summary

A20AU creates the OMEGA autonomy kernel and a DEV-only OMEGA Pixel Lab route. The kernel observes the current autonomy state, detects bottlenecks, scores candidate missions, emits proof-carrying contracts, blocks stagnation, records failure recurrence, and checks readiness for a limited autonomous pixel rehearsal.

This mission also produces visible proof: `/app?omegaPixelLab=1` renders a DEV-only pixel lab with the current bottleneck, utility-ranked candidates, selected mission, Signature Five status, top-two signature state, pixel mandate status, and a visible sacred-board plus decision-feedback pilot composition.

## 2. Why A20AU Was Required

A20AT made human taste validation export-ready, but the system could still over-invest in frameworks, reports, and diagnostics. A20AU adds a local control loop that forces proof-bearing pixel progress when design and night-readiness scores are the bottleneck.

## 3. OMEGA Algorithm Summary

OMEGA is implemented as:

- Observe: `bottleneck_detector.ps1` reads score state, signature status, and failure ledger.
- Model: `mission_utility_engine.ps1` ranks objective reservoir candidates with utility, bonuses, penalties, and hard rejects.
- Execute: `build_proof_carrying_contract.ps1` produces a sub-900-word Codex contract with evidence requirements.
- Grade: Mission Doctor remains the downstream grading layer; OMEGA records proof strength and conservative deltas.
- Adapt: `protocol_memory_update.ps1`, `failure_ledger_update.ps1`, and utility penalties prevent repeated weak lanes.

## 4. Bottleneck Detector Summary

Created:

- `ops/autopilot/bottleneck_detector.ps1`
- `ops/autopilot/test_bottleneck_detector.ps1`
- `docs/autopilot/BOTTLENECK_DETECTOR.md`

The detector reports primary bottleneck, secondary bottlenecks, recommended lane, parked lanes, forbidden moves, and pixel mandate status. A20AT fixture testing confirms `autonomous_loop` is detected as the weak category and `A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS` is selected as the next pixel-progress lane.

## 5. Utility Engine Summary

Created:

- `ops/autopilot/mission_utility_engine.ps1`
- `ops/autopilot/mission_utility_policy.yaml`
- `ops/autopilot/test_mission_utility_engine.ps1`
- `docs/autopilot/MISSION_UTILITY_ENGINE.md`

The utility model implements the requested formula with deterministic ranking, evidence value, bottleneck relevance, pixel mandate boost, night readiness bonus, meta drift penalty, repeated failure penalty, user dependency penalty, live-web dependency penalty, evidence weakness penalty, and scope risk penalty.

Winner in dry run: `A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS`.

## 6. Anti-Stagnation Sentinel Summary

Created:

- `ops/autopilot/anti_stagnation_sentinel.ps1`
- `ops/autopilot/test_anti_stagnation_sentinel.ps1`
- `docs/autopilot/ANTI_STAGNATION_SENTINEL.md`

The sentinel detects meta drift, no-pixel risk, repeated live-web loops, repeated alert loops, score inflation without evidence, and repeated failures. It can force pixel missions, park blocked live lanes, forbid repeated objectives, and lower score confidence.

## 7. Proof-Carrying Contract Summary

Created:

- `ops/autopilot/proof_carrying_contract.schema.json`
- `ops/autopilot/build_proof_carrying_contract.ps1`
- `ops/autopilot/test_proof_carrying_contract.ps1`
- `docs/autopilot/PROOF_CARRYING_MISSION_CONTRACT.md`

The generated contract includes objective, expected proof, allowed paths, forbidden paths, max files, max diff lines, validation commands, stop conditions, evidence artifacts, score delta rules, safety rules, and final verdicts. Test result: contract word count 218, under the 900-word ceiling.

## 8. Failure Ledger 2.0 Summary

Created:

- `ops/autopilot/failure_ledger.yaml`
- `ops/autopilot/failure_ledger_update.ps1`
- `ops/autopilot/test_failure_ledger_update.ps1`
- `docs/autopilot/FAILURE_LEDGER_2.md`

The ledger tracks lane, reason, recurrence count, parked-until time, do-not-repeat rule, next safe alternative, alert status, user intervention requirement, and whether the loop continued. Repeated failures can be marked for avoidance.

## 9. Night Readiness V2 Summary

Created:

- `ops/autopilot/night_readiness_v2.ps1`
- `ops/autopilot/test_night_readiness_v2.ps1`
- `docs/autopilot/NIGHT_READINESS_V2.md`

Night Readiness V2 verifies no user intervention, GPT Web optional, Gemini optional, live lanes park-and-continue, objective reservoir, bottleneck detector, utility engine, anti-stagnation sentinel, pixel mandate, proof contracts, failure ledger, screenshots external-only, no road push, no secrets, bounded runtime, bounded iterations, morning report, and stop flag support.

NightCheck artifact result: `NIGHT_READY` with no full night launched. Unit test result: `NIGHT_READY_LIMITED_PIXEL_REHEARSAL`.

## 10. Protocol Memory 2.0 Summary

Updated:

- `ops/autopilot/protocol_memory.yaml`
- `ops/autopilot/protocol_memory_update.ps1`

Added support for compression, expiration flags, contradiction-resolution metadata, evidence references, max-entry enforcement, short-entry enforcement, no-secret checks, and no-private-URL checks. A20AU memory records that GPT/Gemini remain optional, contact sheets are overview-only, perception-grade evidence is required, unattended runs must avoid READY gates, ntfy remains primary alerting, the pixel mandate activates on visual bottlenecks, and score increases require proof.

## 11. OMEGA Pixel Lab Route

Created:

- `frontend/src/dev/omega-pixel-lab/OmegaPixelLab.tsx`
- `frontend/src/dev/omega-pixel-lab/omegaPixelLabData.ts`
- `frontend/src/dev/omega-pixel-lab/omegaPixelLabStyles.css`

Updated:

- `frontend/src/App.tsx`

Route: `/app?omegaPixelLab=1`

The route is DEV-only through the existing `import.meta.env.DEV` query-route pattern. Normal `/app` remains unchanged.

## 12. First Autonomous Pixel Pilot Result

The pixel pilot renders:

- a strict 8x8 board in a chamber frame;
- board-safe atmospheric rails outside the board;
- post-attempt feedback marks for no-spoiler, success, and miss states;
- current OMEGA bottleneck and selected mission;
- Signature Five status and top-two provisional winners.

Browser smoke result: `OMEGA_PIXEL_LAB_SMOKE_PASS`.

Pixel proof:

- pilot surface: 860 x 510;
- board: 360 x 360;
- screenshot: external QA artifact path only.

## 13. Frontend Build, Typecheck, And Smoke Results

PowerShell direct `npm` and `npx` were blocked by local script policy, then the repo Windows-safe commands passed:

- `cmd /c npm.cmd run build`: pass
- `cmd /c npx.cmd tsc --noEmit`: pass
- `node scripts/browser_omega_pixel_lab_smoke.mjs`: pass

Build warning: Vite chunk-size warning only; no build failure.

## 14. OMEGA Rehearsal Result

Command:

`powershell -NoProfile -ExecutionPolicy Bypass -File ops/autopilot/run_omega_autopilot.ps1 -Mode Rehearsal -MissionId A20AU -MaxIterations 3 -NoLiveWeb`

Result:

- status: `OMEGA_REHEARSAL_PASS`
- completed iterations: 3
- no live web: true
- no user intervention: true
- loop bounded: true
- pixel objective included: true
- average contract words: 215.67
- first selected objective: `A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS`

## 15. NightCheck Result

Command:

`powershell -NoProfile -ExecutionPolicy Bypass -File ops/autopilot/run_omega_autopilot.ps1 -Mode NightCheck -MissionId A20AU -MaxIterations 6 -MaxRuntimeMinutes 180`

Result:

- status: `NIGHT_READY`
- no full night launched: true
- recommended next: `A20AV_LIMITED_AUTONOMOUS_PIXEL_REHEARSAL`

## 16. Score Update

Updated `ops/autopilot/autonomy_score_state.json` conservatively:

- previous overall: 18.9
- new overall: 19.15
- autonomous loop: 15.0 to 18.4
- visual production: 18.0 to 18.25
- night readiness: 17.5 to 18.8

No 19.5 claim is made.

## 17. What Remains For 19.5

Remaining work:

- run a limited autonomous pixel rehearsal;
- execute the selected pixel mission for the provisional top-two winners;
- prove screenshot-backed improvement from the rehearsal;
- import real owner or crowd taste results, or keep claims provisional;
- avoid score inflation until evidence and Mission Doctor output confirm value.

## 18. Recommended Next Mission

`A20AV_LIMITED_AUTONOMOUS_PIXEL_REHEARSAL`

This is the shortest path to 19.5 because it validates OMEGA under bounded unattended pixel-production conditions.

## 19. A21 Statement

A21 was not launched.

## 20. Night Mode Statement

Night Mode was not launched.

## 21. Road Branch Statement

`road-to-V2` was not pushed.

## Final Verdict

`OMEGA_KERNEL_READY_LIMITED_NIGHT_REHEARSAL_NEXT`
