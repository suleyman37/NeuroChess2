# Task Completion Checklist

Before final response after a coding mission:

- Confirm scope stayed within the mission and no unrelated app code was changed.
- Run relevant tests: backend unit tests for backend/metrics/data changes; frontend build and Playwright for browser-visible changes.
- Inspect `git status --short --branch` and summarize modified files.
- Mention tests run and results, or clearly say why tests were not run.
- Call out risks, manual browser validation, and any docs/registries updated.
- For metrics/actions/screens/formulas, verify corresponding registry/docs updates are included.
- Never hide failing tests. Stop if base tests fail without a clear relation to the mission.