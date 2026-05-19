# Visual Judge Packet Protocol

Status: A20AQ packet protocol.

## Rule

One packet judges one probe. Pairwise packets compare two probes. Overview contact sheets are never primary evidence.

## Packet Types

- `judge_packets/gemini/<probe>.md`: visual perception, readability, board safety, atmosphere, defects, next patch.
- `judge_packets/chatgpt/<probe>.md`: product utility, learning-loop contribution, anti-generic strength, UX risks, next mission.
- `judge_packets/pairwise/<probe_a>_vs_<probe_b>.md`: comparison only, two probes maximum.

## Required References

Each one-probe packet includes:

- probe id;
- learning-loop stage;
- primary screenshot path;
- main surface screenshot path;
- detail screenshot path when available;
- evidence quality score;
- strict structured answer format.

## Forbidden Packet Inputs

- 10-probe contact sheets as primary evidence.
- Raw private ChatGPT or Gemini URLs.
- ntfy topics, credentials, tokens, or SMTP values.
- Giant mission histories.
- Claims that a probe is selected before evidence triage passes.

## Packet Readiness

A packet is ready when its manifest entry has:

- `primary_evidence_ready: true`;
- `recommended_for_gemini: true`;
- `recommended_for_chatgpt: true`;
- screenshot paths outside the repo;
- no failure reasons.

## Selection Boundary

A20AQ prepares packets and recommends whether selection can proceed. Final Signature Five selection belongs to the next mission.
