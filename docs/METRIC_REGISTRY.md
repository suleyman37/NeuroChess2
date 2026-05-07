# NeuroChess2 Metric Registry

This registry is the product governance source of truth for NeuroChess metrics.
Every metric used by the product must be registered here before it is used in UI,
training selection, scoring, reporting, debug panels, or research notes.

## Metric Categories

- `action`: triggers or modifies a training decision.
- `communication`: helps the user understand the game without pretending to be scientific truth.
- `audit`: verifies, calibrates, or debugs the system.
- `research`: may exist as an idea, but must never appear in normal user UI.

## Governance Rules

- An uncalibrated `action` metric must not be shown as truth.
- A `communication` metric may be shown if it is clearly framed as a UX synthesis.
- An `audit` metric may remain available in debug or advanced inspection only.
- A `research` metric must stay in Research Backlog and must not appear in normal UI.
- Every new metric must be added to this Metric Registry before it is used.
- `criticality_score_v1` is an `action` metric.
- `coach_neuro_score_v1` is the product-visible NeuroScore: a coach
  communication metric, not a scientific truth.
- `headline_score_v1` remains the existing implementation family that backs
  the coach score aliases.
- Future Transfer Gap metrics are `action` metrics, visible only when data is sufficient.
- `creative_plan_score_research` and `originality_score_research` are `research_only`.
- `neuro_score_public_v1` is the Lichess-like reference precision score,
  displayed secondarily as `Precision de reference`.
- `neuro_score_diag_v1` and `neuro_severity_raw_v1` are internal/audit
  diagnostic metrics until calibrated.
- `headline_score_v0` is a legacy name; the current user-facing contract should
  call it `coach_neuro_score_v1`.
- Stockfish WDL expected score is a separate audit family and must not be merged
  with Lichess-like Win%.
- Transfer Gap must be Bayesian and uncertainty-aware before it is visible.

## Registry

