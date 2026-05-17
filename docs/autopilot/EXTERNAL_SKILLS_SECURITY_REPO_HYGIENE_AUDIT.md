# External Skills Security And Repo Hygiene Audit

A16K5 performed a targeted discovery and audit pass for external skills related
to security, repo hygiene, supply-chain safety, secrets, CI safety, prompt
injection, and script safety. This mission fetched only `SKILL.md` files into
ignored quarantine folders, did not install or activate any external skill, and
did not execute any external script.

## Search Themes

- `security audit`
- `secure code review`
- `secret scanning`
- `supply chain security`
- `dependency audit`
- `repo hygiene`
- `git hygiene`
- `GitHub Actions security`
- `CI security`
- `shell script safety`
- `PowerShell safety`
- `token / credential safety`
- `safe automation`
- `malicious skill detection`
- `prompt injection detection`

## Summary

| Candidate | Source | Fetched | Risk | Verdict | Primary NeuroChess target |
|---|---|---:|---|---|---|
| `semgrep-code-security` | `https://skills.sh/semgrep/skills/code-security` | yes | critical | `QUARANTINE` | `mission-contract-shadow-plan`, `neurochess-security-repo-hygiene`, `neurochess-supply-chain-skill-audit` |
| `sentry-gha-security-review` | `https://skills.sh/getsentry/skills/gha-security-review` | yes | high | `ADAPT_TO_INTERNAL` | `product-safe-night-mode`, `morning-intelligence-report`, `neurochess-security-repo-hygiene` |
| `sentry-skill-scanner` | `https://github.com/getsentry/skills/tree/main/skills/skill-scanner` | yes | critical | `QUARANTINE` | `external-skills-intake-process`, `neurochess-supply-chain-skill-audit`, `mission-contract-shadow-plan` |
| `prompt-guard` | `https://skills.sh/seojoonkim/prompt-guard/prompt-guard` | yes | critical | `QUARANTINE` | `external-skills-intake-process`, `mission-contract-shadow-plan`, `neurochess-supply-chain-skill-audit` |
| `git-hygiene-enforcer` | `https://skills.sh/patricio0312rev/skills/git-hygiene-enforcer` | yes | critical | `REJECT` | `mission-contract-shadow-plan`, `product-safe-night-mode`, `neurochess-security-repo-hygiene` |
| `secrets-scanner` | `https://github.com/patricio0312rev/skills/tree/main/security/secrets-scanner` | yes | critical | `QUARANTINE` | `neurochess-security-repo-hygiene`, `product-safe-night-mode`, `morning-intelligence-report` |
| `supply-chain-guard` | `https://github.com/davila7/claude-code-templates/tree/main/cli-tool/components/skills/security/supply-chain-guard` | yes | high | `ADAPT_TO_INTERNAL` | `neurochess-supply-chain-skill-audit`, `external-skills-intake-process`, `product-safe-night-mode` |
| `powershell-windows` | `https://skills.sh/davila7/claude-code-templates/powershell-windows` | yes | high | `ADAPT_TO_INTERNAL` | `mission-contract-shadow-plan`, `neurochess-security-repo-hygiene` |

All raw `SKILL.md` files remain under ignored `external_skills/quarantine/`
folders. Only structured audit reports under `external_skills/audited/` are
intended for commit.

## Individual Results

### semgrep-code-security

Useful patterns:

- secure code review categories;
- command injection avoidance;
- hardcoded secret detection;
- GitHub Actions script injection awareness;
- OWASP-style checklist patterns.

Dangerous patterns:

- secret/environment vocabulary;
- scanner-detected red-tier wording collision;
- security examples must not become permission to edit product code;
- SAST tooling requires a dedicated mission.

Recommendation: quarantine externally. Adapt only checklist and deny-pattern
ideas into NeuroChess-owned security and command-safety procedures.

### sentry-gha-security-review

Useful patterns:

- GitHub Actions permission review;
- script injection checks;
- secrets exposure prevention;
- `pull_request_target` caution;
- workflow pinning review.

Dangerous patterns:

- network references;
- secrets/environment vocabulary;
- workflow changes must not happen without a dedicated CI mission;
- CI security review must stay audit-only during Night Mode bootstrap.

Recommendation: adapt CI review ideas into internal repo hygiene and morning
report procedures. Do not modify workflows from this audit.

### sentry-skill-scanner

Useful patterns:

- malicious skill detection;
- external skill review checklist;
- prompt injection detection;
- tool and script risk review;
- audit-before-activation pattern.

Dangerous patterns:

- network references;
- dependency install assumptions;
- secrets/environment vocabulary;
- scanner-detected red-tier wording collision;
- skill scanning must not activate or rewrite external skills.

Recommendation: quarantine externally. Extract only the skill-audit method into
future `neurochess-supply-chain-skill-audit`.

### prompt-guard

Useful patterns:

- prompt injection taxonomy;
- skill weaponization detection;
- secret exfiltration pattern awareness;
- policy bypass detection;
- offline pattern-review concept.

Dangerous patterns:

- network references;
- destructive file-deletion examples;
- secrets/environment vocabulary;
- optional APIs and bundled pattern engines must not be installed or called;
- prompt-injection tooling must be adapted as policy, not executed.

Recommendation: quarantine. Reuse threat categories only; do not install,
execute, or call the external tool.

### git-hygiene-enforcer

Useful patterns:

