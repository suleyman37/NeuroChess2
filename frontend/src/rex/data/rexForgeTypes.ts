export type RexForgeBackendStatus = "loading" | "ready" | "empty" | "unavailable";

export type RexForgeSource =
  | "truth_chain_moments"
  | "moves_only"
  | "existing_training_items"
  | "empty"
  | "unavailable";

export type RexForgeOpportunitySource =
  | "truth_chain_moment"
  | "moves_only"
  | "existing_training_item"
  | "fallback";

export type RexForgeOpportunityKind =
  | "review_moment"
  | "position_review"
  | "opening_exit"
  | "existing_exercise"
  | "unknown";

export type RexForgeActionStatus =
  | "preview_only"
  | "existing_exercise_available"
  | "disabled"
  | "prototype";

export type RexForgeVisualSeverity =
  | "positive"
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "unknown";

export type RexForgeOpportunity = {
  id: string;
  gameId?: string;
  title: string;
  subtitle?: string;
  san?: string;
  uci?: string;
  fenBefore?: string;
  fenAfter?: string;
  openingName?: string;
  source: RexForgeOpportunitySource;
  kind: RexForgeOpportunityKind;
  actionStatus: RexForgeActionStatus;
  actionLabel: string;
  visualSeverity: RexForgeVisualSeverity;
  exerciseAvailable: boolean;
  limitations: string[];
};

export type RexForgeSnapshot = {
  backendStatus: RexForgeBackendStatus;
  source: RexForgeSource;
  opportunities: RexForgeOpportunity[];
  limitations: string[];
  readOnlyProof: {
    routesUsed: string[];
    methodsObserved: string[];
    writesObserved: boolean;
    dailyPlanTouched: boolean;
    dueAtTouched: boolean;
    trainingItemsCreated: boolean;
    practiceAttemptsCreated: boolean;
  };
};
