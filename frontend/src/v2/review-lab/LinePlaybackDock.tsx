import type { DecisionLabMoment } from "./decisionLabMockData";

type LinePlaybackDockProps = {
  moment: DecisionLabMoment;
  source: "played" | "solution";
  stepIndex: number;
  onChangeSource: (source: "played" | "solution") => void;
  onPrevious: () => void;
  onNext: () => void;
  onReplay: () => void;
  onClose: () => void;
};

export function LinePlaybackDock({
  moment,
  source,
  stepIndex,
  onChangeSource,
  onPrevious,
  onNext,
  onReplay,
  onClose,
}: LinePlaybackDockProps) {
  const solutionLine = moment.branchMock.map((move) => move.san);
  const line = source === "played" ? moment.line : solutionLine.length > 0 ? solutionLine : moment.line;
  const safeStep = Math.min(stepIndex, Math.max(0, line.length - 1));
  return (
    <section className="decision-lab-line-dock" data-testid="decision-lab-line-player">
      <div className="decision-lab-line-top">
        <div className="decision-lab-line-tabs" aria-label="Choix de ligne">
          <button
            className={source === "played" ? "is-active" : ""}
            type="button"
            onClick={() => onChangeSource("played")}
            data-testid="decision-lab-line-played"
          >
            Ligne jouée
          </button>
          <button
            className={source === "solution" ? "is-active" : ""}
            type="button"
            onClick={() => onChangeSource("solution")}
            data-testid="decision-lab-line-solution"
          >
            Solution
          </button>
        </div>
        <span>
          Étape {line.length === 0 ? 0 : safeStep + 1}/{line.length || 1} · {line[safeStep] ?? "Départ"}
        </span>
      </div>
      <div className="decision-lab-line-actions">
        <button type="button" onClick={onPrevious} data-testid="decision-lab-line-prev">
          Précédent
        </button>
        <button type="button" onClick={onNext} data-testid="decision-lab-line-next">
          Suivant
        </button>
        <button type="button" onClick={onReplay} data-testid="decision-lab-line-replay">
          Rejouer
        </button>
        <button type="button" data-testid="decision-lab-line-auto">
          Auto
        </button>
        <button type="button" onClick={onClose} data-testid="decision-lab-line-close">
          Fermer
        </button>
      </div>
    </section>
  );
}
