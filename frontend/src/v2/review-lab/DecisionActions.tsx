import type { DecisionLabMode, DecisionLabMoment } from "./decisionLabMockData";
import type {
  DecisionLabExplorerResult,
  DecisionLabPrimaryAction,
  DecisionLabReplayPhase,
} from "./decisionLabState";

type DecisionActionsProps = {
  activeMode: DecisionLabMode;
  moment: DecisionLabMoment;
  primaryAction: DecisionLabPrimaryAction;
  analysisPreset: "fast" | "standard" | "deep";
  explorerResult: DecisionLabExplorerResult;
  replayPhase: DecisionLabReplayPhase;
  onPrimaryAction: () => void;
  onOpenLine: () => void;
  onOpenExplore: () => void;
  onOpenReplay: () => void;
  onAnalyzeMove: () => void;
  onAnalyzeLine: () => void;
  onPresetChange: (preset: "fast" | "standard" | "deep") => void;
  onResetExplorer: () => void;
  onReturnToSummary: () => void;
  onReplayHint: () => void;
  onReplayCorrection: () => void;
  onReplayRetry: () => void;
};

type SecondaryAction = {
  label: string;
  testId: string;
  onClick: () => void;
  disabled?: boolean;
};

export function DecisionActions({
  activeMode,
  moment,
  primaryAction,
  analysisPreset,
  explorerResult,
  replayPhase,
  onPrimaryAction,
  onOpenLine,
  onOpenExplore,
  onOpenReplay,
  onAnalyzeMove,
  onPresetChange,
  onResetExplorer,
  onReturnToSummary,
  onReplayHint,
  onReplayCorrection,
  onReplayRetry,
}: DecisionActionsProps) {
  const secondaryActions = buildSecondaryActions({
    activeMode,
    moment,
    primaryLabel: primaryAction.label,
    replayPhase,
    onOpenLine,
    onOpenExplore,
    onOpenReplay,
    onAnalyzeMove,
    onReturnToSummary,
    onReplayHint,
    onReplayCorrection,
    onReplayRetry,
  });
  const activeBranch = moment.branchMock[moment.branchMock.length - 1];

  return (
    <section className="decision-lab-actions" data-testid="decision-lab-actions">
      <div className="decision-lab-actions-context" data-testid="decision-lab-actions-context">
        {activeMode === "explore" ? (
          <>
            <span className="decision-lab-chip">Branche · {moment.branchMock.length} coups</span>
            <span className="decision-lab-chip">
              Actif · {activeBranch?.san ?? "départ"}
            </span>
            {explorerResult === "line" && <span className="decision-lab-chip is-success">Ligne analysée</span>}
            {explorerResult === "move" && <span className="decision-lab-chip is-success">Coup analysé</span>}
          </>
        ) : activeMode === "replay" ? (
          <>
            <span className="decision-lab-chip">Reprise active</span>
            <span className="decision-lab-chip">{getReplayContextLabel(replayPhase)}</span>
          </>
        ) : (
          <>
            <span className="decision-lab-chip">{moment.category}</span>
            <span className="decision-lab-chip">{moment.verdict}</span>
          </>
        )}
      </div>

      <div className="decision-lab-actions-row">
        {activeMode === "explore" && (
          <div className="decision-lab-preset" aria-label="Précision">
            {[
              ["fast", "Rapide"],
              ["standard", "Standard"],
              ["deep", "Précise"],
            ].map(([preset, label]) => (
              <button
                key={preset}
                className={analysisPreset === preset ? "is-active" : ""}
                type="button"
                onClick={() => onPresetChange(preset as "fast" | "standard" | "deep")}
                data-testid={`decision-lab-preset-${preset}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="decision-lab-secondary-actions">
          {secondaryActions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              data-testid={action.testId}
            >
              {action.label}
            </button>
          ))}
        </div>

        <button
          className="decision-lab-primary-action"
          type="button"
          disabled={!primaryAction.enabled}
          onClick={onPrimaryAction}
          data-testid="decision-lab-primary-action"
        >
          {primaryAction.label || "Action indisponible"}
        </button>
      </div>

      {activeMode === "explore" && (
        <div className="decision-lab-explorer-mini" data-testid="decision-lab-explorer-mini">
          <span>Local · hors entraînement</span>
          <span>{explorerResult === "line" ? "Résultat à droite" : "Analyse prête"}</span>
          <div className="decision-lab-compact-tools" aria-label="Outils Explorer">
            <button
              className="decision-lab-tool-button"
              type="button"
              onClick={onResetExplorer}
              aria-label="Reset branche"
              title="Reset"
              data-testid="decision-lab-reset-explorer"
            >
              Reset
            </button>
            <button
              className="decision-lab-tool-button"
              type="button"
              aria-label="Annuler le dernier coup"
              title="Annuler"
              data-testid="decision-lab-undo"
            >
              ↶
            </button>
            <button
              className="decision-lab-tool-button"
              type="button"
              aria-label="Tourner le board"
              title="Tourner"
              data-testid="decision-lab-flip"
            >
              ↻
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function buildSecondaryActions({
  activeMode,
  moment,
  primaryLabel,
  replayPhase,
  onOpenLine,
  onOpenExplore,
  onOpenReplay,
  onAnalyzeMove,
  onReturnToSummary,
  onReplayHint,
  onReplayCorrection,
  onReplayRetry,
}: {
  activeMode: DecisionLabMode;
  moment: DecisionLabMoment;
  primaryLabel: string;
  replayPhase: DecisionLabReplayPhase;
  onOpenLine: () => void;
  onOpenExplore: () => void;
  onOpenReplay: () => void;
  onAnalyzeMove: () => void;
  onReturnToSummary: () => void;
  onReplayHint: () => void;
  onReplayCorrection: () => void;
  onReplayRetry: () => void;
}): SecondaryAction[] {
  const actions: SecondaryAction[] = [];
  const add = (action: SecondaryAction) => {
    if (actions.length >= 2 || action.label === primaryLabel || actions.some((item) => item.label === action.label)) {
      return;
    }
    actions.push(action);
  };

  if (activeMode === "summary") {
    if (moment.canExplore) {
      add({ label: "Explorer depuis ici", testId: "decision-lab-secondary-explore", onClick: onOpenExplore });
    }
    if (moment.lineAvailable) {
      add({ label: "Voir la ligne", testId: "decision-lab-open-line", onClick: onOpenLine });
    }
    return actions;
  }

  if (activeMode === "learn") {
    if (moment.canExplore) {
      add({ label: "Explorer depuis ici", testId: "decision-lab-secondary-explore", onClick: onOpenExplore });
    }
    if (moment.canReplay || moment.canPractice) {
      add({ label: "Rejouer ce moment", testId: "decision-lab-secondary-replay", onClick: onOpenReplay });
    }
    return actions;
  }

  if (activeMode === "replay") {
    if (replayPhase === "attempting") {
      add({ label: "Indice", testId: "decision-lab-replay-hint", onClick: onReplayHint });
      add({ label: "Voir correction", testId: "decision-lab-replay-correction", onClick: onReplayCorrection });
      return actions;
    }
    if (replayPhase === "feedback") {
      add({ label: "Revoir la ligne", testId: "decision-lab-open-line", onClick: onOpenLine });
      add({ label: "Réessayer", testId: "decision-lab-replay-retry", onClick: onReplayRetry });
      return actions;
    }
    if (moment.lineAvailable) {
      add({ label: "Voir la ligne", testId: "decision-lab-open-line", onClick: onOpenLine });
    }
    return actions;
  }

  if (moment.branchMock.length >= 2) {
    add({ label: "Analyser ce coup", testId: "decision-lab-analyze-move", onClick: onAnalyzeMove });
  }
  add({ label: "Retour partie", testId: "decision-lab-return-game", onClick: onReturnToSummary });
  return actions;
}

function getReplayContextLabel(phase: DecisionLabReplayPhase): string {
  if (phase === "feedback") {
    return "Feedback affiché";
  }
  if (phase === "attempting") {
    return "À toi de jouer";
  }
  return "Prêt à rejouer";
}
