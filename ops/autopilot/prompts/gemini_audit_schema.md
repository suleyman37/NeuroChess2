# Gemini Audit Schema

Primary live format:

```json
{
  "schema": "NC_GEMINI_AUDIT_JSON/1",
  "nonce": "THE_NONCE",
  "mode": "prompt_auditor",
  "verdict": "APPROVE",
  "scores": {
    "scope_risk": 0,
    "product_value": 0,
    "safety_risk": 0,
    "automation_drift_risk": 0,
    "confidence": 0.0
  },
  "findings": [
    "finding 1"
  ],
  "required_action": "none",
  "must_not_do": "Do not generate a Codex prompt.",
  "notes": "optional short note",
  "done": "THE_NONCE"
}
```

Legacy offline XML fixture format:

```text
<NC_GEMINI_AUDIT nonce="{{NONCE}}">
<MODE>prompt_auditor|visual_court|long_horizon_critic</MODE>
<VERDICT>APPROVE|NARROW|REJECT|QUARANTINE|PASS_VISUAL|WARNING_VISUAL|BLOCK_VISUAL|REPORT_ONLY</VERDICT>

<SCORES>
scope_risk: 0-5
product_value: 0-5
safety_risk: 0-5
automation_drift_risk: 0-5
confidence: 0.0-1.0
</SCORES>

<FINDINGS>
- max 5 findings
</FINDINGS>

<REQUIRED_ACTION>
none|narrow_prompt|repair_prompt|force_strategic_pulse|quarantine|block_visual|record_report
</REQUIRED_ACTION>

<MUST_NOT_DO>
one concise rule
</MUST_NOT_DO>

<NOTES>
optional, max 5 lines
</NOTES>

<NC_DONE nonce="{{NONCE}}">DONE</NC_DONE>
</NC_GEMINI_AUDIT>
```

Live Gemini should use JSON because Gemini Web may flatten nested XML tags. No MICRO_PROMPT. No codex_prompt.
