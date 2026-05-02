# Style And Conventions

- Prefer backend-authoritative behavior with pure/testable metric and chess helpers.
- Use existing docs/registries before inventing architecture, metrics, actions, screens, or formulas.
- Keep formulas versioned and documented. Keep engine analysis schema/version metadata explicit.
- Keep frontend screens progressively disclosed: beginner flows are prescriptive and non-technical; Explorer/advanced owns debug/engine/evidence detail.
- For Python, follow existing service/module organization and unittest style. For frontend, follow existing React/Vite TypeScript component/API patterns.
- Keep comments sparse and useful. Avoid large refactors unless mission is explicitly a safe refactor.
- Do not expose secrets or local auth material in code, docs, memories, prompts, or logs.