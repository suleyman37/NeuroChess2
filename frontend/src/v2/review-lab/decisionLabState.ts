import type { DecisionLabFilter, DecisionLabMode, DecisionLabMoment } from "./decisionLabMockData";

export type DecisionLabReplayPhase = "idle" | "attempting" | "feedback";
export type DecisionLabExplorerResult = "none" | "move" | "line";

export type DecisionLabViewState = {
  mode: DecisionLabMode;
  selectedMomentId: string;
  filter: DecisionLabFilter;
  deepDiveOpen: boolean;
  linePlayerOpen: boolean;
  replayPhase: DecisionLabReplayPhase;
  explorerResult: DecisionLabExplorerResult;
};

export type DecisionLabPrimaryAction = {
  label: string;
  variant: "primary" | "secondary" | "disabled";
  enabled: boolean;
  reason: string;
  handlerKey:
    | "start_replay"
    | "validate_attempt"
    | "next_position"
    | "open_explorer"
    | "open_line"
    | "analyze_move"
    | "analyze_line"
    | "none";
};

export function filterDecisionMoments(
  moments: DecisionLabMoment[],
  filter: DecisionLabFilter,
): DecisionLabMoment[] {
  if (filter === "all") {
    return moments;
  }

  if (filter === "priority") {
    return moments.filter((moment) => moment.canReplay || moment.badge === "?" || moment.badge === "?!");
  }

  if (filter === "review") {
    return moments.filter((moment) =>
      ["?", "?!", "↻", "="].includes(moment.badge) || /revoir|ratee|ecart|explorer/i.test(moment.verdict),
    );
  }

  return moments.filter((moment) => ["✓", "!", "="].includes(moment.badge));
}

export function getDecisionFilterLabel(filter: DecisionLabFilter): string {
  if (filter === "priority") {
    return "Prioritaires";
  }
  if (filter === "review") {
    return "À revoir";
  }
  if (filter === "good") {
    return "Bons coups";
  }
  return "Tous";
}

export function getNeuroScoreLabel(score: number): { label: string; tone: "strong" | "solid" | "watch" | "fragile" } {
  if (score >= 85) {
    return { label: "Très solide", tone: "strong" };
  }
  if (score >= 70) {
    return { label: "Solide", tone: "solid" };
  }
  if (score >= 50) {
    return { label: "À consolider", tone: "watch" };
  }
  return { label: "Fragile", tone: "fragile" };
}

export function getPrimaryDecisionAction(
  state: DecisionLabViewState,
  selectedMoment: DecisionLabMoment,
): DecisionLabPrimaryAction {
  if (state.linePlayerOpen) {
    return {
      label: "Lecture ouverte",
      variant: "disabled",
      enabled: false,
      reason: "Le dock de lecture remplace les actions principales.",
      handlerKey: "none",
    };
  }

  if (state.mode === "summary") {
    if (selectedMoment.canReplay || selectedMoment.canPractice) {
      return {
        label: "Rejouer ce moment",
        variant: "primary",
        enabled: true,
        reason: "Moment disponible pour une reprise guidee.",
        handlerKey: "start_replay",
      };
    }
    if (selectedMoment.canExplore) {
      return {
        label: "Explorer depuis ici",
        variant: "primary",
        enabled: true,
        reason: "Aucun exercice direct, mais la position peut etre exploree.",
        handlerKey: "open_explorer",
      };
    }
  }

  if (state.mode === "learn") {
    return {
      label: selectedMoment.lineAvailable ? "Voir la ligne" : "Explorer l'idee",
      variant: selectedMoment.lineAvailable ? "primary" : "secondary",
      enabled: selectedMoment.lineAvailable || selectedMoment.canExplore,
      reason: selectedMoment.lineAvailable ? "Une ligne courte est disponible." : "Pas de ligne prete pour ce moment.",
      handlerKey: selectedMoment.lineAvailable ? "open_line" : "open_explorer",
    };
  }

  if (state.mode === "replay") {
    if (!(selectedMoment.canReplay || selectedMoment.canPractice)) {
      return {
        label: "Pas de reprise",
        variant: "disabled",
        enabled: false,
        reason: "Ce moment n'a pas de tentative preparee dans le prototype.",
        handlerKey: "none",
      };
    }
    if (state.replayPhase === "feedback") {
      return {
        label: "Position suivante",
        variant: "primary",
        enabled: true,
        reason: "Le feedback mock est affiche.",
        handlerKey: "next_position",
      };
    }
    if (state.replayPhase === "attempting") {
      return {
        label: "Valider",
        variant: "primary",
        enabled: true,
        reason: "Simule une tentative sur le moment actif.",
        handlerKey: "validate_attempt",
      };
    }
    return {
      label: "Commencer la tentative",
      variant: "primary",
      enabled: true,
      reason: "Lance le mini-flow de reprise mock.",
      handlerKey: "start_replay",
    };
  }

  const branchLength = selectedMoment.branchMock.length;
  if (branchLength <= 0) {
    return {
      label: "Joue un coup sur le board",
      variant: "disabled",
      enabled: false,
      reason: "La branche locale est vide.",
      handlerKey: "none",
    };
  }
  if (branchLength === 1) {
    return {
      label: "Analyser ce coup",
      variant: "primary",
      enabled: true,
      reason: "Un seul coup local est disponible.",
      handlerKey: "analyze_move",
    };
  }
  return {
    label: "Analyser la ligne",
    variant: "primary",
    enabled: true,
    reason: "La branche contient plusieurs coups.",
    handlerKey: "analyze_line",
  };
}
