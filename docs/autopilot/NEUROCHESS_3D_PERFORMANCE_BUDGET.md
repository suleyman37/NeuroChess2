# NeuroChess 3D Performance Budget

The 3D layer must feel responsive on desktop and must never delay board
interaction.

Default budget:

- target desktop FPS: 60;
- graceful minimum FPS: 30;
- max postprocess passes: 2;
- max dynamic lights: low and configurable;
- max particle systems: 1 to 2;
- no uncontrolled particle storms;
- no expensive full-screen shader by default;
- reduced-motion mode required;
- low-quality fallback required;
- screenshot evidence required;
- performance warning if board interactions feel delayed.

Future test ideas:

- browser smoke FPS sampling;
- screenshot check at 1366 and 1440 desktop widths;
- 1920 screenshot when available;
- reduced-motion screenshot;
- low-quality mode screenshot;
- canvas nonblank check;
- board-readable pixel/region check;
- interaction latency warning if board input stalls.

Performance budget failures should classify the branch as `NEEDS_REWORK` or
`READY_TO_REVIEW_WITH_VISUAL_DEBT` depending severity and evidence.
