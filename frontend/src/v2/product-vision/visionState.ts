import type {
  VisionDecisionMode,
  VisionExplorerPhase,
  VisionMainTab,
  VisionOverlay,
  VisionPracticePhase,
  VisionReplayPhase,
} from "./visionMockData";

export type VisionState = {
  mainTab: VisionMainTab;
  overlay: VisionOverlay;
  selectedMomentId: string;
  selectedPracticeIndex: number;
  decisionMode: VisionDecisionMode;
  replayPhase: VisionReplayPhase;
  practicePhase: VisionPracticePhase;
  explorerPhase: VisionExplorerPhase;
  explorerAnalyzed: boolean;
  detailsOpen: boolean;
  linePlayerOpen: boolean;
  profileDeleteConfirm: boolean;
};

export const initialVisionState: VisionState = {
  mainTab: "today",
  overlay: null,
  selectedMomentId: "moment-qxb7",
  selectedPracticeIndex: 0,
  decisionMode: "summary",
  replayPhase: "idle",
  practicePhase: "ready",
  explorerPhase: "initial",
  explorerAnalyzed: false,
  detailsOpen: false,
  linePlayerOpen: false,
  profileDeleteConfirm: false,
};

export function getVisionTitle(state: VisionState): string {
  if (state.overlay === "decisionLab") return "Decision Lab";
  if (state.overlay === "practice") return "S'entraîner";
  if (state.overlay === "explorer") return "Explorer";
  if (state.overlay === "progression") return "Progression";
  if (state.overlay === "profile") return "Profil / Paramètres";
  if (state.mainTab === "games") return "Mes parties";
  if (state.mainTab === "training") return "Entraînement";
  return "Aujourd'hui";
}

export function getVisionPrimaryLabel(state: VisionState): string {
  if (state.overlay === "practice") {
    if (state.practicePhase === "feedback_success") return "Position suivante";
    if (state.practicePhase === "feedback_wrong") return "Voir correction";
    if (state.practicePhase === "correction") return "Position suivante";
    if (state.practicePhase === "attempting") return "Valider le coup";
    return "Commencer";
  }
  if (state.overlay === "explorer") {
    if (state.explorerPhase === "initial") return "Créer une branche";
    if (state.explorerPhase === "analyzed" || state.explorerAnalyzed) return "Modifier la branche";
    if (state.explorerPhase === "analyzing") return "Analyse en cours";
    return "Analyser la ligne";
  }
  if (state.overlay === "decisionLab") {
    if (state.linePlayerOpen) return "Lecture ouverte";
    if (state.decisionMode === "learn") return "Voir la ligne";
    if (state.decisionMode === "replay") {
      if (state.replayPhase === "feedback") return "Position suivante";
      if (state.replayPhase === "active") return "Valider";
      return "Commencer la tentative";
    }
    if (state.decisionMode === "explore") return state.explorerAnalyzed ? "Analyser ce coup" : "Analyser la ligne";
    return "Rejouer ce moment";
  }
  if (state.mainTab === "games") return "Importer PGN";
  if (state.mainTab === "training") return "Commencer";
  return "Commencer";
}

export type VisionBoardStageTone = "calm" | "learn" | "active" | "success" | "explore";

export type VisionDecisionGuideContext = {
  surface: "decisionLab" | "practice" | "explorer";
  decisionMode?: VisionDecisionMode;
  replayPhase?: VisionReplayPhase;
  practicePhase?: VisionPracticePhase;
  explorerPhase?: VisionExplorerPhase | "analyzed";
  explorerAnalyzed?: boolean;
  linePlayerOpen?: boolean;
};

export function shouldShowDecisionGuides(context: VisionDecisionGuideContext): boolean {
  if (context.linePlayerOpen) {
    return true;
  }

  if (context.surface === "practice") {
    return (
      context.practicePhase === "feedback_success" ||
      context.practicePhase === "feedback_wrong" ||
      context.practicePhase === "correction"
    );
  }

  if (context.surface === "explorer") {
    return Boolean(context.explorerAnalyzed) || context.explorerPhase === "analyzed";
  }

  if (context.decisionMode === "replay") {
    return context.replayPhase === "feedback";
  }

  if (context.decisionMode === "explore") {
    return Boolean(context.explorerAnalyzed);
  }

  return true;
}

export function getBoardStageTone(context: VisionDecisionGuideContext): VisionBoardStageTone {
  if (context.surface === "practice") {
    if (
      context.practicePhase === "feedback_success" ||
      context.practicePhase === "feedback_wrong" ||
      context.practicePhase === "correction"
    ) {
      return "success";
    }
    return "active";
  }

  if (context.surface === "explorer") {
    return "explore";
  }

  if (context.decisionMode === "learn") {
    return "learn";
  }
  if (context.decisionMode === "replay") {
    return context.replayPhase === "feedback" ? "success" : "active";
  }
  if (context.decisionMode === "explore") {
    return "explore";
  }
  return "calm";
}

export function getModeNarrativeCopy(context: VisionDecisionGuideContext): string {
  if (context.surface === "practice") {
    if (context.practicePhase === "feedback_success") return "Bien joué : retiens l'idée, puis avance.";
    if (context.practicePhase === "feedback_wrong") return "À revoir : ralentis, puis compare avec la correction.";
    if (context.practicePhase === "correction") return "Lis la correction, puis rejoue la ligne.";
    return "Joue d'abord. La correction vient après.";
  }

  if (context.surface === "explorer") {
    return "Teste une branche sans modifier ton entraînement.";
  }

  if (context.decisionMode === "learn") {
    return "Lis les repères, puis reviens au board.";
  }
  if (context.decisionMode === "replay") {
    if (context.replayPhase === "feedback") return "Compare ta tentative avec la ligne.";
    return "À toi de trouver le coup sans aide visible.";
  }
  if (context.decisionMode === "explore") {
    return "Teste une branche sans modifier ton entraînement.";
  }
  return "Observe la bascule avant de rejouer.";
}

export function getExplorerLocalSignal(): { chip: string; subtitle: string } {
  return {
    chip: "Local",
    subtitle: "Teste une branche sans modifier ton entraînement.",
  };
}
