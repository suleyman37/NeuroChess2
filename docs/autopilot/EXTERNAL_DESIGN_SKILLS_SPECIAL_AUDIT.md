# External Design Skills Special Audit

A16K3 audited `make-interfaces-feel-better` and synthesized the design-related
external skill audits completed in A16K and A16K2. This mission fetched only the
target `SKILL.md` into ignored quarantine, did not install or activate any
external skill, and did not execute external scripts.

## Summary

| Skill | Batch | Fetched | Risk | Verdict | Primary NeuroChess value |
|---|---|---:|---|---|---|
| `frontend-design` | A16K | yes | low | `APPROVE_INTERNAL` | design direction, non-generic UI, visual identity |
| `web-design-guidelines` | A16K | yes | high | `QUARANTINE` | UI/UX/accessibility review pattern |
| `ui-ux-pro-max` | A16K2 | yes | high | `ADAPT_TO_INTERNAL` | Visual Court rubric ideas |
| `shadcn` | A16K2 | yes | high | `QUARANTINE` | component-system review ideas |
| `composition-patterns` | A16K2 | yes | low | `APPROVE_INTERNAL` | React composition and component boundaries |
| `make-interfaces-feel-better` | A16K3 | yes | medium | `ADAPT_TO_INTERNAL` | interface feel, motion, tactile polish, hit areas |

## make-interfaces-feel-better Audit

Source:
`https://skills.sh/jakubkrehel/make-interfaces-feel-better/make-interfaces-feel-better`

Raw `SKILL.md` fetched from:
`https://raw.githubusercontent.com/jakubkrehel/make-interfaces-feel-better/main/skills/make-interfaces-feel-better/SKILL.md`

Result:

- fetched: yes
- has `SKILL.md`: yes
- has scripts: no
- network fetch risk: no
- destructive command risk: no
- prompt injection risk: no
- secrets/env access risk: no
- conflicts with NeuroChess rules: no
- risk level: medium
- verdict: `ADAPT_TO_INTERNAL`

Useful patterns:

- micro-interaction review for press states, icon transitions, and tactile
  feedback;
- surface polish through concentric radius, optical alignment, layered shadows,
  subtle image outlines, and minimum hit areas;
- typography stability through font smoothing, balanced text wrapping, and
  tabular numbers;
- motion quality through interruptible transitions, staggered entry, subtle
  exit, and avoidance of broad `transition: all`;
- before/after review tables that can become screenshot-review evidence.

Dangerous patterns:

- "make it feel better" is too broad unless constrained by product intent,
  Mission Contract, Shadow Plan, screenshots, visual review brief, and Product
  Gate;
- motion and polish can create fake product progress if they do not improve
  player clarity, CTA truthfulness, or the learning loop;
- concrete values must be adapted to NeuroChess, not copied as universal rules.

Recommendation: adapt into internal NeuroChess interface-feel and visual-review
skills. Do not activate the external skill directly.

## Comparative Design Skill Matrix

| Pattern area | Best external source | Safe NeuroChess use | Risk to discard |
|---|---|---|---|
| Non-generic direction | `frontend-design` | establish visual identity before implementation | broad redesign detached from Plan2 |
| Accessibility and UX checks | `web-design-guidelines` | adapt checklist into visual review | mutable remote guideline fetch |
| Visual Court rubric breadth | `ui-ux-pro-max` | extract rubric categories for screenshots | generic beauty optimization |
| Component consistency | `shadcn` | review component states and visual consistency | package installation or dependency changes |
| React composition | `composition-patterns` | review boundaries and repeated component shape | broad refactor execution |
| Interface feel | `make-interfaces-feel-better` | tactile states, hit areas, motion, typography stability | unbounded polish prompts |

## Safe Design Patterns To Reuse

- Design direction must name the product job: real-game learning, active replay,
  truthful feedback, repetition, and transfer verification.
- Screenshot/contact sheet review should check visual hierarchy, CTA
  truthfulness, unsafe claims, and whether the player knows what to do now.
