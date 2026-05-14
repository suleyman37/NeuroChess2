export type RexPartiesBackendStatus = "loading" | "ready" | "empty" | "unavailable";

export type RexTruthChainStepStatus = "inactive" | "pending" | "available" | "unavailable";

export type RexTruthChainStatuses = {
  pgn: RexTruthChainStepStatus;
  analysis: RexTruthChainStepStatus;
  criticalMoment: RexTruthChainStepStatus;
  exercise: RexTruthChainStepStatus;
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
  limitations: string[];
  routesUsed: string[];
};

export const REX_PARTIES_HISTORY_ROUTE = "GET /games/history?limit=50&offset=0&scope=mine";

export const REX_PARTIES_ROUTE_SOURCES = [
  "frontend/src/api/client.ts:getGameHistory",
  "backend/neurochess/api/game_routes.py:@router.get(\"/games/history\")",
];
