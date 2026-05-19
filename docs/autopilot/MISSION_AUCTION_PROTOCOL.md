# Mission Auction Protocol

Tracked script:

- `ops/autopilot/mission_auction.ps1`

Mission Auction chooses one next micro-mission from Decision Packets.

Inputs:

- Decision Packets
- blocked lanes
- pixel mandate policy
- safety constraints

Scoring factors:

- safety pass required
- expected product value
- expected visual value
- automation value
- path to 19.5
- token efficiency
- Codex workload
- external workload
- blocked-lane avoidance
- pixel-production priority

Rules:

- unsafe candidates are rejected;
- repeated blocked lanes are penalized;
- docs-only candidates are penalized unless foundational;
- pixel-production candidates are boosted when safe;
- external proposals are useful but not automatic winners;
- lower Codex context wins when value is comparable.

A20AO rehearsal with zero external packets selected local fallback visual objectives.
