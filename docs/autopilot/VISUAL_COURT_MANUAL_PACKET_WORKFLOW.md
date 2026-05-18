# Visual Court Manual Packet Workflow

This workflow reduces manual copy-paste while keeping live model use optional.
It uses A20P as the example case.

## 1. Generate A Packet

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/run_visual_court_bridge.ps1 `
  -MissionId A20Q_A20P_MANUAL_PACKET `
  -EvidencePath "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_training\A20P_screenshot_to_patch_a20l_20260518\" `
  -OutputPath "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20Q_live_gemini_chatgpt_bridge_20260518\" `
  -Mode MANUAL_PACKET_MODE `
  -TargetVisualLevel PUBLIC_TEASER_READY_WITH_CAVEATS
```

## 2. Files To Upload Or Show To Gemini

Use:

- `gemini_prompt.md`;
- `visual_court_packet.json`;
- `generation_1_patch/contact_sheet_generation_1_states.png`;
- `generation_1_patch/contact_sheet_before_after_a20l_vs_a20p.png`;
- `browser_smoke_report.json`;
- `sacred_board_contract_check.json`;
- `anti_spoiler_check.json`.

## 3. Gemini Prompt

Paste `gemini_prompt.md`. Require strict JSON and concrete visible details.
Reject generic praise or enum placeholders.

## 4. Files To Upload Or Use With ChatGPT

Use:

- `chatgpt_prompt.md`;
- `visual_court_packet.json`;
- A20P report;
- Taste Ledger;
- Failure Gallery;
- the same contact sheets or screenshot references.

## 5. ChatGPT Prompt

Paste `chatgpt_prompt.md`. Ask for product/art-direction critique, not final
authority. Require screenshot evidence for public-ready claims.

## 6. Save Gemini Output

Save strict JSON as:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20Q_live_gemini_chatgpt_bridge_20260518\manual_gemini_output.json`

## 7. Save ChatGPT Output

Save strict JSON as:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20Q_live_gemini_chatgpt_bridge_20260518\manual_chatgpt_output.json`

## 8. Merge Inputs

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/run_visual_court_bridge.ps1 `
  -MissionId A20Q_A20P_MANUAL_PACKET_MERGE `
  -EvidencePath "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_training\A20P_screenshot_to_patch_a20l_20260518\" `
  -OutputPath "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20Q_live_gemini_chatgpt_bridge_20260518\manual_merge" `
  -Mode MANUAL_PACKET_MODE `
  -GeminiPath "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20Q_live_gemini_chatgpt_bridge_20260518\manual_gemini_output.json" `
  -ChatGptPath "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20Q_live_gemini_chatgpt_bridge_20260518\manual_chatgpt_output.json" `
  -CodexPath "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20Q_live_gemini_chatgpt_bridge_20260518\manual_codex_patch_plan.json"
```

## 9. Select Creative Director Verdict

The bridge writes `creative_director_verdict.json` automatically. If running
the lower-level scripts manually:

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/merge_visual_court_inputs.ps1 -GeminiPath manual_gemini_output.json -ChatGptPath manual_chatgpt_output.json -CodexPath manual_codex_patch_plan.json -OutPath merged_visual_court_summary.json
powershell -ExecutionPolicy Bypass -File ops/autopilot/select_visual_patch_plan.ps1 -SummaryPath merged_visual_court_summary.json -OutPath creative_director_verdict.json
```

## 10. Generate Next Codex Mission Prompt

```powershell
powershell -ExecutionPolicy Bypass -File ops/autopilot/generate_next_visual_mission_prompt.ps1 -VerdictPath creative_director_verdict.json -OutPath next_visual_mission_prompt.md
```

The generated prompt must include allowed paths, forbidden paths, stop
conditions, evidence requirements, validation commands, no road push, and no
merge.
