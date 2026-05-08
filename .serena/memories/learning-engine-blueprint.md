# Learning Engine Blueprint

- Source: `docs/LEARNING_ENGINE_BLUEPRINT.md`. It is a blueprint, not an implementation.
- Learning Engine answers: which exercise is most useful for this user now?
- Intended loop: real game -> Review -> annotations/tags/domains -> training_items -> practice_result_events -> user_skill_model -> additive priority -> recommended plan -> future games -> prediction validation.
- Current Review Practice stores partial attempt events; full training_item, user_skill_model, Transfer Gap, BKT/IRT/FSRS, Memory Loop, LLM coach, and prediction validation are not implemented.
- Future `training_item` needs versioned bounded evidence, accepted moves, domain vector, difficulty proxy, criticality, transfer relevance, memory state.
- Calculation must remain unknown/0 until candidate logs exist.
- V1 ETV/priority is additive, not multiplicative: criticality, weakness match, transfer relevance, difficulty fit, memory need, information gain, fatigue cost, redundancy penalty.
- Prescriptive plans need one clear primary action and autonomy option. Any Learning Engine work must update the blueprint or explicitly supersede it.