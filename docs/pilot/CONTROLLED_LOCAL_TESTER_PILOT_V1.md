# Controlled Local Tester Pilot V1

## Purpose

This pilot checks whether NeuroChess V1 is understandable, safe, and useful for
2-3 controlled local testers after the automated release-candidate gate passed.
It is not a public release. It is a structured local test with explicit
boundaries, copied data, and a facilitator.

## Scope

- Pilot size: 2-3 controlled local testers.
- Session duration: 45-60 minutes per tester.
- Test target: the V1 loop from PGN import to analysis, Review, exploration,
  Practice, Daily Plan, and Profile/Privacy safety.
- Environment: local machine, local app, copied PGNs, temp or copied data when
  destructive actions are tested.

## Tester Profile

Preferred testers:

- chess players around 800-1800 Elo;
- optionally one beginner to test clarity;
- comfortable sharing a few non-sensitive PGNs;
- understands this is local test software, not a polished public release.

Avoid testers who need cloud sync, mobile-app packaging, account login, or
production stability guarantees.

## What Testers Should Test

- Import a PGN.
- Launch standard analysis.
- Inspect or launch deep analysis when available.
- Open Review.
- Explore one Review position locally.
- Start Practice from Review.
- Try one wrong move if comfortable.
- Use correction/reveal when needed.
- Check Daily Plan.
- Export data.
- Test delete only on temp/copied data.
- Report degraded states if encountered.

## What Testers Should Not Expect

- No LLM coach yet.
- No Candidate Trainer.
- No cloud sync.
- No Lichess/Chess.com account sync.
- No native mobile app.
- No public-release polish.
- No guarantee of Elo improvement.
- No biological or neurological measurement.

## Privacy And Data Safety

NeuroChess V1 is local-first. Testers should use copied/non-sensitive PGNs.
They should not run destructive delete on valuable real data unless the
facilitator has prepared a temp DB or a backup.

Export/delete are user-data functions. They are not project-file functions and
must not delete repository files, Stockfish, app code, or system files.

## Facilitator Notes

- Explain that "Neuro" is a brand/metaphor, not a brain measurement.
- Watch whether the tester knows the next action without coaching.
- Record confusion, spinner anxiety, contradictory feedback, and trust breaks.
- Separate usability feedback from V2 feature requests.
- Pause the pilot immediately on any P0.
