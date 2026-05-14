export type RexPartiesBackendStatus = "loading" | "ready" | "empty" | "unavailable";

export type RexTruthChainStepStatus = "inactive" | "pending" | "available" | "unavailable";

export type RexTruthChainStatuses = {
  pgn: RexTruthChainStepStatus;
  analysis: RexTruthChainStepStatus;
  criticalMoment: RexTruthChainStepStatus;
  exercise: RexTruthChainStepStatus;
};

export type RexTruthChainVisualSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "positive"
  | "unknown";

export type RexTruthChainMomentKind =
  | "tactical"
  | "strategic"
  | "opening_exit"
  | "conversion"
  | "defense"
  | "unknown";

export type RexTruthChainMomentSource =
  | "review_moment"
  | "training_item"
  | "fixture"
  | "moves_only"
  | "unknown";

export type RexTruthChainGame = {
  id: string;
  white?: string;
  black?: string;
  result?: string;
  openingName?: string;
  eco?: string;
  userColor?: "white" | "black" | "unknown";
  importedAt?: string;
  moveCount?: number;
  reviewStatus?: string;
};

export type RexTruthChainMoment = {
  id: string;
  gameId: string;
  ply: number;
  moveNumber?: number;
  sideToMove?: "white" | "black";
  san?: string;
  uci?: string;
  fenBefore?: string;
  fenAfter?: string;
  label: string;
  visualSeverity: RexTruthChainVisualSeverity;
  momentKind: RexTruthChainMomentKind;
  reviewAvailable: boolean;
  exerciseAvailable: boolean;
  source: RexTruthChainMomentSource;
  limitations: string[];
};

export type RexTruthChainSnapshot = {
  backendStatus: RexPartiesBackendStatus;
  game?: RexTruthChainGame;
  moments: RexTruthChainMoment[];
  limitations: string[];
  routesUsed: string[];
  readOnlyProof: {
    methodsObserved: string[];
    writesObserved: boolean;
    dailyPlanTouched: boolean;
    trainingItemsCreated: boolean;
    dueAtTouched: boolean;
  };
};

export type RexPartiesSnapshot = {
  totalGames: number;
  latestGame?: {
    id: string;
    white?: string;
    black?: string;
    result?: string;
    playedAt?: string;
    importedAt?: string;
    openingName?: string;
    reviewStatus?: string;
    trainingAvailable?: boolean;
  };
  reviewReadyCount?: number;
  criticalMomentsCount?: number | null;
  trainingItemsCount?: number | null;
  backendStatus: RexPartiesBackendStatus;
  truthChain: RexTruthChainStatuses;
  truthChainSnapshot?: RexTruthChainSnapshot;
  limitations: string[];
  routesUsed: string[];
};

export const REX_PARTIES_HISTORY_ROUTE = "GET /games/history?limit=50&offset=0&scope=mine";
export const REX_PARTIES_MOVES_ROUTE = "GET /games/{game_id}/moves";
export const REX_PARTIES_TRUTH_CHAIN_MOMENTS_ROUTE = "GET /games/{game_id}/truth-chain/moments";

export const REX_PARTIES_ROUTE_SOURCES = [
  "frontend/src/api/client.ts:getGameHistory",
  "frontend/src/api/client.ts:getGameMoves",
  "frontend/src/api/client.ts:getTruthChainMoments",
  "backend/neurochess/api/game_routes.py:@router.get(\"/games/history\")",
  "backend/neurochess/api/game_routes.py:@router.get(\"/games/{game_id}/moves\")",
  "backend/neurochess/api/game_routes.py:@router.get(\"/games/{game_id}/truth-chain/moments\")",
];
