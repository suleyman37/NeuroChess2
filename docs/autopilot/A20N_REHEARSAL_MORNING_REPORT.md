# A20N Rehearsal Morning Report

## What Happened

A20N ran a limited rehearsal, not a full all-night run. It started from A20M,
used the A21 objective reservoir, selected one product/design objective, and
stopped after producing evidence and a decision.

No A21 run was launched. No Night Mode run was launched.

## What Product Value Was Created

The rehearsal created a Creative Director Gate and a North Star Public Teaser
Standard.

This matters because A20L is visually promising, but not automatically
approved. The new standards make future visual branches answer harder questions:

- Is the board still sacred?
- Is the state understandable without debug labels?
- Is the design truly NeuroChess, or just a safe dark chess UI?
- Is it public-ready, or only internally reviewable?

This is product value because it protects future design work from becoming
generic, over-scaffolded, or visually inflated.

## Branches Created

- A20N branch:
  `auto/a20n-limited-3h-all-night-rehearsal-20260518`

Child branches:

- none

Why no child branches:

The selected work was docs/design and run-evidence only. A child branch would
not have improved isolation because no frontend, backend, package, DB, or
product route files were touched.

## What Passed

- Road precheck passed at `7a71b0e`.
- A20M source branch verified at `07bcd51`.
- Objective selection avoided red-tier lanes.
- No product data mutation occurred.
- No screenshots or QA artifacts were committed.
- No package files were touched.
- No backend files were touched.
- No live ChatGPT or Gemini call was made.

## What Failed

No validation failure was recorded during the selected rehearsal work.

The rehearsal itself exposed one limitation: this was a controlled short run,
not proof that a full all-night run can safely handle multiple child branches
and browser-heavy objectives.

## What Was Blocked

Blocked or skipped deliberately:

- full A21;
- full Night Mode;
- product-code merge to `road-to-V2`;
- frontend route edits;
- backend read/write work;
- browser smoke churn when no frontend changed;
- live visual-provider calls;
- package changes.

## Visual And Product Risks Remaining

- A20L remains an internal North Star candidate, not public-ready.
- The Creative Director Gate now exists, but has not yet been wired into
  automated objective selection.
- The public teaser standard is a decision standard, not a finished visual
  system.
- Future visual missions still need screenshot evidence and human review before
  any public or product consolidation claim.

## What The User Should Review

Review:

- `docs/design/NEUROCHESS_CREATIVE_DIRECTOR_GATE.md`
- `docs/design/NORTH_STAR_PUBLIC_TEASER_STANDARD.md`
- the A20L contact sheet at the external artifact path from A20M/A20L

The key question is whether the Creative Director Gate captures your taste
strongly enough before it becomes a mandatory future gate.

## Did The System Behave Intelligently?

Mostly yes.

It did not chase volume. It selected a product/design objective because the
current bottleneck is not another visual prototype; it is the judgment system
that decides what visual work is actually worthy of NeuroChess.

But it was still a short, conservative rehearsal. It did not prove full
multi-branch overnight endurance.

## Recommendation

Do not launch full A21 yet.

Recommended next step:

`A20O_NEUROCHESS_CREATIVE_DIRECTOR_AND_AWWWARDS_VISUAL_SYSTEM`

Reason:

Before a true all-night run with visual/product lanes, NeuroChess should turn
the Creative Director Gate into a stronger application-grade visual system with
benchmarks, failure gallery, primitive registry, and screenshot-to-patch rules.
