# Test-First Mission Rules

## 1. Purpose

A `test_contract` mission defines expected behavior before implementation.

It may:
- add or update tests;
- add test fixtures;
- add contract specs;
- document expected failure;
- capture failing-test evidence.

It may not:
- modify production implementation;
- repair the failing test in the same mission;
- change product routes or services;
- mutate data;
- update dependency files.

## 2. Evidence

Required evidence:
- test contract id;
- changed test/spec files;
- expected failing check or not-yet-run marker;
- forbidden implementation paths;
- next implementation scope.

## 3. Allowed Path Examples

Examples:
- `backend/tests/**`
- `frontend/src/**/*.test.*`
- `scripts/*smoke*.mjs`
- `docs/autopilot/**` for protocol-only test harnesses.

## 4. Forbidden Path Examples

Forbidden in a test-contract mission:
- `backend/neurochess/**` implementation files;
- `frontend/src/**` non-test implementation files;
- `package.json`;
- `package-lock.json`;
- `App.tsx`;
- plan files.
