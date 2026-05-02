export type Evaluation = {
  white_percent: number;
  black_percent: number;
  label: string;
  is_mate: boolean;
  advantage_side: string;
  magnitude: string;
};

export type EvaluationSource = {
  kind: "shallow" | "live" | "deep" | "calibration" | string;
  depth: number | null;
  time_ms: number | null;
  elapsed_ms?: number | null;
  nodes: number | null;
  nps?: number | null;
  threads?: number | null;
  hash_mb?: number | null;
  multipv?: number | null;
  analysis_profile?: string | null;
  analysis_limit_mode?: string | null;
  engine_version: string;
};

export type BoardEvaluationContext =
  | "live"
  | "historical"
  | "review"
  | "final"
  | "initial";

export type AnalysisByFen = {
  id: number;
  fen: string;
  engine: string;
  engine_version: string;
  depth: number;
  multipv: number;
  analysis_kind: string;
  status: string;
  error_message?: string | null;
  analysis_time_ms?: number | null;
  analysis_json?: {
    eval_cp?: number | null;
    mate_in?: number | null;
    depth?: number | null;
    analysis_time_ms?: number | null;
    engine_version?: string | null;
    eval_source_kind?: string | null;
    stabilized_eval?: {
      final_eval_cp?: number | null;
      final_mate_in?: number | null;
      final_depth?: number | null;
      final_seldepth?: number | null;
      nodes?: number | null;
      time_ms?: number | null;
      reliability_score?: number | null;
      reliability_label?: string | null;
      engine_version?: string | null;
      source_kind?: string | null;
    };
  };
};

export type LiveAnalysisUpdate = {
  type: "analysis_update" | "analysis_stopped" | "analysis_error";
  session_id: string;
  game_id: number | null;
  ply: number | null;
  context?: BoardEvaluationContext | string | null;
  review_moment_id?: string | null;
  fen: string;
  fen_key?: string | null;
  engine_version?: string;
  analysis_kind?: "live";
  analysis_profile?: string | null;
  analysis_limit_mode?: string | null;
  depth?: number | null;
  seldepth?: number | null;
  nodes?: number | null;
  nps?: number | null;
  time_ms?: number | null;
  elapsed_ms?: number | null;
  threads?: number | null;
  hash_mb?: number | null;
  multipv?: number | null;
  uci_analyse_mode?: boolean | null;
  uci_limit_strength?: boolean | null;
  skill_level?: number | string | null;
  syzygy_path_active?: boolean | null;
  eval_cp?: number | null;
  eval_pov_side_to_move_cp?: number | null;
  mate_in?: number | null;
  best_move_uci?: string | null;
  pv?: string[];
  evaluation_display?: Evaluation;
  evaluation_source?: EvaluationSource;
  error_message?: string;
};

export type RecordedMove = {
  id: number;
  game_id: number;
  ply: number;
  fen_before: string;
  uci: string;
  san: string;
  is_player: boolean;
  time_spent: number | null;
  eval_before_cp: number | null;
  eval_after_cp: number | null;
  best_move_uci: string | null;
  cp_loss: number | null;
  classification: string | null;
  created_at: string;
  annotations: string;
};

export type GameMoveHistoryItem = {
  ply: number;
  side_to_move_before: "white" | "black";
  played_uci: string;
  played_san: string;
  fen_before: string;
  fen_after: string;
};

export type GameMoveHistory = {
  game_id: number;
  initial_fen: string;
  current_fen: string;
  status: string;
  moves: GameMoveHistoryItem[];
};

export type PlayedMove = {
  ply: number;
  fen_before: string;
  uci: string;
  san: string;
  fen_after: string;
  turn_after: "white" | "black";
  is_game_over: boolean;
  result: string | null;
};

export type GameState = {
  game_id: number;
  fen: string;
  legal_moves: string[];
  moves: RecordedMove[];
  result: string | null;
  is_game_over: boolean;
  evaluation: Evaluation | null;
  evaluation_display: Evaluation | null;
  evaluation_source: EvaluationSource | null;
  live_analysis_session_id: string | null;
  fen_after: string | null;
  warnings: string[];
  move?: PlayedMove | null;
  game?: Record<string, unknown> | null;
};

export type ReviewMoment = {
  id?: number;
  ply: number;
  played_by: "white" | "black" | string;
  played_san: string | null;
  played_uci: string;
  best_move_uci: string | null;
  best_move_san: string | null;
  eval_before_cp: number | null;
  eval_after_cp: number | null;
  eval_before_label: string;
  eval_after_label: string;
  mate_before: number | null;
  mate_after: number | null;
  cp_loss: number;
  cp_loss_label: string;
  importance_score: number;
  mover_win_loss?: number;
  criticality_score?: number;
  moment_type?:
    | "turning_point"
    | "lost_advantage"
    | "aggravation"
    | "decisive"
    | "standard_loss"
    | string;
  zone_before?: string;
  zone_after?: string;
  zone_transition?: string;
  eval_source_kind?: "deep" | string;
  eval_depth_before?: number | null;
  eval_depth_after?: number | null;
  player_percent_before?: number;
  player_percent_after?: number;
  reliability_score: number;
  reliability_label: string;
  review_type: "player_loss" | string;
  comment: string;
  fen_before: string;
  fen_after: string;
  top_moves: Array<Record<string, unknown>>;
};

