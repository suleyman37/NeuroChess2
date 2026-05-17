# Rolling Loop Reporting

Each A18 run writes a JSON report and Markdown summary under:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\rolling_loop_dry_runs\`

Reports include session id, scenario name, initial and final phase, missions
proposed, accepted, rejected, selected skills, NC-MP/2 lint results, Mission
Contract results, Shadow Plan results, Product Gate results, Mission Hash
results, Forward Progress results, Prompt Ledger entries, Goldilocks results,
E2E scores, phase transitions, stop reason, final verdict, and confirmations
that no live ChatGPT, Gemini, or product execution occurred.

Future live reports should keep the same structure so Morning Intelligence can
rank branches, detect stop reasons, and summarize what should happen next.
