# Long-Run Safety Guard Pack

A20A exists because A19X proved the live loop can produce real product branches, but a true long run needs stronger stop and reconstruction machinery before A21. The guard pack is automation/control-plane only: it adds no product behavior and does not enable Night Mode.

## Risks Covered

- Policy drift: the run must not weaken its own safety rules while it is running.
- Cost and retry growth: Web UI token counts are not available, so the system tracks measurable proxies.
- Human stop control: the user can request a clean drain by creating a simple file.
- Evidence scatter: reports should read an append-only index instead of searching directories randomly.
- Report fragility: a dry-run hook verifies that morning-report sections can be generated before a night run.

## A20.5 / A21 Preparation

The first long runs should treat meta-fixes as stop conditions, not in-flight patches. For A20.5 and the first A21 run, `meta_fix_max_count` is `0`. If a meta-fix is required, the run should stop with `STOP_META_FIX_REQUIRED`, preserve evidence, and schedule a dedicated repair mission.

The pack is not live enforcement by itself. A20.5/A21 must wire these checks into the loop before starting product work.
