# External Skills Testing And Visual Proof Audit

A16K4 performed a targeted discovery and audit pass for external skills related
to testing, Playwright, browser evidence, visual proof, accessibility, and React
testing. This mission fetched only `SKILL.md` files into ignored quarantine
folders, did not install or activate any external skill, and did not execute any
external script.

## Search Themes

- `playwright`
- `browser testing`
- `visual regression`
- `screenshot`
- `screenshots`
- `accessibility`
- `keyboard navigation`
- `React testing`
- `UI testing`
- `frontend testing`
- `visual proof`
- `browser smoke`
- `e2e testing`
- `user flow testing`

## Summary

| Candidate | Source | Fetched | Risk | Verdict | Primary NeuroChess target |
|---|---|---:|---|---|---|
| `openai-playwright` | `https://skills.sh/openai/skills/playwright` | yes | high | `ADAPT_TO_INTERNAL` | `frontend-visual-review`, `product-safe-night-mode`, `morning-intelligence-report` |
| `e2e-testing` | `https://skills.sh/hieutrtr/ai1-skills/e2e-testing` | yes | high | `ADAPT_TO_INTERNAL` | `neurochess-tdd-behavior-contract`, `frontend-visual-review`, `product-safe-night-mode` |
| `react-testing-patterns` | `https://skills.sh/hieutrtr/ai1-skills/react-testing-patterns` | yes | medium | `ADAPT_TO_INTERNAL` | `neurochess-tdd-behavior-contract`, `neurochess-react-performance-review` |
| `visual-regression` | `https://skills.sh/alekspetrov/navigator/visual-regression` | yes | high | `QUARANTINE` | `frontend-visual-review`, `neurochess-desktop-game-like-interface-design`, `morning-intelligence-report` |
| `playwright-visual-testing` | `https://skills.sh/manutej/luxor-claude-marketplace/playwright-visual-testing` | yes | critical | `REJECT` | `frontend-visual-review`, `neurochess-desktop-game-like-interface-design`, `product-safe-night-mode` |
| `accessibility-a11y` | `https://skills.sh/mindrally/skills/accessibility-a11y` | yes | medium | `ADAPT_TO_INTERNAL` | `frontend-visual-review`, `neurochess-desktop-game-like-interface-design` |
| `ui-doctor` | `https://skills.sh/iress/design-system/ui-doctor` | yes | high | `ADAPT_TO_INTERNAL` | `frontend-visual-review`, `neurochess-desktop-game-like-interface-design`, `morning-intelligence-report` |
| `qa-testing-playwright` | `https://skills.sh/vasilyu1983/ai-agents-public/qa-testing-playwright` | yes | high | `QUARANTINE` | `frontend-visual-review`, `neurochess-tdd-behavior-contract`, `product-safe-night-mode` |

All raw `SKILL.md` files remain under ignored `external_skills/quarantine/`
folders. Only structured audit reports under `external_skills/audited/` are
intended for commit.

## Individual Results

### openai-playwright

Useful patterns:

- Playwright browser smokes;
- screenshot evidence;
- console and network inspection;
- deterministic user-flow proof;
- scope discipline for browser-visible checks.

Dangerous patterns:

- network references;
- dependency install assumptions;
- browser automation must remain audited and evidence-only before live frontend
  missions.

Recommendation: adapt into NeuroChess-owned browser proof procedures. Do not
activate the external skill directly.

### e2e-testing

Useful patterns:

- end-to-end flow contracts;
- browser evidence packs;
- failure screenshots;
- avoidance of brittle sleeps;
- behavior-first testing structure.

Dangerous patterns:

- network references;
- environment/secrets vocabulary;
- risk of turning E2E guidance into broad product execution.

Recommendation: adapt the flow-proof structure into
`neurochess-tdd-behavior-contract` and `product-safe-night-mode`. Keep external
content quarantined.

### react-testing-patterns

Useful patterns:

- user-facing behavior assertions;
- React component test boundaries;
- state-driven UI assertions;
- avoidance of implementation-detail tests;
- React quality checks that pair with public behavior.

Dangerous patterns:

- React testing advice must not authorize dependency installs;
- snapshot-only confidence is not enough for NeuroChess.

Recommendation: adapt into `neurochess-tdd-behavior-contract` and
`neurochess-react-performance-review`.

### visual-regression

Useful patterns:

- before/after screenshots;
- viewport-specific visual comparison;
- baseline drift awareness;
- failure image evidence;
- visual review checklists.

Dangerous patterns:

- network references;
- dependency install assumptions;
- environment/secrets vocabulary;
- image baselines and tooling changes require a dedicated mission.

Recommendation: quarantine. Extract only visual evidence and baseline-review
ideas for later internal skill updates.

### playwright-visual-testing

Useful patterns:

- visual test evidence;
- screenshot baselines;
- desktop viewport checks;
- artifact naming discipline.

Dangerous patterns:

- network references;
- environment/secrets vocabulary;
- scanner-detected NeuroChess red-tier conflict text;
- external browser tooling must not be installed or executed from this skill.

