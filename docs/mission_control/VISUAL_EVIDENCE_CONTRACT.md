# Visual Evidence Contract

This contract defines evidence requirements for UI, browser, runtime, and
trust-critical missions. It complements tests; it does not replace them.

## Evidence Pack Path

Use:

```text
qa_artifacts/<MISSION_ID>/
```

Do not stage evidence packs by default.

## Required Structure

```text
qa_artifacts/<MISSION_ID>/
  report.md
  manifest.json
  git_status_initial.txt
  git_status_final.txt
  diff_stat.txt
  diff_check.txt
  test_commands.txt
  test_results.txt
  screenshots/
  api_snapshots/
  db_snapshots/
  console_logs.jsonl
  network_events.jsonl
```

`console_logs.jsonl` and `network_events.jsonl` are required when available.
For docs-only missions, screenshots may be omitted.

## Screenshot Naming

Use:

```text
01_<flow>_<state>_<viewport>.png
```

Examples:

```text
01_practice_before_attempt_mobile.png
02_practice_success_feedback_desktop.png
03_analysis_recoverable_desktop.png
```

## Manifest Fields

Every screenshot entry in `manifest.json` must include:

- `id`
- `path`
- `viewport`
- `flow`
- `expected_observation`
- `assertions_checked`
- `pass_fail`

## Visual Claim Rule

Screenshots alone are not enough. Every visual claim should be paired with a
DOM, API, or DB assertion when feasible.

Examples:

- Screenshot: success feedback visible.
- DOM assertion: problem label absent.
- API assertion: attempt result is `best`.
- DB assertion: one practice_attempt exists and has `due_at`.

## Side-Effect Checks

Runtime missions must prove side effects, especially these:

- Review analysis must not create `practice_attempts`.
- Review exploration must not create `practice_attempts`.
- Live analysis must not create `review_jobs`, `review_moments`,
  `training_items`, `practice_attempts`, or `due_at`.
- Practice attempt creates an attempt only after actual attempt or reveal.
- Feedback classification endpoint has no side effects.
- Export/delete tests must use temp DB and must not delete project files.

## Failure Capture

Browser smokes should capture:

- page errors;
- console errors;
- unexpected network 500;
- final URL;
- key DOM state;
- API/job ids when available;
- screenshots on failure.

## Report Minimum

`report.md` should include:

- mission name;
- branch and HEAD;
- flow covered;
- commands run;
- PASS/FAIL;
- screenshots generated;
- API snapshots generated;
- DB snapshots generated;
- console/network findings;
- remaining risks.