export type ReviewMoveAnnotation = {
  ply: number;
  move_number: number;
  color: "white" | "black" | string;
  side?: "white" | "black" | string;
  san: string | null;
  uci: string;
  fen_before: string;
  fen_after: string;
  primary_category:
    | "book"
    | "best"
    | "excellent"
    | "very_good"
    | "good"
    | "playable"
    | "inexact"
    | "to_review"
    | "critical"
    | "decisive"
    | "unknown"
    | string;
  category_label: string;
  tags: string[];
  tag_labels?: string[];
  reason?: string;
  win_loss: number | null;
  move_accuracy: number | null;
  lichess_like_move_accuracy?: number | null;
  neuro_diagnostic_loss?: number | null;
  criticality_score: number | null;
  missed_gain?: number | null;
  player_win_percent_before?: number | null;
  player_win_percent_after?: number | null;
  player_percent_before?: number | null;
  player_percent_after?: number | null;
  best_move_uci?: string | null;
  best_move_san?: string | null;
  top_moves?: Array<Record<string, unknown>>;
  try_move_supported?: boolean;
  acceptable_moves?: ReviewAcceptableMove[];
  pv_line?: ReviewPvLineMove[];
  pv_line_available?: boolean;
  pv_line_message?: string | null;
  try_move_model_version?: string | null;
  evidence_available: boolean;
  included_in_score?: boolean;
  exclusion_reason?: string | null;
  section_priority?: number | null;
  pedagogical_explanation?: PedagogicalExplanation | null;
  pedagogical_explanation_version?: string | null;
  contrast_coach_explanation?: ContrastCoachExplanation | null;
  contrast_coach_explanation_version?: string | null;
  coach_priority_rank?: number | null;
  impact_label?: string | null;
  move_quality_label?: string | null;
  coach_card_title?: string | null;
  compact_label?: string | null;
  context_previous_move?: string | null;
  context_start_fen?: string | null;
  move_category_formula_version?: string | null;
  pv_contrast_evidence?: PvContrastEvidence | null;
  pv_contrast_evidence_version?: string | null;
};

export type ReviewAcceptableMove = {
  uci: string;
  san?: string | null;
  quality: "best" | "very_good" | "acceptable" | string;
  delta_from_best_win_percent: number | null;
};

export type ReviewPvLineMove = {
  ply_offset: number;
  uci: string;
  san?: string | null;
  fen_after: string;
};

export type PvContrastBranch = {
  start_fen?: string | null;
  played_move_uci?: string | null;
  played_move_san?: string | null;
  after_played_fen?: string | null;
  opponent_best_reply_uci?: string | null;
  opponent_best_reply_san?: string | null;
  best_move_uci?: string | null;
  best_move_san?: string | null;
  pv?: ReviewPvLineMove[];
  final_fen?: string | null;
  line_length?: number;
  summary_signals?: Record<string, unknown>;
};

export type PvContrastEvidence = {
  schema_version?: string | null;
  pv_contrast_evidence_version?: string | null;
  available: boolean;
  played_branch?: PvContrastBranch;
  best_branch?: PvContrastBranch;
  contrast?: {
    main_difference_type?: string | null;
    played_move_nature?: string | null;
    best_move_nature?: string | null;
    played_branch_risk?: string | null;
    best_branch_benefit?: string | null;
    safe_explanation_bullets?: string[];
    llm_safe_facts?: string[];
  };
  confidence?: "low" | "medium" | "high" | string;
  missing_data?: string[];
};

export type ContrastCoachExplanation = {
  schema_version?: string | null;
  contrast_coach_explanation_version?: string | null;
  available?: boolean;
  what_happened_after_played?: string | null;
  why_solution_is_better?: string | null;
  main_difference?: string | null;
  main_difference_type?: string | null;
  main_difference_label?: string | null;
  line_explanation?: string | null;
  safe_takeaway?: string | null;
  confidence?: "low" | "medium" | "high" | string;
  played_line_preview?: string | null;
  best_line_preview?: string | null;
  missing_data?: string[];
};

export type PedagogicalExplanation = {
  pedagogical_explanation_version?: string | null;
  error_type:
    | "tactical"
    | "positional"
    | "conversion"
    | "defensive"
    | "cluster"
    | "opening_transition"
    | "strong_find"
    | "unknown"
    | string;
  time_horizon: "immediate" | "short_term" | "long_term" | "unknown" | string;
  main_message: string;
  missed_idea: string;
  why_played_move_bad: string;
  why_best_move_good: string;
  training_takeaway: string;
  confidence: "low" | "medium" | "high" | string;
};

export type ReviewSections = {
  to_review: ReviewMoveAnnotation[];
  strong_moves: ReviewMoveAnnotation[];
  missed_opportunities: ReviewMoveAnnotation[];
  all: ReviewMoveAnnotation[];
};

