# REQUEST_MORE Schema

## Valid Example

```text
<NC_SUPERVISOR_RESPONSE nonce="{{NONCE}}">
<VERDICT>REQUEST_MORE</VERDICT>
<REQUEST_MORE>
needed_items:
- changed_files
- diff_stat
- diff_excerpt
reason:
Need a small diff excerpt to verify scope before issuing one micro-prompt.
</REQUEST_MORE>
<NC_DONE nonce="{{NONCE}}">DONE</NC_DONE>
</NC_SUPERVISOR_RESPONSE>
```

## Valid Needed Items

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

## Invalid Unknown Item Example

```text
<NC_SUPERVISOR_RESPONSE nonce="{{NONCE}}">
<VERDICT>REQUEST_MORE</VERDICT>
<REQUEST_MORE>
needed_items:
- whole_repo_zip
reason:
This asks for a non-allowlisted evidence item.
</REQUEST_MORE>
<NC_DONE nonce="{{NONCE}}">DONE</NC_DONE>
</NC_SUPERVISOR_RESPONSE>
```

Unknown items must be rejected.

## Repeat Limit

REQUEST_MORE can repeat at most 2 rounds for one mission. If a third round is requested, Codex must return STOP_REQUIRED and must not build another follow-up.

## DONE Requirement

Every REQUEST_MORE response must end with the nonce-bound DONE sentinel:

```text
<NC_DONE nonce="{{NONCE}}">DONE</NC_DONE>
```

Responses without the matching DONE sentinel are invalid.
