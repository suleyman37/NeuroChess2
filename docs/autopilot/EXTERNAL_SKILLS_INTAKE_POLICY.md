# External Skills Intake Policy

External agent skills can bring useful patterns: better design critique,
behavior-first testing, architecture review, React guidance, and skill authoring
conventions. They also inherit risk because a skill is instruction-bearing
software-adjacent content.

A16J establishes a quarantine-first intake path. It does not download, install,
enable, or execute any external skill.

Intake states:

- `DISCOVERED`: candidate listed for future audit.
- `DOWNLOADED_READONLY`: local copy exists for inspection only.
- `QUARANTINED`: raw content is isolated and inactive.
- `AUDITED`: scanner/classifier report exists.
- `ADAPT_TO_INTERNAL`: useful patterns may be rewritten into a NeuroChess skill.
- `APPROVE_INTERNAL`: adapted internal skill can be reviewed for future use.
- `REJECTED`: unsafe or conflicting skill is kept rejected with reasons.

No external skill is active by default. Raw third-party content stays under
`external_skills/quarantine/` or a raw audit folder and is not committed unless
a later mission explicitly approves it.
