# Pilot Checklist V1

## Before Session

- [ ] Pull latest `road-to-V2`.
- [ ] Confirm `git status --short --branch` is clean.
- [ ] Confirm the latest QA RC gate result is GO controlled local testers.
- [ ] Run a minimal sanity check if time allows.
- [ ] Prepare copied/non-sensitive PGNs.
- [ ] Prepare a temp DB or backup if delete/export will be tested.
- [ ] Prepare the bug report template.
- [ ] Prepare the feedback form.
- [ ] Ask for consent before recording screen or audio.
- [ ] Explain that this is local test software, not a public release.

## During Session

- [ ] Record time to first value.
- [ ] Note whether the tester understands the main navigation.
- [ ] Note confusion points.
- [ ] Note any spinner longer than expected.
- [ ] Note any feedback contradiction.
- [ ] Note whether the tester knows the next useful action.
- [ ] Note whether Practice feedback feels fair.
- [ ] Note whether UI feels calm and non-humiliating.
- [ ] Note any raw technical message in normal UI.
- [ ] Preserve screenshots/video/log paths for bugs.

## After Session

- [ ] Collect all bugs.
- [ ] Classify each as P0/P1/P2/P3.
- [ ] Preserve screenshots, videos, logs, PGN fixture, and DB type.
- [ ] Decide GO/NO-GO for the next tester.
- [ ] Create follow-up Codex missions only for P0/P1.
- [ ] Backlog V2/V3 feature requests separately.
- [ ] Do not add forbidden V1 features from feedback.

## Fast Stop Conditions

Pause the pilot if:

- analysis hangs without recovery;
- best/accepted move is marked as a problem;
- live analysis reveals a Practice answer before attempt/reveal;
- export/delete looks unsafe;
- the app crashes on the core loop;
- tester cannot complete import -> analysis -> Practice.
