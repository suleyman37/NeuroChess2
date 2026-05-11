import { visionMoments } from "./visionMockData";

type VisionDetailsDrawerProps = {
  open: boolean;
  momentId?: string;
  onClose: () => void;
};

export function VisionDetailsDrawer({ open, momentId, onClose }: VisionDetailsDrawerProps) {
  const moment = visionMoments.find((item) => item.id === momentId) ?? visionMoments[0];

  if (!open) {
    return null;
  }

  return (
    <aside className="v2-vision-drawer" role="dialog" aria-modal="true" data-testid="v2-vision-details-drawer">
      <div className="v2-vision-drawer-panel">
        <header>
          <div>
            <span className="v2-vision-kicker">Détails avancés</span>
            <h2>Décision complète</h2>
          </div>
          <button className="v2-vision-ghost" type="button" onClick={onClose} aria-label="Fermer les détails" data-testid="v2-vision-details-close">
            ×
          </button>
        </header>
        <section>
          <h3>Décision</h3>
          <p>{moment.why}</p>
          <p>{moment.impact}</p>
          <p>{moment.betterIdea}</p>
        </section>
        <section>
          <h3>Ligne</h3>
          <p>{moment.line.join("  ")}</p>
        </section>
        <section>
          <h3>Bilan du moment</h3>
          <p>{getDecisionStateLabel(moment.neuroBand)} · repère de lecture prudent.</p>
        </section>
        <section>
          <h3>Moments</h3>
          <p>{visionMoments.map((item) => `C${item.moveNumber} ${item.san} ${item.symbol}`).join(" · ")}</p>
        </section>
        <section>
          <h3>Légende</h3>
          <p>? à revoir · ✓ bonne décision · = ligne tenable · ◌ non analysé.</p>
        </section>
      </div>
    </aside>
  );
}

function getDecisionStateLabel(band: string): string {
  if (band === "strong") return "Très solide";
  if (band === "solid") return "Solide";
  if (band === "watch") return "À consolider";
  return "À revoir";
}
