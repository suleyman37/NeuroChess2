import type { ReactNode } from "react";
import type { OpeningRealityEvidence, ReviewMoment, ReviewMoveAnnotation, ReviewResponse, ReviewSections } from "../../api/client";
import { ReviewExplorerPanel } from "./ReviewExplorerPanel";
import { ReviewOpeningPanel } from "./ReviewOpeningPanel";
import {
  ReviewLegacyMoments,
  ReviewPvContrastDebugList,
  ReviewTechnicalDetails,
} from "./ReviewTechnicalDetails";
import type { ReviewPovContext, ReviewPvLineMode, ReviewRunOptions, ReviewSectionKey } from "./reviewTypes";

export function ReviewLaboratoryPanel({
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
  openingIntentionNote,
  onOpeningIntentionNoteChange,
  onShowOpeningExit,
  onShowOpeningLinkedMoment,
  analysisProfile,
  resetPicker,
  onRetry,
  onToggleResetPicker,
  selectedMomentId,
  hideEvaluation,
  onShowMoment,
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
  openingIntentionNote: string;
  onOpeningIntentionNoteChange: (note: string) => void;
  onShowOpeningExit: (evidence: OpeningRealityEvidence) => void;
  onShowOpeningLinkedMoment: (ply: number, evidence?: OpeningRealityEvidence) => void;
  analysisProfile: "quick" | "standard" | "deep";
  resetPicker: ReactNode;
  onRetry: (options?: ReviewRunOptions) => void;
  onToggleResetPicker: () => void;
  selectedMomentId: string | null;
  hideEvaluation: boolean;
  onShowMoment: (
    moment: ReviewMoment,
    index: number,
    moveMode?: "played" | "best",
  ) => void;
}) {
  if (!review) {
    return null;
  }

  return (
    <section className="review-laboratory" aria-label="Explorer Review">
      <div className="review-lab-intro">
        <strong>Explorer la partie en profondeur</strong>
        <p>Inspecter les coups, les lignes et les détails avancés sans alourdir le résumé, la leçon ou l'entraînement.</p>
      </div>

      <details className="review-lab-section" open>
        <summary>Explorer tous les coups</summary>
        <ReviewExplorerPanel
          review={review}
          filteredSections={filteredSections}
          povContext={povContext}
          activeSection={activeSection}
          selectedCoachPly={selectedCoachPly}
          selectedMovePly={selectedMovePly}
          onSectionChange={onSectionChange}
          onSelectAnnotation={onSelectAnnotation}
          onOpenLessonAnnotation={onOpenLessonAnnotation}
          onReplayLineAnnotation={onReplayLineAnnotation}
        />
      </details>

      <details className="review-lab-section">
        <summary>Ouverture détaillée</summary>
        <ReviewOpeningPanel
          evidence={review.opening_reality_evidence ?? null}
          intentionNote={openingIntentionNote}
          onIntentionNoteChange={onOpeningIntentionNoteChange}
          onShowOpeningExit={onShowOpeningExit}
          onShowOpeningLinkedMoment={onShowOpeningLinkedMoment}
        />
      </details>

      <details className="review-lab-section">
        <summary>Options d'analyse</summary>
        <ReviewTechnicalDetails
          review={review}
          analysisProfile={analysisProfile}
          resetPicker={resetPicker}
          onRetry={onRetry}
          onToggleResetPicker={onToggleResetPicker}
        />
      </details>

      <details className="review-lab-section">
        <summary>Détails techniques</summary>
        <p className="review-lab-muted">
          Les détails moteur et l'audit Review restent disponibles dans les options d'analyse.
        </p>
      </details>

      <details className="review-lab-section">
        <summary>Preuves PV</summary>
        <ReviewPvContrastDebugList annotations={review.move_annotations ?? []} />
      </details>

      {review.moments.length > 0 && (
        <details className="review-lab-section">
          <summary>Historique moteur</summary>
          <ReviewLegacyMoments
            review={review}
            selectedMomentId={selectedMomentId}
            hideEvaluation={hideEvaluation}
            onShowMoment={onShowMoment}
          />
        </details>
      )}
    </section>
  );
}
