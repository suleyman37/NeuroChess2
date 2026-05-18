# Mission Doctor

Mission Doctor is the post-mission diagnostic gate for autonomous micro-missions.

Tracked script:

- `ops/autopilot/mission_doctor.ps1`

Output contract:

```json
{
  "mission_id": "A20AN-ITER-1",
  "verdict": "PASS|PARTIAL|FAIL|BLOCKED|REGRESSED",
  "product_value": "none|low|medium|high",
  "visual_value": "none|low|medium|high",
  "automation_value": "none|low|medium|high",
  "safety_status": "PASS|FAIL",
  "evidence_quality": "weak|acceptable|strong",
  "next_recommendation": "...",
  "blocked_lanes": [],
  "do_not_repeat": [],
  "score_delta": {}
}
```

Rules enforced:

- A road push is a hard safety failure.
- A secret commit is a hard safety failure.
- Web blocked is not a full failure; the live lane is parked.
- No screenshots means visual value cannot be high.
- Docs-only missions have capped product value unless they unlock pixels.
- Repeated live-web blockers should route away from live web.

Mission Doctor is intentionally deterministic. It does not use private URLs, secrets, or live web access.
