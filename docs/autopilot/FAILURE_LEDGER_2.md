# Failure Ledger 2.0

Failure Ledger 2.0 records blocked or failed lanes so OMEGA does not repeat them blindly.

Each entry tracks:

- failed lane
- reason
- recurrence count
- parked-until timestamp
- do-not-repeat rule
- next safe alternative
- whether ntfy alert was sent
- whether user intervention was required
- whether the loop continued

If a failure repeats twice, the lane is avoided unless explicitly unparked by a later mission.

Live GPT Web and Gemini failures do not fail the whole autonomous loop. They are parked and local fallback continues.
