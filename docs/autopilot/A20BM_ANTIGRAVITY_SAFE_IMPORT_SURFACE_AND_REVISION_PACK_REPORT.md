# A20BM Antigravity Safe Import Surface And Revision Pack Report

## 1. Mission Summary

A20BM created the official DEV-only Antigravity spike import surface so future Antigravity proposals do not need to touch `frontend/src/App.tsx`.

Final status:

`ANTIGRAVITY_SAFE_IMPORT_SURFACE_READY`

## 2. Why A20BL Rejected The First Proposal

A20BL rejected the first `critical_moment_sigil` proposal because:

- the proposal base commit was `472f403`, while the import branch was `ee8c7ce`;
- the patch exceeded the importer diff-line gate;
- the patch touched `frontend/src/App.tsx`;
- rollback notes were missing;
- `patch.diff` was not accepted by `git apply --check`.

That rejection was correct. A20BM reduces future rejection risk by letting Codex own route registration once and narrowing Antigravity's future write surface.

## 3. DEV-Only Spike Host

Created:

- `frontend/src/dev/antigravity-spikes/AntigravitySpikeHost.tsx`
- `frontend/src/dev/antigravity-spikes/antigravitySpikeRegistry.ts`
- `frontend/src/dev/antigravity-spikes/antigravitySpikeTypes.ts`
- `frontend/src/dev/antigravity-spikes/antigravitySpikeStyles.css`
- `frontend/src/dev/antigravity-spikes/README.md`

The host renders a safe placeholder when no imported spike component exists.

## 4. Route Created

Route:

`/app?antigravitySpike=critical_moment_sigil`

The route is guarded by `import.meta.env.DEV` and does not change the normal V1 product flow.

## 5. Allowed Antigravity Import Surface

Future Antigravity proposals may touch only:

- `frontend/src/dev/antigravity-spikes/**`
- `scripts/browser_antigravity_*_smoke.mjs`
- `docs/autopilot/A20ANTIGRAVITY*_REPORT.md`

Future proposals must not touch `frontend/src/App.tsx`.

## 6. App.tsx Touch Status

`frontend/src/App.tsx` was touched by Codex in this mission only to mount the DEV-only route.

Justification:

Codex is the official integrator and route owner. Antigravity remains forbidden from touching `App.tsx` in future proposals.

## 7. Importer Policy Updates

Updated:

- `ops/autopilot/import_antigravity_patch_proposal.ps1`
- `ops/autopilot/antigravity_lane_policy.yaml`
- `ops/autopilot/test_antigravity_patch_proposal_import.ps1`
- `ops/autopilot/test_antigravity_agent_bridge.ps1`
- visual safety allowlists for the new DEV-only surface

New checks:

- `frontend/src/App.tsx` remains rejected for Antigravity proposals;
- frontend DEV paths outside `frontend/src/dev/antigravity-spikes/**` are rejected;
- safe proposals inside `frontend/src/dev/antigravity-spikes/**` validate in dry-run;
- invalid `patch.diff` is rejected;
- missing rollback path is rejected;
- base commit mismatch remains rejected unless Codex explicitly handles compatibility in a later mission.

## 8. Revision Pack Path

External revision pack:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\antigravity\A20BM_revision_pack_20260518`

Files created externally:

- `revision_prompt.md`
- `rejection_reasons.md`
- `allowed_paths.txt`
- `forbidden_paths.txt`
- `patch_format_requirements.md`
- `rollback_requirements.md`
- `expected_output_pack.md`

These files were not committed.

## 9. What Antigravity Must Change

Antigravity must:

- rebase or recreate the proposal from the current branch;
- avoid `frontend/src/App.tsx`;
- use `frontend/src/dev/antigravity-spikes/**`;
- generate a real Git-compatible `patch.diff`;
- keep the diff small;
- include rollback notes;
- include risk and test reports;
- produce only a Patch Proposal Pack;
- not commit or push.

## 10. Validation Results

Passed:

- `git diff --check`
- `cd frontend && npm run build`
- `cd frontend && npx tsc --noEmit`
- `node scripts/browser_antigravity_spike_host_smoke.mjs`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_antigravity_worktree_manager.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_antigravity_patch_proposal_import.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_multi_agent_workload_router.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_antigravity_transport_discovery.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_antigravity_agent_bridge.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_antigravity_screenshot_truth.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_mcp_playwright_browser_truth.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_omega_autopilot.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_neurorelay_loop.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_night_readiness_v2.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_strict_visual_firewall.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_design_intelligence_layer.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_autonomous_design_judgment.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_visual_auditor_canary_halting.ps1`
- `python tools/plan_guard.py`

Browser screenshot:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\antigravity\A20BM_revision_pack_20260518\smoke_artifacts\screenshots\antigravity_spike_host_1440.png`

Screenshot was external only and was not committed.

## 11. Recommended Next Mission

`A20BN_ANTIGRAVITY_REVISION_FROM_CODEX_FEEDBACK`

## 12. Antigravity Official Repo Statement

Antigravity did not touch the official repo directly.

## 13. A21 Statement

A21 was not launched.

## 14. Protected Branch Statement

road-to-V2 was not pushed or merged.

## 15. Safety Summary

- no backend product code touched;
- no package files touched;
- no DB touched;
- no screenshots or QA artifacts committed;
- no `ops/autopilot/local/**` committed;
- no `ops/autopilot/runtime/**` committed;
- no private URLs, ntfy topic, cookies, tokens, secrets, or PII committed;
- no bypass, CAPTCHA automation, 2FA automation, consent automation, or human verification automation;
- no Antigravity direct commit or push;
- no broad staging;
- V1 product flow unchanged.

## 16. Final Verdict

`ANTIGRAVITY_SAFE_IMPORT_SURFACE_READY`
