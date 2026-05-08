import { fr } from "../../i18n";
import { MoveQualityBadge } from "./MoveQualityBadge";
import type { MoveQualityGlyphId } from "./moveQualityGlyphs";

const LEGEND_ITEMS: MoveQualityGlyphId[] = [
  "critical_best",
  "good",
  "playable",
  "imprecise",
  "wrong",
  "illegal",
  "rebuild_needed",
];

export function ReviewQualityLegend() {
  return (
    <details
      className="review-quality-legend"
      aria-label={fr.qualityLegend.ariaLabel}
      data-testid="review-quality-legend"
    >
      <summary data-testid="review-quality-legend-toggle">
        {fr.qualityLegend.toggle}
      </summary>
      <div className="review-quality-legend-grid">
        {LEGEND_ITEMS.map((qualityId) => (
          <div
            key={qualityId}
            className="review-quality-legend-item"
            data-testid="review-quality-legend-item"
          >
            <MoveQualityBadge
              qualityId={qualityId}
              context={qualityId === "critical_best" ? "solution" : "attempt"}
              size="sm"
              testId={`review-quality-legend-badge-${qualityId}`}
            />
          </div>
        ))}
      </div>
    </details>
  );
}
