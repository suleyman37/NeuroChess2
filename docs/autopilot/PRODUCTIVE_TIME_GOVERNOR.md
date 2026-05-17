# Productive Time Governor

The Productive Time Governor prevents two bad outcomes:

- stopping early only because the first quota was easy;
- filling time with low-value work.

For A21, policy should use:

- target wall clock: 360 minutes;
- hard cap: 360 minutes;
- soft target: 240 minutes;
- drain required by: 330 minutes;
- useful work target ratio: 0.65;
- minimum meaningful mission time: 20 minutes.

Tracked counters include wall clock elapsed, useful mission minutes, phase time,
bridge wait, test wait, visual audit wait, missions attempted, high-value
missions, low-value missions, E2E deliverables, consolidations, evidence
amplifications, and productive utilization ratio.

If remaining time is below the minimum meaningful mission window, the run should
enter `DRAIN`. If quota is reached early and at least 45 minutes remain, the run
must consider `ADAPTIVE_EXTENSION` before DRAIN.
