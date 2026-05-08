# NeuroChess2 Research Backlog

This backlog parks ambitious ideas that are not in the committed roadmap.
Research items cannot appear in normal UI and cannot drive training until they
are promoted through governance.

Promotion requires:

- Metric Registry entry if it is a metric;
- Action Registry entry if it creates an action;
- Screen Contracts update if it changes UI;
- calibration plan if it drives training;
- Decision Log entry for product direction changes.

## Research Items

### 1. NeuroMonitor 3D full version

- research_id: `research.neuromonitor_3d_full`
- title: NeuroMonitor 3D full version
- status: RESEARCH / not V1 / not user-facing
- description: Rich visual identity for understanding progress and cognitive
  patterns in a spatial view.
- potential_value: strong product identity and memorable progression surface.
- why_not_now: Plan1 says "Neuro" is a metaphor, not direct measurement; Plan2
  prioritizes a calm, actionable Review over spectacular visuals.
- dependencies: stable domain metrics, screen contracts, calibrated signals.
- possible_version: future after 2D validation.
- risk_level: high
- notes: removed from V1 normal UI on 2026-05-03; any future version needs an
  explicit product decision, user testing, calibrated signals, and careful copy.

### 2. Plan Score

- research_id: `research.plan_score`
- title: Plan Score
- description: Evaluate whether a move belongs to a coherent long-term plan.
- potential_value: could make NeuroChess feel deeper than tactics-only review.
- why_not_now: hard to detect honestly without LLM verifier, concept graph, and corpus.
- dependencies: Evidence JSON, concept graph, human labels.
- possible_version: research after evidence contracts stabilize.
- risk_level: high
- notes: must not become a fake strategic percentage.

### 3. Creative Plan Score

- research_id: `research.creative_plan_score`
- title: Creative Plan Score
- description: Score creative but valid plans.
- potential_value: encourages human style and not only engine conformity.
- why_not_now: requires human game database and quality constraint.
- dependencies: plan evaluator, strong corpus, quality labels.
- possible_version: research-only until validated.
- risk_level: high
- notes: registered as research-only metric.

### 4. Originality Score

- research_id: `research.originality_score`
- title: Originality Score
- description: Estimate how rare or surprising a move/plan is.
- potential_value: could explain style and novelty.
- why_not_now: novelty is not quality and can reward bad moves.
- dependencies: large game database, quality filter, opening context.
- possible_version: research-only.
- risk_level: high
- notes: never visible as normal user truth.

### 5. Concept Graph full

- research_id: `research.concept_graph_full`
- title: Concept Graph full
- description: Graph of chess concepts, motifs, and dependencies.
- potential_value: better explanations and transfer mapping.
- why_not_now: needs stable Evidence JSON first.
- dependencies: evidence schema, tagged corpus, taxonomy governance.
- possible_version: future research.
- risk_level: medium
- notes: avoid ontology sprawl.

### 6. PV Contrast Quiz

- research_id: `research.pv_contrast_quiz`
- title: PV Contrast Quiz
- description: Turn played-vs-best branches into interactive quizzes.
- potential_value: strong pedagogy from existing Review evidence.
- why_not_now: interesting but not MVP; current lesson flow must stay simple.
- dependencies: PV Contrast evidence, lesson UI contracts, reveal gate.
- possible_version: future.
- risk_level: medium
- notes: must not overload Learn tab.

### 7. Role Reversal

- research_id: `research.role_reversal`
- title: Role Reversal
- description: Ask the user to find the opponent's refutation or defensive resource.
- potential_value: trains perspective switching.
- why_not_now: high UX complexity and risk of confusing lesson flow.
- dependencies: stable lesson state machine, accepted moves, explanation model.
- possible_version: future training mode.
- risk_level: medium
- notes: action registry required before implementation.

### 8. Syzygy Trainer

- research_id: `research.syzygy_trainer`
- title: Syzygy Trainer
- description: Endgame trainer powered by tablebase-perfect positions.
- potential_value: precise endgame training.
- why_not_now: storage/scope/endgame-specific; not part of current roadmap.
- dependencies: local tablebase configuration, endgame UI contract, storage policy.
- possible_version: future optional advanced module.
- risk_level: medium
- notes: current docs may mention Syzygy as future source type only; no Trainer added.

### 9. Full FSRS Memory Loop

- research_id: `research.full_fsrs_memory_loop`
- title: Full FSRS Memory Loop
- description: Spaced repetition scheduling over chess training items.
- potential_value: long-term retention.
- why_not_now: needs stable training item engine and attempt logging.
- dependencies: training item model, practice result events, retention validation.
- possible_version: future after Learning Engine V1.
- risk_level: medium
- notes: not implemented in V5.4 docs.

### 10. IRT/BKT full model

- research_id: `research.irt_bkt_full_model`
- title: IRT/BKT full model
- description: Formal latent skill model for item difficulty and user mastery.
- potential_value: better predictions and adaptive training.
- why_not_now: needs dense user data.
- dependencies: many attempts, calibrated item domains, validation reports.
- possible_version: future research.
- risk_level: high
- notes: start with simpler Beta model first.

### 11. Time Pressure Trainer

