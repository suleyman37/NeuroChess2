import { RexConstellationPreview } from "./RexConstellationPreview";
import { RexFlowRail } from "./RexFlowRail";
import { RexMetricPlaceholder } from "./RexMetricPlaceholder";
import { RexProgressRing } from "./RexProgressRing";
import { RexSurfaceCard } from "./RexSurfaceCard";
import { RexSurfaceHero } from "./RexSurfaceHero";
import type { RexSurfaceCopy } from "../rexTypes";

type RexSurfaceLayoutProps = {
  copy: RexSurfaceCopy;
};

function renderVisual(copy: RexSurfaceCopy) {
  if (copy.visualKind === "forge-rings") {
    return (
      <div className="rex-visual rex-visual--rings" data-testid="rex-visual-forge-rings">
        <RexProgressRing label="Drill" tone="forge" />
        <RexProgressRing label="Ligne" tone="forge" />
        <RexProgressRing label="Rappel" tone="forge" />
      </div>
    );
  }

  if (copy.visualKind === "arena-lanes") {
    return (
      <div className="rex-visual rex-visual--lanes" data-testid="rex-visual-arena-lanes">
        {["Blitz", "Rapide", "Classique"].map((lane) => (
          <div className="rex-arena-lane" key={lane}>
            <span>{lane}</span>
            <strong>Palier prototype</strong>
          </div>
        ))}
      </div>
    );
  }

  if (copy.visualKind === "profile-map") {
    return (
      <div className="rex-visual rex-visual--profile" data-testid="rex-visual-profile-map">
        <RexConstellationPreview />
        <div>
          <strong>Constellation 2D</strong>
          <span>Identité visuelle en quarantaine.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rex-visual rex-visual--${copy.visualKind}`} data-testid={`rex-visual-${copy.id}`}>
      <RexFlowRail steps={copy.flow} />
    </div>
  );
}

export function RexSurfaceLayout({ copy }: RexSurfaceLayoutProps) {
  return (
    <section
      className="rex-surface"
      data-testid={copy.testId}
      data-rex-surface={copy.id}
      data-rex-tone={copy.tone}
    >
      <RexSurfaceHero copy={copy} />

      <div className="rex-surface__feature">
        <div className="rex-command-card">
          <span className="rex-command-card__label">Signal principal</span>
          <h2>{copy.commandTitle}</h2>
          <p>{copy.commandBody}</p>
        </div>
        {renderVisual(copy)}
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