export type OpeningRealityMoment = {
  ply: number | null;
  move_number?: number | null;
  move_san?: string | null;
  move_uci?: string | null;
  color?: "white" | "black" | string | null;
  category?: string | null;
  category_label?: string | null;
  tags?: string[];
  win_loss?: number | null;
  impact_label?: string | null;
  reason?: string | null;
};

export type OpeningRealityEvidence = {
  schema_version?: string | null;
  opening_reality_evidence_version?: string | null;
  available: boolean;
  status:
    | "available"
    | "not_applicable_from_position"
    | "missing_data"
    | string;
  opening_name?: string | null;
  eco?: string | null;
  source?: "local_book" | "lichess_book" | "unknown" | string;
  book_until_ply?: number | null;
  last_book_ply?: number | null;
  last_book_move_san?: string | null;
  last_book_move_uci?: string | null;
  last_book_fen?: string | null;
  out_of_book_ply?: number | null;
  out_of_book_move_san?: string | null;
  out_of_book_move_uci?: string | null;
  out_of_book_fen?: string | null;
  exit_ply?: number | null;
  exit_move_san?: string | null;
  exit_move_uci?: string | null;
  fen_before_exit?: string | null;
  fen_after_exit?: string | null;
  move_number_exit?: number | null;
  exit_color?: "white" | "black" | string | null;
  side_to_move_at_exit?: "white" | "black" | string | null;
  critical_moment_after_exit?: OpeningRealityMoment | null;
  first_loss_after_exit?: OpeningRealityMoment | null;
  summary?: string | null;
  recommendation?: string | null;
  confidence?: "low" | "medium" | "high" | string;
  missing_data?: string[];
  search_window_after_exit_plies?: number | null;
  significant_loss_threshold?: number | null;
};

export type ReviewPracticePov = "user" | "white" | "black" | "both" | string;

export type ReviewPracticeScope = "top_priority" | "all_to_review" | string;

export type ReviewPracticeResult =
  | "best"
  | "very_good"
  | "acceptable"
  | "wrong"
  | "illegal"
  | "attempted"
  | "skipped"
  | "revealed"
  | string;

export type ReviewPracticeItem = {
  game_id?: number | null;
  ply: number;
  move_number: number | null;
  color: "white" | "black" | string;
  san: string | null;
  uci?: string | null;
  fen_before: string;
  fen_after?: string | null;
  best_move_uci: string;
  best_move_san?: string | null;
  acceptable_moves: ReviewAcceptableMove[];
  pedagogical_explanation?: PedagogicalExplanation | null;
  contrast_coach_explanation?: ContrastCoachExplanation | null;
  impact_label?: string | null;
  move_quality_label?: string | null;
  primary_category: string;
  category_label?: string | null;
  tags: string[];
  tag_labels?: string[];
  pv_line?: ReviewPvLineMove[];
  pv_line_available?: boolean;
  pv_line_message?: string | null;
  pv_contrast_evidence?: PvContrastEvidence | null;
  try_move_supported: boolean;
  win_loss?: number | null;
  move_accuracy?: number | null;
  coach_priority_rank?: number | null;
  compact_label?: string | null;
  coach_card_title?: string | null;
};

export type ReviewPracticeSummary = {
  session_id?: number | string;
  status?: "running" | "completed" | "abandoned" | string;
  item_count: number;
  positions_worked_count: number;
  best_count?: number;
  very_good_count?: number;
  acceptable_count?: number;
  correct_count: number;
  partial_count: number;
  wrong_count: number;
  illegal_count?: number;
  revealed_count: number;
  skipped_count: number;
  attempt_count: number;
  completed_at?: string | null;
  schema_version?: string | null;
  dominant_theme?: string | null;
  dominant_theme_label?: string | null;
  theme?: string | null;
  summary_sentence?: string | null;
  message?: string | null;
  retry_failed_available?: boolean;
  failed_plies?: number[];
  failed_count?: number;
  result_by_ply?: Record<string, ReviewPracticeResult>;
  attempt_feedback?: ReviewPracticeAttemptFeedback | null;
  latest_attempt?: Partial<ReviewPracticeAttempt> | null;
};

export type ReviewPracticeAttemptFeedback = {
  result: ReviewPracticeResult;
  message: string;
  show_best_move: boolean;
  attempted_uci?: string | null;
  attempted_san?: string | null;
  best_move_uci?: string | null;
  best_move_san?: string | null;
  try_move_model_version?: string | null;
  evidence?: Record<string, unknown>;
};

export type ReviewPracticeAttempt = {
  id: number;
  session_id: number;
  game_id: number;
  ply: number;
  color: string;
  attempted_uci?: string | null;
  attempted_san?: string | null;
  expected_best_uci?: string | null;
  result: ReviewPracticeResult;
  attempt_number: number;
  created_at: string;
};

export type ReviewPracticeSessionResponse = {
  session_id: number | string;
  game_id: number;
  review_id?: number | null;
  pov: ReviewPracticePov;
  scope: ReviewPracticeScope;
  status: "running" | "completed" | "abandoned" | string;
  schema_version?: string | null;
  item_count: number;
  items: ReviewPracticeItem[];
  summary: ReviewPracticeSummary;
  attempts?: ReviewPracticeAttempt[];
};

