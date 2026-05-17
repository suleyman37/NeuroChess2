# NeuroChess 3D Visual State Machine

The 3D Board Stage uses learning states, not decorative scenes.

## States

| State | Purpose | 3D behavior |
|---|---|---|
| `observe` | Inspect the position before acting | Stable board, quiet atmosphere, no answer trace |
| `detect` | Notice the key tension | Focus halo or tension ring, still readable |
| `try_before_feedback` | User attempts before answer | Contained energy, no solution reveal |
| `feedback_success` | Attempt matched the learning target | Short stabilization pulse, earned feedback |
| `feedback_miss` | Attempt missed the target | Brief imbalance, then clarity reset |
| `replay` | Show sequence after effort | Guided trace, bounded motion |
| `explore` | Inspect candidate context | Subtle grid or artifact fragments |
| `memory` | Connect to prior learning | Subtle memory trace, no science claims |
| `transfer` | Connect past pattern to future game | Link metaphor only, no fake Transfer score |

## Transitions

- `observe` -> `try_before_feedback`
- `try_before_feedback` -> `feedback_success`
- `try_before_feedback` -> `feedback_miss`
- `feedback_success` -> `replay`
- `feedback_miss` -> `observe`
- `replay` -> `memory`
- `memory` -> `observe`

Any transition that hides the board, spins the camera, or creates fake progress
claims is invalid.
