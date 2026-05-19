# Browser State Truth Protocol

Mission: A20BA Browser State Truth Protocol and Composer-First Classifier.

## Doctrine

Current UI state is more authoritative than historical page text.

A ChatGPT or Gemini page may contain old conversation text that says CAPTCHA,
verification, consent, bypass, login, or auth wall. Those words are not a
current blocker unless a foreground blocker or direct blocker selector is
visible now.

## Usable Page

A page is `PAGE_USABLE` when:

- the composer exists in the current DOM;
- the composer is visible in the current viewport;
- the composer is enabled or editable;
- send is available, or prompt submission is possible;
- no foreground auth, consent, CAPTCHA, 2FA, or human-verification overlay
  blocks interaction.

For ChatGPT Web, `#prompt-textarea` is a primary signal. If it is visible and
interactable, classify the page as usable unless a real foreground blocker is
visible.

## Human Action Required

A page is `HUMAN_ACTION_REQUIRED` only when current UI evidence supports it:

- login, consent, CAPTCHA, 2FA, or human-verification UI is visible now;
- the composer is absent, disabled, or blocked;
- the blocker is in the active viewport or a foreground overlay;
- screenshot and DOM probe evidence were captured when possible.

Full body text alone is not enough.

## Unclassified State

If the composer is absent and no current blocker is visible, the classifier
returns `UNCLASSIFIED_PAGE_STATE`.

In that state the system should:

- write screenshot/DOM diagnostics when possible;
- avoid repeated ntfy alerts;
- retry only within a bounded flow;
- avoid claiming that human action is required.

## Alert Rule

Ntfy is sent only for `HUMAN_ACTION_REQUIRED` with foreground blocker evidence.

No ntfy is sent for:

- `PAGE_USABLE`;
- `PAGE_LOADING`;
- `UNCLASSIFIED_PAGE_STATE`;
- broad historical text matches.

## Resume Rule

`ResumeCheck` maps `PAGE_USABLE` to `RESUME_READY`.

If a user says the page looks usable, the system captures screenshot/composer
diagnostics and reclassifies. If the composer is visible and enabled, the lane
resumes instead of waiting for non-existent manual action.

## Safety

The classifier does not:

- bypass login, CAPTCHA, 2FA, consent, or human verification;
- click verification controls;
- enter credentials;
- use blind typing;
- print private URLs, cookies, tokens, ntfy topic, or secrets.
