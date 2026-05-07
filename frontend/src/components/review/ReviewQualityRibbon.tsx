import type { ReviewMoveAnnotation } from "../../api/client";
import { fr } from "../../i18n";
import { MoveQualityBadge } from "./MoveQualityBadge";
import {
  getMoveQualityGlyphForHistoricalCategory,
  type MoveQualityGlyphId,
} from "./moveQualityGlyphs";
import { reviewColorLabel } from "./reviewLabels";

const MAX_RIBBON_ITEMS = 14;

export function ReviewQualityRibbon({
  annotations,
  selectedPly,
  showColor = false,
  onSelectAnnotation,
}: {
  annotations: ReviewMoveAnnotation[];
  selectedPly?: number | null;
  showColor?: boolean;
  onSelectAnnotation?: (annotation: ReviewMoveAnnotation) => void;
}) {
  const items = uniqueAnnotationsByPly(annotations).slice(0, MAX_RIBBON_ITEMS);
  return (
    <section
      className="review-quality-ribbon"
      aria-label={fr.qualityRibbon.title}
      data-testid="review-quality-ribbon"
    >
      <div className="review-quality-ribbon-head">
        <span>{fr.qualityRibbon.title}</span>
        <strong>{items.length}</strong>
      </div>
      {items.length === 0 ? (
        <p>{fr.qualityRibbon.empty}</p>
      ) : (
        <ol className="review-quality-ribbon-track">
          {items.map((annotation) => {
            const move = annotation.san ?? annotation.uci ?? fr.decisionCard.unavailableMove;
            const qualityId = safeHistoricalQualityId(annotation.primary_category);
            const active = selectedPly === annotation.ply;
            const itemLabel = `${fr.qualityRibbon.moveLabel(
              annotation.move_number,
              move,
            )}${active ? ` · ${fr.qualityRibbon.selected}` : ""}`;
            return (
              <li key={`${annotation.ply}-${annotation.uci ?? move}`}>
                <button
                  className={`review-quality-ribbon-item ${active ? "active" : ""}`}
                  type="button"
                  aria-label={itemLabel}
                  aria-current={active ? "step" : undefined}
                  data-testid="review-quality-ribbon-item"
                  onClick={() => onSelectAnnotation?.(annotation)}
                  disabled={!onSelectAnnotation}
                >
                  <span className="review-quality-ribbon-move">
                    {showColor && (
                      <em>{reviewColorLabel(annotation.color)}</em>
                    )}
                    <strong>{annotation.move_number ?? "?"}</strong>
                    <span>{move}</span>
                  </span>
                  {qualityId && (
                    <MoveQualityBadge
                      qualityId={qualityId}
                      context="historical"
                      size="sm"
                      showLabel={false}
                      testId="review-quality-ribbon-badge"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function uniqueAnnotationsByPly(
  annotations: ReviewMoveAnnotation[],
): ReviewMoveAnnotation[] {
  const seen = new Set<number>();
  const items: ReviewMoveAnnotation[] = [];
  for (const annotation of annotations) {
    if (seen.has(annotation.ply)) {
      continue;
    }
    seen.add(annotation.ply);
    items.push(annotation);
  }
  return items;
}

function safeHistoricalQualityId(
  category: string | null | undefined,
): MoveQualityGlyphId | null {
  const qualityId = getMoveQualityGlyphForHistoricalCategory(category);
  return qualityId === "unknown" ? null : qualityId;
}
