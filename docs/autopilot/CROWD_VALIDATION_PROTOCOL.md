# Crowd Validation Protocol

## Goal

Validate whether NeuroChess signature variants feel premium, readable, useful, and not bizarre to humans. The protocol prepares test packets for real humans, but it does not run paid studies automatically.

## Test Families

### Five-Second Impression

Question: after seeing this UI for 5 seconds, which words best describe it?

Options: premium, clear, confusing, cheap, intense, calm, generic, memorable, serious, weird, game-like, professional.

Pass signal: cheap, weird, and confusing stay below threshold while premium, memorable, serious, and clear rise.

### Weirdness Rejection

Question: does this UI feel weird, confusing, or visually off-putting?

Options: No / Slightly / Yes.

Pass signal: Yes below 15%, No above 60%, with sufficient sample.

### Preference

Question: which variant would you rather use for a premium chess learning app?

Options: A / B / C / No preference.

Pass signal: winning variant has a clear conservative margin and no high rejection risk.

### Board Readability

Questions:

- Can you immediately understand this is a chess training interface?
- Can you read the board clearly?
- Can you tell where the main action is?

Pass signal: board readability above 80%.

### Learning Value

Questions:

- Which UI best helps you understand what to do next?
- Which UI feels useful for improving at chess?

Pass signal: selected UI supports actual training, not only aesthetics.

## Provider Packet Rules

- Use isolated variant screenshots as primary evidence.
- Do not use overview contact sheets as primary evidence.
- Include screenshot path, variant id, signature id, learning-loop stage, questions, and expected answer schema.
- Do not include private URLs, secrets, ntfy topics, tokens, or PII.
- Export-only providers must not be called by automation.

## Result Import Rules

CSV and JSON imports must include anonymous participant id, provider, study id, question id, signature id, variant id, response, rating, and optional redacted free text.

Rows are rejected for missing variant/question id, impossible ratings, duplicate participant spam, or PII fields.
