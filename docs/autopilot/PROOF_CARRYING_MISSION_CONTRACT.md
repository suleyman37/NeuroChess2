# Proof-Carrying Mission Contract

Every OMEGA-selected mission must carry its proof before Codex executes it.

Required fields:

- objective
- expected proof
- allowed paths
- forbidden paths
- max files
- max diff lines
- test commands
- stop conditions
- evidence artifacts
- score delta rules
- safety rules
- final verdicts

If proof cannot be defined, the mission is invalid.

A20AU contracts are capped at 900 words. They are intentionally short so Codex receives an execution contract rather than full historical context.

For pixel missions, expected proof must include visible DEV route evidence, screenshots outside the repository, and browser smoke output.
