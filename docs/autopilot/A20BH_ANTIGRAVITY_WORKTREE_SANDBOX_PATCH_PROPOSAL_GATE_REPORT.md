# A20BH Antigravity Worktree Sandbox + Patch Proposal Gate Report

## 1. Mission Summary

A20BH creates the safe lane that allows a future Antigravity/Gemini Flash helper to explore without touching the official NeuroChess repo directly.

Final status: `ANTIGRAVITY_SANDBOX_GATE_READY`.

## 2. Why Antigravity Must Be Sandboxed

Antigravity is useful for exploratory visual variants, UI spikes, and alternate component ideas. It is not allowed to become a second Codex operating inside the official repo.

The rule is:

`Antigravity explores. Codex integrates. OMEGA routes. Gemini critiques visuals. ChatGPT challenges strategy. Local fallback continues.`

## 3. Why Codex Remains The Only Integrator

Codex is the only agent allowed to:

- stage explicit mission files;
- run repo validation;
- commit;
- push a non-protected branch;
- decide whether a proposal pack is accepted, accepted with fixes, rejected, or retried with constraints.

Antigravity may produce a Patch Proposal Pack only.

## 4. Worktree Manager Status

Created:

`ops/autopilot/antigravity_worktree_manager.ps1`

Supported modes:

- `Status`
- `PlanSandbox`
- `CreateSandbox`
- `RemoveSandbox`
- `DryRun`

Dry-run result:

- status: `ANTIGRAVITY_SANDBOX_DRY_RUN_READY`
- base commit: `a8f46fc`
- external sandbox root: yes
- worktree created: no
- Antigravity required: no
- Antigravity called: no
- official repo touched by Antigravity: no

## 5. Patch Proposal Pack Schema

Created:

`ops/autopilot/antigravity_patch_proposal.schema.json`

The pack requires:

- `proposal.json`
- `patch.diff`
- `summary.md`
- `risk_report.json`
- `test_report.json`
- `files_touched.txt`
- `integration_notes.md`

Screenshots stay external only.

## 6. Import / Reject Rules

Created:

`ops/autopilot/import_antigravity_patch_proposal.ps1`

The importer rejects:

- duplicate nonce;
- base commit mismatch;
- backend changes without explicit permission;
- package files;
- DB files;
- `ops/autopilot/local/**`;
- `ops/autopilot/runtime/**`;
- screenshots/images/assets;
- secrets, private URLs, cookies, tokens, credentials, ntfy topics;
- missing summary/risk/test report;
- missing objective;
- missing rollback path;
- file or diff size over policy.

## 7. Atomic Apply / Rollback Strategy

Default mode is validation/dry-run.

Future apply strategy:

1. create a temporary external worktree;
2. run `git apply --check`;
3. apply only inside the temporary worktree;
4. run checks;
5. import explicit approved files only;
6. remove the temporary worktree on rollback.

No broad staging is allowed.

## 8. Nonce / Idempotence Protection

The importer records a nonce only after dry-run acceptance. Reusing the same nonce returns `NONCE_ALREADY_USED` and rejects the pack.

## 9. Multi-Agent Workload Router Result

Created:

`ops/autopilot/multi_agent_workload_router.ps1`

Dry-run routing:

- visual variant exploration -> `ANTIGRAVITY`
- final integration -> `CODEX`
- screenshot critique -> `GEMINI`
- strategic review -> `CHATGPT`
- blocked live lane -> `LOCAL_FALLBACK`

## 10. Dry-Run Fixture Result

Created safe fixture:

`ops/autopilot/fixtures/antigravity_patch_proposal_sample/`

Dry-run result:

- `ANTIGRAVITY_PROPOSAL_ACCEPTED_DRY_RUN`
- safe pack validated;
- duplicate nonce rejected;
- backend/package/image/secret unsafe cases rejected by tests;
- rollback support present;
- no real Antigravity execution required.

## 11. What Antigravity Is Allowed To Do Next

Antigravity may:

- create visual variant spikes in an external disposable worktree;
- create alternate DEV-only frontend proposals;
- write screenshots to external artifacts;
- emit Patch Proposal Packs for Codex.

## 12. What Antigravity Is Forbidden To Do

Antigravity must not:

- write directly to the official repo branch;
- stage, commit, or push;
- touch `road-to-V2`;
- touch backend, DB, package files, local/runtime files, or secrets;
- include screenshots or QA artifacts in git;
- bypass login, CAPTCHA, consent, 2FA, or human verification.

## 13. Recommended First Antigravity Spike

Recommended first spike:

`A20BI_ANTIGRAVITY_VISUAL_VARIANT_SPIKE`

Scope: one DEV-only visual variant pack for a board-centered NeuroChess surface, emitted as a Patch Proposal Pack and validated by Codex.

## 14. Safety Statements

- Antigravity did not touch the official repo directly.
- Antigravity was not called live.
- A21 was not launched.
- Night Mode was not launched.
- road-to-V2 was not pushed.
- road-to-V2 was not merged.
- No paid API was used.
- No backend, package, or DB files were touched.
- No screenshots, QA artifacts, local/runtime files, private URLs, cookies, tokens, ntfy topic, credentials, secrets, or PII were committed.

## 15. Validation

Passed:

- `git diff --check`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_antigravity_worktree_manager.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_antigravity_patch_proposal_import.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_multi_agent_workload_router.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_mcp_playwright_browser_truth.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_external_judge_sre.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_alert_router.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_web_judge_orchestrator.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_omega_autopilot.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_neurorelay_loop.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_night_readiness_v2.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_neurochess_visual_training_system.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_all_night_readiness_gate.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_strict_visual_firewall.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_design_intelligence_layer.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_autonomous_design_judgment.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_3d_board_stage_architecture.ps1`
- `powershell -ExecutionPolicy Bypass -File ops/autopilot/test_visual_auditor_canary_halting.ps1`
- `python tools/plan_guard.py`

## 16. Final Verdict

`ANTIGRAVITY_SANDBOX_GATE_READY`

Recommended next mission:

`A20BI_ANTIGRAVITY_VISUAL_VARIANT_SPIKE`