Recommendation: reject as an external skill. A future internal procedure may
reuse the general idea of desktop screenshot baselines, but none of the skill is
trusted or activated.

### accessibility-a11y

Useful patterns:

- keyboard navigation checks;
- visible focus states;
- ARIA only where useful;
- desktop accessibility proof;
- accessibility review checklist structure.

Dangerous patterns:

- accessibility guidance must remain desktop-first for NeuroChess;
- mobile-first assumptions cannot become the primary product target.

Recommendation: adapt into `frontend-visual-review` and
`neurochess-desktop-game-like-interface-design`.

### ui-doctor

Useful patterns:

- UI diagnosis checklist;
- visual hierarchy critique;
- accessibility review prompts;
- actionable visual findings;
- scope and path guardrail reminders.

Dangerous patterns:

- network references;
- dependency install assumptions;
- environment/secrets vocabulary;
- generic UI diagnosis must be constrained by CTA truthfulness, board-centered
  desktop layout, and the NeuroChess North Star.

Recommendation: adapt review categories only. Do not activate externally.

### qa-testing-playwright

Useful patterns:

- Playwright QA flow checklist;
- console error capture;
- network error capture;
- repeatable browser smoke evidence;
- scope discipline for test runs.

Dangerous patterns:

- network references;
- QA automation guidance must not execute downloaded test code;
- package files and dependencies require a dedicated mission.

Recommendation: quarantine. Extract evidence-pack and error-capture patterns
only.

## Useful Testing And Visual-Proof Patterns

- Browser smokes should produce evidence, not just a pass/fail claim.
- Frontend branches should capture desktop screenshots at the configured
  NeuroChess desktop widths before review.
- Contact sheets should collect the before state, after state, key interaction
  state, and failure state when relevant.
- Console errors and network failures should be captured with screenshots.
- Visual regression should be treated as evidence review, not automatic product
  truth.
- Browser tests should use stable selectors and route-visible state, not brittle
  sleeps or snapshot-only assertions.
- Accessibility review should focus on keyboard navigation, visible focus,
  mouse interaction, and board-centered desktop workflows.
- React tests should prove public behavior and state-driven UI, not internal
  implementation details.
- Morning reports should summarize screenshots, console/network evidence,
  visual verdicts, and the branch evidence pack path.

## Dangerous Patterns Found

- Dependency installation or browser tooling setup instructions inside external
  skills.
- Mutable network references that should not be fetched during active missions.
- Environment, token, or secrets vocabulary that requires conservative
  quarantine.
- Visual baseline tooling that could modify package files or create runtime
  artifacts without a dedicated mission.
- External browser automation instructions that could be mistaken for permission
  to run product missions.
- UI review guidance that is too generic unless bound to CTA truthfulness,
  read-only clarity, desktop-first board layout, and product evidence.
- Snapshot-only testing as sufficient proof.
- Frontend auto-merge without screenshots, contact sheet, visual review brief,
  and Control Plane approval.

## Recommended Internal Skill Updates Later

### frontend-visual-review

Add stronger procedures for:

- screenshot evidence;
- contact sheets;
- visual regression review;
- desktop viewport checks;
- console and network capture;
- screenshot-backed failure evidence;
- PASS/WARNING/BLOCK evidence summary.

### neurochess-desktop-game-like-interface-design

Add stronger procedures for:

- interaction feel evidence;
- visual state proof;
- desktop-first game-like feedback checks;
- board-centered viewport proof;
- accessibility and keyboard proof for desktop flows.

### neurochess-react-performance-review

Add stronger procedures for:

- React behavior tests;
- component boundary checks;
- render stability evidence;
- avoiding brittle snapshots;
- linking visible behavior to React state changes.

### neurochess-tdd-behavior-contract

Add stronger procedures for:

- browser behavior tests;
- public behavior over implementation details;
- stable selector guidance;
- route-visible state verification;
- failure screenshot capture.

### morning-intelligence-report

Add stronger procedures for:

- visual proof summary;
- screenshot/contact sheet links;
- console and network failure summary;
- branch evidence pack classification;
- clear PASS/WARNING/BLOCK outcome.

### product-safe-night-mode

Add stronger procedures for:

- frontend branch proof requirements;
- browser smoke proof requirements;
- evidence pack requirements;
- no product auto-merge from visual-only evidence.

## Structured Reports

Committed audit reports:

- `external_skills/audited/openai-playwright.audit.json`
- `external_skills/audited/e2e-testing.audit.json`
- `external_skills/audited/react-testing-patterns.audit.json`
- `external_skills/audited/visual-regression.audit.json`
- `external_skills/audited/playwright-visual-testing.audit.json`
- `external_skills/audited/accessibility-a11y.audit.json`
- `external_skills/audited/ui-doctor.audit.json`
- `external_skills/audited/qa-testing-playwright.audit.json`

Raw fetched external files remain ignored and uncommitted under
`external_skills/quarantine/`.

## Recommended Next Mission

`A16K5_EXTERNAL_SKILLS_SECURITY_REPO_HYGIENE_AUDIT`
