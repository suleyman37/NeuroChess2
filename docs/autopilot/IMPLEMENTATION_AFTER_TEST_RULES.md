# Implementation After Test Rules

## 1. Prior Contract Required

An amber or red implementation mission must reference at least one of:
- `prior_test_contract_id`;
- `prior_test_commit`;
- `prior_test_evidence_pack`.

Without this reference, the implementation mission is rejected.

## 2. Scope

Implementation must address only the prior test contract. It must not add broad new behavior or opportunistic fixes.

New tests are not allowed in the implementation mission except a minimal fixture adjustment that is explicitly approved and recorded.

## 3. Checks

Required checks should include:
- the prior failing test;
- relevant targeted test command;
- mutation or side-effect evidence for amber/red backend work;
- rollback expectations.

## 4. Rollback

Implementation missions must state how to revert the change if the prior test or side-effect evidence fails.

Red-tier implementation still requires quarantine and cannot auto-promote.
