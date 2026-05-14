import { useEffect, useState } from "react";
import { getGameHistory, type GameHistoryItem } from "../../api/client";
import {
  REX_PARTIES_HISTORY_ROUTE,
  type RexPartiesSnapshot,
  type RexTruthChainStepStatus,
  type RexTruthChainStatuses,
} from "./rexPartiesTypes";

const HISTORY_LIMIT = 50;

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
        setSnapshot(buildSnapshot(Array.isArray(items) ? items : []));
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
