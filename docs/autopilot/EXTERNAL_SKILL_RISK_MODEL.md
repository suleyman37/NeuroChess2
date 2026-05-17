# External Skill Risk Model

External skills are powerful because they can shape future agent behavior. That
also makes them a supply-chain and prompt-safety risk.

Risk categories:

- Supply-chain risk: copied content can include hidden scripts, mutable remote
  dependencies, or unsafe install steps.
- Prompt injection risk: instructions may tell the agent to ignore host rules,
  system messages, Mission Contract, or Control Plane decisions.
- Script risk: a skill may include PowerShell, shell, Node, Python, or binary
  files that perform filesystem, network, Git, or credential actions.
- Network fetch risk: `curl`, `wget`, `Invoke-WebRequest`, `fetch`, or remote
  raw URLs can change behavior outside the repo review process.
- Permission inheritance risk: once installed, a skill can steer Codex inside
  the user's workspace even if the skill itself did not request explicit
  permission.

Risk levels:

- `low`: documentation-only, precise, no scripts, no safety conflict.
- `medium`: broad or vague guidance, architecture-wide encouragement, unclear
  scope.
- `high`: network fetch, dependency install, scripts, broad filesystem access.
- `critical`: destructive commands, secrets exfiltration, prompt injection, or
  NeuroChess safety-gate weakening.
