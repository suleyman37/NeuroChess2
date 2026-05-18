# Visual Primitive Registry

The registry defines where visual ambition may live and where it must recede.

| Zone | Freedom | Allowed | Forbidden | May Cross Board Core | Can Imply Move | Requires Post Feedback |
|---|---:|---|---|---|---|---|
| BoardCore | 0 | squares, pieces | fog, particles, decorative lines | false | false | n/a |
| BoardOverlayPedagogical | 0 before feedback / 70 after | post-feedback trace, correction, replay path | pre-feedback arrow, destination glow | true after feedback only | true after feedback only | true |
| BoardFrame | 35 | rim light, material depth, tension ring | arrow-like effects, target glow | false | false | false |
| SurroundingStage | 90 | chamber, atmosphere, memory rails | random glow, generic blobs | false | false | false |
| CockpitPanels | 60 | tactical panels, product labels | debug HUD, generic SaaS cards | false | false | false |
| FeedbackLayer | 80 after attempt | insight pulse, reorientation trace | humiliation marks | true only after feedback | true only after feedback | true |
| ReplayMemoryLayer | 75 | replay path, memory fragments | pre-feedback hint | true only after feedback | true only after feedback | true |
| MotionLayer | 65 | state motion, pulse, stabilization | random loops, motion sickness | false | false | state-dependent |

Every primitive must declare its zone, state, function, and hard-gate risk.
