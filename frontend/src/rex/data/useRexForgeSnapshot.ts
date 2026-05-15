import { useMemo } from "react";
import type { RexPartiesSnapshot, RexTruthChainMoment } from "./rexPartiesTypes";
import type {
  RexForgeOpportunity,
  RexForgeOpportunityKind,
  RexForgeOpportunitySource,
  RexForgeSnapshot,
} from "./rexForgeTypes";
import { useRexPartiesSnapshot } from "./useRexPartiesSnapshot";

const MAX_FORGE_OPPORTUNITIES = 3;

const loadingSnapshot: RexForgeSnapshot = {
  backendStatus: "loading",
  source: "unavailable",
  opportunities: [],
  limitations: ["Lecture des opportunites Forge depuis les sources read-only existantes."],
  readOnlyProof: {
    routesUsed: ["GET /games/history?limit=50&offset=0&scope=mine"],
    methodsObserved: ["GET"],
    writesObserved: false,
    dailyPlanTouched: false,
    dueAtTouched: false,
    trainingItemsCreated: false,
    practiceAttemptsCreated: false,
  },
};

function safeText(value: string | undefined | null): string | undefined {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function moveLabel(moment: RexTruthChainMoment): string {
  const move = moment.san ?? moment.uci ?? "position";
  if (moment.moveNumber) {
    return moment.sideToMove === "black" ? `${moment.moveNumber}...${move}` : `${moment.moveNumber}.${move}`;
  }
  return `Ply ${moment.ply}`;
}

function sourceForMoment(moment: RexTruthChainMoment): RexForgeOpportunitySource {
  if (moment.source === "training_item") {
    return "existing_training_item";
  }
  if (moment.source === "moves_only") {
    return "moves_only";
  }
  if (moment.source === "review_moment") {
    return "truth_chain_moment";
  }
  return "fallback";
}

function kindForMoment(moment: RexTruthChainMoment): RexForgeOpportunityKind {
  if (moment.exerciseAvailable) {
    return "existing_exercise";
  }
  if (moment.momentKind === "opening_exit") {
    return "opening_exit";
  }
  if (moment.source === "moves_only") {
    return "position_review";
  }
  if (moment.source === "review_moment" || moment.source === "training_item") {
    return "review_moment";
  }
  return "unknown";
}

function persistedOpportunity(moment: RexTruthChainMoment, openingName?: string): RexForgeOpportunity {
  const label = moveLabel(moment);
  const hasExistingExercise = moment.exerciseAvailable === true;
  return {
    id: `forge-${moment.id}`,
    gameId: moment.gameId,
    title: hasExistingExercise ? "Exercice existant detecte" : "Moment a transformer",
    subtitle: `${label} - ${openingName ?? "position lue"}`,
    san: safeText(moment.san),
    uci: safeText(moment.uci),
    fenBefore: safeText(moment.fenBefore),
    fenAfter: safeText(moment.fenAfter),
    openingName,
    source: sourceForMoment(moment),
    kind: kindForMoment(moment),
    actionStatus: hasExistingExercise ? "existing_exercise_available" : "preview_only",
    actionLabel: hasExistingExercise ? "Voir la position" : "Preparer la Forge",
    visualSeverity: moment.visualSeverity,
    exerciseAvailable: hasExistingExercise,
    limitations: hasExistingExercise
      ? [
          "Signal lu depuis la Truth Chain.",
          "Aucune route Practice appelee en R3E.",
          "La position reste une preview.",
        ]
      : [
          "Moment Review lu en lecture seule.",
          "Aucune creation d'exercice.",
          "La Forge prepare seulement la transformation.",
        ],
  };
}

function movesOnlyOpportunity(moment: RexTruthChainMoment, openingName?: string): RexForgeOpportunity {
  const label = moveLabel(moment);
  return {
    id: `forge-moves-${moment.id}`,
    gameId: moment.gameId,
    title: "Position a inspecter",
    subtitle: `${label} - moment Review non persiste`,
    san: safeText(moment.san),
    uci: safeText(moment.uci),
    fenBefore: safeText(moment.fenBefore),
    fenAfter: safeText(moment.fenAfter),
    openingName,
    source: "moves_only",
    kind: "position_review",
    actionStatus: "prototype",
    actionLabel: "Voir la Truth Chain",
    visualSeverity: "unknown",
    exerciseAvailable: false,
    limitations: [
      "Coups lus depuis le fallback moves-only.",
      "Aucune erreur inventee.",
      "Forge non disponible sans moment Review persiste.",
    ],
  };
}

function fallbackOpportunity(
  id: string,
  title: string,
  subtitle: string,
  actionLabel: string,
  actionStatus: RexForgeOpportunity["actionStatus"],
): RexForgeOpportunity {
  return {
    id,
    title,
    subtitle,
    source: "fallback",
    kind: "unknown",
    actionStatus,
    actionLabel,
    visualSeverity: "unknown",
    exerciseAvailable: false,
    limitations: ["Fallback honnete.", "Aucune mutation.", "Aucune action produit lancee."],
  };
}

function readOnlyProofFromParties(snapshot: RexPartiesSnapshot): RexForgeSnapshot["readOnlyProof"] {
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
    practiceAttemptsCreated: false,
  };
}