| metric_id | display_name | purpose | drives_training | visible_user | calibration_status | formula_reference | input_dependencies | minimum_sample_size | known_limitations | current_status | owner_module |
|---|---|---|---|---|---|---|---|---|---|---|---|
| white_percent_v1 | White win percent | communication | false | when_data_sufficient | heuristic_v0 | Engine score converted to white-side winning chances. | eval_cp, mate_score, side_to_move | 1 analyzed position | Heuristic conversion, not an observed win probability. | implemented | evaluation_display |
| win_loss_v1 | Win chance loss | communication | false | when_data_sufficient | heuristic_v0 | Difference between player win percent before and after a move. | white_percent_v1, played_by, fen_before, fen_after | 1 analyzed move | Sensitive to engine depth and tactical instability. | implemented | review_service |
| move_accuracy_lichess_like_v1 | Move accuracy | communication | false | when_data_sufficient | heuristic_v0 | Lichess-like accuracy derived from win chance loss. | win_loss_v1 | 1 analyzed move | Familiar UX proxy, not a calibrated skill measure. | implemented | review_metrics |
| game_accuracy_lichess_like_v1 | Game accuracy | communication | false | when_data_sufficient | heuristic_v0 | Aggregate of move accuracy values for a game/player. | move_accuracy_lichess_like_v1, player_color | 10 half-moves | Can overstate quality in quiet or short games. | implemented | review_metrics |
| criticality_score_v1 | Criticality | action | true | when_data_sufficient | heuristic_v0 | Weighted priority score for selecting review moments. | win_loss_v1, leverage_weight_v1, transition_weight_v1, persistence_weight_v1, reliability_weight_v1 | 10 half-moves | Selection heuristic; not a standalone user truth. | implemented | review_service |
| leverage_weight_v1 | Leverage weight | audit | false | debug_only | heuristic_v0 | Multiplier for how much a move can swing the position. | eval_before, eval_after, win_loss_v1 | 1 analyzed move | Can amplify noisy evaluations. | implemented | review_service |
| transition_weight_v1 | Transition weight | audit | false | debug_only | heuristic_v0 | Multiplier for phase or state transitions around a critical move. | move_number, opening_state, phase_tags | 1 analyzed move | Phase boundaries are heuristic. | implemented | review_service |
| persistence_weight_v1 | Persistence weight | audit | false | debug_only | heuristic_v0 | Multiplier for whether the consequence persists over following moves. | subsequent_evals, pv_stability | 3 analyzed positions | Requires enough post-move evidence. | partial | review_service |
| reliability_weight_v1 | Reliability weight | audit | false | debug_only | heuristic_v0 | Multiplier for engine and evidence confidence. | depth, multipv, pv_available, source_kind | 1 analyzed position | Not a statistical confidence interval. | implemented | review_service |
| review_confidence_v1 | Review confidence | communication | false | when_data_sufficient | heuristic_v0 | Human-readable confidence label for review completeness and evidence quality. | coverage, depth, failed_positions, reliability_weight_v1 | 10 half-moves | Summarizes system state, not chess truth. | implemented | review_state |
| neuro_score_raw_v1 | Raw NeuroChess score | audit | false | debug_only | experimental | Internal composite before UX headline framing. | game_accuracy_lichess_like_v1, diagnostic_gap_v1, domain_scores | 10 half-moves | Legacy naming; prefer `neuro_severity_raw_v1` and `neuro_score_diag_v1` for documented diagnostic math. | partial | review_metrics |
| diagnostic_gap_v1 | Diagnostic gap | audit | false | debug_only | experimental | Difference between generic accuracy and NeuroChess diagnostic assessment. | game_accuracy_lichess_like_v1, neuro_score_raw_v1 | 10 half-moves | Needs corpus validation before product use. | partial | review_metrics |
| headline_score_v1 | NeuroChess headline score | communication | false | debug_only | heuristic_v0 | Existing severity-aware blend used as the implementation family behind coach aliases, currently labeled `headline_neurochess_score_v2`. | neuro_score_raw_v1, game_accuracy_lichess_like_v1, review_confidence_v1 | 10 half-moves | Communication label, not a scientific truth; do not expose as "Headline Score" copy. | implemented | review_metrics |
| coach_neuro_score_v1 | Coach NeuroScore | communication | false | when_data_sufficient | heuristic_v0 | Product-visible coach score backed by `headline_neurochess_score_v2`. | game_accuracy_lichess_like_v1, neuro_score_diag_v1, review_confidence_v1 | 10 half-moves | Severity-aware UX score, not calibrated science and not a training driver. | implemented | ReviewCockpitSummary |
| neuro_score_public_v1 | Reference precision score | communication | false | always | heuristic_v0 | Lichess-like public precision reference, currently `game_accuracy_lichess_like_v1` until exact reference validation. | game_accuracy_lichess_like_v1, review_confidence_v1 | 10 half-moves | Not diagnostic, not neurological, and does not drive training. | implemented | Review summary |
| neuro_severity_raw_v1 | Neuro diagnostic severity | audit | false | debug_only | needs_corpus | Per-move diagnostic loss with persistence and cluster weights. | win_loss_v1, future_player_percents, cluster_memory | 10 half-moves | Internal uncalibrated severity; not a public score. | implemented | review_metrics |
| neuro_score_diag_v1 | NeuroDiagnostic score | audit | false | debug_only | needs_corpus | `100 * exp(-0.035 * Z)` from mean and tail diagnostic loss. | neuro_severity_raw_v1 | 10 half-moves | Internal/audit only; not the public NeuroScore. | implemented | review_metrics |
| headline_score_v0 | Legacy coach score alias | communication | false | debug_only | heuristic_v0 | `0.35 * public_accuracy + 0.65 * diagnostic_score`, with diagnostic-gap fallback. | game_accuracy_lichess_like_v1, neuro_score_diag_v1, diagnostic_gap_v1 | 10 half-moves | Legacy name for the coach score implementation; avoid user-facing "Headline" copy. | partial | review_metrics |
| qualitative_game_label_v1 | Qualitative game label | communication | false | when_data_sufficient | heuristic_v0 | Text label describing the game pattern. | coach_neuro_score_v1, critical moments, domain signals | 10 half-moves | Should remain qualitative and non-absolute. | partial | review_view_model |
| tail_mean_topk_v1 | Tail mean top-k | audit | false | debug_only | heuristic_v0 | Mean of the largest diagnostic losses; current code uses `min(max(3, ceil(0.10*n)), n)`. | neuro_severity_raw_v1, win_loss_v1 | 10 half-moves | Do not call this robust CVaR; not suitable as short-game UI truth. | implemented | review_metrics |
| expected_score_wdl_sfXX_v1 | Stockfish WDL expected score | audit | false | debug_only | experimental | `(W + 0.5 * D) / (W + D + L)` from Stockfish WDL. | Stockfish WDL, Stockfish version | 1 analyzed position | Stockfish-version dependent; different semantics from Lichess-like Win%. | planned | future_audit |
| opening_reality_evidence_v1 | Opening reality evidence | communication | false | when_data_sufficient | heuristic_v0 | Evidence for book exit and first real critical moment. | opening_book, fen_before_exit, linked_moment | 1 opening sequence | Book coverage can be incomplete. | implemented | opening_service |
| pv_contrast_evidence_v1 | PV contrast evidence | communication | false | when_data_sufficient | heuristic_v0 | Stored contrast between played branch and best branch. | played_branch, best_branch, pv_line, multipv | 1 annotated move with PV | Depends on stored PV quality and depth. | implemented | review_service |
| tactical_domain_score_v1 | Tactical domain score | action | true | when_data_sufficient | needs_corpus | Domain score from tactical mistakes and solved practice items. | tactical tags, practice_result_v1, criticality_score_v1 | 20 relevant items | Insufficient samples can mislead. | planned | training_item_engine |
| calculation_domain_score_v1 | Calculation domain score | action | true | when_data_sufficient | needs_corpus | Domain score for calculation depth and line handling. | pv_contrast_evidence_v1, practice_result_v1, error tags | 20 relevant items | Hard to separate from tactical pattern recognition. | planned | training_item_engine |
| conversion_domain_score_v1 | Conversion domain score | action | true | when_data_sufficient | needs_corpus | Domain score for converting advantage. | conversion tags, win_loss_v1, practice_result_v1 | 20 relevant items | Needs repeated advantage positions. | planned | training_item_engine |
| defense_domain_score_v1 | Defense domain score | action | true | when_data_sufficient | needs_corpus | Domain score for defensive decisions. | defensive tags, criticality_score_v1, practice_result_v1 | 20 relevant items | Defensive opportunities are sparse. | planned | training_item_engine |
| opening_domain_score_v1 | Opening domain score | action | true | when_data_sufficient | needs_corpus | Domain score for opening exits and early plans. | opening_reality_evidence_v1, linked moments, practice_result_v1 | 10 opening exits | Must not punish unfamiliar openings without evidence. | planned | training_item_engine |
| practice_result_v1 | Practice result | action | true | always | heuristic_v0 | Result category for a practice attempt. | attempted_uci, best_move_uci, acceptable_moves, candidate_moves/top_moves, stabilized resulting-position eval, legality | 1 attempt | Single attempt is not a skill diagnosis; `playable`/`imprecise` do not change due scheduling in V1. | implemented | review_practice_service |
| revision_due_simple_v1 | Simple revision due signal | action | true | always | heuristic_v0 | V1 due/scheduled count from Practice events, exposed only as simple revision copy. | practice_result_v1, result, hint_used, reveal_used, due_at | 1 attempt | Not FSRS or a mastery estimate; timing is intentionally simple. | implemented | review_practice_service |
| dominant_theme_v1 | Dominant theme | communication | false | when_data_sufficient | heuristic_v0 | Main lesson theme selected from review tags and priorities. | error_type, tags, criticality_score_v1 | 3 annotated moments | May hide secondary issues. | partial | review_view_model |
| transfer_gap_tactical_future | Tactical transfer gap | action | true | when_data_sufficient | needs_corpus | Future gap between review mistakes and later tactical practice performance. | tactical_domain_score_v1, practice history, retention windows | 30 tactical items | Future metric; must stay hidden until calibrated. | planned | future_training_engine |
| transfer_gap_conversion_future | Conversion transfer gap | action | true | when_data_sufficient | needs_corpus | Future gap between conversion lessons and later conversion performance. | conversion_domain_score_v1, practice history, retention windows | 30 conversion items | Future metric; sparse samples likely. | planned | future_training_engine |
| transfer_gap_opening_future | Opening transfer gap | action | true | when_data_sufficient | needs_corpus | Future gap between opening exits and later opening decisions. | opening_domain_score_v1, opening history, practice history | 20 opening items | Needs repeated openings and enough comparable positions. | planned | future_training_engine |
| transfer_gap_defense_future | Defense transfer gap | action | true | when_data_sufficient | needs_corpus | Future gap between defensive review lessons and later defensive play. | defense_domain_score_v1, practice history, retention windows | 30 defense items | Defense samples can be rare and noisy. | planned | future_training_engine |
| transfer_gap_beta_v1 | Bayesian transfer gap | action | true | when_data_sufficient | needs_corpus | Difference between training and practical Beta posteriors by domain. | practice_result_v1, real-game opportunities, domain tags | Domain-specific minimum plus credible interval | Must show uncertainty or `profile in construction`, never a fake precise number. | planned | future_training_engine |
| priority_score_additive_v1 | Training priority score | action | true | never | needs_corpus | Additive ranking score over criticality, weakness match, transfer relevance, difficulty fit, memory need, information gain, fatigue, and redundancy. | criticality_score_v1, domain profile, practice history, context | Calibration corpus plus practice events | Future item ranking only; all terms must be normalized 0-1. | planned | future_training_engine |
| etv_additive_v1 | Expected Training Value | action | true | never | needs_corpus | Additive estimate of item usefulness for the current user and context. | priority_score_additive_v1, user_skill_model | Calibration corpus plus practice events | Do not use multiplicative product as default V1. | planned | future_training_engine |
| creative_plan_score_research | Creative plan score | research | false | never | research_only | Research-only idea for evaluating non-obvious plans. | candidate plans, engine lines, human labels | Corpus required | High risk of false authority and style bias. | research | Research Backlog |
| originality_score_research | Originality score | research | false | never | research_only | Research-only idea for novelty or surprise of a move/plan. | game corpus, opening database, candidate moves | Corpus required | Novelty is not quality; must not guide normal UX. | research | Research Backlog |

## Display Policy

- Normal UI may show only `communication` metrics and calibrated-enough `action` outcomes.
- Training selection may use `action` metrics even when they are not directly displayed.
- Debug and advanced views may show `audit` metrics if they are clearly labeled.
- Research-only metrics must not be exposed outside research documents.

## Rules for future Codex missions

- Any new metric must be added to the Metric Registry.
- Any new action must be added to Action Registry.
- Any new screen or tab must be added to Screen Contracts.
- If a mission introduces or uses a metric without updating this registry, the mission is incomplete.
