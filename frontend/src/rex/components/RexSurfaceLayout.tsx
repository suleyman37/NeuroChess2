import { RexArtifactStage } from "./RexArtifactStage";
import { RexMetricPlaceholder } from "./RexMetricPlaceholder";
import { RexSurfaceCard } from "./RexSurfaceCard";
import { RexSurfaceHero } from "./RexSurfaceHero";
import type { RexSurfaceCopy } from "../rexTypes";

type RexSurfaceLayoutProps = {
  copy: RexSurfaceCopy;
};

export function RexSurfaceLayout({ copy }: RexSurfaceLayoutProps) {
  return (
    <section
      className={`rex-surface rex-surface--${copy.id}`}
      data-testid={copy.testId}
      data-rex-surface={copy.id}
      data-rex-tone={copy.tone}
    >
      <RexSurfaceHero copy={copy} />

      <div className="rex-surface__instrument">
        <RexArtifactStage copy={copy} />
        <aside className="rex-instrument-brief" aria-label="Contrat prototype">
          <span className="rex-command-card__label">Contrat de surface</span>
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyBody}</p>
        </aside>
      </div>

      <div className="rex-surface__support">
        <div className="rex-metric-grid">
          {copy.metrics.map((metric) => (
            <RexMetricPlaceholder key={metric.label} metric={metric} />
          ))}
        </div>
        <div className="rex-card-grid">
          {copy.cards.map((card) => (
            <RexSurfaceCard key={card.title} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}