- Micro-interactions are valuable when they make actions feel responsive,
  reversible, and game-like without fake gamification.
- Motion should be interruptible, subtle, and purposeful; it must never block
  input or imply training progress that did not happen.
- Dynamic counters, timers, scores, or progress labels should avoid layout
  shift and false precision.
- Component review should include hover, focus, active, disabled, loading,
  empty, error, and small-screen states.
- React composition guidance is useful as review or contract input, not as
  automatic refactor permission.

## Dangerous Patterns To Discard

- "Make it beautiful", "polish everything", "improve the UI", or other broad
  design commands as executable Night Mode work.
- Frontend auto-merge without screenshots, contact sheet, visual review brief,
  and Visual Court/Gemini review when required.
- Any Practice, XP, rank, Transfer, drill-ready, or progress claim not backed by
  product truth and allowed contracts.
- Package installation, shadcn installation, or dependency changes during design
  audit missions.
- Mutable remote fetch instructions as part of active skill execution.
- Architecture or component-wide refactors without explicit Mission Contract,
  Shadow Plan, max-file budget, and tests.
- Animation for decoration alone when it weakens clarity, accessibility, or
  reduced-motion behavior.

## Proposed Internal NeuroChess Design Skills

### neurochess-game-like-interface-design

Purpose: make NeuroChess feel alive, premium, and game-like without fake
gamification.

Source influences:

- `frontend-design` for non-generic direction;
- `make-interfaces-feel-better` for tactile polish and motion;
- `ui-ux-pro-max` for broad rubric categories.

Required constraints:

- must cite the learning-loop step it improves;
- must avoid fake XP/rank/Transfer claims;
- must require screenshots for UI work.

### neurochess-frontend-visual-review

Purpose: review screenshots/contact sheets for CTA truthfulness, UI clarity,
visual hierarchy, and one-intent-per-screen behavior.

Source influences:

- `web-design-guidelines` for checklist structure;
- `ui-ux-pro-max` for UX categories;
- `make-interfaces-feel-better` for before/after evidence format.

Required constraints:

- must fail unsafe Practice CTAs or false "drill ready" claims;
- must require visual review brief;
- must not approve road-to-V2 product merge by itself.

### neurochess-visual-identity

Purpose: keep NeuroChess dark, premium, strategic, and distinct from generic
SaaS dashboards or cheap game skins.

Source influences:

- `frontend-design` for design direction;
- `ui-ux-pro-max` for identity vocabulary;
- `make-interfaces-feel-better` for tactile details.

Required constraints:

- must stay science-safe;
- must support learning clarity before decoration.

### neurochess-react-performance-review

Purpose: review React architecture, component composition, rendering, and
performance hygiene.

Source influences:

- `composition-patterns` for component boundaries;
- `react-best-practices` from A16K for performance review;
- `make-interfaces-feel-better` for transition and layout stability checks.

Required constraints:

- review-only by default;
- no broad refactor in Night Mode;
- no package changes unless a dedicated mission authorizes them.

### neurochess-component-system-review

Purpose: review component consistency, accessibility, visual states, and
interaction states.

Source influences:

- `shadcn` for component-system thinking;
- `composition-patterns` for component structure;
- `make-interfaces-feel-better` for hit area, focus, active, and motion details.

Required constraints:

- no shadcn install by default;
- no dependency changes;
- screenshots and contract evidence required for frontend changes.

## Patterns Forbidden In Night Mode

- broad UI polish missions without NC-MP/2, Mission Contract, Shadow Plan, and
  Product Gate;
- any design mission that mixes frontend and backend work without explicit
  policy approval;
- frontend branch marked ready without screenshots/contact sheet/visual brief;
- "make it beautiful" as a mission goal;
- dependency, package, or shadcn install;
- active Practice/due_at/Daily Plan/training/scoring/XP/rank/Transfer changes;
- visual claims that overstate learning progress or transfer;
- product-code auto-merge to `road-to-V2` from frontend branches.

## Recommended Next Mission

`A16L_NEUROCHESS_INTERNAL_SKILLS_PACK`
