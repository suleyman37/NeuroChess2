# Taste Confidence Score

## Purpose

Taste Confidence turns imported owner or crowd feedback into conservative labels. It is not a popularity oracle and it never claims universal appeal.

## Inputs

Normalized taste result rows:

- anonymous participant id
- provider
- study id
- question id
- signature id
- variant id
- response
- rating 0-5
- optional redacted free text

## Metrics

For each variant:

- preference_rate
- weirdness_rejection_rate
- board_readability_rate
- premium_perception_rate
- learning_value_rate
- sample_size
- Wilson lower bound for preference support

## Labels

- NO_DATA: no imported owner or crowd result exists.
- INSUFFICIENT_SAMPLE: sample is below 10.
- PROVISIONAL: data exists, but it is local/owner only or not strong enough.
- MAJORITY_SUPPORTED: level 2 crowd sample is at least 30 and Wilson lower bound supports a majority.
- STRONG_MAJORITY_SUPPORTED: level 2 crowd sample is at least 50 and Wilson lower bound is stronger.
- HUMAN_VALIDATION_FAILED: weirdness rejection or board readability fails.

## Conservative Rules

- n < 10: INSUFFICIENT_SAMPLE.
- n >= 30: can support majority if Wilson lower bound passes.
- n >= 50: can support stronger majority.
- weirdness rejection > 15%: fail or warn.
- board readability < 80%: fail or warn.
- no level 2 crowd data: no crowd validation claim.

## 95% Clarification

The only acceptable 95% language is confidence-method language, such as Wilson interval parameters. It must never be written as a universal appeal claim.
