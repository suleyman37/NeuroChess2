import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ReviewJobResponse, ReviewMoment, ReviewMoveAnnotation } from "../../api/client";
import { fr } from "../../i18n";
import {
  REVIEW_FAILED_DEEP_MESSAGE,
  REVIEW_NOT_REVIEWABLE_MESSAGE,
  REVIEW_NO_SIGNIFICANT_MOMENTS_MESSAGE,
  REVIEW_PENDING_BACKGROUND_MESSAGE,
  REVIEW_STALLED_MESSAGE,
  REVIEW_TIMEOUT_MESSAGE,
  reviewPanelDisplayStatus,
} from "../../reviewState";
import { ReviewCockpitSummary } from "./ReviewCockpitSummary";
import { ReviewFocusTabs } from "./ReviewFocusTabs";
import { ReviewLaboratoryPanel } from "./ReviewLaboratoryPanel";
import { ReviewLessonPanel } from "./ReviewLessonPanel";
import { ReviewPracticeHistory } from "./ReviewPracticeHistory";
import { ReviewPracticeLaunch, ReviewPracticePanel } from "./ReviewPracticePanel";
import {
  ForceReanalysisPicker,
  ReviewAnalysisUnavailableMessage,
  ReviewMessage,
  reviewJobReconcileMessage,
  reviewJobReconcileTitle,
  reviewJobStatusTitle,
} from "./ReviewTechnicalDetails";
import {
  annotationIndex,
  countPracticeEligibleItems,
  filterSectionsByPov,
  reviewPovContext,
  selectedCoachAnnotationForReview,
} from "./reviewViewModel";
import type { GameStoryEvent, ReviewFocusKey, ReviewLessonStep, ReviewPanelProps, ReviewPov, ReviewSectionKey } from "./reviewTypes";

const REVIEW_RETRY_COPY = fr.analysis.retryCopy;

function reviewJobElapsedSeconds(job: ReviewJobResponse): number {
  const storedElapsed = Number(job.elapsed_seconds ?? 0);
  if (
    job.status !== "queued" &&
    job.status !== "running" &&
    job.status !== "finalizing"
  ) {
    return Math.max(0, storedElapsed);
  }
  const stableStartedAt = job.started_at ?? job.created_at;
  const parsedStartedAt = stableStartedAt ? Date.parse(stableStartedAt) : Number.NaN;
  if (!Number.isFinite(parsedStartedAt)) {
    return Math.max(0, storedElapsed);
  }
  const monotonicElapsed = Math.floor((Date.now() - parsedStartedAt) / 1000);
  return Math.max(0, storedElapsed, monotonicElapsed);
}

