# Skill Trust Gate

The trust gate audits local skill folders before any external skill can influence
AgentOS or Night Mode.

Audit checklist:

- `SKILL.md` exists.
- name and description are present.
- frontmatter is present when expected.
- scripts or executable files are detected.
- network fetches are detected.
- install commands are detected.
- secrets, SSH, keychain, browser-profile, or environment access is detected.
- destructive Git and filesystem commands are detected.
- prompt injection and host-rule override language is detected.
- conflicts with NeuroChess safety gates are detected.

Verdicts:

- `REJECT`: critical risk such as destructive commands, exfiltration, prompt
  injection, or safety weakening.
- `QUARANTINE`: high-risk content that may still contain useful ideas.
- `ADAPT_TO_INTERNAL`: medium/high content whose safe patterns should be
  rewritten into a NeuroChess-owned skill.
- `APPROVE_INTERNAL`: low-risk internal candidate after review and tests.

The trust gate only reads files. It never executes skill scripts and never calls
the network.
