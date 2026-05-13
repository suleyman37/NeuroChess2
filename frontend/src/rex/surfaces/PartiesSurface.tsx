import { RexMetricPlaceholder } from "../components/RexMetricPlaceholder";
import { RexPrototypeBadge } from "../components/RexPrototypeBadge";
import { RexSurfaceCard } from "../components/RexSurfaceCard";
import { getRexSurfaceCopy } from "../rexCopy";

const copy = getRexSurfaceCopy("parties");

export function PartiesSurface() {
  return (
    <section className="rex-surface" data-testid={copy.testId}>
      <div className="rex-surface__hero">
        <div>
          <RexPrototypeBadge />
          <p className="rex-eyebrow">{copy.eyebrow}</p>
          <h1>{copy.question}</h1>
          <p className="rex-surface__promise">{copy.promise}</p>
        </div>
        <button className="rex-primary-cta" type="button" data-placeholder-action="true">
          {copy.ctaLabel}
        </button>
      </div>

      <div className="rex-surface__body">
        <div className="rex-empty-state">
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyBody}</p>
        </div>
        <div className="rex-metric-grid">
          {copy.metrics.map((metric) => (
            <RexMetricPlaceholder key={metric.label} metric={metric} />
          ))}
        </div>
      </div>

      <div className="rex-card-grid">
        {copy.cards.map((card) => (
          <RexSurfaceCard key={card.title} card={card} />
        ))}
      </div>
    </section>
  );
}
