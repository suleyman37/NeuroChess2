# Design Winner Selection Policy

A design candidate can win only if:

- CTA truthfulness passes;
- no fake gamification;
- no fake XP/rank/Transfer;
- board is central when board exists;
- desktop-first requirements pass;
- no mobile-first drift;
- no red-tier;
- design score is at least 80;
- taste proxy score is at least 75;
- generic SaaS drift is at most 25;
- visual provider verdict is not `BLOCK_VISUAL`;
- learning-loop support passes threshold.

Winner selection:

- clear winner if the best candidate beats second place by at least 10 points
  and passes all hard gates;
- if top candidates are close, choose the one with stronger learning-loop
  support;
- if no candidate passes hard gates, return `AUTO_NO_WINNER`;
- if all candidates are generic, return `AUTO_BLOCK_GENERIC_UI`;
- if only minor issues remain, return `AUTO_WARNING_VISUAL_DEBT`.

Runtime user approval is never required.
