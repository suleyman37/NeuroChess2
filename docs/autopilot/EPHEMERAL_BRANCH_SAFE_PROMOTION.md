# Ephemeral Branch Safe Promotion

## 1. Purpose

Future autonomous loops must not use `road-to-V2` as the direct work branch. A task branch gives every micro-mission a disposable boundary: if the task fails, the branch can be archived or quarantined without incrementally corrupting the main delivery branch.

A5B documents and scripts the dry-run protocol. It does not enable live ephemeral execution yet.

## 2. Branch Naming

Normal task branches use:

```text
auto/<risk-tier>-<work-type>-<mission-id>-<timestamp>
```

Examples:

```text
auto/green-docs-a5-step1-20260516-0130
auto/blue-frontend-readonly-rex-qg-copy-20260516-0200
auto/amber-backend-readonly-truth-route-20260516-0230
```

Red-tier work uses quarantine:

```text
quarantine/red-<scope>-<mission-id>-<timestamp>
```

Rules:
- lowercase preferred;
- spaces and special characters are sanitized;
- risk tier, work type or scope, mission id, and timestamp are included;
- `road-to-V2` and `origin/road-to-V2` are never task branches.

## 3. Lifecycle

1. Verify the repo is clean.
2. Verify the current branch is `road-to-V2`.
3. Verify local `road-to-V2` is aligned with `origin/road-to-V2`.
4. Create an ephemeral branch from `road-to-V2`.
5. Execute exactly one micro-mission.
6. Run checks and commit on the task branch.
7. Switch back to `road-to-V2`.
8. Verify `road-to-V2` is still aligned with origin.
9. Promote only by fast-forward.
10. Push `road-to-V2`.
11. Export evidence before deleting any task branch.

## 4. Promotion Rules

Green and blue branches may be promoted automatically only when:
- checks pass;
- allowed-path verification passes;
- no forbidden paths changed;
- the promotion can fast-forward;
- no merge commit is needed;
- no force push is needed.

Amber follows the same flow, but backend read-only work also requires anti-mutation evidence.

Red-tier or quarantine branches are never promoted automatically to `road-to-V2`.

Strict rules:
- no automatic merge commits;
- no force push;
- no `git add -A`;
- no promotion without exact allowed paths;
- no promotion when `road-to-V2` moved.

If `road-to-V2` moved while a task branch was running, the protocol returns `NEED_REBASE_OR_RERUN`. It does not merge automatically.

## 5. Failure Behavior

Failed branches are not promoted. They must be archived before cleanup. The archive contains a manifest, branch names, heads, status, changed files, patch, checks, and failure reason.

## 6. Relationship To ChatGPT Web Supervision

ChatGPT Web may provide bounded micro-prompts. Codex executes them on an ephemeral branch in future enabled modes. The supervisor does not bypass branch policy, promotion checks, quarantine rules, or path restrictions.

## 7. A5B Status

A5B creates the policy and dry-run scripts only.

`ephemeral_branches_enabled` remains `false` until a later mission validates live task-branch execution end to end.
