import type { DecisionLabMode, DecisionLabMoment } from "./decisionLabMockData";
import { getNeuroScoreLabel } from "./decisionLabState";
import { DecisionBoardAdapter } from "./DecisionBoardAdapter";

type DecisionBoardProps = {
  moment: DecisionLabMoment;
  activeMode: DecisionLabMode;
};

export function DecisionBoard({ moment, activeMode }: DecisionBoardProps) {
  const score = getNeuroScoreLabel(moment.neuroScore);
  const isInteractiveMock = activeMode === "replay" || activeMode === "explore";

  return (
    <section className="decision-lab-board-stage" data-testid="decision-lab-board-stage">
      <div className="decision-lab-board-meta" data-testid="decision-lab-board-meta">
        <span>Coup {moment.moveNumber}</span>
        <strong>{moment.playedMoveSan}</strong>
        <span>{moment.sideToMove} au trait</span>
        <span className={`decision-lab-score decision-lab-score-${score.tone}`}>
          NeuroScore {moment.neuroScore} · {score.label}
        </span>
      </div>
      <DecisionBoardAdapter moment={moment} interactive={isInteractiveMock} />
      <div className="decision-lab-board-caption">
        {activeMode === "explore"
          ? "Branche locale · hors entraînement · prototype sans API"
          : "Position issue d'une vraie décision · prototype sans API"}
      </div>
    </section>
  );
}
