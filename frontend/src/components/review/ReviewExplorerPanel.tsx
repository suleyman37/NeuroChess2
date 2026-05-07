import type { ReviewMoveAnnotation, ReviewResponse, ReviewSections } from "../../api/client";
import { REVIEW_SECTION_TABS, reviewColorLabel } from "./reviewLabels";
import { MoveQualityBadge } from "./MoveQualityBadge";
import { getMoveQualityGlyphForHistoricalCategory } from "./moveQualityGlyphs";
import { reviewIsCompleted } from "./reviewViewModel";
import { formatImpact, reviewAnnotationHasAnyPvLine } from "./reviewUtils";
import type { ReviewPovContext, ReviewPvLineMode, ReviewSectionKey } from "./reviewTypes";

function ReviewMomentNavigator({
  review,
  filteredSections,
  povContext,
  activeSection,
  selectedCoachPly,
  selectedMovePly,
  onSectionChange,
  onSelectAnnotation,
  onOpenLessonAnnotation,
  onReplayLineAnnotation,
}: {
  review: ReviewResponse | null;
  filteredSections: ReviewSections;
  povContext: ReviewPovContext;
  activeSection: ReviewSectionKey;
  selectedCoachPly: number | null | undefined;
  selectedMovePly: number | null;
  onSectionChange: (section: ReviewSectionKey) => void;
  onSelectAnnotation: (ply: number | null) => void;
  onOpenLessonAnnotation: (annotation: ReviewMoveAnnotation) => void;
  onReplayLineAnnotation: (annotation: ReviewMoveAnnotation, lineMode?: ReviewPvLineMode) => void;
}) {
  if (!reviewIsCompleted(review) || !review?.review_sections || !review.move_annotations?.length) {
    return null;
  }

  const sections = filteredSections;
  const selectedTab =
    REVIEW_SECTION_TABS.find((tab) => tab.key === activeSection) ??
    REVIEW_SECTION_TABS[0];
  const rawRows = sections[selectedTab.key] ?? [];
  const rows = selectedTab.key === "to_review" ? rawRows.slice(0, 3) : rawRows;
  const isScrollable = selectedTab.key === "all" || rows.length > 6;
  const selectedAnnotation =
    sections.all.find((annotation) => annotation.ply === selectedCoachPly) ??
    sections.all.find((annotation) => annotation.ply === selectedMovePly) ??
    rows[0] ??
    null;

  return (
    <section className="review-moment-navigator" aria-label="Navigation compacte des moments">
      <div className="review-block-title">
        <span>{selectedTab.key === "to_review" ? "À revoir en priorité" : "Explorer la Review"}</span>
        <strong>{rawRows.length}</strong>
      </div>
      <div className="review-section-tabs" role="tablist">
        {REVIEW_SECTION_TABS.map((tab) => {
          const count = sections[tab.key]?.length ?? 0;
          return (
            <button
              key={tab.key}
              className={`review-section-tab ${
                tab.key === selectedTab.key ? "active" : ""
              }`}
              type="button"
              role="tab"
              aria-selected={tab.key === selectedTab.key}
              onClick={() => {
                onSectionChange(tab.key);
                onSelectAnnotation(null);
              }}
            >
              <span>{tab.label}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="review-section-empty">
          {povContext.targetColor === "both"
            ? selectedTab.emptyLabel
            : "Aucun coup dans cette section pour ce joueur."}
        </div>
      ) : (
        <ol className={`review-compact-list ${isScrollable ? "scrollable" : ""}`}>
          {rows.map((annotation, index) => (
            <ReviewCompactMomentRow
              key={`${annotation.ply}-${annotation.uci}-${index}`}
              annotation={annotation}
              index={index}
              active={
                selectedCoachPly === annotation.ply ||
                selectedMovePly === annotation.ply
              }
              showColor={povContext.targetColor === "both"}
              onSelectAnnotation={onSelectAnnotation}
            />
          ))}
        </ol>
      )}
      {selectedAnnotation && (
        <ReviewExplorerDetail
          annotation={selectedAnnotation}
          onOpenLessonAnnotation={onOpenLessonAnnotation}
          onReplayLineAnnotation={onReplayLineAnnotation}
        />
      )}
    </section>
  );
}

function ReviewCompactMomentRow({
  annotation,
  index,
  active,
  showColor,
  onSelectAnnotation,
}: {
  annotation: ReviewMoveAnnotation;
  index: number;
  active: boolean;
  showColor: boolean;
  onSelectAnnotation: (ply: number | null) => void;
}) {
  const qualityId = safeHistoricalQualityId(annotation.primary_category);
  return (
    <li>
      <button
        className={`review-compact-row ${active ? "active" : ""}`}
        type="button"
        onClick={() => onSelectAnnotation(annotation.ply ?? null)}
      >
        <span className="review-compact-rank">
          #{annotation.coach_priority_rank ?? index + 1}
        </span>
        <span className="review-compact-main">
          {showColor ? `${reviewColorLabel(annotation.color)} - ` : ""}
          {annotation.compact_label ??
            `Coup ${annotation.move_number} - ${annotation.category_label}`}
        </span>
        {qualityId && (
          <MoveQualityBadge
            qualityId={qualityId}
            context="historical"
            size="sm"
            testId="historical-move-quality-badge"
          />
        )}
        <span className="review-compact-meta">
          {formatImpact(annotation.win_loss)}
        </span>
      </button>
    </li>
  );
}

function ReviewExplorerDetail({
  annotation,
  onOpenLessonAnnotation,
  onReplayLineAnnotation,
}: {
  annotation: ReviewMoveAnnotation;
  onOpenLessonAnnotation: (annotation: ReviewMoveAnnotation) => void;
  onReplayLineAnnotation: (annotation: ReviewMoveAnnotation, lineMode?: ReviewPvLineMode) => void;
}) {
  const canReplayLine = reviewAnnotationHasAnyPvLine(annotation);
  const qualityId = safeHistoricalQualityId(annotation.primary_category);
  return (
    <aside className="review-explorer-detail" aria-label="Détail du moment sélectionné">
      <div>
        <span>Moment sélectionné</span>
        <strong>
          Coup {annotation.move_number} · {annotation.category_label}
          {qualityId && (
            <MoveQualityBadge
              qualityId={qualityId}
              context="historical"
              size="sm"
              testId="historical-move-quality-badge"
            />
          )}
        </strong>
        <p>
          {annotation.reason ??
            annotation.compact_label ??
            "Ce moment mérite une inspection plus précise."}
        </p>
      </div>
      <div className="review-action-row">
        <button
          className="primary"
          type="button"
          onClick={() => onOpenLessonAnnotation(annotation)}
        >
          Voir la leçon
        </button>
        {canReplayLine && (
          <button
            type="button"
            onClick={() => onReplayLineAnnotation(annotation, "solution")}
          >
            Rejouer la ligne
          </button>
        )}
      </div>
    </aside>
  );
}

function safeHistoricalQualityId(category: string | null | undefined) {
  const qualityId = getMoveQualityGlyphForHistoricalCategory(category);
  return qualityId === "unknown" ? null : qualityId;
}


export const ReviewExplorerPanel = ReviewMomentNavigator;
