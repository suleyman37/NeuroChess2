# A20AO NeuroRelay External Intelligence Load Balancer Report

## 1. Mission Summary

A20AO created NeuroRelay, an external-intelligence load balancer for the autonomous control plane. It builds compact context capsules, normalizes external or local reasoning into Decision Packets, auctions candidate missions, emits short Codex Patch Contracts, and updates bounded Protocol Memory.

## 2. Why NeuroRelay Was Required After A20AN

A20AN made the autonomous conductor offline-first, but Codex still carried too much planning context. NeuroRelay shifts reasoning into compact packets and lets Codex execute one bounded contract at a time.

## 3. How Codex Workload Is Reduced

Codex receives a patch contract under 900 words instead of a full mission history. A20AO rehearsal averaged about 183 words per contract.

## 4. ChatGPT Web Workload When Available

ChatGPT Web can receive a 1200-word context capsule and return a Decision Packet as strategic supervisor, product critic, mission selector, prompt improver, or risk challenger.

## 5. Gemini Workload When Visual Evidence Exists

Gemini is reserved for visual perception critique: screenshot review, composition/readability judgment, and style defect detection. If no visual evidence exists, Gemini is skipped.

## 6. External Models Remain Optional

Both live lanes can be parked. In A20AO `-NoLiveWeb` rehearsal, ChatGPT Web and Gemini were unavailable by design and the loop still completed through local fallback.

## 7. Context Capsule Summary

Created `ops/autopilot/context_capsule_builder.ps1`. Capsules include mission goal, repo state, last outcomes, blockers, score snapshot, requested decision, and artifact references. They exclude secrets, private URLs, screenshots, giant logs, and repeated boilerplate.

## 8. Decision Packet Summary

Created `ops/autopilot/decision_packet.schema.json` and `ops/autopilot/normalize_external_decision_packet.ps1`. The normalizer rejects vague praise, missing actions, unsafe actions, and forbidden allowed paths.

## 9. Mission Auction Summary

Created `ops/autopilot/mission_auction.ps1`. It scores safe candidate missions by value, risk, pixel mandate alignment, blocked-lane avoidance, and Codex context cost.

## 10. Codex Patch Contract Summary

Created `ops/autopilot/codex_patch_contract_builder.ps1`. It emits concise contracts with objective, allowed paths, forbidden paths, deliverables, validation, safety, stop conditions, and final report format.

## 11. Protocol Memory Summary

Created `ops/autopilot/protocol_memory.yaml` and `ops/autopilot/protocol_memory_update.ps1`. Memory entries are short, actionable, duplicate-merged, and safe for commits.

## 12. Workload Shift Metrics

A20AO rehearsal metrics:

- context capsule average: 135 words
- Codex patch contract average: 182.67 words
- external decision packets: 0
- local fallback packets: 3
- giant prompt prevented count: 3
- external reasoning utilization: 0, proving the system works without external models

## 13. DryRun Result

`NEURORELAY_DRY_RUN_PASS`

DryRun built a context capsule, normalized a local fallback Decision Packet, selected `VISUAL_CONSTITUTION_CANDIDATE_V0`, and created a Codex Patch Contract without GPT Web, Gemini, or user input.

## 14. Rehearsal Result

`NEURORELAY_REHEARSAL_PASS`

Three iterations selected:

1. `VISUAL_CONSTITUTION_CANDIDATE_V0`
2. `SIGNATURE_CANDIDATE_PROBE_SET_V0`
3. `SACRED_BOARD_CHAMBER_COMPONENT_PROBE`

## 15. Current Score Impact

Score delta is conservative: automation maturity improves through mechanism proof, but overall remains below 19.5 because no visual probe screenshots or signature variants were produced.

## 16. What Remains For 19.5

The next climb requires pixels: Constitution Candidate V0, 10 Signature Candidate probes, external screenshots, evidence-based Signature Five selection, and at least two tripled signature components.

## 17. Recommended Next Mission

`A20AP_CONSTITUTION_CANDIDATE_AND_10_SIGNATURE_CANDIDATES`

## 18. A21 Statement

A21 was not launched.

## 19. Night Mode Statement

Night Mode was not launched.

## 20. Road Statement

`road-to-V2` was not pushed.

## Final Verdict

`NEURORELAY_READY`