export type ReviewPracticeSessionListItem = Omit<
  ReviewPracticeSessionResponse,
  "items"
> & {
  items?: ReviewPracticeItem[];
};

export type ReviewPracticeSessionListResponse = {
  game_id: number;
  sessions: ReviewPracticeSessionListItem[];
};

export type ReviewResponse = {
  game_id: number;
  status:
    | "not_generated"
    | "not_reviewable"
    | "pending"
    | "done"
    | "partial"
    | "failed"
    | "stalled"
    | "incomplete"
    | string;
  reason?: "game_too_short" | string;
  min_half_moves?: number;
  actual_half_moves?: number;
  half_moves_count?: number;
  min_half_moves_for_review?: number;
  reviewable?: boolean;
  empty_reason?: "game_too_short" | "no_significant_moments" | string | null;
  missing_deep_count?: number;
  analyzed_deep_count?: number;
  total_required_deep_count?: number;
  scheduled_deep_count?: number;
  failed_deep_count?: number;
  failed_deep_details?: Array<{
    fen: string;
    error_message?: string | null;
    status: string;
    analysis_kind: string;
    engine?: string | null;
    engine_version?: string | null;
    depth?: number | null;
    multipv?: number | null;
    schema_version?: string | null;
    created_at?: string | null;
    completed_at?: string | null;
  }>;
  review_work_active?: boolean;
  review_schema_version: string;
  selection_algorithm_version: string;
  coverage: number;
  white_review_score: number | null;
  black_review_score: number | null;
  user_color?: "white" | "black" | string | null;
  user_review_score: number | null;
  opponent_review_score: number | null;
  white_lichess_like_accuracy?: number | null;
  black_lichess_like_accuracy?: number | null;
  user_lichess_like_accuracy?: number | null;
  opponent_lichess_like_accuracy?: number | null;
  white_public_neuro_score?: number | null;
  black_public_neuro_score?: number | null;
  user_public_neuro_score?: number | null;
  opponent_public_neuro_score?: number | null;
  public_neuro_score?: number | null;
  public_score_formula_version?: string | null;
  qualitative_game_label?: string | null;
  qualitative_game_label_formula_version?: string | null;
  white_coach_neuro_score?: number | null;
  black_coach_neuro_score?: number | null;
  user_coach_neuro_score?: number | null;
  opponent_coach_neuro_score?: number | null;
  coach_neuro_score?: number | null;
  coach_score_formula_version?: string | null;
  white_neuro_score?: number | null;
  black_neuro_score?: number | null;
  user_neuro_score?: number | null;
  opponent_neuro_score?: number | null;
  white_diagnostic_gap?: number | null;
  black_diagnostic_gap?: number | null;
  user_diagnostic_gap?: number | null;
  opponent_diagnostic_gap?: number | null;
  white_headline_neurochess_score?: number | null;
  black_headline_neurochess_score?: number | null;
  user_headline_neurochess_score?: number | null;
  opponent_headline_neurochess_score?: number | null;
  headline_neurochess_score?: number | null;
  headline_score_subject?: "user" | "white" | "black" | string | null;
  headline_score_formula_version?: string | null;
  review_summary_sentence?: string | null;
  score_availability?: ReviewScoreAvailability | null;
  review_score_deprecated?: boolean;
  review_score_alias_of?: "lichess_like_accuracy" | string | null;
  review_score_confidence: "high" | "medium" | "low" | string | null;
  score_formula_version?: string | null;
  move_accuracy_formula_version?: string | null;
  game_accuracy_formula_version?: string | null;
  neuro_score_formula_version?: string | null;
  formula_versions?: Record<string, string>;
  move_category_formula_version?: string | null;
  review_sections_version?: string | null;
  pedagogical_explanation_version?: string | null;
  contrast_coach_explanation_version?: string | null;
  pv_contrast_evidence_version?: string | null;
  opening_reality_evidence_version?: string | null;
  try_move_model_version?: string | null;
  score_analyzed_moves_white: number;
  score_analyzed_moves_black: number;
  score_missing_moves_white: number;
  score_missing_moves_black: number;
  deep_coverage: number | null;
  required_position_count?: number;
  deep_done_count?: number;
  deep_missing_count?: number;
  deep_failed_count?: number;
  review_analysis_origin?:
    | "cached_full"
    | "cached_partial"
    | "newly_computed"
    | "newly_scheduled"
    | "insufficient"
    | "failed"
    | "unknown"
    | string;
  review_analysis_state?:
    | "ready"
    | "partial"
    | "pending"
    | "failed"
    | "insufficient"
    | "incomplete"
    | string;
  review_analysis_quality?: "cached" | "fast" | "standard" | "deep" | string;
  review_analysis_profile?: "cached" | "quick" | "standard" | "deep" | string;
  review_score_profile?: "cached" | "quick" | "standard" | "deep" | string;
  analysis_profile_used?: "quick" | "standard" | "deep" | string | null;
  completed_position_count?: number;
  pending_position_count?: number;
  failed_position_count?: number;
  total_budget_seconds?: number;
  elapsed_seconds?: number;
  estimated_remaining_seconds?: number;
  per_position_time_ms?: number;
  analysis_limit_mode?:
    | "depth"
    | "time"
    | "time_with_max_depth"
    | "mixed"
    | string
    | null;
  requested_multipv?: number | null;
  analysis_threads?: number | null;
  analysis_hash_mb?: number | null;
  uci_analyse_mode?: boolean | null;
  uci_limit_strength?: boolean | null;
  skill_level?: number | string | null;
  syzygy_path_active?: boolean | null;
  average_depth_reached?: number | null;
  min_depth_reached?: number | null;
  max_depth_reached?: number | null;
  cache_hits?: number;
  cache_misses?: number;
  legacy_cache_ignored_count?: number;
  number_of_moves_white?: number;
  number_of_moves_black?: number;
  white_score_debug?: ReviewScoreDebug | null;
  black_score_debug?: ReviewScoreDebug | null;
  review_score_audit_rows?: ReviewScoreAuditRow[];
  move_annotations?: ReviewMoveAnnotation[];
  review_sections?: ReviewSections;
  opening_reality_evidence?: OpeningRealityEvidence | null;
  message: string | null;
  warnings: string[];
  moments: ReviewMoment[];
};

