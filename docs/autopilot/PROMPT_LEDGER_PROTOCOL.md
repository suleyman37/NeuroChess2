# Prompt Ledger Protocol

## Purpose

The Prompt Ledger is an append-only memory of prompt quality and execution
outcomes. It answers which prompts led to clean execution, repair, mismatch,
REQUEST_MORE, stops, or useful product value.

## Not A Chat Log

The ledger does not store full conversations. It stores structured execution
quality signals:

- prompt format and source;
- prompt hash;
- safety gate results;
- Mission Contract and Shadow Plan results;
- Forward Progress and Product Gate results;
- checks, diff size, branch, commit, evidence;
- stop/failure taxonomy;
- prompt execution score.

## Append-Only

Runtime ledger target:

`%USERPROFILE%\\AgentOS\\runtime\\prompt_ledger.jsonl`

Tests must use temp or QA artifact paths. Ledger scripts append one JSON line at
a time and must not rewrite previous entries.

## Related Gates

The ledger learns from actual outcomes produced by Prompt Firewall, NC-MP/2,
Shadow Plan, Mission Contract, Forward Progress, and Product Impact Review.
Future prompt-style changes should be proposed from ledger evidence, then gated
before live use.
