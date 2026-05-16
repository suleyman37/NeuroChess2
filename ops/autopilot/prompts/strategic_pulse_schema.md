# Strategic Pulse Schema

```text
<NC_STRATEGIC_PULSE nonce="{{NONCE}}">
<DECISION>CONTINUE|NARROW|SPLIT|PIVOT|HARDEN|RETURN_TO_PRODUCT|QUARANTINE|STOP</DECISION>

<SCORES>
product_progress: 0-5
automation_friction: 0-5
risk_exposure: 0-5
strategic_coherence: 0-5
confidence: 0.0-1.0
</SCORES>

<WHY>
Short reason.
</WHY>

<NEXT_BEST_MOVE>
Exactly one recommended next mission or action.
</NEXT_BEST_MOVE>

<DO_NOT_DO>
One thing not to do now.
</DO_NOT_DO>

<GENIUS_SPARK>
Optional idea, max 5 lines. Must not be auto-executed.
</GENIUS_SPARK>

<EXECUTION_MODE>
micro_prompt_now|backlog_only|stop_for_review
</EXECUTION_MODE>

<NC_DONE nonce="{{NONCE}}">DONE</NC_DONE>
</NC_STRATEGIC_PULSE>
```

Rules:
- nonce must match exactly;
- DONE must be present and final;
- decision must be allowlisted;
- scores must be valid;
- exactly one next best move;
- no prose outside the block.