export type ReviewJobStatus =
  | "queued"
  | "running"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled"
  | "incomplete"
  | "stalled"
  | string;

export type ReviewJobResponse = {
  job_id: string;
  game_id: number;
  status: ReviewJobStatus;
  profile: "quick" | "standard" | "deep" | string;
  required_position_count: number;
  completed_position_count: number;
  failed_position_count: number;
  percent: number;
  current_fen_index: number;
  total_budget_seconds: number;
  per_position_time_ms: number;
  elapsed_seconds: number;
  estimated_remaining_seconds: number;
  can_cancel: boolean;
  force_reanalysis: boolean;
  error_message?: string | null;
  failed_reason?: string | null;
  last_error?: string | null;
  retryable?: boolean;
  heartbeat_at?: string | null;
  last_progress_at?: string | null;
  current_fen_key?: string | null;
  current_phase?: string | null;
  stalled_reason?: string | null;
  current_position_started_at?: string | null;
  attempts_for_current_position?: number;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  settings?: Record<string, unknown>;
  review_pipeline_version?: string | null;
  derived_is_stale?: boolean;
  derived_needs_reconcile?: boolean;
  can_reconcile?: boolean;
  derived_reconcile_reason?: string | null;
};

export type ReviewJobDiagnostics = {
  job_id: string;
  game_id: number;
  status: ReviewJobStatus | string;
  profile: "quick" | "standard" | "deep" | string;
  retryable?: boolean;
  stalled_reason?: string | null;
  error_message?: string | null;
  current_phase?: string | null;
  current_fen_key?: string | null;
  current_fen_index?: number;
  required_position_count?: number;
  completed_position_count_stored?: number;
  valid_analysis_count?: number;
  missing_fens_count?: number;
  failed_fens_count?: number;
  running_fens_count?: number;
  pending_fens_count?: number;
  heartbeat_at?: string | null;
  last_progress_at?: string | null;
  current_position_started_at?: string | null;
  attempts_for_current_position?: number;
  total_budget_seconds?: number;
  per_position_time_ms?: number;
  engine_settings?: Record<string, unknown>;
  cache_quality_gate_summary?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  last_events?: unknown[];
  derived_is_stale?: boolean;
  derived_needs_reconcile?: boolean;
  can_reconcile?: boolean;
  derived_reconcile_reason?: string | null;
};

export type ReviewScoreAvailabilityStatus =
  | "available"
  | "missing_data"
  | "insufficient_moves"
  | "legacy_needs_rebuild"
  | "missing_dependency"
  | string;

export type ReviewScoreAvailabilitySide = {
  lichess_like: ReviewScoreAvailabilityStatus;
  neuro_score: ReviewScoreAvailabilityStatus;
  diagnostic_gap: ReviewScoreAvailabilityStatus;
  reason?: string | null;
  move_count_analyzed?: number;
};

export type ReviewScoreAvailability = {
  lichess_like: ReviewScoreAvailabilityStatus;
  neuro_score: ReviewScoreAvailabilityStatus;
  diagnostic_gap: ReviewScoreAvailabilityStatus;
  reason?: string | null;
  white?: ReviewScoreAvailabilitySide;
  black?: ReviewScoreAvailabilitySide;
};

