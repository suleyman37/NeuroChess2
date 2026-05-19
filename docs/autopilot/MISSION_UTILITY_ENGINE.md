# Mission Utility Engine

The Mission Utility Engine is the OMEGA Model step.

For each candidate mission:

`BaseUtility = Impact * Confidence * BottleneckRelevance * EvidenceValue * LearningValue / max(Cost * Risk, epsilon)`

Bonuses:

- PixelMandateBoost
- NoveltyBonus
- ExternalLeverageBonus
- NightReadinessBonus

Penalties:

- MetaDriftPenalty
- RepeatedFailurePenalty
- UserDependencyPenalty
- LiveWebDependencyPenalty
- EvidenceWeaknessPenalty
- ScopeRiskPenalty

Hard rejects:

- unsafe mission
- road push
- secrets risk
- human verification automation
- unauthorized package changes
- backend or DB risky writes
- no bounded stop condition

A20AU uses deterministic scoring by default. Optional seed and Pareto mode are accepted for future controlled exploration, but no randomness is needed for the current branch.

Current expected winner:

`A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS`

Reason: it has the highest expected pixel value while visual production remains under the next target and human data is absent.
