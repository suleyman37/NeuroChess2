import { useMemo } from "react";
import type { RexPartiesSnapshot, RexTruthChainMoment } from "./rexPartiesTypes";
import { useRexPartiesSnapshot } from "./useRexPartiesSnapshot";
import type { RexQGMission, RexQGMissionSnapshot } from "./rexQGMissionTypes";

const EXISTING_DATA_COPY = "Mission proposée depuis données existantes";

function latestGameLabel(latest: NonNullable<RexPartiesSnapshot["latestGame"]>): string {
  const players = [latest.white, latest.black].filter(Boolean).join(" vs ");
  return [players || `Partie ${latest.id}`, latest.result].filter(Boolean).join(" · ");
}

function hasPersistedMoment(moment: RexTruthChainMoment): boolean {
  return moment.source === "review_moment" || moment.source === "training_item";
}

function readOnlyProofFromParties(snapshot: RexPartiesSnapshot): RexQGMissionSnapshot["readOnlyProof"] {
  const truthProof = snapshot.truthChainSnapshot?.readOnlyProof;
  return {
    routesUsed: Array.from(
      new Set([
        ...snapshot.routesUsed,
        ...(snapshot.truthChainSnapshot?.routesUsed ?? []),
      ]),
    ),
    methodsObserved: truthProof?.methodsObserved?.length ? truthProof.methodsObserved : ["GET"],
    writesObserved: truthProof?.writesObserved === true,
    dailyPlanTouched: truthProof?.dailyPlanTouched === true,
    dueAtTouched: truthProof?.dueAtTouched === true,
    trainingItemsCreated: truthProof?.trainingItemsCreated === true,
  };
}

function loadingMission(): RexQGMission {
  return {
    id: "qg-loading",
    title: "Lecture des données de mission",
    subtitle: "Le QG cherche une priorité existante sans créer de plan.",
    primaryActionLabel: "Chargement",
    primaryActionStatus: "disabled",
    evidence: {},
    missionKind: "prototype",
    confidence: "fallback",
    limitations: ["Chargement read-only en cours.", EXISTING_DATA_COPY],
  };
}

function unavailableMission(routesUsed: string[]): RexQGMissionSnapshot {
  return {
    backendStatus: "unavailable",
    source: "unavailable",
    mission: {
      id: "qg-unavailable",
      title: "Lecture indisponible",
      subtitle: "Le QG reste lisible en mode prototype, sans action de planification.",
      primaryActionLabel: "Réessayer plus tard",
      primaryActionStatus: "disabled",
      evidence: {},
      missionKind: "prototype",
      confidence: "fallback",
      limitations: ["Backend indisponible.", EXISTING_DATA_COPY],
    },
    limitations: ["Lecture backend indisponible.", "Aucune mission calculée ni créée."],
    readOnlyProof: {
      routesUsed,
      methodsObserved: ["GET"],
      writesObserved: false,
      dailyPlanTouched: false,
      dueAtTouched: false,
      trainingItemsCreated: false,
    },
  };
}

function emptyMission(snapshot: RexPartiesSnapshot): RexQGMissionSnapshot {
  return {
    backendStatus: "empty",
    source: "empty",
    mission: {
      id: "qg-empty",
      title: "Importer une partie",
      subtitle: "Aucune partie lue : le CTA reste prototype et non-mutating.",
      primaryActionLabel: "Importer une partie",
      primaryActionStatus: "prototype",
      evidence: {},
      missionKind: "import_first_game",
      confidence: "fallback",
      limitations: [
        "Import REX non branché dans cette mission.",
        "CTA prototype/non-mutating.",
        EXISTING_DATA_COPY,
      ],
    },
    limitations: [
      ...snapshot.limitations,
      "Aucune donnée utilisateur disponible pour proposer une mission réelle.",
    ],
    readOnlyProof: readOnlyProofFromParties(snapshot),
  };
}

function persistedMomentsMission(snapshot: RexPartiesSnapshot): RexQGMissionSnapshot {
  const latest = snapshot.latestGame;
  const truthChain = snapshot.truthChainSnapshot;
  const moments = truthChain?.moments.filter(hasPersistedMoment) ?? [];
  const evidence = latest
    ? {
        gameId: latest.id,
        gameLabel: latestGameLabel(latest),
        openingName: latest.openingName,
        momentCount: moments.length,
        movesCount: truthChain?.game?.moveCount,
        reviewStatus: latest.reviewStatus,
      }
    : {};

  return {
    backendStatus: "ready",
    source: "truth_chain_moments",
    mission: {
      id: `qg-truth-chain-${latest?.id ?? "latest"}`,
      title: "Revoir les moments détectés de la dernière partie",
      subtitle: "La priorité vient des moments Review persistés lus en lecture seule.",
      primaryActionLabel: "Voir la Truth Chain",
      primaryActionStatus: "available",
      evidence,
      missionKind: "review_latest_game",
      confidence: "confirmed",
      limitations: [EXISTING_DATA_COPY],
    },
    limitations: snapshot.limitations,
    readOnlyProof: readOnlyProofFromParties(snapshot),
  };
}

function movesOnlyMission(snapshot: RexPartiesSnapshot): RexQGMissionSnapshot {
  const latest = snapshot.latestGame;
  const moments = snapshot.truthChainSnapshot?.moments ?? [];
  const movesCount = moments.filter((moment) => moment.source === "moves_only").length || undefined;
  const source = movesCount ? "moves_only" : "latest_game";

  return {
    backendStatus: "ready",
    source,
    mission: {
      id: `qg-moves-only-${latest?.id ?? "latest"}`,
      title: "Explorer la dernière partie lue",
      subtitle: "Les coups/FEN sont disponibles, mais aucun moment Review persisté n'est disponible.",
      primaryActionLabel: "Explorer la partie",
      primaryActionStatus: "available",
      evidence: latest
        ? {
            gameId: latest.id,
            gameLabel: latestGameLabel(latest),
            openingName: latest.openingName,
            movesCount,
            reviewStatus: latest.reviewStatus,
          }
        : {},
      missionKind: "inspect_truth_chain",
      confidence: "partial",
      limitations: [
        "Moves-only fallback : pas de moment critique inventé.",
        "Gravité non branchée.",
        EXISTING_DATA_COPY,
      ],
    },
    limitations: snapshot.limitations,
    readOnlyProof: readOnlyProofFromParties(snapshot),
  };
}

function buildQGMissionSnapshot(snapshot: RexPartiesSnapshot): RexQGMissionSnapshot {
  if (snapshot.backendStatus === "loading") {
    return {
      backendStatus: "loading",
      source: "unavailable",
      mission: loadingMission(),
      limitations: snapshot.limitations,
      readOnlyProof: readOnlyProofFromParties(snapshot),
    };
  }

  if (snapshot.backendStatus === "unavailable") {
    return unavailableMission(snapshot.routesUsed);
  }

  if (snapshot.backendStatus === "empty" || !snapshot.latestGame) {
    return emptyMission(snapshot);
  }

  const persistedMoments =
    snapshot.truthChainSnapshot?.moments.some((moment) => hasPersistedMoment(moment)) === true;
  if (persistedMoments) {
    return persistedMomentsMission(snapshot);
  }

  return movesOnlyMission(snapshot);
}

export function useRexQGMissionSnapshot(): RexQGMissionSnapshot {
  const partiesSnapshot = useRexPartiesSnapshot();
  return useMemo(() => buildQGMissionSnapshot(partiesSnapshot), [partiesSnapshot]);
}