export type ReviewScoreDebug = {
  analyzed_moves: number;
  missing_moves: number;
  avg_win_loss: number | null;
  max_win_loss: number | null;
  weighted_mean: number | null;
  weighted_harmonic: number | null;
  worst_tail: number | null;
  score_cap: number | null;
  raw_score: number | null;
  final_score: number | null;
  lichess_like_accuracy?: number | null;
  neuro_score?: number | null;
  diagnostic_gap?: number | null;
  mean_win_loss?: number | null;
  tail_win_loss?: number | null;
  mean_diagnostic_loss?: number | null;
  tail_diagnostic_loss?: number | null;
  tail_count?: number | null;
  z_value?: number | null;
  volatility_window_size?: number | null;
  volatility_weights?: number[];
  formula_versions?: Record<string, string>;
  confidence: "high" | "medium" | "low" | string;
  depth_min?: number | null;
  depth_max?: number | null;
  depth_avg?: number | null;
  engine_versions?: string[];
};

export type ReviewScoreAuditRow = {
  ply: number;
  side: "white" | "black" | string;
  san: string | null;
  uci: string;
  eval_before_cp: number | null;
  mate_before: number | null;
  eval_after_cp: number | null;
  mate_after: number | null;
  white_percent_before: number | null;
  white_percent_after: number | null;
  player_percent_before: number | null;
  player_percent_after: number | null;
  win_loss: number | null;
  move_accuracy: number | null;
  lichess_like_move_accuracy?: number | null;
  neuro_diagnostic_loss?: number | null;
  persistence_weight?: number | null;
  cluster_weight?: number | null;
  omega_weight?: number | null;
  criticality_score: number | null;
  move_weight: number | null;
  review_evidence?: Record<string, unknown>;
  included_in_score: boolean;
  exclusion_reason: string | null;
  analysis_kind_before: string | null;
  analysis_kind_after: string | null;
  depth_before: number | null;
  depth_after: number | null;
  source_before: string | null;
  source_after: string | null;
  analysis_profile_before?: string | null;
  analysis_profile_after?: string | null;
  requested_time_ms_before?: number | null;
  requested_time_ms_after?: number | null;
  analysis_limit_mode_before?: string | null;
  analysis_limit_mode_after?: string | null;
  engine_version_before: string | null;
  engine_version_after: string | null;
};

export type OpeningClassification = {
  game_id: number;
  line_id: number | null;
  opening_name: string | null;
  eco_code: string | null;
  matched_plies: number;
  last_book_ply: number | null;
  out_of_book_ply: number | null;
  out_of_book_color: "white" | "black" | null;
  out_of_book_fen: string | null;
  confidence: string;
  classification_status: "matched" | "partial" | "unknown" | "failed" | string;
};

export type PgnImportPreview = {
  game_count: number;
  valid_count: number;
  invalid_count: number;
  duplicate_count: number;
  detected_players: string[];
  needs_user_alias: boolean;
  sample_games: Array<{
    white: string | null;
    black: string | null;
    date: string | null;
    result: string | null;
    time_control: string | null;
    eco: string | null;
    opening: string | null;
    source_platform?: string | null;
    variant?: string | null;
    is_special_position?: boolean;
  }>;
  errors: string[];
};

export type PgnImportResult = {
  status: "ok" | string;
  imported_count: number;
  duplicate_count: number;
  invalid_count: number;
  classified_count: number;
  warnings: string[];
  imported_game_ids: number[];
  repaired_count?: number;
  repaired_game_ids?: number[];
  import_schema_version?: string | null;
};

export type GameDiagnostics = {
  local_game_id: number;
  external_source: string | null;
  external_game_id: string | null;
  source_url: string | null;
  variant: string | null;
  initial_fen: string;
  is_initial_fen_standard: boolean;
  current_position_fen?: string | null;
  import_status: string;
  import_warnings: string[];
  import_error?: string | null;
  import_schema_version?: string | null;
  move_count: number;
  first_move_san?: string | null;
  last_move_san?: string | null;
  first_fen_before?: string | null;
  last_fen_after?: string | null;
  opening_status: string;
  can_open: boolean;
  can_analyze: boolean;
  replay_from_initial_fen_ok: boolean;
  replay_error_ply?: number | null;
  replay_error_san?: string | null;
  replay_error_fen_before?: string | null;
  replay_error_message?: string | null;
  history_payload_ok: boolean;
  review_start_ok_if_fake_engine: boolean;
};

export type GameHistoryItem = {
  game_id: number;
  game_category:
    | "local_manual"
    | "local_ai"
    | "imported_user"
    | "imported_observed"
    | "analysis_sandbox"
    | "unknown"
    | string;
  opponent_type: "human" | "engine" | "bot" | "self" | "unknown" | string | null;
  source: string | null;
  source_platform: string | null;
  source_url: string | null;
  source_game_id?: string | null;
  initial_fen?: string | null;
  current_position_fen?: string | null;
  variant?: string | null;
  import_status?: string | null;
  import_warnings?: string[];
  import_error?: string | null;
  import_schema_version?: string | null;
  is_special_position?: boolean;
  date_played: string | null;
  white_name: string | null;
  black_name: string | null;
  display_title: string;
  display_subtitle: string;
  user_color: "white" | "black" | string | null;
  opponent_name: string | null;
  result: string | null;
  result_from_user_pov: "win" | "loss" | "draw" | "unknown" | string | null;
  white_elo: number | null;
  black_elo: number | null;
  time_control: string | null;
  time_control_category: "bullet" | "blitz" | "rapid" | "classical" | "unknown" | string;
  move_count: number;
  opening_name: string | null;
  eco_code: string | null;
  classification_status: "matched" | "partial" | "unknown" | "failed" | string;
  review_status: string | null;
  review_summary_status:
    | "review_available"
    | "not_analyzed"
    | "analysis_in_progress"
    | "no_significant_moments"
    | "too_short"
    | "analysis_failed"
    | string;
  is_reviewable: boolean;
  metadata_quality: "complete" | "partial" | "poor" | string;
};

