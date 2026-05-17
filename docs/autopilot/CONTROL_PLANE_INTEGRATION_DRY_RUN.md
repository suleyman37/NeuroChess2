# Control Plane Integration Dry Run

A17 proves the deterministic Control Plane can coordinate a complete mission
lifecycle without live ChatGPT, live Gemini, product execution, or live Night
Mode.

The dry run exists because NeuroChess now has many separate governance pieces:

- Control Plane state and event IPC;
- NC-MP/2 parsing and linting;
- Mission Contract and Shadow Plan checks;
- Mission Hash and Forward Progress detectors;
- Product Intelligence Gate and North Star Vector discipline;
- Prompt Ledger;
- Gemini Auditor decision mapping;
- internal skill selection;
- Goldilocks Governor;
- E2E Deliverable Score;
- Night Mode phase transitions.

The integration runner uses fixture data only. It creates a temporary runtime,
acquires a local lock, creates a synthetic night session, processes synthetic
events, invokes the existing dry-run scripts, writes append-only ledgers in the
temporary runtime, and produces an external report under the QA artifacts root.

## Not Live

A17 does not:

- run Night Mode live;
- execute Codex against a product mission;
- call ChatGPT Web;
- call Gemini Web;
- enable live Control Plane;
- enable live skills activation;
- touch product files.

## Why This Prepares A18

A18 can build a rolling-loop controller dry run on top of this lifecycle proof.
A17 confirms the components can exchange deterministic JSON, stop on safety
gates, and produce a useful report without trusting LLM self-report.
