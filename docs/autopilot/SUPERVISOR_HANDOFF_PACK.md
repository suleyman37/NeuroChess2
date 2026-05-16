# Supervisor Handoff Pack

## Purpose

The Supervisor Handoff Pack is a compact state injection for a new ChatGPT
Project conversation. It supplies dynamic state that stable project files do not
contain.

The pack helps a fresh conversation understand the current mission boundary
without receiving full patches, long logs, screenshots, secrets, or raw Codex
transcripts.

## Required Fields

The handoff pack should include:

- project name;
- current branch;
- current HEAD;
- origin HEAD;
- last 8 commits;
- current product checkpoint;
- current automation stack;
- current disabled features;
- active risks;
- forbidden zones;
- red-tier rules;
- last 5 missions summary if provided;
- next expected role;
- required response formats.

It must include this reminder:

`Do not provide broad prompts. Use MICRO_PROMPT only when asked.`

## What Not To Include

The pack must not include:

- full patches;
- screenshots;
- long git logs;
- secrets, tokens, cookies, API keys, or `.env` values;
- browser session data;
- raw Codex transcripts;
- product implementation requests.

## External Output

The preferred output root is:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\session_rollovers\`

Generated handoff packs are evidence artifacts, not source of truth. Git and
the committed docs remain authoritative.
