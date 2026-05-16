# Prompt Execution Score

## Purpose

Prompt Execution Score is computed from actual execution outcomes, not
ChatGPT's self-rated `quality_score`.

## Positive Factors

The score is out of 100 and capped after positives and penalties.

Positive factors include:

- objective was atomic and respected;
- allowed paths respected;
- forbidden paths avoided;
- file count stayed within `max_files`;
- diff lines stayed within `max_diff_lines`;
- required checks all ran;
- required checks passed;
- Mission Contract matched;
- Shadow Plan matched or was not applicable;
- no format repair was needed;
- no unnecessary REQUEST_MORE occurred;
- Forward Progress was true;
- Product Gate passed or warned with a valid friction/unlock;
- final report was clear and actionable.

## Penalties

Major penalties apply for:

- Mission Contract mismatch;
- forbidden path touched;
- red-tier outside quarantine;
- repair required;
- unnecessary REQUEST_MORE;
- no forward progress;
- missing product value without safety justification;
- vague or broad wording;
- incomplete final report;
- product code merged to `road-to-V2` when forbidden.

## Score Bands

- 90-100: excellent prompt.
- 75-89: good prompt.
- 60-74: usable but needs improvement.
- 40-59: weak prompt.
- below 40: dangerous or should be redesigned.
