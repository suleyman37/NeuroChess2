# North Star Public Teaser Standard

Status: A20N rehearsal deliverable. This is a standard for judging future
screenshots, not permission to publish or market anything.

## Purpose

A North Star screenshot should make a serious chess player curious without
misrepresenting the product. It must feel like NeuroChess, not like a generic
analysis board, a SaaS dashboard, or a visual-effects demo.

The standard is intentionally stricter than DEV-only prototype readiness.

## Public Teaser Ladder

`INTERNAL_PROTOTYPE_ONLY`

- useful for development;
- may show selectors, debug panels, or scaffolding;
- not suitable for external sharing.

`INTERNAL_NORTH_STAR_CANDIDATE`

- strong enough for user or team review;
- board and learning state are credible;
- still has visible prototype or review-panel debt.

`PUBLIC_TEASER_READY_WITH_CAVEATS`

- visually impressive and product-specific;
- no visible DEV/test/audit residue;
- no misleading product claims;
- may still need caption context such as "early prototype."

`PUBLIC_TEASER_READY`

- screenshot can stand on its own as a credible early product image;
- board is sacred and readable;
- visual identity is memorable;
- primary state is clear without debug labels.

`HERO_MARKETING_READY`

- polished enough for a launch surface;
- production truth is fully aligned;
- user-facing flow exists or is accurately described;
- no prototype caveat needed.

## Hard Requirements

Every public-teaser candidate must satisfy:

- strict chessboard fidelity pass;
- anti-spoiler pass;
- no fake XP, rank, Elo, Transfer, neuroscience, or Practice-ready claim;
- no board pollution;
- no generic SaaS dashboard feel;
- no Stockfish GUI clone feel;
- no DEV-only, strict-gate, file-id, test badge, or audit label dominance;
- no visible debug scaffolding;
- no product claim unsupported by implementation;
- evidence path outside the repo;
- human review before public use.

## Visual Requirements

A strong teaser should show:

- board as central artifact;
- premium desktop application framing;
- immediate sense of decision state;
- meaningful atmosphere around the board;
- strong composition at 1366, 1440, and preferably 1920 widths;
- pieces readable at normal screenshot scale;
- state feedback that feels earned and non-gamey;
- one clear product mood, not a pile of effects.

## What Does Not Count

The following do not make a teaser public-ready:

- high autonomous score alone;
- Gemini pass alone;
- a pretty contact sheet that hides board defects;
- a board-centered layout with unreadable pieces;
- decorative 3D that does not clarify decision state;
- generic dark UI with colored glows;
- labels explaining what visuals fail to communicate.

## A20L Classification Under This Standard

A20L current classification:

`INTERNAL_NORTH_STAR_CANDIDATE`

Why:

- It passes strict board and anti-spoiler gates.
- It is visibly stronger than A20J3.
- It has a distinct NeuroChess chamber identity.
- It still contains prototype-side controls and state panels.
- It is appropriate for human review, not public marketing.

## Required Review Questions

Before any screenshot is labeled public-ready, answer:

- Would a serious chess player understand this is about chess improvement?
- Is the board instantly readable?
- Is the state understandable without reading debug text?
- Does the screen avoid fake progress and fake science?
- Does the visual identity feel specific to NeuroChess?
- Would the screenshot embarrass the project if shared outside the team?
- Is the caption honest about prototype/product status?

## Decision Rule

If the screenshot is impressive but still visibly prototype-like, classify it as
`INTERNAL_NORTH_STAR_CANDIDATE`, not public-ready. NeuroChess can be ambitious
without pretending a prototype is a finished product.
