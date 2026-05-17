# No-Human-Runtime Design Loop Policy

During autonomous runs:

- the user is not part of the design approval loop;
- no mission may wait for user visual judgment;
- no runtime design decision may require "ask Suleyman";
- if judges cannot select a safe winner, the result is `NO_WINNER` or
  `NEEDS_HUMAN_REVIEW_AFTER_RUN`.

Allowed states:

- `AUTO_PASS_DESIGN`
- `AUTO_WARNING_VISUAL_DEBT`
- `AUTO_BLOCK_GENERIC_UI`
- `AUTO_NO_WINNER`
- `NEEDS_HUMAN_REVIEW_AFTER_RUN`

After the run:

- the user may review screenshots/contact sheets;
- feedback can be appended to the Visual Taste Ledger;
- the Taste Proxy can be updated only in a dedicated calibration mission;
- calibration must never become a live-run dependency.
