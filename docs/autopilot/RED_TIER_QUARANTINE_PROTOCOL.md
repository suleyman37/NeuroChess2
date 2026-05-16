# Red-Tier Quarantine Protocol

## 1. Purpose

Red-tier work is any mission that can change learning state, user scheduling state, training records, scoring, or hidden review/practice behavior. It must never be treated like a normal green or blue micro-mission.

A6 creates the protocol and dry-run tools only. It does not execute a red-tier mission and does not enable red-tier auto-merge.

## 2. Red-Tier Definition

Red-tier includes any mission that touches or may touch:

- Practice active execution;
- `training_items` creation, update, or delete;
- `practice_attempts` creation, update, or delete;
- `due_at` mutation;
- Daily Plan creation, rebuild, or update;
- scoring writes;
- result recording;
- solution reveal;
- XP, rank, or league;
- Transfer Score;
- DB migrations affecting training, practice, review, or scheduling;
- routes or services with hidden side effects;
- any write path connected to learning state.

## 3. Quarantine Branches

Red-tier branches must use:

```text
quarantine/red-<scope>-<mission-id>-<timestamp>
```

Rules:
- never work directly on `road-to-V2`;
- never fast-forward automatically into `road-to-V2`;
- never push `road-to-V2` from a red-tier path;
- require an evidence pack before cleanup;
- require rollback planning before execution;
- require future supervisor or human review before any promotion.

## 4. Required Preflight

Before any future red-tier execution, the preflight must verify:
- current branch is not `road-to-V2`;
- branch name starts with `quarantine/red-`;
- rollback plan exists or is explicitly marked provided;
- evidence directory exists;
- risk classification exists and is red;
- required checks are listed;
- `auto_promote` is false;
- `auto_push_to_road_to_V2` is false;
- allowed paths are explicit;
- forbidden paths are explicit.

## 5. Evidence Requirement

Red-tier work is blocked until evidence exists for:
- mission brief;
- red-tier classification reason;
- allowed and forbidden paths;
- precheck;
- branch name;
- base HEAD;
- changed files;
- diff patch;
- checks summary;
- DB snapshot before;
- DB snapshot after;
- DB mutation report;
- route inventory when backend routes are touched;
- side-effect risk inventory;
- rollback plan;
- Codex report;
- ChatGPT supervisor response when used;
- final GO/NO-GO.

Missing required evidence blocks promotion.

## 6. Promotion Rule

Red-tier branches are quarantine branches. They do not auto-promote and cannot be merged into `road-to-V2` by the standard ephemeral promotion script.

Any future red-tier promotion requires a dedicated mission, explicit review, complete evidence, and a rollback plan.

## 7. A6 Status

A6 documents and tests quarantine behavior only.

`red_tier_quarantine_enabled` remains false.
`red_tier_auto_promote` remains false.
