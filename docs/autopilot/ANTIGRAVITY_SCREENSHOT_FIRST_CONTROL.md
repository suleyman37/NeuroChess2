# Antigravity Screenshot-First Control

## Rule

No screenshot means no GUI verdict.

Codex must not mark Antigravity, a browser, or any desktop GUI as ready, blocked, safe, or unsafe from process lists, hidden DOM, old logs, or guessed selectors alone.

## Required Observation

Every GUI observation must include:

```json
{
  "target": "antigravity",
  "action_attempted": "...",
  "screenshot_path": "...",
  "visible_ui_summary": "...",
  "visible_controls": [],
  "missing_controls": [],
  "safe_next_action": "...",
  "verdict": "READY|BLOCKED|UNSAFE|UNCLASSIFIED|FALLBACK_REQUIRED",
  "reasoning_from_pixels": [],
  "dom_or_process_used_only_as_confirmation": true
}
```

Screenshots must be external artifacts only.

## Safety Consequences

- A process list can confirm Antigravity is running, but cannot prove the GUI is safe.
- A window title can confirm the target, but cannot prove a sandbox/worktree.
- A ready verdict requires screenshot evidence plus sandbox/worktree proof.
- Blind typing is forbidden.
- Official repo workspace evidence makes GUI transport unsafe.

## Implementation

Script:

`ops/autopilot/antigravity_screenshot_truth.ps1`

Tests:

`ops/autopilot/test_antigravity_screenshot_truth.ps1`
