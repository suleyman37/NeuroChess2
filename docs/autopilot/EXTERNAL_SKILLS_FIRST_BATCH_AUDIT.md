# External Skills First Batch Audit

A16K audited the first controlled external skills batch. The mission fetched
only `SKILL.md` files into ignored quarantine folders, did not install or
activate any skill, and did not execute external scripts.

## Summary

| Candidate | Fetched | Risk | Verdict | Internal target |
|---|---:|---|---|---|
| `frontend-design` | yes | low | `APPROVE_INTERNAL` | `neurochess-frontend-visual-review`, `neurochess-game-like-ux`, `neurochess-visual-identity` |
| `react-best-practices` | yes | low | `APPROVE_INTERNAL` | `neurochess-react-performance-review` |
| `tdd` | yes | high | `ADAPT_TO_INTERNAL` | `neurochess-tdd-behavior-contract`, `backend-readonly-proof` |
| `web-design-guidelines` | yes | high | `QUARANTINE` | `frontend-visual-review`, accessibility/visual review checklist |
| `improve-codebase-architecture` | yes | medium | `ADAPT_TO_INTERNAL` | morning architecture review, architecture audit only |

## Individual Notes

### frontend-design

Source: `https://skills.sh/anthropics/skills/frontend-design`

Useful patterns:

- explicit design direction before implementation;
- avoidance of generic AI-looking UI;
- visual identity and aesthetic differentiation as a review checklist.

Dangerous patterns: none detected by the local scanner.

Recommendation: adapt into NeuroChess frontend visual review and game-like UX
skills. Approval remains internal-only and does not activate the external skill.

### react-best-practices

Source: `https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices`

Useful patterns:

- prioritized React performance categories;
- review mindset around bundle size, re-render behavior, and effects;
- rule-code naming that could become a compact NeuroChess review checklist.

Dangerous patterns: none detected by the local scanner.

Recommendation: adapt into `neurochess-react-performance-review`, with
NeuroChess-specific constraints and no package changes by default.

### tdd

Source: `https://skills.sh/hieutrtr/ai1-skills/tdd-workflow`

Useful patterns:

- test-first loop;
- explicit skip conditions for trivial/static/config tasks;
- behavior-first thinking useful for Mission Contract and backend-readonly
  proof.

Dangerous patterns:

- scanner detected `.env`/environment reference. In context this appears in
  skip guidance, not an instruction to read secrets, but the conservative
  classification remains high.

Recommendation: adapt into NeuroChess TDD behavior-contract guidance. Do not
import directly; preserve A7 TDD separation and red-tier quarantine.

### web-design-guidelines

Source: `https://skills.sh/vercel-labs/agent-skills/web-design-guidelines`

Useful patterns:

- terse `file:line` style review output;
- UI, UX, and accessibility checklist framing;
- review-only posture.

Dangerous patterns:

- explicit mutable remote guideline fetch requirement.

Recommendation: quarantine raw skill. Extract only the review-output pattern and
accessibility checklist idea into an internal frontend visual review skill. Do
not preserve remote fetch behavior.

### improve-codebase-architecture

Source: `https://skills.sh/mattpocock/skills/improve-codebase-architecture`

Useful patterns:

- read-only architecture diagnosis;
- module-boundary and testability framing;
- RFC/report-first output instead of immediate refactor.

Dangerous patterns:

- architecture-wide refactor encouragement risk. Even if read-only, this should
  never run as broad Night Mode implementation work.

Recommendation: adapt into a morning architecture review skill only. Use for
audit/RFC generation, not execution, and keep broad refactor proposals behind
Mission Contract and Shadow Plan.

## Structured Reports

Committed audit reports:

- `external_skills/audited/frontend-design.audit.json`
- `external_skills/audited/react-best-practices.audit.json`
- `external_skills/audited/tdd.audit.json`
- `external_skills/audited/web-design-guidelines.audit.json`
- `external_skills/audited/improve-codebase-architecture.audit.json`

Raw downloaded SKILL.md files remain under ignored `external_skills/quarantine/`
folders and are not committed.

## Recommended Next Mission

`A16L_NEUROCHESS_INTERNAL_SKILLS_PACK`