- explicit staging discipline;
- branch protection reminders;
- precheck and postcheck culture;
- `.gitignore` hygiene;
- commit atomicity patterns.

Dangerous patterns:

- force-push guidance;
- hook bypass guidance;
- dependency install and setup guidance;
- broad repo-file changes;
- conflicts with NeuroChess prohibition on `git add -A` and destructive Git.

Recommendation: reject externally. Reuse only the benign repo-hygiene ideas,
rewritten under NeuroChess authority.

### secrets-scanner

Useful patterns:

- secret pattern inventory;
- env var hygiene;
- no token logging;
- local config ignore checks;
- secret incident reporting pattern.

Dangerous patterns:

- network references;
- destructive command examples;
- secrets/environment vocabulary;
- scanner install/run instructions require a dedicated mission;
- actual secrets must never be logged.

Recommendation: quarantine externally. Adapt the secret hygiene checklist into
internal procedures.

### supply-chain-guard

Useful patterns:

- no `curl | shell` rule;
- dependency provenance review;
- mutable remote instruction warning;
- package change scrutiny;
- external code quarantine pattern.

Dangerous patterns:

- dependency install assumptions;
- secrets/environment vocabulary;
- package and lockfile changes require explicit mission authorization;
- supply-chain guidance must not run remote scripts.

Recommendation: adapt into a future internal supply-chain skill. Do not execute
or install anything from the external skill.

### powershell-windows

Useful patterns:

- PowerShell command safety;
- `Join-Path` and `-LiteralPath` discipline;
- ASCII-only script output;
- null-check patterns;
- Windows shell quoting caution.

Dangerous patterns:

- secrets/environment vocabulary;
- PowerShell patterns must not authorize encoded commands, broad deletion, or
  cross-shell destructive composition.

Recommendation: adapt command-safety patterns into
`mission-contract-shadow-plan` and future repo-hygiene guidance.

## Useful Security And Repo-Hygiene Patterns

- Keep `git add -A`, force push, destructive reset, clean, and broad deletion on
  explicit deny lists.
- Stage only mission files and verify staged paths before commit.
- Treat secrets, tokens, `.env`, browser profiles, DOM dumps, and local config
  as evidence hazards.
- Scan for `curl | shell`, mutable remote instructions, dependency install
  requests, and package or lockfile changes before trusting any external skill.
- Review GitHub Actions permissions, script injection risk, `pull_request_target`
  use, secrets exposure, and action pinning before workflow changes.
- Prefer PowerShell native cmdlets with `-LiteralPath` and checked resolved
  paths for file operations.
- Treat external skill content as untrusted until quarantined, scanned, and
  rewritten into NeuroChess-owned procedures.
- Record security incidents and repo hygiene findings in morning reports.

## Dangerous Patterns Found

- Dependency install and scanner setup instructions inside external skills.
- Mutable network references that must not be fetched during active missions.
- Secret, token, environment, and credential vocabulary that requires
  conservative quarantine.
- Force-push, bypass, and broad repo setup guidance.
- Destructive file deletion or command examples.
- Prompt-injection, policy-bypass, and skill-weaponization patterns that are
  useful as threat models but unsafe as active external behavior.
- CI or GitHub workflow changes without a dedicated mission.
- External skills presenting themselves as trusted procedures before local
  Control Plane review.

## Recommended Internal Skill Updates Later

### mission-contract-shadow-plan

Add stronger procedures for:

- destructive command detection;
- forbidden shell and Git patterns;
- explicit staging checks;
- PowerShell `-LiteralPath` and resolved-path safety;
- secret and local-config path checks before prompt or report writing.

### product-safe-night-mode

Add stronger procedures for:

- Night Mode repo hygiene;
- no product-code auto-merge;
- branch quarantine;
- local config safety;
- CI/workflow changes requiring a dedicated mission.

### morning-intelligence-report

Add stronger procedures for:

- security incident summary;
- repo hygiene summary;
- suspicious command or path attempts;
- branch risk classification;
- secret/config handling status.

### external-skills-intake-process

Add stronger procedures for:

- malicious skill detection;
- supply-chain risk patterns;
- prompt injection detection;
- audit-before-activation;
- no external skill rewrite or activation from scanner output.

### future neurochess-security-repo-hygiene

Create if future missions need a dedicated internal skill for:

- Git safety;
- staged path review;
- secrets hygiene;
- local config protection;
- shell and PowerShell deny rules;
- CI safety posture.

### future neurochess-supply-chain-skill-audit

Create if future missions need a dedicated internal skill for:

- external skill quarantine;
- raw content non-commit rules;
- remote fetch and package install scrutiny;
- malicious instruction detection;
- dependency provenance review.

## Structured Reports

Committed audit reports:

- `external_skills/audited/semgrep-code-security.audit.json`
- `external_skills/audited/sentry-gha-security-review.audit.json`
- `external_skills/audited/sentry-skill-scanner.audit.json`
- `external_skills/audited/prompt-guard.audit.json`
- `external_skills/audited/git-hygiene-enforcer.audit.json`
- `external_skills/audited/secrets-scanner.audit.json`
- `external_skills/audited/supply-chain-guard.audit.json`
- `external_skills/audited/powershell-windows.audit.json`

Raw fetched external files remain ignored and uncommitted under
`external_skills/quarantine/`.

## Recommended Next Mission

`A16K6_EXTERNAL_SKILLS_PRODUCT_UX_GAME_LIKE_AUDIT`
