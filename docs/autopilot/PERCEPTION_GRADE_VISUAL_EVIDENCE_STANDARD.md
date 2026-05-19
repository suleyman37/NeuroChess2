# Perception-Grade Visual Evidence Standard

Status: A20AQ active standard.

## Purpose

A visual judge must not be asked to judge ten tiny UIs in one image. Contact sheets are navigation aids only. Primary evidence is one full-size image for one probe.

## Primary Probe Screenshot

- Contains one probe only.
- Uses a viewport of at least 1366x900.
- Target probe occupies at least 65% of meaningful visual attention and at least 35% of viewport area by measured main-surface bounds.
- Probe title and context may appear, but they must not dominate the image.
- A 10-up collage is invalid as primary evidence.

## Component Crop

- Captures the main probe surface with a browser locator or equivalent CDP clipped element capture.
- Main surface should be at least 700px wide and 450px tall, with 800px wide preferred.
- Used for detailed visual critique by Gemini, ChatGPT Vision, or a human reviewer.

## Detail Screenshot

Required when a probe includes a signature element: piece, sigil, wax seal, chamber, timeline scar, cabinet card, breath motion frame, pressure field, or resonance link.

## Pairwise Comparison

- Contains at most two probes.
- Used only for comparison.
- Cannot replace one-probe primary screenshots.

## Overview Contact Sheet

- Allowed only as a navigation index.
- Must be labelled `OVERVIEW_ONLY`.
- Must not be sent as the primary judge input.

## Visual Judge Packet

- One packet per probe.
- References one primary screenshot and one main-surface crop.
- References an optional detail crop.
- Includes compact context and structured answer format.
- Asks the judge to critique only one probe.
- Does not include a 10-probe prompt or a giant history.

## Evidence Failure Conditions

- Target too small.
- Text unreadable.
- Board distorted.
- Board too small to judge.
- Signature element not visible.
- Screenshot missing.
- Contact sheet used as primary evidence.
- Compression too high.
- Route metadata missing.

## Judge-Ready Minimum

Each probe needs an evidence quality score of at least 75/100 before it can be considered for final Signature Five selection.