- research_id: `research.time_pressure_trainer`
- title: Time Pressure Trainer
- description: Train decision quality under clock pressure.
- potential_value: practical relevance for blitz/rapid users.
- why_not_now: needs time-control data and attempt timing.
- dependencies: clocks in PGN, practice timing, session UX.
- possible_version: future.
- risk_level: medium
- notes: avoid stress UX before core practice is stable.

### 12. Shapley / causal contribution of moves

- research_id: `research.shapley_causal_moves`
- title: Shapley / causal contribution of moves
- description: Attribute game outcome or review value to individual moves using
  contribution methods.
- potential_value: nuanced explanation of move importance.
- why_not_now: research-heavy and easy to overclaim causality.
- dependencies: formal outcome model, counterfactual framework, corpus.
- possible_version: research-only.
- risk_level: high
- notes: do not use causal language in V1.

### 13. HMM hidden psychological states

- research_id: `research.hmm_hidden_states`
- title: HMM hidden psychological states
- description: Infer hidden state sequences such as tilt or confidence.
- potential_value: could personalize recovery training.
- why_not_now: too speculative and ethically sensitive.
- dependencies: dense behavioral data, validation, careful language.
- possible_version: research-only.
- risk_level: high
- notes: never claim to measure mental state directly.

### 14. Opening intention NLP matching

- research_id: `research.opening_intention_nlp`
- title: Opening intention NLP matching
- description: Compare user-written opening intentions to game outcomes.
- potential_value: helps connect plan and execution.
- why_not_now: needs LLM verifier or robust NLP layer.
- dependencies: intention notes, Evidence JSON, verifier, privacy rules.
- possible_version: future research after evidence governance.
- risk_level: high
- notes: no LLM added by this backlog.

### 15. Cross-user cohorts

- research_id: `research.cross_user_cohorts`
- title: Cross-user cohorts
- description: Compare training outcomes across similar users.
- potential_value: better priors and recommendations.
- why_not_now: requires user base and privacy layer.
- dependencies: accounts, consent, anonymization, cohort validation.
- possible_version: future product research.
- risk_level: high
- notes: local-first product should avoid premature cohort claims.

### 16. Maia-like bots

- research_id: `research.maia_like_bots`
- title: Maia-like bots
- description: Human-like bots that model likely mistakes at specific levels.
- potential_value: useful sparring and prediction baseline.
- why_not_now: requires datasets and model training.
- dependencies: large human game corpora, training infrastructure, evaluation.
- possible_version: future research.
- risk_level: high
- notes: not part of current local Stockfish-based product.

### 17. Estimated Elo probabilistic model

- research_id: `research.estimated_elo_probabilistic`
- title: Estimated Elo probabilistic model
- description: Estimate player strength with uncertainty.
- potential_value: familiar progression signal.
- why_not_now: requires validation layer and can be misleading.
- dependencies: many games, external rating context, calibration reports.
- possible_version: future after public score stability.
- risk_level: high
- notes: never present as official Elo.

### 18. Deep LLM coach

- research_id: `research.deep_llm_coach`
- title: Deep LLM coach
- description: Natural-language coach using structured Evidence JSON.
- potential_value: richer explanation and personalization.
- why_not_now: requires stable Evidence JSON and verifier.
- dependencies: bounded evidence schema, hallucination guard, review contracts.
- possible_version: future research.
- risk_level: high
- notes: no LLM in current mission.

### 19. Neural / brain claims

- research_id: `research.neural_brain_claims`
- title: Neural / brain claims
- description: Claims that NeuroChess measures brain activity or cognition directly.
- potential_value: brand metaphor only.
- why_not_now: must remain metaphorical; no real brain data is measured.
- dependencies: none; mostly a product-language constraint.
- possible_version: never as literal claim.
- risk_level: high
- notes: NeuroScore is not neurological.

### 20. Contextual bandit for training selection

- research_id: `research.contextual_bandit_training`
- title: Contextual bandit for training selection
- description: Learn item selection policy from user attempts.
- potential_value: adaptive personalization.
- why_not_now: needs many attempts and offline evaluation.
- dependencies: stable event logs, counterfactual evaluation, safety constraints.
- possible_version: future after additive ETV V1.
- risk_level: high
- notes: additive priority score is V1 default.

### 21. Position embeddings / graph neural networks

- research_id: `research.position_embeddings_gnn`
- title: Position embeddings / graph neural networks
- description: Learn vector or graph representations of chess positions.
- potential_value: powerful similarity and pattern discovery.
- why_not_now: research-heavy and data-hungry.
- dependencies: large datasets, infrastructure, evaluation tasks.
- possible_version: research-only.
- risk_level: high
- notes: not needed for current Review Coach.

## Final Rule

Research Backlog items cannot be implemented unless promoted to roadmap with:

- Metric Registry entry if metric;
- Action Registry entry if action;
- Screen Contracts update if UI;
- calibration plan if it drives training.

## Rules for future Codex missions

- Any new metric must be added to the Metric Registry.
- Any new action must be added to Action Registry.
- Any new screen or tab must be added to Screen Contracts.
- Any new research idea must be added here if it is not committed roadmap.
- Otherwise the mission is incomplete.
