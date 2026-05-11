import type { DecisionLabMoment } from "./decisionLabMockData";

type DeepDiveDrawerProps = {
  open: boolean;
  moment: DecisionLabMoment;
  onClose: () => void;
};

export function DeepDiveDrawer({ open, moment, onClose }: DeepDiveDrawerProps) {
  if (!open) return null;
  return (
    <div className="decision-lab-drawer-backdrop" data-testid="decision-lab-deep-dive">
      <section className="decision-lab-drawer" aria-label="Détails Review">
        <button
          className="decision-lab-drawer-close"
          type="button"
          onClick={onClose}
          data-testid="decision-lab-close-details"
          aria-label="Fermer les détails"
        >
          X
        </button>
        <span className="decision-lab-kicker">Détails avancés</span>
        <h2>
          {moment.playedMoveSan} · {moment.verdict}
        </h2>
        <div className="decision-lab-detail-grid">
          <article>
            <h3>Décision</h3>
            <p>{moment.details.decision}</p>
          </article>
          <article>
            <h3>Ligne</h3>
            <p>{moment.details.line}</p>
          </article>
          <article>
            <h3>Score</h3>
            <p>{moment.details.score}</p>
          </article>
          <article>
            <h3>Moments</h3>
            <p>{moment.details.moments}</p>
          </article>
          <article>
            <h3>Légende</h3>
            <p>{moment.details.legend}</p>
          </article>
        </div>
      </section>
    </div>
  );
}
