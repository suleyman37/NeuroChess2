import type { VisionMoment } from "./visionMockData";

type VisionLinePlayerProps = {
  moment: VisionMoment;
  label?: string;
  onClose: () => void;
};

export function VisionLinePlayer({ moment, label = "Ligne jouée", onClose }: VisionLinePlayerProps) {
  return (
    <section className="v2-vision-line-player" data-line-scene="board-stage" data-testid="v2-vision-line-player">
      <div className="v2-vision-line-tabs" role="tablist" aria-label="Lecture de ligne">
        <button className="is-active" type="button" role="tab" aria-selected="true">
          {label}
        </button>
        <button type="button" role="tab" aria-selected="false">
          Solution
        </button>
      </div>
      <div className="v2-vision-line-body">
        <strong>Étape 1/{moment.line.length} · {moment.san}</strong>
        <span>{moment.line.join("  ")}</span>
      </div>
      <div className="v2-vision-actions">
        <button className="v2-vision-secondary" type="button">Précédent</button>
        <button className="v2-vision-secondary" type="button">Suivant</button>
        <button className="v2-vision-secondary" type="button">Rejouer</button>
        <button className="v2-vision-ghost" type="button">Auto</button>
        <button className="v2-vision-ghost" type="button" onClick={onClose} data-testid="v2-vision-line-close">
          Fermer
        </button>
      </div>
    </section>
  );
}
