# REQUEST_MORE Protocol

## Purpose

REQUEST_MORE lets the ChatGPT Web Supervisor ask for only the missing evidence after it receives a compact Supervisor Digest. It avoids sending a full Evidence Pack by default and keeps micro-loop supervision small, auditable, and bounded.

A4A introduced the Supervisor Digest and Evidence Levels. A4B adds one targeted follow-up path:

1. Codex sends a Supervisor Digest.
2. The supervisor may answer with one REQUEST_MORE response.
3. Codex validates the nonce-bound response and requested item allowlist.
4. Codex builds only the requested evidence.
5. Codex sends a targeted follow-up in a later supervised step.

This protocol does not execute product missions, call ChatGPT live by itself, run Codex, commit, or push.

## Response Format

```text
<NC_SUPERVISOR_RESPONSE nonce="{{NONCE}}">
<VERDICT>REQUEST_MORE</VERDICT>
<REQUEST_MORE>
needed_items:
- changed_files
- diff_stat
- diff_excerpt
reason:
Short reason here.
</REQUEST_MORE>
<NC_DONE nonce="{{NONCE}}">DONE</NC_DONE>
</NC_SUPERVISOR_RESPONSE>
```

The nonce must match exactly. The DONE block is required. The response must request known evidence items only.

## Allowed Items

REQUEST_MORE may ask for these items only:

- changed_files
- diff_stat
- diff_excerpt
- full_patch
- checks_summary
- failing_test_log
- screenshot_contact_sheet
- alarm_report
- route_inventory
- db_mutation_report
- codex_report
- prompt_firewall_report
- supervisor_digest

Unknown items are rejected. Codex must not invent unavailable evidence; it writes an unavailable marker instead.

## Repeat Limit

REQUEST_MORE may repeat at most 2 rounds for the same mission. A third request returns STOP_REQUIRED and no additional follow-up is built.

## Token Policy

Full patches and screenshots are opt-in. The handler must not include `full_patch` unless it is explicitly requested. Screenshot contact sheets are not included unless explicitly requested.

## Relationship To Evidence Levels

- Level 0: no ChatGPT call for unambiguous green/docs-only work.
- Level 1: default Supervisor Digest.
- Level 2: targeted evidence through REQUEST_MORE.
- Level 3: Full Evidence Pack for future high-risk review.

A4B implements the Level 2 targeted evidence request skeleton. It does not implement red-tier promotion, retro every 5 missions, Gemini, or PC2 critic promotion decisions.
