# Control Plane Loop Guards

## Purpose

A16B extends the A16A Local Control Plane with two loop guards:

- Mission Hash Detector;
- Forward Progress Detector.

Both are local and deterministic. They are not live-enabled in A16B.

## Authority

ChatGPT proposes. Codex executes only after gates pass. The Control Plane owns
the continuation decision.

ChatGPT cannot override:

- repeated mission hash stops;
- no-progress stops;
- forbidden scope stops;
- Mission Contract mismatch stops.

## Integration Model

Future Night Mode integration should:

1. normalize and hash every proposed mission before execution;
2. compare the hash against `mission_hashes_seen`;
3. record every mission result in `progress_ledger.jsonl`;
4. classify forward progress from commits, branches, artifacts, checks, and
   evidence;
5. stop or drain when deterministic loop guards trigger.

## Runtime State

The progress ledger lives outside the repo by default:

`%USERPROFILE%\\AgentOS\\runtime\\progress_ledger.jsonl`

Repo-local tests must use temp or QA artifact directories only.
