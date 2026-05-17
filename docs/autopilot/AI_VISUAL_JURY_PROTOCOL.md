# AI Visual Jury Protocol

The autonomous design jury has five components.

## Gemini Visual Court

Primary visual judge when screenshots exist. Gemini may return PASS, WARNING,
or BLOCK style verdicts, but it cannot authorize unsafe work.

## ChatGPT Visual Court

Secondary judge when:

- Gemini returns `WARNING_VISUAL`;
- Gemini returns `PASS_VISUAL` on high-risk UI;
- visual canary fails;
- design tournament final tie;
- anti-generic gate is uncertain.

## Deterministic Design Rubric

Scores fields from design briefs, screenshots, and jury results against the
NeuroChess Design Rubric.

## Suleyman Taste Proxy

Scores likely alignment with known user taste.

## Anti-Generic Brutality Gate

Blocks generic SaaS, passive dashboards, meaningless glow, mobile-first drift,
and 3D spectacle that does not clarify the chess decision.

The Control Plane remains final authority. No visual judge may override safety,
product truth, branch hygiene, Visual Halting Limit, Mission Contract, or Shadow
Plan.
