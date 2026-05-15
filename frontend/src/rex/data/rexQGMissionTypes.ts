export type RexQGMissionBackendStatus = "loading" | "ready" | "empty" | "unavailable";

export type RexQGMissionSource =
  | "truth_chain_moments"
  | "moves_only"
  | "latest_game"
  | "empty"
  | "unavailable";

export type RexQGMission = {
  id: string;
  title: string;
  subtitle?: string;
  primaryActionLabel: string;
  primaryActionStatus: "prototype" | "available" | "disabled";
  evidence: {
    gameId?: string;
    gameLabel?: string;
    openingName?: string;
    momentCount?: number;
    movesCount?: number;
    reviewStatus?: string;
  };
  missionKind: "review_latest_game" | "inspect_truth_chain" | "import_first_game" | "prototype" | "unknown";
  confidence: "confirmed" | "partial" | "fallback";
  limitations: string[];
};

export type RexQGMissionSnapshot = {
  backendStatus: RexQGMissionBackendStatus;
  mission?: RexQGMission;
  source: RexQGMissionSource;
  limitations: string[];
  readOnlyProof: {
    routesUsed: string[];
    methodsObserved: string[];
    writesObserved: boolean;
    dailyPlanTouched: boolean;
    dueAtTouched: boolean;
    trainingItemsCreated: boolean;
  };
};
