# TDD Separation Protocol

## 1. Purpose

Amber and red missions must not let Codex write tests and implementation in the same micro-mission. The separation prevents an executor from shaping tests around its own implementation and then treating the result as independent evidence.

A7 creates the protocol and dry-run tooling only. It does not write NeuroChess product tests and does not implement product behavior.

## 2. Required Phases

Allowed phases:

- `test_contract`: writes or updates tests/specs only. No production code.
- `implementation`: implements only what a prior test contract required.
- `validation`: runs checks, smokes, evidence, and snapshots. No implementation changes except emergency revert.
- `docs_only`: documentation or protocol work that does not touch product code.

## 3. Strict Separation

For amber and red missions:
- tests/specs and implementation must be separate micro-missions;
- mixed test and implementation path scope is rejected;
- implementation must reference a prior test contract id, commit, or evidence pack;
- red-tier training, scheduling, and scoring work must never combine test and implementation in one mission.

Green docs-only missions are exempt.

Blue UI missions may include smoke updates only when explicitly allowed, but must not include backend implementation.

## 4. Relation To Red-Tier Quarantine

Red-tier quarantine protects `road-to-V2` from dangerous branches. TDD separation protects evidence quality inside those branches. A red-tier branch still needs quarantine even if it has a test-first split.

## 5. Exceptions

Any exception requires explicit supervisor approval and must be recorded in the mission evidence. Exceptions cannot enable red-tier auto-promotion.

## 6. A7 Status

`tdd_separation_enabled` remains false until a later mission integrates this protocol into live task execution.
