# Action Registry Rules

- Source of truth: `docs/ACTION_REGISTRY.md`.
- Any new visible/hidden product action must be registered before use.
- One prescriptive screen gets exactly one visible primary action and at most two visible secondary actions.
- Prescriptive screens should preserve autonomy with an alternative action when rejection is reasonable.
- Advanced actions are hidden by default. Debug actions are never visible in normal UI. Destructive actions require confirmation.
- Use simple verbs and avoid duplicate actions with different labels.
- If an unavailable action teaches nothing, hide it instead of showing a disabled button.
- Respect existing registered labels such as `Essayer`, `Voir la correction`, `S'entrainer`, `Reprendre`, `Importer PGN`, `Lancer l'analyse`.
- If a mission introduces or uses an action without registry alignment, the mission is incomplete.