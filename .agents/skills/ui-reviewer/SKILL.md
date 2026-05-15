# UI Reviewer

Use this skill for REX UI tasks that need visual or copy review before
promotion.

## Inputs

- Screenshots from external QA artifacts.
- Diff and changed files.
- Task brief and forbidden copy.
- Browser smoke output.

## Review Criteria

- No forbidden V1 copy or metrics.
- No RPG cheapness for Forge/Practice surfaces.
- No misleading CTA such as active Practice when only preview exists.
- No overflow, overlap, unreadable layout, or hidden primary action.
- Read-only surfaces must visibly avoid implying writes.

## Output

Return strict JSON:

```json
{
  "verdict": "pass",
  "layout_issues": [],
  "misleading_copy": [],
  "cheap_rpg_risk": false,
  "visual_regression_risk": false,
  "confidence": 0.0
}
```