export type StartLiveAnalysisResponse = {
  session_id: string;
  fen: string;
  context: BoardEvaluationContext | string;
  status: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;

    try {
      const payload = await response.json();
      message = payload.detail ?? payload.message ?? payload.reason ?? message;
    } catch {
      // Keep the HTTP fallback message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function createGame(): Promise<GameState> {
  return request<GameState>("/games", {
    method: "POST",
    body: JSON.stringify({
      mode: "classic",
      opponent_type: "none",
      opponent_level: null,
    }),
  });
}

export function playMove(
  gameId: number,
  uci: string,
): Promise<GameState> {
  return request<GameState>(`/games/${gameId}/moves`, {
    method: "POST",
    body: JSON.stringify({
      uci,
      is_player: true,
      time_spent: null,
    }),
  });
}

export function finishGame(gameId: number): Promise<GameState> {
  return request<GameState>(`/games/${gameId}/finish`, {
    method: "POST",
    body: JSON.stringify({ result: "*" }),
  });
}

export function getGameMoves(gameId: number): Promise<GameMoveHistory> {
  return request<GameMoveHistory>(`/games/${gameId}/moves`);
}

export function getGame(gameId: number): Promise<GameState> {
  return request<GameState>(`/games/${gameId}`);
}

export function getGameDiagnostics(gameId: number): Promise<GameDiagnostics> {
  return request<GameDiagnostics>(`/games/${gameId}/diagnostics`);
}

export function generateReview(
  gameId: number,
  options: {
    forceRetryFailed?: boolean;
    profile?: "quick" | "standard" | "deep" | string;
  } = {},
): Promise<ReviewResponse> {
  const params = new URLSearchParams();
  if (options.forceRetryFailed) {
    params.set("force_retry_failed", "true");
  }
  if (options.profile) {
    params.set("profile", options.profile);
  }
  const query = params.toString();
  return request<ReviewResponse>(
    `/games/${gameId}/review/generate${query ? `?${query}` : ""}`,
    {
      method: "POST",
    },
  );
}

export function getReview(
  gameId: number,
  options: { profile?: "quick" | "standard" | "deep" | string } = {},
): Promise<ReviewResponse> {
  const params = new URLSearchParams();
  if (options.profile) {
    params.set("profile", options.profile);
  }
  const query = params.toString();
  return request<ReviewResponse>(
    `/games/${gameId}/review${query ? `?${query}` : ""}`,
  );
}

export function rebuildReviewMetrics(
  gameId: number,
  options: { profile?: "quick" | "standard" | "deep" | string } = {},
): Promise<ReviewResponse> {
  const params = new URLSearchParams();
  if (options.profile) {
    params.set("profile", options.profile);
  }
  const query = params.toString();
  return request<ReviewResponse>(
    `/games/${gameId}/review/rebuild-metrics${query ? `?${query}` : ""}`,
    {
      method: "POST",
    },
  );
}

export function startReviewPracticeSession(
  gameId: number,
  options: {
    pov?: ReviewPracticePov;
    scope?: ReviewPracticeScope;
    maxItems?: number;
  } = {},
): Promise<ReviewPracticeSessionResponse> {
  return request<ReviewPracticeSessionResponse>(
    `/games/${gameId}/review/practice/sessions`,
    {
      method: "POST",
      body: JSON.stringify({
        pov: options.pov ?? "user",
        scope: options.scope ?? "top_priority",
        max_items: options.maxItems ?? 5,
      }),
    },
  );
}

export function getReviewPracticeSessions(
  gameId: number,
): Promise<ReviewPracticeSessionListResponse> {
  return request<ReviewPracticeSessionListResponse>(
    `/games/${gameId}/review/practice/sessions`,
  );
}

export function getReviewPracticeSession(
  sessionId: number | string,
): Promise<ReviewPracticeSessionResponse> {
  return request<ReviewPracticeSessionResponse>(
    `/review/practice/sessions/${sessionId}`,
  );
}

export function recordReviewPracticeAttempt(
  sessionId: number | string,
  payload: {
    ply: number;
    attemptedUci?: string | null;
    result?: ReviewPracticeResult | null;
  },
): Promise<ReviewPracticeSummary> {
  const body: {
    ply: number;
    attempted_uci: string | null;
    result?: ReviewPracticeResult | null;
  } = {
    ply: payload.ply,
    attempted_uci: payload.attemptedUci ?? null,
  };
  if (payload.result !== undefined) {
    body.result = payload.result;
  }
  return request<ReviewPracticeSummary>(
    `/review/practice/sessions/${sessionId}/attempts`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function abandonReviewPracticeSession(
  sessionId: number | string,
): Promise<ReviewPracticeSummary> {
  return request<ReviewPracticeSummary>(
    `/review/practice/sessions/${sessionId}/abandon`,
    {
      method: "POST",
    },
  );
}

export function retryFailedReviewPracticeSession(
  sessionId: number | string,
): Promise<ReviewPracticeSessionResponse> {
  return request<ReviewPracticeSessionResponse>(
    `/review/practice/sessions/${sessionId}/retry-failed`,
    {
      method: "POST",
    },
  );
}

export function completeReviewPracticeSession(
  sessionId: number | string,
): Promise<ReviewPracticeSummary> {
  return request<ReviewPracticeSummary>(
    `/review/practice/sessions/${sessionId}/complete`,
    {
      method: "POST",
    },
  );
}

export function startReviewJob(
  gameId: number,
  options: {
    profile?: "quick" | "standard" | "deep" | string;
    forceReanalysis?: boolean;
  } = {},
): Promise<ReviewJobResponse> {
  return request<ReviewJobResponse>(`/games/${gameId}/review/jobs`, {
    method: "POST",
    body: JSON.stringify({
      profile: options.profile ?? "standard",
      force_reanalysis: options.forceReanalysis === true,
    }),
  });
}

export function getReviewJob(jobId: string): Promise<ReviewJobResponse> {
  return request<ReviewJobResponse>(`/review/jobs/${jobId}`);
}

export function getReviewJobDiagnostics(jobId: string): Promise<ReviewJobDiagnostics> {
  return request<ReviewJobDiagnostics>(`/review/jobs/${jobId}/diagnostics`);
}

export function reconcileReviewJob(jobId: string): Promise<ReviewJobResponse> {
  return request<ReviewJobResponse>(`/review/jobs/${jobId}/reconcile`, {
    method: "POST",
  });
}

export function cancelReviewJob(jobId: string): Promise<ReviewJobResponse> {
  return request<ReviewJobResponse>(`/review/jobs/${jobId}/cancel`, {
    method: "POST",
  });
}

export function previewPgnImport(payload: {
  pgnText: string;
  file?: File | null;
}): Promise<PgnImportPreview> {
  return requestPgnImport<PgnImportPreview>("/games/import-pgn/preview", payload);
}

export function importPgnGames(payload: {
  pgnText: string;
  file?: File | null;
  userAlias?: string | null;
  platform?: string | null;
}): Promise<PgnImportResult> {
  return requestPgnImport<PgnImportResult>("/games/import-pgn", payload);
}

export function getGameHistory(
  limit = 50,
  offset = 0,
  scope = "mine",
): Promise<GameHistoryItem[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    scope,
  });
  return request<GameHistoryItem[]>(`/games/history?${params.toString()}`);
}

export function getAnalysisByFen(
  fen: string,
  kind = "deep",
): Promise<AnalysisByFen> {
  const params = new URLSearchParams({ fen, kind });
  return request<AnalysisByFen>(`/analyses/by-fen?${params.toString()}`);
}

export function getGameOpening(gameId: number): Promise<OpeningClassification> {
  return request<OpeningClassification>(`/games/${gameId}/opening`);
}

export function classifyGameOpening(gameId: number): Promise<OpeningClassification> {
  return request<OpeningClassification>(`/games/${gameId}/opening/classify`, {
    method: "POST",
  });
}

export function importOpeningBook(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/openings/import-book", {
    method: "POST",
  });
}