function buildForgeSnapshot(snapshot: RexPartiesSnapshot): RexForgeSnapshot {
  if (snapshot.backendStatus === "loading") {
    return loadingSnapshot;
  }

  const readOnlyProof = readOnlyProofFromParties(snapshot);

  if (snapshot.backendStatus === "unavailable") {
    return {
      backendStatus: "unavailable",
      source: "unavailable",
      opportunities: [
        fallbackOpportunity(
          "forge-unavailable",
          "Lecture indisponible",
          "Forge reste lisible sans appel de secours risqué.",
          "Indisponible",
          "disabled",
        ),
      ],
      limitations: ["Backend indisponible.", "Aucun fallback dangereux.", "Aucune creation."],
      readOnlyProof,
    };
  }

  if (snapshot.backendStatus === "empty" || !snapshot.latestGame) {
    return {
      backendStatus: "empty",
      source: "empty",
      opportunities: [
        fallbackOpportunity(
          "forge-empty",
          "Importer une partie",
          "CTA prototype/non-mutating : l'import REX n'est pas branche ici.",
          "Prototype non-mutating",
          "prototype",
        ),
      ],
      limitations: ["Aucune partie lue.", "Forge attend une matiere reelle.", "Aucune creation."],
      readOnlyProof,
    };
  }

  const chainMoments = snapshot.truthChainSnapshot?.moments ?? [];
  const persistedMoments = chainMoments.filter(
    (moment) => moment.source === "review_moment" || moment.source === "training_item",
  );
  const openingName = snapshot.truthChainSnapshot?.game?.openingName ?? snapshot.latestGame.openingName;

  if (persistedMoments.length > 0) {
    return {
      backendStatus: "ready",
      source: "truth_chain_moments",
      opportunities: persistedMoments
        .slice(0, MAX_FORGE_OPPORTUNITIES)
        .map((moment) => persistedOpportunity(moment, openingName)),
      limitations: [
        "Source principale : Truth Chain moments read-only.",
        "Maximum trois opportunites visibles.",
        "Aucune route Practice dans R3E.",
      ],
      readOnlyProof,
    };
  }

  const movesOnlyMoments = chainMoments.filter((moment) => moment.source === "moves_only");
  if (movesOnlyMoments.length > 0) {
    return {
      backendStatus: "ready",
      source: "moves_only",
      opportunities: movesOnlyMoments
        .slice(0, MAX_FORGE_OPPORTUNITIES)
        .map((moment) => movesOnlyOpportunity(moment, openingName)),
      limitations: [
        "Partie lue depuis les coups existants.",
        "Aucun moment Review persiste n'est pret pour Forge.",
        "Aucun exercice disponible.",
      ],
      readOnlyProof,
    };
  }

  return {
    backendStatus: "ready",
    source: "moves_only",
    opportunities: [
      fallbackOpportunity(
        "forge-no-moments",
        "Partie lue - Forge non disponible",
        "Aucun moment Review persiste n'est pret pour Forge.",
        "Voir la Truth Chain",
        "prototype",
      ),
    ],
    limitations: ["Historique lu.", "Truth Chain vide.", "Aucune creation."],
    readOnlyProof,
  };
}

export function useRexForgeSnapshot(): RexForgeSnapshot {
  const partiesSnapshot = useRexPartiesSnapshot();
  return useMemo(() => buildForgeSnapshot(partiesSnapshot), [partiesSnapshot]);
}
