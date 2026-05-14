import { useEffect, useState } from "react";
import { getGameHistory, getGameMoves, type GameHistoryItem, type GameMoveHistory } from "../../api/client";
import {
  REX_PARTIES_HISTORY_ROUTE,
  REX_PARTIES_MOVES_ROUTE,
  type RexPartiesSnapshot,
  type RexTruthChainGame,
  type RexTruthChainMoment,
  type RexTruthChainSnapshot,
  type RexTruthChainStepStatus,
  type RexTruthChainStatuses,
} from "./rexPartiesTypes";

const HISTORY_LIMIT = 50;
const TRUTH_CHAIN_MAX_MOMENTS = 5;

function emptyTruthChain(status: RexTruthChainStepStatus): RexTruthChainStatuses {
  return {
    pgn: status,
    analysis: status,
    criticalMoment: status,
    exercise: status,
  };
}

const loadingSnapshot: RexPartiesSnapshot = {
  totalGames: 0,
  backendStatus: "loading",
  truthChain: emptyTruthChain("pending"),
  limitations: ["Chargement read-only via l'historique existant."],
  routesUsed: [REX_PARTIES_HISTORY_ROUTE],
};

function reviewLabel(item: GameHistoryItem): string {
  const status = item.review_summary_status ?? item.review_status ?? "unknown";
  if (status === "review_available") {
    return "ready";
  }
  if (status === "analysis_in_progress") {
    return "pending";
  }
  if (status === "analysis_failed") {
    return "failed";
  }
  if (status === "too_short") {
    return "not_reviewable";
  }
  if (status === "no_significant_moments") {
    return "no_significant_moments";
  }
  if (status === "not_analyzed") {
    return "not_started";
  }
  return String(status);
}

function truthChainForHistory(item?: GameHistoryItem): RexTruthChainStatuses {
  if (!item) {
    return emptyTruthChain("inactive");
  }

  const summaryStatus = item.review_summary_status;
  const analysisStatus: RexTruthChainStepStatus =
    summaryStatus === "review_available"
      ? "available"
      : summaryStatus === "analysis_in_progress"
        ? "pending"
        : summaryStatus === "not_analyzed" || summaryStatus === "too_short"
          ? "inactive"
          : "unavailable";

  const criticalMomentStatus: RexTruthChainStepStatus =
    summaryStatus === "review_available"
      ? "available"
      : summaryStatus === "analysis_in_progress"
        ? "pending"
        : "unavailable";

  return {
    pgn: "available",
    analysis: analysisStatus,
    criticalMoment: criticalMomentStatus,
    exercise: "unavailable",
  };
}

