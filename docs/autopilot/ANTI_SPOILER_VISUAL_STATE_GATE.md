# Anti-Spoiler Visual State Gate

NeuroChess visual effects must not reveal the answer before the player has made
an effort. The board stage can create tension, but it cannot draw a line that
looks like the move, destination, candidate path, or solution before feedback.

Pre-feedback states:

- `observe`: no solution line, no candidate line, no destination trace.
- `try_before_feedback`: tension is allowed, but no answer trace, candidate
  path, arrow, or line that can be read as the best move or destination.

Post-feedback states:

- `feedback_success`, `feedback_miss`, and `replay` may show pedagogical traces
  if they are clearly post-feedback and not confused with pre-attempt guidance.

If a pre-feedback spoiler exists, the result is `BLOCK_STATE_SEMANTICS`. A
visual provider cannot override this. The branch must be classified as
`NEEDS_REWORK` or worse until the spoiler is removed.
