# DONE Sentinel And Nonce

The bridge must not capture partial ChatGPT output.

Each supervisor request gets a unique nonce. A response is complete only when it
contains:

```text
<NC_DONE nonce="{{NONCE}}">DONE</NC_DONE>
```

Completion checks:

1. the root response nonce matches;
2. the DONE nonce matches;
3. DONE appears exactly once;
4. DONE is followed only by `</NC_SUPERVISOR_RESPONSE>`;
5. the final trimmed token is the closing supervisor response block;
6. the answer text remains unchanged for the configured stability window.

If any check fails, AgentOS writes a STOP report and executes nothing.
