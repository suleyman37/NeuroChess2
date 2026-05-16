# Long Running Mission Rules

## 1. When Longer Tasks Are Allowed

Long tasks are allowed only when the mission explicitly says so.

Examples:
- frontend build;
- backend full suite;
- browser smoke suite;
- long DB snapshot or route audit.

## 2. Active Work Vs Tests

Long checks do not automatically mean Codex is spiraling. The timebox must separate:
- active edit/debug time;
- check/test time;
- ChatGPT or browser wait time.

## 3. Overrides

Any override must state:
- expected long command;
- expected duration;
- why it is necessary;
- stop condition if it exceeds the override.

## 4. Red-Tier Missions

Red-tier work is stricter. Repeated repair attempts require checkpoint and supervisor review before continuing.
