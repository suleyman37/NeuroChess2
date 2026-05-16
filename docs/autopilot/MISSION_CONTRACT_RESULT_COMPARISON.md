# Mission Contract Result Comparison

Mission Contract Result Comparison checks the registered plan against the actual
mission output after execution.

The comparison answers one question:

```text
Did the final diff and evidence match the contract that was registered before
execution?
```

If the answer is no, the system must stop. It must not continue to the next
micro-mission.

## Expected Inputs

The pre-registered contract supplies:

- expected changed files;
- allowed paths;
- forbidden paths;
- maximum file count;
- maximum diff line count;
- expected diff line range;
- required checks;
- expected artifacts;
- commit and push policy;
- product-surface flags.

The actual result supplies:

- actual changed files;
- actual diff line count;
- actual paths touched;
- actual checks run;
- actual artifacts created;
- actual commit hash, if any;
- actual push result, if any.

## Exact File Matching

Exact mode is the safest default.

When `exact_file_match` is enabled:

- every actual changed file must appear in `expected_changed_files`;
- every expected changed file must appear in the actual changed files;
- extra files are a contract failure;
- missing expected files are a contract failure.

Exact mode is required for narrow docs-only, contract-only, and automation
protocol missions unless a later protocol explicitly allows broader matching.

## Diff And Path Checks

The comparison must fail or stop when:

- actual changed files exceed `max_files`;
- actual diff lines exceed `max_diff_lines`;
- actual diff lines exceed `expected_diff_lines_max`;
- a forbidden path is changed;
- a docs-only mission touches code paths;
- frontend and backend are mixed without explicit permission;
- package files change without explicit permission;
- docs/rebuild changes without explicit permission.

Diffs larger than declared are usually `STOP_FOR_SUPERVISOR`, because they may
mean the mission should be split.

Forbidden product or generated/noise paths are mechanical failures. Red-tier
paths outside quarantine require quarantine.

## Check And Artifact Verification

The comparison must verify that every required check was run. A missing check is
a stop condition, even if the diff itself looks safe.

### Required Check Normalization

`required_checks` are normalized before comparison. The contract may represent
them as a JSON array, comma-separated string, newline-separated string, or
semicolon-separated string.

Normalization trims whitespace, removes empty entries, normalizes path
separators, and applies only explicit aliases such as `diffcheck` to
`git diff --check` and Python wrapper invocations of `tools/plan_guard.py` to
`tools/plan_guard.py`.

This does not weaken enforcement. Missing checks remain blocking, and path,
scope, file-count, diff-size, artifact, commit, and push checks still run
unchanged.

Expected artifacts are also checked. If an artifact was declared but not
produced, the mission result is incomplete and must stop before promotion.

## Commit And Push Verification

If the contract forbids commits or pushes, any actual commit or push is a
contract violation.

If the contract allows commits and pushes, the comparison still does not prove
quality by itself. It only proves that the mission stayed inside the declared
scope.

## Output

The comparison output is JSON:

```json
{
  "contract_result": "PASS|FAIL|STOP_FOR_SUPERVISOR|QUARANTINE_REQUIRED",
  "violations": [],
  "warnings": [],
  "expected": {},
  "actual": {},
  "recommended_next_action": ""
}
```

Only `PASS` allows normal continuation. All other results stop the mission flow.
