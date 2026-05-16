# ChatGPT Project Reference Files

## Purpose

The `NeuroChess Supervisor` Project should hold a small set of stable reference
files. These files give ChatGPT durable context without forcing every
supervisor conversation to receive a huge prompt.

The user uploads these files manually. A12 does not automate project file
upload, project creation, or login.

## Recommended Project Files

### 1. 01_NEUROCHESS_PRODUCT_DOCTRINE_MIN.md

Purpose:

- product doctrine;
- user-facing surfaces;
- forbidden claims;
- red-tier product risks.

### 2. 02_AGENTOS_SUPERVISOR_PROTOCOLS_MIN.md

Purpose:

- `NC_SUPERVISOR_RESPONSE`;
- `NC_STRATEGIC_PULSE`;
- nonce-bound DONE;
- Prompt Firewall basics;
- REQUEST_MORE.

### 3. 03_DANGEROUS_ZONES_AND_GIT_RULES_MIN.md

Purpose:

- `git add -A` is forbidden;
- forbidden paths;
- red-tier zones;
- road-to-V2 protections.

### 4. 04_CURRENT_AUTOMATION_STACK_MIN.md

Purpose:

- current proven stack;
- enabled and disabled features;
- Night Mode requirements.

## Stable Versus Dynamic Context

Project reference files are stable. The Supervisor Handoff Pack is dynamic.

Stable files should change rarely. The handoff pack should be regenerated for
each new supervisor conversation because it carries the current HEAD, branch,
recent missions, active risks, and next expected role.

## Verification

A later live smoke may test whether the Project context is present indirectly
with READY canary questions. A12 only defines the protocol and local validators.
