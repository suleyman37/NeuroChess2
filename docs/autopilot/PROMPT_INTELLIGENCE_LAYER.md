# Prompt Intelligence Layer

## Scope

A16C introduces the first Prompt Intelligence Layer. It creates NC-MP/2 and
tooling, but does not enable live enforcement.

Created components:

- NC-MP/2 parser;
- NC-MP/2 normalizer;
- NC-MP/2 linter;
- verbose MICRO_PROMPT to NC-MP/2 converter;
- fixtures and tests.

## Intent

Current MICRO_PROMPT blocks are safe but verbose. NC-MP/2 keeps the same safety
content while making prompts compact, deterministic, and mechanically lintable.

## Future Work

A16C leaves these ideas for later missions:

- Shadow Plan;
- Gemini Auditor;
- Prompt Ledger;
- Prompt Execution Score;
- Mission Market.

Those features must not be implied by A16C. The only active output is local
offline parsing and linting scaffolding.