function playerName(value: string | null | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function userColor(value: string | null | undefined): RexTruthChainGame["userColor"] {
  return value === "white" || value === "black" ? value : "unknown";
}

function moveNumberFromPly(ply: number): number | undefined {
  if (!Number.isFinite(ply) || ply <= 0) {
    return undefined;
  }
  return Math.ceil(ply / 2);
}

function actualMovesRoute(gameId: number | string): string {
  return `GET /games/${gameId}/moves`;
}

function truthChainGameFromHistory(item: GameHistoryItem): RexTruthChainGame {
  return {
    id: String(item.game_id),
    white: playerName(item.white_name),
    black: playerName(item.black_name),
    result: playerName(item.result),
    openingName: playerName(item.opening_name),
    eco: playerName(item.eco_code),
    userColor: userColor(item.user_color),
    importedAt: playerName(item.date_played),
    moveCount: Number.isFinite(item.move_count) ? item.move_count : undefined,
    reviewStatus: reviewLabel(item),
  };
}

function buildReadOnlyProof(): RexTruthChainSnapshot["readOnlyProof"] {
  return {
    methodsObserved: ["GET"],
    writesObserved: false,
    dailyPlanTouched: false,
    trainingItemsCreated: false,
    dueAtTouched: false,
  };
}

function buildMovesOnlyMoments(
  latest: GameHistoryItem,
  moveHistory: GameMoveHistory,
): RexTruthChainMoment[] {
  return (Array.isArray(moveHistory.moves) ? moveHistory.moves : [])
    .slice(0, TRUTH_CHAIN_MAX_MOMENTS)
    .map((move) => {
      const ply = Number(move.ply);
      const moveNumber = moveNumberFromPly(ply);
      const san = playerName(move.played_san);
      const uci = playerName(move.played_uci);
      return {
        id: `${latest.game_id}:${ply}`,
        gameId: String(latest.game_id),
        ply,
        moveNumber,
        sideToMove: move.side_to_move_before === "white" || move.side_to_move_before === "black"
          ? move.side_to_move_before
          : undefined,
        san,
        uci,
        fenBefore: playerName(move.fen_before),
        fenAfter: playerName(move.fen_after),
        label: moveNumber ? `Coup ${moveNumber}` : `Ply ${ply}`,
        visualSeverity: "unknown",
        momentKind: "unknown",
        reviewAvailable: reviewLabel(latest) === "ready",
        exerciseAvailable: false,
        source: "moves_only",
        limitations: [
          "Coup lu depuis la route moves existante.",
          "Moment critique non derive en frontend.",
          "Gravite prudente : unknown.",
        ],
      };
    });
}

function buildTruthChainSnapshot(
  latest: GameHistoryItem,
  moveHistory?: GameMoveHistory,
): RexTruthChainSnapshot {
  const game = truthChainGameFromHistory(latest);
  const routesUsed = [REX_PARTIES_HISTORY_ROUTE, actualMovesRoute(latest.game_id)];

  if (!moveHistory) {
    return {
      backendStatus: "unavailable",
      game,
      moments: [],
      limitations: [
        "Route moves indisponible ou non interceptee dans cet environnement.",
        "Aucun moment critique invente.",
        "GET /games/{game_id}/review non appele : risque de creation training item.",
      ],
      routesUsed,
      readOnlyProof: buildReadOnlyProof(),
    };
  }

  const moments = buildMovesOnlyMoments(latest, moveHistory);
  return {
    backendStatus: moments.length > 0 ? "ready" : "empty",
    game,
    moments,
    limitations: [
      `Maximum ${TRUTH_CHAIN_MAX_MOMENTS} coups lus au depart.`,
      "Mode moves-only : ces noeuds ne sont pas des moments critiques detectes.",
      "GET /games/{game_id}/review non appele : risque de creation training item.",
      "Aucun exercice ni planning cree.",
    ],
    routesUsed,
    readOnlyProof: buildReadOnlyProof(),
  };
}

function buildSnapshot(items: GameHistoryItem[]): RexPartiesSnapshot {
  if (items.length === 0) {
    return {
      totalGames: 0,
      backendStatus: "empty",
      truthChain: emptyTruthChain("inactive"),
      limitations: [
        "Aucune partie reelle retournee par l'historique.",
        "Import REX non branche dans cette mission.",
      ],
      routesUsed: [REX_PARTIES_HISTORY_ROUTE],
    };
  }

  const latest = items[0];
  const reviewReadyCount = items.filter((item) => item.review_summary_status === "review_available").length;
  const limitations = [
    `Lecture seule limitee aux ${HISTORY_LIMIT} premieres entrees retournees.`,
    "Aucune route Review directe appelee pour eviter toute creation de training item.",
    "Exercice reste a brancher plus tard sans creation de session.",
  ];

  if (items.length >= HISTORY_LIMIT) {
    limitations.push("Le total exact peut etre superieur : aucun endpoint de comptage global n'est utilise ici.");
  }

  return {
    totalGames: items.length,
    latestGame: {
      id: String(latest.game_id),
      white: playerName(latest.white_name),
      black: playerName(latest.black_name),
      result: playerName(latest.result),
      playedAt: playerName(latest.date_played),
      openingName: playerName(latest.opening_name),
      reviewStatus: reviewLabel(latest),
      trainingAvailable: false,
    },
    reviewReadyCount,
    criticalMomentsCount: null,
    trainingItemsCount: null,
    backendStatus: "ready",
    truthChain: truthChainForHistory(latest),
    limitations,
    routesUsed: [REX_PARTIES_HISTORY_ROUTE],
  };
}

export function useRexPartiesSnapshot() {
  const [snapshot, setSnapshot] = useState<RexPartiesSnapshot>(loadingSnapshot);

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      setSnapshot(loadingSnapshot);
      try {
        const items = await getGameHistory(HISTORY_LIMIT, 0, "mine");
        if (cancelled) {
          return;
        }
        const safeItems = Array.isArray(items) ? items : [];
        const nextSnapshot = buildSnapshot(safeItems);
        const latest = safeItems[0];

        if (!latest) {
          setSnapshot(nextSnapshot);
          return;
        }

        try {
          const moveHistory = await getGameMoves(latest.game_id);
          if (cancelled) {
            return;
          }
          const truthChainSnapshot = buildTruthChainSnapshot(latest, moveHistory);
          setSnapshot({
            ...nextSnapshot,
            truthChainSnapshot,
            routesUsed: Array.from(new Set([...nextSnapshot.routesUsed, ...truthChainSnapshot.routesUsed])),
            limitations: Array.from(new Set([...nextSnapshot.limitations, ...truthChainSnapshot.limitations])),
          });
        } catch {
          if (cancelled) {
            return;
          }
          const truthChainSnapshot = buildTruthChainSnapshot(latest);
          setSnapshot({
            ...nextSnapshot,
            truthChainSnapshot,
            routesUsed: Array.from(new Set([...nextSnapshot.routesUsed, REX_PARTIES_MOVES_ROUTE])),
            limitations: Array.from(new Set([...nextSnapshot.limitations, ...truthChainSnapshot.limitations])),
          });
        }
      } catch {
        if (cancelled) {
          return;
        }
        setSnapshot({
          totalGames: 0,
          backendStatus: "unavailable",
          truthChain: emptyTruthChain("unavailable"),
          limitations: [
            "Backend indisponible : affichage prototype conserve.",
            "Lecture seule : aucune analyse declenchee.",
          ],
          routesUsed: [REX_PARTIES_HISTORY_ROUTE],
        });
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, []);

  return snapshot;
}
