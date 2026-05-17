# NeuroChess Taste Dataset Protocol

The taste dataset is a ledger of human and auditor feedback. It is not a model
training pipeline.

Each entry records:

- artifact path;
- surface;
- branch;
- verdict: `LOVE`, `LIKE`, `NEUTRAL`, `DISLIKE`, or `REJECT`;
- reason;
- visual traits;
- what to repeat;
- what to avoid;
- related reference;
- NeuroChess relevance;
- notes.

The purpose is to make taste cumulative. If Suleyman loves a board-centered
artifact treatment or rejects generic SaaS cards, future missions should know.

The ledger should live in runtime/external artifacts by default. Fixture ledgers
in the repo are only schema examples.
