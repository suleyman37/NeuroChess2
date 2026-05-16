# Mission Runtime Context

## 1. Purpose

Mission runtime context gives Codex and supervisors a short-term summary between micro-missions without polluting tracked source files.

Preferred generated path:

```text
ops/autopilot/runtime/current_mission_context.json
```

This file is gitignored.

## 2. Contents

The context may contain:
- current task;
- base head;
- current branch;
- risk tier;
- work type;
- active constraints;
- recent decisions;
- active risks;
- do-not-touch paths;
- last successful commit;
- next expected step.

## 3. Not Source Of Truth

Runtime context is memory, not authority. Source of truth remains:
- Git history;
- committed docs;
- evidence packs;
- mission prompts;
- deterministic checks.

## 4. A8 Status

A8 creates the context updater and gitignore rule, but keeps live runtime context enablement false.