export function startLiveAnalysis(payload: {
  fen: string;
  context: BoardEvaluationContext;
  game_id?: number | null;
  ply?: number | null;
  review_moment_id?: string | null;
}): Promise<StartLiveAnalysisResponse> {
  return request<StartLiveAnalysisResponse>("/live-analysis/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function stopLiveAnalysis(sessionId: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/live-analysis/stop", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export function liveAnalysisStreamUrl(sessionId: string): string {
  const params = new URLSearchParams({ session_id: sessionId });
  return `${API_BASE_URL}/live-analysis/stream?${params.toString()}`;
}

async function requestPgnImport<T>(
  path: string,
  payload: {
    pgnText: string;
    file?: File | null;
    userAlias?: string | null;
    platform?: string | null;
  },
): Promise<T> {
  if (payload.file) {
    const formData = new FormData();
    formData.append("file", payload.file);
    if (payload.userAlias) {
      formData.append("user_alias", payload.userAlias);
    }
    if (payload.platform) {
      formData.append("platform", payload.platform);
    }
    return requestWithoutJsonHeader<T>(path, {
      method: "POST",
      body: formData,
    });
  }

  return request<T>(path, {
    method: "POST",
    body: JSON.stringify({
      pgn_text: payload.pgnText,
      user_alias: payload.userAlias ?? null,
      platform: payload.platform ?? "unknown",
    }),
  });
}

async function requestWithoutJsonHeader<T>(
  path: string,
  options: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      message = payload.detail ?? payload.message ?? payload.reason ?? message;
    } catch {
      // Keep the HTTP fallback message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
