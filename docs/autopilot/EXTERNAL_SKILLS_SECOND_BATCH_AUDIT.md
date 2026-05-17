# External Skills Second Batch Audit

A16K2 audited the second controlled external skills batch. The mission fetched
only `SKILL.md` files into ignored quarantine folders, did not install or
activate any skill, and did not execute external scripts.

## Summary

| Candidate | Fetched | Risk | Verdict | Internal target |
|---|---:|---|---|---|
| `find-skills` | yes | high | `QUARANTINE` | `neurochess-skill-discovery`, `external-skills-intake-process` |
| `skill-creator` | yes | high | `ADAPT_TO_INTERNAL` | `neurochess-internal-skill-authoring`, `skill-quality-checklist` |
| `shadcn` | yes | high | `QUARANTINE` | `neurochess-component-system-review`, `frontend-visual-review` |
| `github-actions-docs` | yes | high | `QUARANTINE` | `neurochess-ci-workflow-guidance`, `morning-validation-pipeline` |
| `ui-ux-pro-max` | yes | high | `ADAPT_TO_INTERNAL` | `neurochess-frontend-visual-review`, `neurochess-game-like-ux`, `visual-court-rubric` |
| `composition-patterns` | yes | low | `APPROVE_INTERNAL` | `neurochess-react-component-architecture`, `react-performance-review` |

## Individual Notes

### find-skills

Source: `https://skills.sh/vercel-labs/skills/find-skills`

Useful patterns:

- skill discovery workflow;
- quality checks before recommendation;
- marketplace/source reputation as an intake signal.

Dangerous patterns:

- network discovery;
- install/add instructions that must never run without audit.

Recommendation: quarantine as an external skill. Adapt only the discovery and
intake checklist into `neurochess-skill-discovery`; discard automatic install
or `npx skills add` behavior.

### skill-creator

Source: `https://skills.sh/anthropics/skills/skill-creator`

Useful patterns:

- concise skill authoring guidance;
- frontmatter and trigger-quality checklist;
- examples of progressive disclosure and bundled resources.

Dangerous patterns:

- conservative scanner hit for environment/secrets wording;
- broad improvement language that should be narrowed for NeuroChess.

Recommendation: adapt into internal authoring guidance only. Do not create or
activate internal skills in this mission.

### shadcn

Source: `https://github.com/shadcn-ui/ui/tree/main/skills/shadcn`

Useful patterns:

- component-system thinking;
- visual/component review structure;
- design-system consistency checks.

Dangerous patterns:

- network references;
- dependency/package installation guidance;
- environment/access wording detected by scanner.

Recommendation: quarantine externally. Extract component review patterns only;
do not install shadcn packages or change package files without a dedicated
future mission.

### github-actions-docs

Source: `https://skills.sh/xixu-me/skills/github-actions-docs`

Useful patterns:

- official-docs grounding;
- topic-map style navigation for CI docs;
- clear scope boundary away from repo-specific CI debugging.

Dangerous patterns:

- official docs links trip network-risk detection;
- secrets/token/runner topics require a dedicated CI mission.

Recommendation: quarantine externally. Adapt docs-grounding and topic-map
patterns into `neurochess-ci-workflow-guidance`; do not modify workflows,
secrets, tokens, or runners from this audit.

### ui-ux-pro-max

Source:
`https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills/ui-ux-pro-max`

Useful patterns:

- broad UI/UX checklist taxonomy;
- accessibility, motion, layout, and hierarchy review prompts;
- visual review rubric ideas for future Visual Court work.

Dangerous patterns:

- broad UI/UX improvement language;
- risk of generic beauty optimization unless tied to NeuroChess truthfulness,
  CTA safety, and the North Star.

Recommendation: adapt only concrete review criteria into
`neurochess-frontend-visual-review`, `neurochess-game-like-ux`, and
`visual-court-rubric`.

### composition-patterns

Source: `https://skills.sh/vercel-labs/agent-skills/composition-patterns`

Useful patterns:

- React composition and maintainability review;
- component boundary thinking;
- review-oriented architecture notes.

Dangerous patterns:

- no scanner-detected dangerous pattern, but broad refactor execution remains
  forbidden without Mission Contract and Shadow Plan.

Recommendation: approve as an internal adaptation candidate, not as an active
external skill. Use it to shape `neurochess-react-component-architecture` and
`react-performance-review`.

## Comparison With A16K

A16K focused on product-facing design, React best practices, TDD, web design
guidelines, and architecture review. A16K2 broadened the intake surface toward
skill discovery, skill authoring, component-system guidance, CI documentation,
and future visual/code review skills.

The second batch produced more high-risk verdicts because several skills
contain install commands, mutable network references, package guidance, or CI
security topics. That does not make the ideas unusable; it means the useful
patterns must be rewritten into NeuroChess-owned skills before any activation.

## Structured Reports

Committed audit reports:

- `external_skills/audited/find-skills.audit.json`
- `external_skills/audited/skill-creator.audit.json`
- `external_skills/audited/shadcn.audit.json`
- `external_skills/audited/github-actions-docs.audit.json`
- `external_skills/audited/ui-ux-pro-max.audit.json`
- `external_skills/audited/composition-patterns.audit.json`

Raw downloaded SKILL.md files remain under ignored `external_skills/quarantine/`
folders and are not committed.

## Recommended Next Mission

`A16L_NEUROCHESS_INTERNAL_SKILLS_PACK`
