# Shadow Linting Protocol

## 1. Purpose

Shadow linting runs cheap checks early and repeatedly so Codex does not discover basic breakage at the end of a long mission.

It is lightweight by design. It does not replace full builds, backend suites, browser smokes, or red-tier evidence packs.

## 2. Checks

Minimum A8 checks:
- `git diff --check`;
- changed files vs product path expectations;
- PowerShell parser check for changed `.ps1` files under `ops/autopilot`;
- `node --check` for changed `.mjs` or `.js` files under `ops/autopilot`;
- JSON parse for changed `.json` files under `ops/autopilot`;
- YAML sanity check for changed `.yaml` or `.yml` files;
- no product code touched for automation-only missions.

## 3. When To Run

Run shadow lint:
- after creating or changing automation scripts;
- before a controlled commit;
- after any generated prompt or supervisor response changes mission scope;
- before asking for another autonomous step.

## 4. Limitations

Shadow lint does not make product decisions. Ambiguous failures should become `STOP_FOR_SUPERVISOR`.