export function ReviewPanel({
  review,
  reviewJob,
  error,
  uiState,
  selectedMomentId,
  onGenerate,
  onRetry,
  onForceReanalysis,
  onCancelJob,
  onReconcileJob,
  reviewReconcileInFlight,
  onCheck,
  onShowMoment,
  onShowAnnotation,
  onShowOpeningExit,
  onShowOpeningLinkedMoment,
  openingIntentionNote,
  onOpeningIntentionNoteChange,
  onGuidedReplayAnnotation,
  onTryMoveAnnotation,
  onShowPvLineAnnotation,
  onTryMoveReset,
  onTryMoveRevealSolution,
  tryMoveState,
  solutionRevealState,
  onSolutionHintAnnotation,
  onSolutionReset,
  practiceState,
  practicePvLineState,
  onStartPractice,
  onPracticeHint,
  onPracticeRevealSolution,
  onPracticeSkip,
  onPracticeTryAgain,
  onPracticeNext,
  onPracticeShowPvLine,
  onPracticePvPrevious,
  onPracticePvNext,
  onPracticePvRestart,
  onPracticePvToggleAutoplay,
  onPracticePvSelectLine,
  onPracticePvClose,
  onPracticeQuit,
  onPracticeRetryFailed,
  onPracticeRedoAll,
  practiceHistory,
  practiceHistoryLoading,
  practiceHistoryError,
  onPracticeHistoryRefresh,
  onPracticeResumeSession,
  onPracticeViewSessionSummary,
  onPracticeRetryFailedSession,
  selectedReviewPov,
  activeReviewFocus,
  onReviewPovChange,
  onReviewFocusChange,
  selectedMovePly,
  hideEvaluation,
  analysisProfile,
  onAnalysisProfileChange,
}: ReviewPanelProps) {
  const [resetPickerOpen, setResetPickerOpen] = useState(false);
  const [activeSection, setActiveSection] =
    useState<ReviewSectionKey>("to_review");
  const [activeFocus, setActiveFocus] = useState<ReviewFocusKey>("summary");
  const [lessonStep, setLessonStep] = useState<ReviewLessonStep>("observe");
  const [selectedCoachPly, setSelectedCoachPly] = useState<number | null>(null);
  const displayStatus = reviewPanelDisplayStatus(review, uiState);
  const povContext = reviewPovContext(review, selectedReviewPov);
  const filteredSections = filterSectionsByPov(review, povContext.targetColor);
  const practiceEligibleCount = countPracticeEligibleItems(filteredSections);
  const effectiveFocus: ReviewFocusKey = practiceState?.active ? "practice" : activeFocus;
  const selectedCoachAnnotation = selectedCoachAnnotationForReview(
    review,
    selectedCoachPly,
    selectedMovePly,
    activeSection,
    povContext.targetColor,
  );
  const selectedLessonKey = selectedCoachAnnotation
    ? `${selectedCoachAnnotation.ply}:${selectedCoachAnnotation.uci ?? ""}`
    : "none";
  const hasNoSignificantMoments =
    (displayStatus === "done" || displayStatus === "partial") &&
    (review?.empty_reason === "no_significant_moments" ||
      review?.moments.length === 0);
  const resetPicker = resetPickerOpen ? (
    <ForceReanalysisPicker
      onSelect={(profile) => {
        setResetPickerOpen(false);
        onForceReanalysis(profile);
      }}
      onCancel={() => setResetPickerOpen(false)}
    />
  ) : null;
  useEffect(() => {
    setLessonStep("observe");
  }, [selectedLessonKey]);

  useEffect(() => {
    setActiveFocus(activeReviewFocus);
  }, [activeReviewFocus]);

  useEffect(() => {
    setActiveFocus("summary");
    setActiveSection("to_review");
    setSelectedCoachPly(null);
    setLessonStep("observe");
  }, [review?.game_id, review?.status]);

  function handleReviewPovChange(nextPov: ReviewPov) {
    setSelectedCoachPly(null);
    setActiveSection("to_review");
    setLessonStep("observe");
    onReviewPovChange(nextPov);
  }

  function handleReviewFocusChange(nextFocus: ReviewFocusKey) {
    setActiveFocus(nextFocus);
    onReviewFocusChange(nextFocus);
  }

  function handleCoachSectionChange(section: ReviewSectionKey) {
    onSolutionReset("review_section_changed");
    setSelectedCoachPly(null);
    setLessonStep("observe");
    setActiveSection(section);
  }

  function handleCoachAnnotationSelect(ply: number | null) {
    onSolutionReset("review_moment_changed");
    setSelectedCoachPly(ply);
    setLessonStep("observe");
  }

  function openLessonForAnnotation(annotation: ReviewMoveAnnotation | null) {
    if (!annotation) {
      return;
    }
    handleCoachAnnotationSelect(annotation.ply ?? null);
    setActiveFocus("learn");
    onReviewFocusChange("learn");
    onShowAnnotation(annotation, annotationIndex(review, annotation), "before");
  }

  function handleExplorerAnnotationSelect(ply: number | null) {
    handleCoachAnnotationSelect(ply);
  }

  function handleExplorerReplayLine(
    annotation: ReviewMoveAnnotation,
    lineMode?: "played" | "solution",
  ) {
    handleCoachAnnotationSelect(annotation.ply ?? null);
    onShowPvLineAnnotation(annotation, annotationIndex(review, annotation), lineMode);
  }

  function handleSummaryPracticeStart() {
    setActiveFocus("practice");
    onReviewFocusChange("practice");
    onStartPractice();
  }

  function handleTimelineEventSelect(event: GameStoryEvent) {
    if (event.annotation) {
      openLessonForAnnotation(event.annotation);
      return;
    }
    if (event.focus === "lab") {
      setActiveFocus("lab");
      onReviewFocusChange("lab");
      if (event.openingEvidence && event.showOpeningExit) {
        onShowOpeningExit(event.openingEvidence);
      }
      return;
    }
    if (event.focus) {
      handleReviewFocusChange(event.focus);
    }
  }

  function handleNextLessonMoment() {
    const rows =
      filteredSections[activeSection]?.length
        ? filteredSections[activeSection]
        : filteredSections.to_review?.length
          ? filteredSections.to_review
          : filteredSections.all;
    if (!rows.length) {
      return;
    }
    const currentIndex = selectedCoachAnnotation
      ? rows.findIndex((annotation) => annotation.ply === selectedCoachAnnotation.ply)
      : -1;
    const nextIndex =
      currentIndex >= 0 && currentIndex + 1 < rows.length ? currentIndex + 1 : 0;
    handleCoachAnnotationSelect(rows[nextIndex].ply ?? null);
  }

  function renderFocusedReviewModule(showNoSignificantMessage = false) {
    return (
      <>
        <ReviewFocusTabs
          activeFocus={effectiveFocus}
          onFocusChange={handleReviewFocusChange}
        />
        {effectiveFocus === "summary" && (
          <ReviewCockpitSummary
            review={review}
            povContext={povContext}
            filteredSections={filteredSections}
            selectedCoachAnnotation={selectedCoachAnnotation}
            practiceEligibleCount={practiceEligibleCount}
            onPovChange={handleReviewPovChange}
            onStartPractice={handleSummaryPracticeStart}
            onOpenLesson={openLessonForAnnotation}
            onFocusChange={handleReviewFocusChange}
            onTimelineEventSelect={handleTimelineEventSelect}
          />
        )}
        {effectiveFocus === "learn" && (
          <ReviewLessonPanel
            annotation={selectedCoachAnnotation}
            index={annotationIndex(review, selectedCoachAnnotation)}
            active={selectedMovePly === selectedCoachAnnotation?.ply}
            lessonStep={lessonStep}
            onLessonStepChange={setLessonStep}
            onNextLessonMoment={handleNextLessonMoment}
            onReturnToSummary={() => handleReviewFocusChange("summary")}
            onShowAnnotation={onShowAnnotation}
            onTryMoveAnnotation={onTryMoveAnnotation}
            onShowPvLineAnnotation={onShowPvLineAnnotation}
            onTryMoveReset={onTryMoveReset}
            onTryMoveRevealSolution={onTryMoveRevealSolution}
            tryMoveState={tryMoveState}
            solutionRevealState={solutionRevealState}
            onSolutionHintAnnotation={onSolutionHintAnnotation}
            practiceAvailable={practiceEligibleCount > 0}
            onStartPractice={handleSummaryPracticeStart}
            povContext={povContext}
          />
        )}
        {effectiveFocus === "practice" && (
          practiceState?.active ? (
            <ReviewPracticePanel
              state={practiceState}
              pvLineState={practicePvLineState}
              povContext={povContext}
              onHint={onPracticeHint}
              onRevealSolution={onPracticeRevealSolution}
              onSkip={onPracticeSkip}
              onTryAgain={onPracticeTryAgain}
              onNext={onPracticeNext}
              onShowPvLine={onPracticeShowPvLine}
              onPvPrevious={onPracticePvPrevious}
              onPvNext={onPracticePvNext}
              onPvRestart={onPracticePvRestart}
              onPvToggleAutoplay={onPracticePvToggleAutoplay}
              onPvSelectLine={onPracticePvSelectLine}
              onPvClose={onPracticePvClose}
              onQuit={onPracticeQuit}
              onRetryFailed={onPracticeRetryFailed}
              onRedoAll={onPracticeRedoAll}
            />
          ) : (
            <>
              <ReviewPracticeLaunch
                eligibleCount={practiceEligibleCount}
                dominantTheme={
                  selectedCoachAnnotation?.category_label ??
                  filteredSections.to_review[0]?.category_label ??
                  "moments prioritaires"
                }
                onStartPractice={onStartPractice}
                onOpenExplorer={() => handleReviewFocusChange("lab")}
              />
              <ReviewPracticeHistory
                sessions={practiceHistory}
                isLoading={practiceHistoryLoading}
                error={practiceHistoryError}
                onRefresh={onPracticeHistoryRefresh}
                onResume={onPracticeResumeSession}
                onViewSummary={onPracticeViewSessionSummary}
                onRetryFailed={onPracticeRetryFailedSession}
              />
            </>
          )
        )}
        {effectiveFocus === "lab" && (
          <ReviewLaboratoryPanel
            review={review}
            filteredSections={filteredSections}
            povContext={povContext}
            activeSection={activeSection}
            selectedCoachPly={selectedCoachAnnotation?.ply ?? selectedMovePly}
            selectedMovePly={selectedMovePly}
            onSectionChange={handleCoachSectionChange}
            onSelectAnnotation={handleExplorerAnnotationSelect}
            onOpenLessonAnnotation={openLessonForAnnotation}
            onReplayLineAnnotation={handleExplorerReplayLine}
            openingIntentionNote={openingIntentionNote}
            onOpeningIntentionNoteChange={onOpeningIntentionNoteChange}
            onShowOpeningExit={onShowOpeningExit}
            onShowOpeningLinkedMoment={onShowOpeningLinkedMoment}
            analysisProfile={analysisProfile}
            resetPicker={resetPicker}
            onRetry={onRetry}
            onToggleResetPicker={() => setResetPickerOpen((open) => !open)}
            selectedMomentId={selectedMomentId}
            hideEvaluation={hideEvaluation}
            onShowMoment={onShowMoment}
          />
        )}
        {showNoSignificantMessage && (
          <div className="review-message">
            <span>{REVIEW_NO_SIGNIFICANT_MOMENTS_MESSAGE}</span>
          </div>
        )}
      </>
    );
  }

  if (practiceState?.active) {
    return (
      <div className="review-content">
        <div className="panel-title">Review coach</div>
        {renderFocusedReviewModule()}
      </div>
    );
  }

  if (displayStatus === "not_reviewable") {
    return (
      <ReviewMessage>
        <span>{review?.message ?? REVIEW_NOT_REVIEWABLE_MESSAGE}</span>
      </ReviewMessage>
    );
  }

  if (reviewJob?.derived_needs_reconcile && reviewJob.can_reconcile) {
    return (
      <ReviewMessage>
        <div className="review-job-progress" data-testid="review-status">
          <strong>{reviewJobReconcileTitle(reviewJob)}</strong>
          <span>
            {reviewJob.completed_position_count}/{reviewJob.required_position_count} positions
          </span>
          <span>{reviewJobReconcileMessage(reviewJob)}</span>
          <div className="review-action-row">
            <button
              data-testid="review-reconcile"
              onClick={onReconcileJob}
              disabled={reviewReconcileInFlight}
            >
              {reviewReconcileInFlight ? fr.actions.checkRepairing : fr.actions.repairAnalysis}
            </button>
            <button data-testid="review-resume" onClick={() => onRetry()}>
              {fr.actions.resume}
            </button>
            <button onClick={() => setResetPickerOpen((open) => !open)}>
              {fr.actions.restartFromZero}
            </button>
          </div>
          {resetPicker}
        </div>
      </ReviewMessage>
    );
  }

  if (
    reviewJob?.status === "queued" ||
    reviewJob?.status === "running" ||
    reviewJob?.status === "finalizing"
  ) {
    const isFinalizing = reviewJob.status === "finalizing";
    const isCheckingLastPosition =
      !isFinalizing &&
      reviewJob.current_phase === "analyzing_position" &&
      reviewJob.percent >= 95;
    const elapsedSeconds = reviewJobElapsedSeconds(reviewJob);
    return (
      <ReviewMessage>
        <div className="review-job-progress" data-testid="review-progress">
          <strong>
            {isFinalizing
              ? fr.analysis.finalizingReview
              : `Analyse ${reviewJob.profile} en cours`}
          </strong>
          <progress data-testid="review-progress-bar" value={reviewJob.percent} max={100} />
          <span>
            {reviewJob.completed_position_count}/{reviewJob.required_position_count} positions · {reviewJob.percent} %
          </span>
          <span>
            Temps écoulé : {elapsedSeconds}s · restant estimé : {reviewJob.estimated_remaining_seconds}s
          </span>
          <span>
            Stockfish · Threads {String(reviewJob.settings?.analysis_threads ?? "?")} · Hash {String(reviewJob.settings?.analysis_hash_mb ?? "?")} MB · MultiPV {String(reviewJob.settings?.requested_multipv ?? "?")} · time-only
          </span>
          {(isFinalizing || isCheckingLastPosition) && (
            <span>
              {isFinalizing
                ? "Construction du score et des moments."
                : "Vérification de la dernière position..."}
            </span>
          )}
          {!isFinalizing && (
            <button onClick={onCancelJob} disabled={!reviewJob.can_cancel}>
              Annuler
            </button>
          )}
        </div>
      </ReviewMessage>
    );
  }

  if (
    reviewJob?.status === "failed" ||
    reviewJob?.status === "cancelled" ||
    reviewJob?.status === "incomplete" ||
    reviewJob?.status === "stalled"
  ) {
    return (
      <ReviewMessage>
        <div className="review-job-progress" data-testid="review-status">
          <strong>{reviewJobStatusTitle(reviewJob)}</strong>
          <span>
            {reviewJob.completed_position_count}/{reviewJob.required_position_count} positions
          </span>
          {reviewJob.error_message && <span>{reviewJob.error_message}</span>}
          {reviewJob.retryable &&
            !reviewJob.error_message?.includes(REVIEW_RETRY_COPY) && (
              <span>{REVIEW_RETRY_COPY}</span>
            )}
          {reviewJob.last_error && (
            <details className="review-job-debug">
              <summary>Debug technique</summary>
              <code>
                {reviewJob.last_error}
                {reviewJob.current_fen_key
                  ? ` · fen_key=${reviewJob.current_fen_key}`
                  : ""}
                {reviewJob.current_phase
                  ? ` · phase=${reviewJob.current_phase}`
                  : ""}
                {reviewJob.attempts_for_current_position
                  ? ` · attempts=${reviewJob.attempts_for_current_position}`
                  : ""}
              </code>
            </details>
          )}
          <div className="review-action-row">
            <button data-testid="review-resume" onClick={() => onRetry()}>{fr.actions.resume}</button>
            <button onClick={() => setResetPickerOpen((open) => !open)}>
              {fr.actions.restartFromZero}
            </button>
          </div>
          {resetPicker}
        </div>
      </ReviewMessage>
    );
  }

  if (
    review?.status === "incomplete" ||
    review?.review_analysis_state === "incomplete"
  ) {
    return (
      <ReviewUnavailableWithPlanCard>
        <ReviewAnalysisUnavailableMessage
          title="Analyse non disponible"
          detail={`Analyse incomplète · ${review.completed_position_count ?? review.deep_done_count ?? 0}/${
            review.required_position_count ?? review.total_required_deep_count ?? 0
          } positions`}
          analysisProfile={analysisProfile}
          onAnalysisProfileChange={onAnalysisProfileChange}
          onRunRecommended={() => onRetry({ profile: "standard" })}
          onRunStandard={() => onRetry({ profile: "standard" })}
          onRunDeep={() => onRetry({ profile: "deep" })}
          resetPicker={resetPicker}
          onToggleResetPicker={() => setResetPickerOpen((open) => !open)}
        />
      </ReviewUnavailableWithPlanCard>
    );
  }

  if (displayStatus === "failed") {
    return (
      <ReviewMessage>
        <span>{uiState.error ?? error ?? "L'analyse n'a pas pu se terminer."}</span>
        <button onClick={() => onRetry()}>{fr.actions.relaunchAnalysis}</button>
      </ReviewMessage>
    );
  }

  if (displayStatus === "stalled") {
    const hasFailedDeep = Number(review?.failed_deep_count ?? 0) > 0;
    return (
      <ReviewMessage>
        <span>
          {hasFailedDeep
            ? REVIEW_FAILED_DEEP_MESSAGE
            : uiState.error ?? error ?? review?.message ?? REVIEW_STALLED_MESSAGE}
        </span>
        <button onClick={() => onRetry({ forceRetryFailed: hasFailedDeep })}>
          {fr.actions.relaunchAnalysis}
        </button>
      </ReviewMessage>
    );
  }

  if (displayStatus === "timeout") {
    return (
      <ReviewMessage>
        <span>{uiState.error ?? REVIEW_TIMEOUT_MESSAGE}</span>
        <button onClick={() => onRetry()}>{fr.actions.relaunchAnalysis}</button>
      </ReviewMessage>
    );
  }

  if (hasNoSignificantMoments) {
    return (
      <div className="review-content">
        <div className="panel-title">Review coach</div>
        {/* REVIEW_NO_SIGNIFICANT_MOMENTS_MESSAGE is rendered by the focused module. */}
        {renderFocusedReviewModule(true)}
      </div>
    );
  }

  if (displayStatus === "pending_background") {
    return (
      <ReviewMessage>
        <span>{uiState.error ?? REVIEW_PENDING_BACKGROUND_MESSAGE}</span>
        <button onClick={onCheck}>{fr.actions.checkAgain}</button>
      </ReviewMessage>
    );
  }

  if (displayStatus === "pending" || displayStatus === "generating") {
    const done = review?.completed_position_count ?? review?.deep_done_count ?? 0;
    const total = review?.required_position_count ?? review?.total_required_deep_count ?? 0;
    return (
      <ReviewMessage>
        <span className="spinner" aria-hidden="true" />
        <span>
          Analyse approfondie en cours : {done}/{total} positions
        </span>
        <span>
          Temps prévu : environ {review?.total_budget_seconds ?? 0}s · Mode :{" "}
          {review?.review_analysis_profile ?? "standard"}
        </span>
      </ReviewMessage>
    );
  }

  if (!review || review.status === "not_generated") {
    return (
      <ReviewUnavailableWithPlanCard>
        <ReviewAnalysisUnavailableMessage
          title="Analyse non disponible"
          detail="L'analyse recommandée utilise un profil fiable pour construire la Review."
          analysisProfile={analysisProfile}
          onAnalysisProfileChange={onAnalysisProfileChange}
          onRunRecommended={() => onGenerate({ profile: "standard" })}
          onRunStandard={() => onGenerate({ profile: "standard" })}
          onRunDeep={() => onGenerate({ profile: "deep" })}
        />
      </ReviewUnavailableWithPlanCard>
    );
  }

  return (
    <div className="review-content">
      <div className="panel-title">Review coach</div>
      {renderFocusedReviewModule()}
      {displayStatus === "partial" && (
        <div className="review-note">
          Review partielle : certaines positions n'ont pas pu être analysées.
        </div>
      )}

      {review.message && (
        <div className="review-empty">{review.message}</div>
      )}

    </div>
  );
}

function ReviewUnavailableWithPlanCard({ children }: { children: ReactNode }) {
  return (
    <div className="review-unavailable-plan-layout">
      {children}
      <section className="review-construction-summary" aria-label="Review en preparation">
        <span>Review en preparation</span>
        <strong>Analyse recommandee</strong>
        <p>
          Lance une analyse standard pour construire un resume coach, trois
          moments cles et une session d'entrainement fiable.
        </p>
      </section>
    </div>
  );
}

export default ReviewPanel;
