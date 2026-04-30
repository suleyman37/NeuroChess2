import { useState } from "react";
import type { ReactNode } from "react";
import type {
  ReviewMoment,
  OpeningRealityEvidence,
  ReviewJobResponse,
  ReviewMoveAnnotation,
  ReviewPracticeItem,
  ReviewPracticeSessionListItem,
  ReviewPracticeSummary,
  ReviewPvLineMove,
  ReviewResponse,
  ReviewSections,
  ReviewScoreAuditRow,
  ReviewScoreDebug,
} from "../api/client";
import { makeEvaluationDisplayFromEngineScore } from "../evaluationDisplay";
import {
  REVIEW_FAILED_DEEP_MESSAGE,
  REVIEW_NOT_REVIEWABLE_MESSAGE,
  REVIEW_NO_SIGNIFICANT_MOMENTS_MESSAGE,
  REVIEW_PENDING_BACKGROUND_MESSAGE,
  REVIEW_STALLED_MESSAGE,
  REVIEW_TIMEOUT_MESSAGE,
  reviewPanelDisplayStatus,
  type ReviewUiState,
} from "../reviewState";

type ReviewPanelProps = {
  review: ReviewResponse | null;
  reviewJob: ReviewJobResponse | null;
  error: string | null;
  uiState: ReviewUiState;
  selectedMomentId: string | null;
  onGenerate: (options?: ReviewRunOptions) => void;
  onRetry: (options?: ReviewRunOptions) => void;
  onForceReanalysis: (profile?: "standard" | "deep") => void;
  onCancelJob: () => void;
  onReconcileJob: () => void;
  reviewReconcileInFlight: boolean;
  onCheck: () => void;
  onRebuildMetrics: () => void;
  onShowMoment: (
    moment: ReviewMoment,
    index: number,
    moveMode?: "played" | "best",
  ) => void;
  onShowAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
    mode?: "before" | "played" | "best",
  ) => void;
  onShowOpeningExit: (evidence: OpeningRealityEvidence) => void;
  onShowOpeningLinkedMoment: (ply: number, evidence?: OpeningRealityEvidence) => void;
  openingIntentionNote: string;
  onOpeningIntentionNoteChange: (note: string) => void;
  onGuidedReplayAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
  ) => void;
  onTryMoveAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
  ) => void;
  onShowPvLineAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
    lineMode?: ReviewPvLineMode,
  ) => void;
  onTryMoveReset: () => void;
  onTryMoveRevealSolution: () => void;
  tryMoveState: ReviewTryMoveViewState | null;
  solutionRevealState: ReviewSolutionRevealViewState | null;
  onSolutionHintAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
  ) => void;
  onSolutionReset: (reason: string) => void;
  practiceState: ReviewPracticeViewState | null;
  practicePvLineState: ReviewPvLineViewState | null;
  onStartPractice: () => void;
  onPracticeHint: () => void;
  onPracticeRevealSolution: () => void;
  onPracticeSkip: () => void;
  onPracticeTryAgain: () => void;
  onPracticeNext: () => void;
  onPracticeShowPvLine: (lineMode?: ReviewPvLineMode) => void;
  onPracticePvPrevious: () => void;
  onPracticePvNext: () => void;
  onPracticePvRestart: () => void;
  onPracticePvToggleAutoplay: () => void;
  onPracticePvSelectLine: (lineMode: ReviewPvLineMode) => void;
  onPracticePvClose: () => void;
  onPracticeQuit: () => void;
  onPracticeRetryFailed: () => void;
  onPracticeRedoAll: () => void;
  practiceHistory: ReviewPracticeSessionListItem[];
  practiceHistoryLoading: boolean;
  practiceHistoryError: string | null;
  onPracticeHistoryRefresh: () => void;
  onPracticeResumeSession: (sessionId: number | string) => void;
  onPracticeViewSessionSummary: (sessionId: number | string) => void;
  onPracticeRetryFailedSession: (sessionId: number | string) => void;
  selectedReviewPov: ReviewPov;
  onReviewPovChange: (pov: ReviewPov) => void;
  onReviewFocusChange: (focus: string) => void;
  selectedMovePly: number | null;
  hideEvaluation: boolean;
  analysisProfile: "quick" | "standard" | "deep";
  onAnalysisProfileChange: (profile: "quick" | "standard" | "deep") => void;
};

type ReviewRunOptions = {
  forceRetryFailed?: boolean;
  forceReanalysis?: boolean;
  profile?: "standard" | "deep";
};

export type ReviewTryMoveViewState = {
  active: boolean;
  annotationPly: number | null;
  attemptedUci: string | null;
  attemptedSan: string | null;
  feedback: {
    result: "best" | "very_good" | "acceptable" | "wrong" | "illegal" | "unknown" | string;
    message: string;
    show_best_move: boolean;
  } | null;
  solutionRevealed: boolean;
};

export type ReviewSolutionRevealMode =
  | "hidden"
  | "hint_shown"
  | "attempted"
  | "played_move_shown"
  | "solution_revealed"
  | "pv_line";

export type ReviewSolutionRevealViewState = {
  key: string | null;
  ply: number | null;
  pov: ReviewPov;
  state: ReviewSolutionRevealMode;
};

export type ReviewPracticeViewState = {
  active: boolean;
  sessionId: number | string | null;
  status: "starting" | "running" | "completed";
  itemState:
    | "awaiting_attempt"
    | "hint_shown"
    | "attempted"
    | "solution_revealed"
    | "pv_line"
    | "completed";
  items: ReviewPracticeItem[];
  currentIndex: number;
  attemptedUci: string | null;
  attemptedSan: string | null;
  feedback: ReviewTryMoveViewState["feedback"];
  solutionRevealed: boolean;
  hintVisible: boolean;
  summary: ReviewPracticeSummary | null;
  error: string | null;
  saving: boolean;
};

export type ReviewPvLineViewState = {
  active: boolean;
  moves: ReviewPvLineMove[];
  currentIndex: number;
  currentFen: string;
  autoplay: boolean;
  message: string | null;
  lineMode: ReviewPvLineMode;
  playedLineAvailable: boolean;
  solutionLineAvailable: boolean;
};

export type ReviewPov = "user" | "white" | "black" | "both";
export type ReviewPvLineMode = "played" | "solution";
type ReviewFocusKey = "coach" | "opening" | "practice" | "explorer";

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
  onRebuildMetrics,
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
  const [activeFocus, setActiveFocus] = useState<ReviewFocusKey>("coach");
  const [selectedCoachPly, setSelectedCoachPly] = useState<number | null>(null);
  const displayStatus = reviewPanelDisplayStatus(review, uiState);
  const povContext = reviewPovContext(review, selectedReviewPov);
  const filteredSections = filteredReviewSections(review, povContext.targetColor);
  const practiceEligibleCount = countPracticeEligibleItems(filteredSections);
  const effectiveFocus: ReviewFocusKey = practiceState?.active ? "practice" : activeFocus;
  const selectedCoachAnnotation = selectedCoachAnnotationForReview(
    review,
    selectedCoachPly,
    selectedMovePly,
    activeSection,
    povContext.targetColor,
  );
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
  function handleReviewPovChange(nextPov: ReviewPov) {
    setSelectedCoachPly(null);
    setActiveSection("to_review");
    onReviewPovChange(nextPov);
  }

  function handleReviewFocusChange(nextFocus: ReviewFocusKey) {
    setActiveFocus(nextFocus);
    onReviewFocusChange(nextFocus);
  }

  function handleCoachSectionChange(section: ReviewSectionKey) {
    onSolutionReset("review_section_changed");
    setSelectedCoachPly(null);
    setActiveSection(section);
  }

  function handleCoachAnnotationSelect(ply: number | null) {
    onSolutionReset("review_moment_changed");
    setSelectedCoachPly(ply);
  }

  function renderFocusedReviewModule(showNoSignificantMessage = false) {
    return (
      <>
        <ReviewFocusTabs
          activeFocus={effectiveFocus}
          onFocusChange={handleReviewFocusChange}
        />
        {effectiveFocus === "coach" && (
          <ReviewCoachMomentCard
            annotation={selectedCoachAnnotation}
            index={annotationIndex(review, selectedCoachAnnotation)}
            active={selectedMovePly === selectedCoachAnnotation?.ply}
            onShowAnnotation={onShowAnnotation}
            onGuidedReplayAnnotation={onGuidedReplayAnnotation}
            onTryMoveAnnotation={onTryMoveAnnotation}
            onShowPvLineAnnotation={onShowPvLineAnnotation}
            onTryMoveReset={onTryMoveReset}
            onTryMoveRevealSolution={onTryMoveRevealSolution}
            tryMoveState={tryMoveState}
            solutionRevealState={solutionRevealState}
            onSolutionHintAnnotation={onSolutionHintAnnotation}
            povContext={povContext}
          />
        )}
        {effectiveFocus === "opening" && (
          <OpeningRealityCard
            evidence={review?.opening_reality_evidence ?? null}
            intentionNote={openingIntentionNote}
            onIntentionNoteChange={onOpeningIntentionNoteChange}
            onShowOpeningExit={onShowOpeningExit}
            onShowOpeningLinkedMoment={onShowOpeningLinkedMoment}
          />
        )}
        {effectiveFocus === "practice" && (
          practiceState?.active ? (
            <ReviewPracticeSessionPanel
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
                onStartPractice={onStartPractice}
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
        {effectiveFocus === "explorer" && (
          <ReviewMomentNavigator
            review={review}
            filteredSections={filteredSections}
            povContext={povContext}
            activeSection={activeSection}
            selectedCoachPly={selectedCoachAnnotation?.ply ?? selectedMovePly}
            selectedMovePly={selectedMovePly}
            onSectionChange={handleCoachSectionChange}
            onSelectAnnotation={handleCoachAnnotationSelect}
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
              {reviewReconcileInFlight ? "Vérification..." : "Vérifier / réparer l'analyse"}
            </button>
            <button data-testid="review-resume" onClick={() => onRetry()}>
              Reprendre
            </button>
            <button onClick={() => setResetPickerOpen((open) => !open)}>
              Relancer depuis zéro
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
    return (
      <ReviewMessage>
        <div className="review-job-progress" data-testid="review-progress">
          <strong>
            {isFinalizing
              ? "Finalisation de la Review... Toutes les positions ont été analysées."
              : `Analyse ${reviewJob.profile} en cours`}
          </strong>
          <progress data-testid="review-progress-bar" value={reviewJob.percent} max={100} />
          <span>
            {reviewJob.completed_position_count}/{reviewJob.required_position_count} positions · {reviewJob.percent} %
          </span>
          <span>
            Temps écoulé : {reviewJob.elapsed_seconds}s · restant estimé : {reviewJob.estimated_remaining_seconds}s
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
          {reviewJob.retryable && (
            <span>Vous pouvez reprendre l'analyse.</span>
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
            <button data-testid="review-resume" onClick={() => onRetry()}>Reprendre</button>
            <button onClick={() => setResetPickerOpen((open) => !open)}>
              Relancer depuis zéro
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
      <ReviewMessage>
        <div className="review-job-progress" data-testid="review-status">
          <strong>Analyse incomplète</strong>
          <span>
            {review.completed_position_count ?? review.deep_done_count ?? 0}/
            {review.required_position_count ?? review.total_required_deep_count ?? 0} positions
          </span>
          <div className="review-action-row">
            <button data-testid="review-resume" onClick={() => onRetry()}>Reprendre</button>
            <button onClick={() => setResetPickerOpen((open) => !open)}>
              Relancer depuis zéro
            </button>
          </div>
          {resetPicker}
        </div>
      </ReviewMessage>
    );
  }

  if (displayStatus === "failed") {
    return (
      <ReviewMessage>
        <span>{uiState.error ?? error ?? "L'analyse n'a pas pu se terminer."}</span>
        <button onClick={() => onRetry()}>Relancer l'analyse</button>
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
          Relancer l'analyse
        </button>
      </ReviewMessage>
    );
  }

  if (displayStatus === "timeout") {
    return (
      <ReviewMessage>
        <span>{uiState.error ?? REVIEW_TIMEOUT_MESSAGE}</span>
        <button onClick={() => onRetry()}>Relancer l'analyse</button>
      </ReviewMessage>
    );
  }

  if (hasNoSignificantMoments) {
    return (
      <div className="review-content">
        <div className="panel-title">Review coach</div>
        <ReviewScoreSummary
          review={review}
          povContext={povContext}
          filteredSections={filteredSections}
          onPovChange={handleReviewPovChange}
          onRebuildMetrics={onRebuildMetrics}
        />
        {/* REVIEW_NO_SIGNIFICANT_MOMENTS_MESSAGE is rendered by the focused module. */}
        {renderFocusedReviewModule(true)}
        {!practiceState?.active && (
          <ReviewAnalysisOptions
            review={review}
            analysisProfile={analysisProfile}
            resetPicker={resetPicker}
            onRetry={onRetry}
            onToggleResetPicker={() => setResetPickerOpen((open) => !open)}
          />
        )}
      </div>
    );
  }

  if (displayStatus === "pending_background") {
    return (
      <ReviewMessage>
        <span>{uiState.error ?? REVIEW_PENDING_BACKGROUND_MESSAGE}</span>
        <button onClick={onCheck}>Vérifier à nouveau</button>
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
      <ReviewMessage>
        <span>Cette partie peut être relue avec l'analyse approfondie.</span>
        <ReviewAnalysisProfileSelector
          value={analysisProfile}
          onChange={onAnalysisProfileChange}
        />
        <button onClick={() => onGenerate({ profile: "standard" })}>
          Analyse standard recommandée
        </button>
        <button onClick={() => onGenerate({ profile: "deep" })}>
          Analyse approfondie
        </button>
      </ReviewMessage>
    );
  }

  return (
    <div className="review-content">
      <div className="panel-title">Review coach</div>
      <ReviewScoreSummary
        review={review}
        povContext={povContext}
        filteredSections={filteredSections}
        onPovChange={handleReviewPovChange}
        onRebuildMetrics={onRebuildMetrics}
      />
      {renderFocusedReviewModule()}
      {!practiceState?.active && (
        <ReviewAnalysisOptions
          review={review}
          analysisProfile={analysisProfile}
          resetPicker={resetPicker}
          onRetry={onRetry}
          onToggleResetPicker={() => setResetPickerOpen((open) => !open)}
        />
      )}
      {displayStatus === "partial" && (
        <div className="review-note">
          Review partielle : certaines positions n'ont pas pu être analysées.
        </div>
      )}

      {review.message && (
        <div className="review-empty">{review.message}</div>
      )}

      {review.moments.length > 0 && (
        <details className="review-legacy-moments">
          <summary>Moments moteur historiques</summary>
          <ReviewLegacyMoments
            review={review}
            selectedMomentId={selectedMomentId}
            hideEvaluation={hideEvaluation}
            onShowMoment={onShowMoment}
          />
        </details>
      )}
    </div>
  );
}

type ReviewSectionKey =
  | "to_review"
  | "strong_moves"
  | "missed_opportunities"
  | "all";

const REVIEW_SECTION_TABS: Array<{
  key: ReviewSectionKey;
  label: string;
  emptyLabel: string;
}> = [
  {
    key: "to_review",
    label: "À revoir",
    emptyLabel: "Aucun coup prioritaire à revoir.",
  },
  {
    key: "strong_moves",
    label: "Coups forts",
    emptyLabel: "Aucun coup fort détecté.",
  },
  {
    key: "missed_opportunities",
    label: "Opportunités",
    emptyLabel: "Aucune opportunité manquée détectée.",
  },
  {
    key: "all",
    label: "Tous",
    emptyLabel: "Aucun coup annoté disponible.",
  },
];

const REVIEW_FOCUS_TABS: Array<{ key: ReviewFocusKey; label: string }> = [
  { key: "coach", label: "Moment coach" },
  { key: "opening", label: "Ouverture" },
  { key: "practice", label: "Entraînement" },
  { key: "explorer", label: "Explorer" },
];

function ReviewFocusTabs({
  activeFocus,
  onFocusChange,
}: {
  activeFocus: ReviewFocusKey;
  onFocusChange: (focus: ReviewFocusKey) => void;
}) {
  return (
    <div className="review-focus-tabs" role="tablist" aria-label="Focus Review">
      {REVIEW_FOCUS_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          className={`review-focus-tab ${activeFocus === tab.key ? "active" : ""}`}
          aria-selected={activeFocus === tab.key}
          onClick={() => onFocusChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function OpeningRealityCard({
  evidence,
  intentionNote,
  onIntentionNoteChange,
  onShowOpeningExit,
  onShowOpeningLinkedMoment,
}: {
  evidence: OpeningRealityEvidence | null;
  intentionNote: string;
  onIntentionNoteChange: (note: string) => void;
  onShowOpeningExit: (evidence: OpeningRealityEvidence) => void;
  onShowOpeningLinkedMoment: (ply: number, evidence?: OpeningRealityEvidence) => void;
}) {
  if (!evidence) {
    return null;
  }

  const linkedMoment = evidence.critical_moment_after_exit ?? null;
  const canReviewExit = Boolean(evidence.fen_before_exit ?? evidence.out_of_book_fen);
  const canShowLinkedMoment = typeof linkedMoment?.ply === "number";

  if (evidence.status === "not_applicable_from_position") {
    return (
      <section className="review-opening-reality compact" aria-label="Réalité de l'ouverture">
        <div className="review-block-title">
          <span>Réalité de l'ouverture</span>
          <strong>spéciale</strong>
        </div>
        <p>Ouverture non applicable — position initiale spéciale.</p>
      </section>
    );
  }

  if (!evidence.available) {
    return (
      <section className="review-opening-reality compact" aria-label="Réalité de l'ouverture">
        <div className="review-block-title">
          <span>Réalité de l'ouverture</span>
          <strong>à compléter</strong>
        </div>
        <p>
          {evidence.summary ??
            "Données d'ouverture insuffisantes pour établir un diagnostic fiable."}
        </p>
      </section>
    );
  }

  return (
    <section className="review-opening-reality" aria-label="Réalité de l'ouverture">
      <div className="review-block-title">
        <span>Réalité de l'ouverture</span>
        <strong>{openingRealityConfidenceLabel(evidence.confidence)}</strong>
      </div>
      <div className="review-opening-grid">
        <div>
          <span>Ouverture</span>
          <strong>
            {evidence.opening_name ?? "non classifiée"}
            {evidence.eco ? ` · ${evidence.eco}` : ""}
          </strong>
        </div>
        <div>
          <span>Dernier coup de livre</span>
          <strong>
            {typeof (evidence.last_book_ply ?? evidence.book_until_ply) === "number"
              ? `jusqu'au ${openingMoveLabel(evidence.last_book_ply ?? evidence.book_until_ply ?? 0)}`
              : "limite inconnue"}
          </strong>
        </div>
        <div>
          <span>Coup de sortie</span>
          <strong>
            {typeof (evidence.exit_ply ?? evidence.out_of_book_ply) === "number"
              ? `${openingMoveLabel(evidence.exit_ply ?? evidence.out_of_book_ply ?? 0)} — ${openingSanLabel(
                  evidence.exit_move_san ?? evidence.out_of_book_move_san,
                  evidence.exit_color ?? evidence.side_to_move_at_exit,
                )}`
              : "sortie inconnue"}
          </strong>
        </div>
        <div>
          <span>Après la sortie</span>
          <strong>{openingLinkedMomentLabel(linkedMoment)}</strong>
        </div>
      </div>
      <p className="review-opening-summary">
        {evidence.summary ?? "Diagnostic d'ouverture disponible."}
      </p>
      <div className="review-action-row">
        <button
          type="button"
          onClick={() => onShowOpeningExit(evidence)}
          disabled={!canReviewExit}
        >
          Revoir la sortie
        </button>
        <button
          type="button"
          onClick={() => {
            if (typeof linkedMoment?.ply === "number") {
              onShowOpeningLinkedMoment(linkedMoment.ply, evidence);
            }
          }}
          hidden={!canShowLinkedMoment}
          disabled={!canShowLinkedMoment}
        >
          Voir le moment lié
        </button>
      </div>
      {!canShowLinkedMoment && (
        <p className="review-opening-summary">
          Pas de gros problème détecté juste après la sortie.
        </p>
      )}
      <details className="review-opening-intention">
        <summary>Intention d'ouverture</summary>
        <label>
          <span>Note personnelle</span>
          <input
            value={intentionNote}
            onChange={(event) => onIntentionNoteChange(event.target.value)}
            placeholder="Ex. Je voulais jouer la Caro-Kann"
          />
        </label>
        {intentionNote.trim() && (
          <p>
            Intention déclarée : {intentionNote.trim()} · Ouverture détectée :{" "}
            {evidence.opening_name ?? "non classifiée"}
          </p>
        )}
      </details>
    </section>
  );
}

function ReviewCoachMomentCard({
  annotation,
  index,
  active,
  onShowAnnotation,
  onGuidedReplayAnnotation,
  onTryMoveAnnotation,
  onShowPvLineAnnotation,
  onTryMoveReset,
  onTryMoveRevealSolution,
  tryMoveState,
  solutionRevealState,
  onSolutionHintAnnotation,
  povContext,
}: {
  annotation: ReviewMoveAnnotation | null;
  index: number;
  active: boolean;
  onShowAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
    mode?: "before" | "played" | "best",
  ) => void;
  onGuidedReplayAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
  ) => void;
  onTryMoveAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
  ) => void;
  onShowPvLineAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
    lineMode?: ReviewPvLineMode,
  ) => void;
  onTryMoveReset: () => void;
  onTryMoveRevealSolution: () => void;
  tryMoveState: ReviewTryMoveViewState | null;
  solutionRevealState: ReviewSolutionRevealViewState | null;
  onSolutionHintAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
  ) => void;
  povContext: ReviewPovContext;
}) {
  if (!annotation) {
    return null;
  }

  const explanation = annotation.pedagogical_explanation;
  const contrastCoach = annotation.contrast_coach_explanation;
  const hasContrastCoach = Boolean(contrastCoach?.available);
  const tone = coachTone(annotation, explanation?.error_type);
  const tags = annotation.tag_labels?.length
    ? annotation.tag_labels
    : annotation.tags;
  const moveTitle =
    annotation.coach_card_title ??
    `Coup ${annotation.move_number} — ${reviewColorLabel(annotation.color)} jouent ${
      annotation.san ?? annotation.uci
    }`;
  const impactValue = impactPercentage(annotation.win_loss);
  const tryActiveForAnnotation =
    tryMoveState?.active && tryMoveState.annotationPly === annotation.ply;
  const isUserLanguage = povContext.isUserPov;
  const colorName = reviewColorLabel(annotation.color).toLowerCase();
  const revealMode =
    solutionRevealState?.ply === annotation.ply
      ? solutionRevealState.state
      : "hidden";
  const hasAttempted =
    revealMode === "attempted" || Boolean(tryActiveForAnnotation && tryMoveState?.feedback);
  const hasPlayedMoveOnly = revealMode === "played_move_shown";
  const canShowSolutionData =
    revealMode === "solution_revealed" ||
    revealMode === "pv_line" ||
    hasAttempted ||
    Boolean(tryActiveForAnnotation && tryMoveState?.solutionRevealed);
  const hintVisible = revealMode === "hint_shown";
  const canShowAnyPvLine = reviewAnnotationHasAnyPvLine(annotation);
  const hiddenPrompt = isUserLanguage
    ? "À toi de jouer : trouve le meilleur coup."
    : `À toi de jouer pour les ${colorName}.`;
  const displayedMoveTitle =
    canShowSolutionData || hasPlayedMoveOnly
      ? moveTitle
      : `Coup ${annotation.move_number} — ${reviewColorLabel(annotation.color)} au trait`;

  return (
    <section
      className={`review-coach-moment review-coach-moment-${tone} ${
        active ? "active" : ""
      }`}
      aria-label="Moment coach courant"
    >
      <div className="review-coach-moment-head">
        <div>
          <span>Moment coach</span>
          <h3>{displayedMoveTitle}</h3>
        </div>
        <strong className="review-coach-type">
          {errorTypeLabel(explanation?.error_type, annotation)}
        </strong>
      </div>

      <div className="review-coach-badges">
        <span className={`review-coach-badge review-coach-badge-${tone}`}>
          {annotation.category_label}
        </span>
        {tags.slice(0, 2).map((tag) => (
          <span className="review-tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      <p className="review-coach-main">
        {canShowSolutionData || hasPlayedMoveOnly
          ? coachTextForPov(
              explanation?.main_message ?? humanReason(annotation),
              povContext,
              annotation,
            )
          : hiddenPrompt}
      </p>

      {canShowSolutionData ? (
        <ReviewLineComparison
          annotation={annotation}
          index={index}
          contrastCoach={contrastCoach ?? {}}
          explanation={explanation}
          povContext={povContext}
          onShowPvLineAnnotation={onShowPvLineAnnotation}
        />
      ) : (
        <div className="review-coach-grid">
          {!canShowSolutionData && !hasPlayedMoveOnly && (
            <>
              <CoachExplanationBlock
                title="Objectif"
                text={hiddenCoachObjective(annotation, explanation)}
              />
              {hintVisible && (
                <CoachExplanationBlock
                  title="Indice"
                  text={practiceHintForAnnotation(annotation)}
                />
              )}
            </>
          )}
          {hasPlayedMoveOnly && (
            <CoachExplanationBlock
              title={isUserLanguage ? "Ton coup" : "Coup joué"}
              text={annotation.san ?? annotation.uci ?? "Coup joué non disponible."}
            />
          )}
          {canShowSolutionData && (
            <CoachExplanationBlock
              title={isUserLanguage ? "Ce que tu as raté" : "Ce que le joueur a raté"}
              text={coachTextForPov(explanation?.missed_idea, povContext, annotation)}
            />
          )}
          <CoachExplanationBlock
            title={
              isUserLanguage
                ? "Pourquoi ton coup pose problème"
                : `Pourquoi le coup des ${colorName} pose problème`
            }
            text={
              hasPlayedMoveOnly || canShowSolutionData
                ? coachTextForPov(explanation?.why_played_move_bad, povContext, annotation)
                : null
            }
          />
          <CoachExplanationBlock
            title="Pourquoi le meilleur coup aide"
            text={
              canShowSolutionData
                ? coachTextForPov(explanation?.why_best_move_good, povContext, annotation)
                : null
            }
          />
          <CoachExplanationBlock
            title="À retenir"
            text={
              canShowSolutionData
                ? coachTextForPov(explanation?.training_takeaway, povContext, annotation)
                : null
            }
          />
        </div>
      )}

      <div className="review-coach-impact">
        <div>
          <span>
            {canShowSolutionData || hasPlayedMoveOnly
              ? isUserLanguage
                ? "Impact sur tes chances"
                : `Impact pour les ${colorName}`
              : "Impact potentiel"}
          </span>
          <strong>
            {canShowSolutionData || hasPlayedMoveOnly
              ? formatImpact(annotation.win_loss)
              : annotation.impact_label ?? impactLabelFromLoss(annotation.win_loss)}
          </strong>
          <em>
            {canShowSolutionData || hasPlayedMoveOnly
              ? annotation.impact_label ?? impactLabelFromLoss(annotation.win_loss)
              : "Ce moment a fortement influencé la partie."}
          </em>
        </div>
        <div className="review-impact-meter" aria-hidden="true">
          <span style={{ width: `${impactValue}%` }} />
        </div>
        <div>
          <span>{canShowSolutionData || hasPlayedMoveOnly ? "Qualité du coup" : "Défi"}</span>
          <strong>
            {canShowSolutionData || hasPlayedMoveOnly
              ? annotation.move_quality_label ?? moveQualityLabel(annotation.move_accuracy)
              : "Solution cachée"}
          </strong>
        </div>
      </div>

      {tryActiveForAnnotation && (
        <div className="review-try-move-panel">
          <strong>
            {isUserLanguage
              ? "À toi de jouer : retrouve le meilleur coup."
              : `À toi de jouer pour les ${colorName}.`}
          </strong>
          {!tryMoveState?.feedback && (
            <span>Joue directement sur l'échiquier. La partie réelle ne sera pas modifiée.</span>
          )}
          {tryMoveState?.feedback && (
            <>
              <span>
                {coachTextForPov(
                  tryMoveState.feedback.message,
                  povContext,
                  annotation,
                )}
              </span>
              {tryMoveState.attemptedUci && (
                <span>
                  {isUserLanguage ? "Ton coup" : "Coup joué"} :{" "}
                  {tryMoveState.attemptedSan ?? tryMoveState.attemptedUci}
                </span>
              )}
              {canShowSolutionData && (
                <span>
                  Solution : {annotation.best_move_san ?? annotation.best_move_uci ?? "non disponible"}
                </span>
              )}
              <div className="review-action-row">
                <button onClick={onTryMoveReset}>Essayer encore</button>
                <button onClick={onTryMoveRevealSolution}>Voir la solution</button>
                <button onClick={() => onGuidedReplayAnnotation(annotation, index)}>
                  Revoir l'explication
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="review-action-row">
        {annotation.try_move_supported && (
          <button onClick={() => onTryMoveAnnotation(annotation, index)}>
            Réessayer
          </button>
        )}
        <button onClick={() => onSolutionHintAnnotation(annotation, index)}>
          Indice
        </button>
        <button onClick={() => onGuidedReplayAnnotation(annotation, index)}>
          {canShowSolutionData ? "Revoir l'explication" : "Voir l'explication avec solution"}
        </button>
        <button onClick={() => onShowAnnotation(annotation, index, "played")}>
          {isUserLanguage ? "Ton coup" : "Coup joué"}
        </button>
        <button
          onClick={() => onShowAnnotation(annotation, index, "best")}
          disabled={!annotation.best_move_uci}
          title={
            annotation.best_move_uci
              ? "Révéler la solution depuis la même position"
              : "Solution non disponible"
          }
        >
          {canShowSolutionData ? "Solution" : "Voir la solution"}
        </button>
        <button
          onClick={() =>
            onShowPvLineAnnotation(
              annotation,
              index,
              reviewAnnotationHasSolutionPvLine(annotation) ? "solution" : "played",
            )
          }
          disabled={!canShowAnyPvLine || !canShowSolutionData}
          title={
            !canShowSolutionData
              ? "Révèle d'abord la solution pour voir la ligne"
              : canShowAnyPvLine
              ? "Voir la ligne proposée par le moteur"
              : annotation.pv_line_message ?? "Ligne complète indisponible"
          }
        >
          Voir la ligne
        </button>
      </div>
    </section>
  );
}

function ReviewLineComparison({
  annotation,
  index,
  contrastCoach,
  explanation,
  povContext,
  onShowPvLineAnnotation,
}: {
  annotation: ReviewMoveAnnotation;
  index: number;
  contrastCoach: NonNullable<ReviewMoveAnnotation["contrast_coach_explanation"]>;
  explanation: ReviewMoveAnnotation["pedagogical_explanation"];
  povContext: ReviewPovContext;
  onShowPvLineAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
    lineMode?: ReviewPvLineMode,
  ) => void;
}) {
  const evidence = annotation.pv_contrast_evidence;
  const playedBranch = evidence?.played_branch;
  const bestBranch = evidence?.best_branch;
  const isUserLanguage = povContext.isUserPov;
  const playedMove = annotation.san ?? annotation.uci ?? "Coup joué non disponible";
  const solutionMove =
    annotation.best_move_san ?? annotation.best_move_uci ?? "Solution indisponible";
  const opponentReply =
    playedBranch?.opponent_best_reply_san ??
    playedBranch?.opponent_best_reply_uci ??
    null;
  const playedLinePreview =
    contrastCoach.played_line_preview || pvContrastLinePreview(playedBranch?.pv);
  const solutionLinePreview =
    contrastCoach.best_line_preview ||
    pvContrastLinePreview(bestBranch?.pv) ||
    pvContrastLinePreview(annotation.pv_line);
  const playedLineAvailable = reviewAnnotationHasPlayedPvLine(annotation);
  const solutionLineAvailable = reviewAnnotationHasSolutionPvLine(annotation);
  const playedSummary =
    coachTextForPov(
      contrastCoach.what_happened_after_played,
      povContext,
      annotation,
    ) ??
    (opponentReply
      ? `Après le coup joué, l'adversaire peut répondre activement par ${opponentReply}.`
      : "Réponse adverse non disponible.");
  const solutionSummary =
    coachTextForPov(
      contrastCoach.why_solution_is_better,
      povContext,
      annotation,
    ) ??
    publicMainDifferenceText(contrastCoach, explanation);
  const mainDifference = publicMainDifferenceText(contrastCoach, explanation);
  const takeaway =
    coachTextForPov(
      contrastCoach.safe_takeaway ?? explanation?.training_takeaway,
      povContext,
      annotation,
    ) ?? "Compare les deux branches et cherche ce que la solution empêche.";

  return (
    <div className="review-line-comparison">
      <div className="review-line-comparison-head">
        <span>Comparaison des lignes</span>
        <strong>{mainDifference}</strong>
      </div>
      <div className="review-line-comparison-grid">
        <article className="review-line-card review-line-card-played">
          <span>{isUserLanguage ? "Après ton coup" : "Après le coup joué"}</span>
          <strong>Coup joué : {playedMove}</strong>
          <p>{playedSummary}</p>
          <p>
            Réponse adverse :{" "}
            {opponentReply ?? "réponse adverse non disponible."}
          </p>
          <p>
            Ligne du coup joué :{" "}
            {playedLinePreview || "ligne indisponible."}
          </p>
          <button
            type="button"
            onClick={() => onShowPvLineAnnotation(annotation, index, "played")}
            disabled={!playedLineAvailable}
          >
            Rejouer cette ligne
          </button>
        </article>
        <article className="review-line-card review-line-card-solution">
          <span>Avec la solution</span>
          <strong>Solution : {solutionMove}</strong>
          <p>Idée principale : {solutionSummary}</p>
          <p>
            Ligne de la solution :{" "}
            {solutionLinePreview || "ligne indisponible."}
          </p>
          <button
            type="button"
            onClick={() => onShowPvLineAnnotation(annotation, index, "solution")}
            disabled={!solutionLineAvailable}
          >
            Rejouer cette ligne
          </button>
        </article>
      </div>
      <div className="review-line-takeaway">
        <span>À retenir</span>
        <p>{takeaway}</p>
      </div>
    </div>
  );
}

function CoachExplanationBlock({
  title,
  text,
}: {
  title: string;
  text: string | null | undefined;
}) {
  if (!text) {
    return null;
  }
  return (
    <div className="review-coach-explanation">
      <span>{title}</span>
      <p>{text}</p>
    </div>
  );
}

function publicMainDifferenceText(
  explanation: ReviewMoveAnnotation["contrast_coach_explanation"],
  pedagogicalExplanation?: ReviewMoveAnnotation["pedagogical_explanation"],
): string | null {
  if (!explanation) {
    return null;
  }
  const type = explanation.main_difference_type ?? "unknown";
  if (
    pedagogicalExplanation?.error_type === "tactical" &&
    type !== "forcing" &&
    type !== "king_safety" &&
    type !== "unknown"
  ) {
    return `Le moment est tactique, et la différence dans la ligne concerne surtout ${mainDifferenceTopic(type)}.`;
  }
  return humanMainDifferenceSentence(type, explanation.main_difference);
}

function humanMainDifferenceSentence(
  type: string | null | undefined,
  fallback?: string | null,
): string {
  switch (type) {
    case "forcing":
      return "Différence principale : la solution est plus forcing.";
    case "material":
      return "Différence principale : la ligne change le bilan matériel.";
    case "king_safety":
      return "Différence principale : la sécurité du roi.";
    case "initiative":
      return "Différence principale : l'initiative.";
    case "conversion":
      return "Différence principale : la conversion de l'avantage.";
    case "defense":
      return "Différence principale : la défense.";
    case "positional":
      return "Différence principale : le plan positionnel.";
    case "unknown":
    case null:
    case undefined:
      return fallback ?? "Différence difficile à classifier.";
    default:
      return fallback ?? "Différence difficile à classifier.";
  }
}

function mainDifferenceTopic(type: string | null | undefined): string {
  switch (type) {
    case "material":
      return "le bilan matériel";
    case "king_safety":
      return "la sécurité du roi";
    case "initiative":
      return "l'initiative";
    case "conversion":
      return "la conversion de l'avantage";
    case "defense":
      return "la défense";
    case "positional":
      return "le plan positionnel";
    case "forcing":
      return "le caractère forcing de la solution";
    default:
      return "un élément difficile à classifier";
  }
}

function ReviewPvContrastDebugList({
  annotations,
}: {
  annotations: ReviewMoveAnnotation[];
}) {
  const annotationsWithEvidence = annotations.filter(
    (annotation) => annotation.pv_contrast_evidence,
  );
  if (annotationsWithEvidence.length === 0) {
    return null;
  }
  return (
    <details className="review-pv-contrast-debug">
      <summary>Détails techniques PV</summary>
      {annotationsWithEvidence.slice(0, 12).map((annotation) => (
        <ReviewPvContrastTechnicalDetails
          key={annotation.ply}
          evidence={annotation.pv_contrast_evidence}
          label={`Ply ${annotation.ply} · ${annotation.san ?? annotation.uci ?? "coup"}`}
        />
      ))}
    </details>
  );
}

function ReviewPvContrastTechnicalDetails({
  evidence,
  label,
}: {
  evidence: ReviewMoveAnnotation["pv_contrast_evidence"];
  label: string;
}) {
  if (!evidence) {
    return null;
  }
  const contrast = evidence.contrast;
  const playedPreview = pvContrastLinePreview(evidence.played_branch?.pv);
  const bestPreview = pvContrastLinePreview(evidence.best_branch?.pv);
  return (
    <div className="review-pv-contrast-debug-item">
      <strong>{label}</strong>
      <dl>
        <dt>main_difference_type</dt>
        <dd>{contrast?.main_difference_type ?? "unknown"}</dd>
        <dt>confidence</dt>
        <dd>{evidence.confidence ?? "low"}</dd>
        <dt>played_branch</dt>
        <dd>{playedPreview || "non disponible"}</dd>
        <dt>best_branch</dt>
        <dd>{bestPreview || "non disponible"}</dd>
        <dt>missing_data</dt>
        <dd>{evidence.missing_data?.join(", ") || "none"}</dd>
      </dl>
    </div>
  );
}

function pvContrastLinePreview(line: ReviewMoveAnnotation["pv_line"]): string {
  if (!line?.length) {
    return "";
  }
  return line
    .slice(0, 8)
    .map((move) => move.san ?? move.uci)
    .filter(Boolean)
    .join(" ");
}

function reviewAnnotationHasSolutionPvLine(annotation: ReviewMoveAnnotation): boolean {
  return Boolean(
    (annotation.pv_line_available && annotation.pv_line?.length) ||
      annotation.pv_contrast_evidence?.best_branch?.pv?.length,
  );
}

function reviewAnnotationHasPlayedPvLine(annotation: ReviewMoveAnnotation): boolean {
  return Boolean(annotation.pv_contrast_evidence?.played_branch?.pv?.length);
}

function reviewAnnotationHasAnyPvLine(annotation: ReviewMoveAnnotation): boolean {
  return (
    reviewAnnotationHasSolutionPvLine(annotation) ||
    reviewAnnotationHasPlayedPvLine(annotation)
  );
}

function ReviewPracticeLaunch({
  eligibleCount,
  onStartPractice,
}: {
  eligibleCount: number;
  onStartPractice: () => void;
}) {
  if (eligibleCount <= 0) {
    return null;
  }
  const displayedCount = Math.min(5, eligibleCount);
  return (
    <section className="review-practice-launch" aria-label="Entraînement Review">
      <div>
        <strong>S'entraîner sur cette Review</strong>
        <span>
          Session courte : {displayedCount} position{displayedCount > 1 ? "s" : ""} à rejouer depuis les moments importants.
        </span>
      </div>
      <button type="button" onClick={onStartPractice}>
        S'entraîner sur cette Review
      </button>
    </section>
  );
}

function ReviewPracticeSessionPanel({
  state,
  pvLineState,
  povContext,
  onHint,
  onRevealSolution,
  onSkip,
  onTryAgain,
  onNext,
  onShowPvLine,
  onPvPrevious,
  onPvNext,
  onPvRestart,
  onPvToggleAutoplay,
  onPvSelectLine,
  onPvClose,
  onQuit,
  onRetryFailed,
  onRedoAll,
}: {
  state: ReviewPracticeViewState;
  pvLineState: ReviewPvLineViewState | null;
  povContext: ReviewPovContext;
  onHint: () => void;
  onRevealSolution: () => void;
  onSkip: () => void;
  onTryAgain: () => void;
  onNext: () => void;
  onShowPvLine: (lineMode?: ReviewPvLineMode) => void;
  onPvPrevious: () => void;
  onPvNext: () => void;
  onPvRestart: () => void;
  onPvToggleAutoplay: () => void;
  onPvSelectLine: (lineMode: ReviewPvLineMode) => void;
  onPvClose: () => void;
  onQuit: () => void;
  onRetryFailed: () => void;
  onRedoAll: () => void;
}) {
  if (state.status === "starting") {
    return (
      <section className="review-practice-panel">
        <div className="review-block-title">
          <span>Entraînement Review</span>
          <strong>Préparation...</strong>
        </div>
        <p>Préparation des positions à travailler.</p>
      </section>
    );
  }

  if (state.status === "completed") {
    const summary = state.summary;
    const bestCount = summary?.best_count ?? summary?.correct_count ?? 0;
    const veryGoodCount = summary?.very_good_count ?? 0;
    const acceptableCount = summary?.acceptable_count ?? 0;
    const wrongCount = summary?.wrong_count ?? 0;
    const illegalCount = summary?.illegal_count ?? 0;
    const revealedCount = summary?.revealed_count ?? 0;
    const skippedCount = summary?.skipped_count ?? 0;
    const reviewCount = wrongCount + illegalCount + revealedCount + skippedCount;
    const solvedCount = bestCount + veryGoodCount;
    const itemCount = summary?.item_count ?? state.items.length;
    return (
      <section
        className="review-practice-panel review-practice-summary"
        aria-label="Résumé de session"
      >
        <div className="review-block-title">
          <span>Session terminée</span>
          <strong>{solvedCount} / {itemCount} positions réussies</strong>
        </div>
        <div className="review-practice-summary-grid">
          <PracticeSummaryMetric
            label="Positions travaillées"
            value={itemCount}
          />
          <PracticeSummaryMetric
            label="Meilleurs coups"
            value={bestCount}
          />
          <PracticeSummaryMetric
            label="Très bons coups"
            value={veryGoodCount}
          />
          <PracticeSummaryMetric
            label="Coups acceptables"
            value={acceptableCount}
          />
          <PracticeSummaryMetric
            label="À revoir"
            value={wrongCount + illegalCount}
          />
          <PracticeSummaryMetric
            label="Solutions révélées"
            value={revealedCount}
          />
          <PracticeSummaryMetric
            label="Positions passées"
            value={skippedCount}
          />
        </div>
        <div className="review-practice-theme">
          <span>Thème principal à revoir</span>
          <strong>{summary?.dominant_theme_label ?? "Inconnu"}</strong>
        </div>
        <p>{summary?.summary_sentence ?? summary?.message ?? "Session terminée."}</p>
        <div className="review-action-row">
          {reviewCount > 0 && (
            <button type="button" onClick={onRetryFailed}>
              Revoir les positions ratées
            </button>
          )}
          <button type="button" onClick={onRedoAll}>
            Tout refaire
          </button>
          <button type="button" onClick={onQuit}>
            Retour à la Review
          </button>
        </div>
      </section>
    );
  }

  const item = state.items[state.currentIndex];
  if (!item) {
    return (
      <section className="review-practice-panel">
        <div className="review-block-title">
          <span>Entraînement Review</span>
          <strong>0 position</strong>
        </div>
        <p>Aucune position disponible pour cette session.</p>
        <button type="button" onClick={onQuit}>Revenir à la Review</button>
      </section>
    );
  }

  const itemAnnotation = practiceItemAnnotationLabel(item);
  const explanation = item.pedagogical_explanation;
  const contrastCoach = item.contrast_coach_explanation;
  const colorLabel = reviewColorLabel(item.color);
  const subjectLabel = povContext.isUserPov
    ? "À toi de jouer : trouve le meilleur coup."
    : `À toi de jouer pour les ${colorLabel.toLowerCase()}.`;
  const canShowPv = reviewAnnotationHasAnyPvLine(itemAnnotation);
  const showSolution = Boolean(
    state.feedback ||
      state.solutionRevealed ||
      state.itemState === "attempted" ||
      state.itemState === "solution_revealed" ||
      state.itemState === "pv_line",
  );
  const waitingForAttempt =
    state.itemState === "awaiting_attempt" || state.itemState === "hint_shown";

  return (
    <section className="review-practice-panel" aria-label="Mode entraînement Review">
      <div className="review-practice-head">
        <div>
          <span>Entraînement Review</span>
          <h3>Position {state.currentIndex + 1} / {state.items.length}</h3>
        </div>
        <button type="button" onClick={onQuit}>
          Quitter
        </button>
      </div>

      <div className="review-practice-card">
        <span className="review-coach-badge">
          {item.category_label ?? errorTypeLabel(explanation?.error_type, itemAnnotation)}
        </span>
        <strong>
          Coup {item.move_number ?? Math.ceil(item.ply / 2)} - {colorLabel} jouent {item.san ?? item.uci ?? ""}
        </strong>
        <p>{subjectLabel}</p>
        {state.hintVisible && (
          <div className="review-practice-hint">
            Indice : {practiceHintForItem(item)}
          </div>
        )}
        {state.feedback && (
          <div className={`review-practice-feedback review-practice-feedback-${state.feedback.result}`}>
            <strong>{coachTextForPov(state.feedback.message, povContext, itemAnnotation)}</strong>
            {state.attemptedUci && (
              <span>
                {povContext.isUserPov ? "Ton coup" : "Coup joué"} :{" "}
                {state.attemptedSan ?? state.attemptedUci}
              </span>
            )}
          </div>
        )}
        {showSolution && (
          <div className="review-practice-solution">
            Solution : {item.best_move_san ?? item.best_move_uci}
          </div>
        )}
        {showSolution && explanation && (
          <div className="review-practice-explanation">
            <span>Pourquoi la solution aide</span>
            <p>{coachTextForPov(explanation.why_best_move_good, povContext, itemAnnotation)}</p>
          </div>
        )}
        {showSolution && (
          <ReviewPracticeContrastFeedback
            feedbackResult={state.feedback?.result ?? (state.solutionRevealed ? "revealed" : null)}
            explanation={contrastCoach}
            fallback={explanation}
            povContext={povContext}
            item={item}
          />
        )}
        {state.error && <div className="warning">{state.error}</div>}
      </div>

      <div className="review-action-row">
        {waitingForAttempt && (
          <>
            <button type="button" onClick={onHint} disabled={state.saving}>
              Indice
            </button>
            <button type="button" onClick={onRevealSolution} disabled={state.saving}>
              Voir solution
            </button>
            <button type="button" onClick={onSkip} disabled={state.saving}>
              Passer
            </button>
          </>
        )}
        {showSolution && (
          <>
            <button type="button" onClick={onTryAgain} disabled={state.saving}>
              Essayer encore
            </button>
            <button
              type="button"
              onClick={() =>
                onShowPvLine(
                  reviewAnnotationHasSolutionPvLine(itemAnnotation) ? "solution" : "played",
                )
              }
              disabled={!canShowPv || state.saving}
              title={
                canShowPv
                  ? "Voir la ligne proposée"
                  : item.pv_line_message ?? "Ligne complète indisponible"
              }
            >
              Voir la ligne
            </button>
            <button type="button" onClick={onNext} disabled={state.saving}>
              {state.currentIndex + 1 >= state.items.length
                ? "Terminer"
                : "Position suivante"}
            </button>
          </>
        )}
      </div>
      {showSolution && pvLineState?.active && (
        <ReviewPracticePvStepper
          state={pvLineState}
          onPrevious={onPvPrevious}
          onNext={onPvNext}
          onRestart={onPvRestart}
          onToggleAutoplay={onPvToggleAutoplay}
          onSelectLine={onPvSelectLine}
          onClose={onPvClose}
        />
      )}
    </section>
  );
}

function ReviewPracticeContrastFeedback({
  feedbackResult,
  explanation,
  fallback,
  povContext,
  item,
}: {
  feedbackResult: string | null;
  explanation: ReviewPracticeItem["contrast_coach_explanation"];
  fallback: ReviewPracticeItem["pedagogical_explanation"];
  povContext: ReviewPovContext;
  item: ReviewPracticeItem;
}) {
  const annotation = practiceItemAnnotationLabel(item);
  const isBest = feedbackResult === "best";
  const primaryText = isBest
    ? explanation?.safe_takeaway ?? fallback?.training_takeaway
    : explanation?.why_solution_is_better ?? fallback?.why_best_move_good;
  const secondaryText = isBest
    ? explanation?.main_difference
    : explanation?.what_happened_after_played;
  if (!primaryText && !secondaryText) {
    return null;
  }
  return (
    <div className="review-practice-explanation review-practice-contrast">
      <span>{isBest ? "Idée clé" : "Contraste des lignes"}</span>
      {primaryText && (
        <p>{coachTextForPov(primaryText, povContext, annotation)}</p>
      )}
      {secondaryText && (
        <p>{coachTextForPov(secondaryText, povContext, annotation)}</p>
      )}
    </div>
  );
}

function ReviewPracticePvStepper({
  state,
  onPrevious,
  onNext,
  onRestart,
  onToggleAutoplay,
  onSelectLine,
  onClose,
}: {
  state: ReviewPvLineViewState;
  onPrevious: () => void;
  onNext: () => void;
  onRestart: () => void;
  onToggleAutoplay: () => void;
  onSelectLine: (lineMode: ReviewPvLineMode) => void;
  onClose: () => void;
}) {
  const currentMove =
    state.currentIndex >= 0 ? state.moves[state.currentIndex] : null;
  const total = state.moves.length;
  const hasPrevious = state.currentIndex >= 0;
  const hasNext = state.currentIndex < total - 1;
  return (
    <div className="review-practice-pv-stepper">
      <div className="review-block-title">
        <span>
          {state.lineMode === "played"
            ? "Ligne après le coup joué"
            : "Ligne de la solution"}
        </span>
        <strong>
          {state.currentIndex < 0
            ? `Départ / ${total}`
            : `Coup ${state.currentIndex + 1} / ${total}`}
        </strong>
      </div>
      <p>
        {currentMove
          ? currentMove.san ?? currentMove.uci
          : "Position de départ de la ligne."}
      </p>
      {state.message && <div className="warning">{state.message}</div>}
      <div className="review-pv-line-mode" aria-label="Choix de ligne PV">
        <button
          type="button"
          className={state.lineMode === "played" ? "active" : ""}
          onClick={() => onSelectLine("played")}
          disabled={!state.playedLineAvailable}
        >
          Ligne du coup joué
        </button>
        <button
          type="button"
          className={state.lineMode === "solution" ? "active" : ""}
          onClick={() => onSelectLine("solution")}
          disabled={!state.solutionLineAvailable}
        >
          Ligne de la solution
        </button>
      </div>
      <div className="review-action-row">
        <button type="button" onClick={onPrevious} disabled={!hasPrevious}>
          ← Coup précédent
        </button>
        <button type="button" onClick={onNext} disabled={!hasNext}>
          Coup suivant →
        </button>
        <button type="button" onClick={onRestart}>
          Rejouer depuis le début
        </button>
        <button type="button" onClick={onToggleAutoplay} disabled={!hasNext}>
          {state.autoplay ? "Pause" : "Auto"}
        </button>
        <button type="button" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}

function PracticeSummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="review-practice-summary-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReviewPracticeHistory({
  sessions,
  isLoading,
  error,
  onRefresh,
  onResume,
  onViewSummary,
  onRetryFailed,
}: {
  sessions: ReviewPracticeSessionListItem[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onResume: (sessionId: number | string) => void;
  onViewSummary: (sessionId: number | string) => void;
  onRetryFailed: (sessionId: number | string) => void;
}) {
  if (sessions.length === 0 && !isLoading && !error) {
    return null;
  }

  return (
    <details className="review-practice-history">
      <summary>Dernières sessions d'entraînement</summary>
      <div className="review-practice-history-head">
        <span>
          {isLoading
            ? "Chargement..."
            : `${sessions.length} session${sessions.length > 1 ? "s" : ""}`}
        </span>
        <button type="button" onClick={onRefresh} disabled={isLoading}>
          Actualiser
        </button>
      </div>
      {error && <div className="warning">{error}</div>}
      {!isLoading && sessions.length === 0 && (
        <p>Aucune session enregistrée pour cette Review.</p>
      )}
      {sessions.length > 0 && (
        <div className="review-practice-history-list">
          {sessions.slice(0, 5).map((session) => (
            <ReviewPracticeHistoryRow
              key={String(session.session_id)}
              session={session}
              onResume={onResume}
              onViewSummary={onViewSummary}
              onRetryFailed={onRetryFailed}
            />
          ))}
        </div>
      )}
    </details>
  );
}

function ReviewPracticeHistoryRow({
  session,
  onResume,
  onViewSummary,
  onRetryFailed,
}: {
  session: ReviewPracticeSessionListItem;
  onResume: (sessionId: number | string) => void;
  onViewSummary: (sessionId: number | string) => void;
  onRetryFailed: (sessionId: number | string) => void;
}) {
  const summary = session.summary;
  const bestCount = summary?.best_count ?? summary?.correct_count ?? 0;
  const veryGoodCount = summary?.very_good_count ?? 0;
  const acceptableCount = summary?.acceptable_count ?? 0;
  const wrongCount = (summary?.wrong_count ?? 0) + (summary?.illegal_count ?? 0);
  const revealedCount = summary?.revealed_count ?? 0;
  const skippedCount = summary?.skipped_count ?? 0;
  const retryAvailable = Boolean(summary?.retry_failed_available);
  return (
    <div className="review-practice-history-row">
      <div>
        <strong>{practiceSessionDate(summary?.completed_at)} · {practicePovLabel(session.pov)}</strong>
        <span>
          {session.status} · {session.item_count} positions · thème :{" "}
          {summary?.dominant_theme_label ?? "Inconnu"}
        </span>
        <span>
          best {bestCount} · très bons {veryGoodCount} · jouables {acceptableCount} · à revoir {wrongCount} · révélées {revealedCount} · passées {skippedCount}
        </span>
      </div>
      <div className="review-action-row">
        {session.status === "running" && (
          <button type="button" onClick={() => onResume(session.session_id)}>
            Reprendre
          </button>
        )}
        <button type="button" onClick={() => onViewSummary(session.session_id)}>
          Voir résumé
        </button>
        {retryAvailable && (
          <button type="button" onClick={() => onRetryFailed(session.session_id)}>
            Revoir les ratées
          </button>
        )}
      </div>
    </div>
  );
}

function practiceSessionDate(value: string | null | undefined): string {
  if (!value) {
    return "Session en cours";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function practicePovLabel(pov: string): string {
  if (pov === "user") {
    return "Moi";
  }
  if (pov === "white") {
    return "Blancs";
  }
  if (pov === "black") {
    return "Noirs";
  }
  return "Les deux";
}

function ReviewMomentNavigator({
  review,
  filteredSections,
  povContext,
  activeSection,
  selectedCoachPly,
  selectedMovePly,
  onSectionChange,
  onSelectAnnotation,
}: {
  review: ReviewResponse | null;
  filteredSections: ReviewSections;
  povContext: ReviewPovContext;
  activeSection: ReviewSectionKey;
  selectedCoachPly: number | null | undefined;
  selectedMovePly: number | null;
  onSectionChange: (section: ReviewSectionKey) => void;
  onSelectAnnotation: (ply: number | null) => void;
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
        <span className="review-compact-meta">
          {formatImpact(annotation.win_loss)}
        </span>
      </button>
    </li>
  );
}

function ReviewScoreSummary({
  review,
  povContext,
  filteredSections,
  onPovChange,
  onRebuildMetrics,
}: {
  review: ReviewResponse | null;
  povContext: ReviewPovContext;
  filteredSections: ReviewSections;
  onPovChange: (pov: ReviewPov) => void;
  onRebuildMetrics: () => void;
}) {
  if (!review) {
    return null;
  }

  const hasUserScores =
    hasReviewScoreValue(review.user_lichess_like_accuracy ?? review.user_review_score) ||
    hasReviewScoreValue(review.opponent_lichess_like_accuracy ?? review.opponent_review_score);
  const hasSideScores =
    hasReviewScoreValue(review.white_lichess_like_accuracy ?? review.white_review_score) ||
    hasReviewScoreValue(review.black_lichess_like_accuracy ?? review.black_review_score);
  if (!hasUserScores && !hasSideScores) {
    return null;
  }

  const confidenceLabel = reviewScoreConfidenceLabel(review.review_score_confidence);
  const confidenceIsLow = review.review_score_confidence === "low";
  const metricsNeedRebuild = reviewMetricsNeedRebuild(review);
  const headline = headlineScoreForReview(review, povContext);
  const headlineLabel = headlineLabelForPov(povContext);
  const summarySentence = reviewSummaryForPov(review, povContext, filteredSections);
  const scoreDetails = scoreDetailsForPov(review, povContext);
  const headlineDisplay =
    povContext.targetColor === "both"
      ? comparisonLabelForPov(review, povContext)
      : formatHeadlineScore(headline);

  return (
    <section className="review-score-summary review-coach-summary" aria-label="Résumé coach">
      <div className="review-score-title">
        <span>{headlineLabel}</span>
        {confidenceIsLow && (
          <strong className="review-score-indicative">
            Score indicatif — données limitées
          </strong>
        )}
      </div>
      <div className="review-headline-score">
        <strong>{headlineDisplay}</strong>
        {povContext.targetColor === "both" ? null : <span>/ 100</span>}
      </div>
      <p className="review-coach-sentence">
        {summarySentence}
      </p>
      <ReviewPovSelector
        povContext={povContext}
        onChange={onPovChange}
      />
      <div className="review-coach-meta">
        <span>Confiance : {confidenceLabel}</span>
        <span>{reviewCompactAnalysisLabel(review)}</span>
      </div>
      <div className="review-score-comparison">
        <span>Comparaison</span>
        <strong>{comparisonLabelForPov(review, povContext)}</strong>
      </div>
      {metricsNeedRebuild && (
        <div className="review-score-rebuild">
          <span>
            Cette analyse complète doit être mise à jour avec les nouvelles métriques.
          </span>
          <button onClick={onRebuildMetrics}>Recalculer les métriques</button>
          <small>{reviewScoreAvailabilityReason(review)}</small>
        </div>
      )}
      <details className="review-score-details">
        <summary>Détails du score</summary>
        <div className="review-score-grid">
          {scoreDetails.map((metric) => (
            <ReviewScoreMetric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              signed={metric.signed}
              suffix={metric.suffix}
            />
          ))}
        </div>
        <p className="review-score-note">
          Le score principal synthétise la qualité moyenne et le diagnostic NeuroChess. Les détails restent disponibles pour audit.
        </p>
      </details>
    </section>
  );
}

function ReviewPovSelector({
  povContext,
  onChange,
}: {
  povContext: ReviewPovContext;
  onChange: (pov: ReviewPov) => void;
}) {
  return (
    <div className="review-pov-selector" aria-label="Joueur analysé">
      <span>Analyser :</span>
      {povContext.options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === povContext.selectedPov ? "active" : ""}
          aria-pressed={option.value === povContext.selectedPov}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ReviewAnalysisOptions({
  review,
  analysisProfile,
  resetPicker,
  onRetry,
  onToggleResetPicker,
}: {
  review: ReviewResponse;
  analysisProfile: "quick" | "standard" | "deep";
  resetPicker: ReactNode;
  onRetry: (options?: ReviewRunOptions) => void;
  onToggleResetPicker: () => void;
}) {
  return (
    <details className="review-analysis-options">
      <summary>Options d'analyse</summary>
      <div className="review-action-row">
        <button onClick={() => onRetry()}>Recalculer {analysisProfile}</button>
        {analysisProfile !== "deep" && (
          <button onClick={() => onRetry({ profile: "deep" })}>
            Analyse approfondie
          </button>
        )}
        <button onClick={onToggleResetPicker}>Relancer depuis zéro</button>
      </div>
      {resetPicker}
      <div className="review-analysis-origin">
        {reviewAnalysisStatusLabel(review)}
      </div>
      <div className="review-analysis-settings">
        Mode {review.review_analysis_profile ?? review.review_analysis_quality ?? "standard"} ·{" "}
        {review.completed_position_count ?? review.deep_done_count ?? 0}/
        {review.required_position_count ?? 0} positions · temps prévu{" "}
        {review.total_budget_seconds ?? 0}s · Stockfish MultiPV{" "}
        {review.requested_multipv ?? 3} ·{" "}
        {review.analysis_limit_mode ?? "time-only"}
        {" "}· Threads {review.analysis_threads ?? "?"} · Hash{" "}
        {review.analysis_hash_mb ?? "?"} MB
      </div>
      {import.meta.env.DEV && (
        <details className="review-score-debug" data-review-score-debug="true">
          <summary>Debug score Review</summary>
          <ReviewAnalysisDebugBlock review={review} />
          <ReviewScoreDebugBlock label="Blancs" debug={review.white_score_debug} />
          <ReviewScoreDebugBlock label="Noirs" debug={review.black_score_debug} />
          <ReviewScoreAuditTable rows={review.review_score_audit_rows ?? []} />
          <ReviewPvContrastDebugList annotations={review.move_annotations ?? []} />
        </details>
      )}
    </details>
  );
}

function ReviewLegacyMoments({
  review,
  selectedMomentId,
  hideEvaluation,
  onShowMoment,
}: {
  review: ReviewResponse;
  selectedMomentId: string | null;
  hideEvaluation: boolean;
  onShowMoment: (
    moment: ReviewMoment,
    index: number,
    moveMode?: "played" | "best",
  ) => void;
}) {
  return (
    <ol className="review-list">
      {review.moments.map((moment, index) => {
        const momentId = momentKey(moment, index);
        const bestMove = moment.best_move_san ?? moment.best_move_uci ?? "non disponible";
        const displayLabel = momentTypeLabel(moment.moment_type) ?? moment.cp_loss_label;
        const delta = reviewMomentDelta(moment);
        return (
          <li
            key={momentId}
            className={`review-item ${selectedMomentId === momentId ? "active" : ""}`}
          >
            <div className="review-item-head">
              <span>#{index + 1}</span>
              <strong>Coup {moment.ply}</strong>
              <span
                className={`review-badge ${badgeClass(displayLabel)}`}
                aria-label={`écart ${moment.cp_loss_label}`}
              >
                {displayLabel}
              </span>
            </div>
            <div className="review-line review-move-line">
              <span>Joué</span>
              <strong className="played-move">
                {moment.played_san ?? moment.played_uci}
              </strong>
              <span>Meilleur</span>
              <strong className="engine-move">{bestMove}</strong>
            </div>
            {hideEvaluation ? (
              <div className="review-line review-evaluation-hidden">
                <span>Évaluation</span>
                <strong>Évaluation masquée</strong>
              </div>
            ) : (
              <div className="review-line">
                <span>Évaluation</span>
                <strong>
                  {moment.eval_before_label} → {moment.eval_after_label}
                </strong>
              </div>
            )}
            {!hideEvaluation && delta && (
              <div className="review-line">
                <span>Variation joueur</span>
                <strong className={`review-delta review-delta-${delta.tone}`}>
                  {delta.label}
                </strong>
              </div>
            )}
            <p>{commentForLabel(displayLabel)}</p>
            <div className="review-action-row">
              <button onClick={() => onShowMoment(moment, index, "played")}>
                Voir le coup joué
              </button>
              <button
                onClick={() => onShowMoment(moment, index, "best")}
                disabled={!moment.best_move_uci}
                title={
                  moment.best_move_uci
                    ? "Voir la suggestion moteur depuis la même position"
                    : "Meilleur coup non disponible sur l'échiquier"
                }
              >
                Voir le meilleur coup
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function reviewJobStatusTitle(job: ReviewJobResponse): string {
  if (job.status === "cancelled") {
    return "Analyse annulée";
  }
  if (job.status === "failed") {
    return "Analyse échouée";
  }
  if (job.status === "stalled") {
    return "Analyse bloquée temporairement";
  }
  return "Analyse incomplète";
}

function reviewJobReconcileTitle(job: ReviewJobResponse): string {
  if (job.derived_reconcile_reason === "coverage_complete") {
    return "Finalisation Review disponible";
  }
  if (job.derived_reconcile_reason === "completed_without_review") {
    return "Finalisation Review à vérifier";
  }
  return "Analyse peut être bloquée";
}

function reviewJobReconcileMessage(job: ReviewJobResponse): string {
  if (job.derived_reconcile_reason === "coverage_complete") {
    return "Toutes les positions sont disponibles. Une vérification explicite peut construire la Review finale.";
  }
  if (job.derived_reconcile_reason === "completed_without_review") {
    return "Le job est marqué terminé, mais la Review finale doit être reconstruite explicitement.";
  }
  return "Le statut est lu sans correction automatique. Vous pouvez lancer une vérification explicite.";
}

function ReviewAnalysisProfileSelector({
  value,
  onChange,
}: {
  value: "quick" | "standard" | "deep";
  onChange: (profile: "quick" | "standard" | "deep") => void;
}) {
  return (
    <label className="review-analysis-profile">
      <span>Mode</span>
      <select
        data-testid="review-profile-select"
        value={value}
        onChange={(event) =>
          onChange(event.target.value as "quick" | "standard" | "deep")
        }
      >
        <option value="standard">Standard recommandé</option>
        <option value="deep">Approfondie</option>
      </select>
    </label>
  );
}

function ForceReanalysisPicker({
  onSelect,
  onCancel,
}: {
  onSelect: (profile: "standard" | "deep") => void;
  onCancel: () => void;
}) {
  return (
    <div className="review-reset-picker">
      <span>
        Cela ignorera l'ancienne analyse et recalculera avec le moteur actuel.
      </span>
      <div className="review-action-row">
        <button onClick={() => onSelect("standard")}>Standard recommandée</button>
        <button onClick={() => onSelect("deep")}>Approfondie</button>
        <button className="ghost" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

function ReviewAnalysisDebugBlock({ review }: { review: ReviewResponse }) {
  return (
    <dl className="review-score-debug-block">
      <dt>Analyse</dt>
      <dd>profile: {review.review_analysis_profile ?? "unknown"}</dd>
      <dd>required_position_count: {review.required_position_count ?? 0}</dd>
      <dd>completed_position_count: {review.completed_position_count ?? 0}</dd>
      <dd>total_budget_seconds: {review.total_budget_seconds ?? 0}</dd>
      <dd>per_position_time_ms: {review.per_position_time_ms ?? 0}</dd>
      <dd>analysis_limit_mode: {review.analysis_limit_mode ?? "unknown"}</dd>
      <dd>requested_multipv: {review.requested_multipv ?? "unknown"}</dd>
      <dd>analysis_threads: {review.analysis_threads ?? "unknown"}</dd>
      <dd>analysis_hash_mb: {review.analysis_hash_mb ?? "unknown"}</dd>
      <dd>uci_analyse_mode: {String(review.uci_analyse_mode ?? "unknown")}</dd>
      <dd>uci_limit_strength: {String(review.uci_limit_strength ?? "unknown")}</dd>
      <dd>skill_level: {String(review.skill_level ?? "unknown")}</dd>
      <dd>syzygy_path_active: {String(review.syzygy_path_active ?? false)}</dd>
      <dd>average_depth_reached: {formatDebugNumber(review.average_depth_reached)}</dd>
      <dd>min_depth_reached: {formatDebugNumber(review.min_depth_reached)}</dd>
      <dd>max_depth_reached: {formatDebugNumber(review.max_depth_reached)}</dd>
      <dd>cache_hits: {review.cache_hits ?? 0}</dd>
      <dd>cache_misses: {review.cache_misses ?? 0}</dd>
      <dd>legacy_cache_ignored_count: {review.legacy_cache_ignored_count ?? 0}</dd>
    </dl>
  );
}

function ReviewScoreDebugBlock({
  label,
  debug,
}: {
  label: string;
  debug: ReviewScoreDebug | null | undefined;
}) {
  if (!debug) {
    return (
      <div className="review-score-debug-block">
        <strong>{label}</strong>
        <span>non disponible</span>
      </div>
    );
  }

  return (
    <dl className="review-score-debug-block">
      <dt>{label}</dt>
      <dd>coups analysés: {debug.analyzed_moves}</dd>
      <dd>coups manquants: {debug.missing_moves}</dd>
      <dd>avg_win_loss: {formatDebugNumber(debug.avg_win_loss)}</dd>
      <dd>max_win_loss: {formatDebugNumber(debug.max_win_loss)}</dd>
      <dd>weighted_mean: {formatDebugNumber(debug.weighted_mean)}</dd>
      <dd>weighted_harmonic: {formatDebugNumber(debug.weighted_harmonic)}</dd>
      <dd>lichess_like_accuracy: {formatDebugNumber(debug.lichess_like_accuracy ?? debug.final_score)}</dd>
      <dd>neuro_score: {formatDebugNumber(debug.neuro_score)}</dd>
      <dd>diagnostic_gap: {formatDebugNumber(debug.diagnostic_gap)}</dd>
      <dd>tail_win_loss: {formatDebugNumber(debug.tail_win_loss)}</dd>
      <dd>mean_diagnostic_loss: {formatDebugNumber(debug.mean_diagnostic_loss)}</dd>
      <dd>tail_diagnostic_loss: {formatDebugNumber(debug.tail_diagnostic_loss)}</dd>
      <dd>tail_count: {formatDebugNumber(debug.tail_count ?? null)}</dd>
      <dd>z_value: {formatDebugNumber(debug.z_value)}</dd>
      <dd>confidence: {debug.confidence}</dd>
      <dd>depth_min: {formatDebugNumber(debug.depth_min ?? null)}</dd>
      <dd>depth_max: {formatDebugNumber(debug.depth_max ?? null)}</dd>
      <dd>depth_avg: {formatDebugNumber(debug.depth_avg ?? null)}</dd>
      <dd>engine_versions: {(debug.engine_versions ?? []).join(", ") || "unknown"}</dd>
    </dl>
  );
}

function ReviewScoreAuditTable({ rows }: { rows: ReviewScoreAuditRow[] }) {
  if (rows.length === 0) {
    return <div className="review-score-debug-block">Audit coups : aucun coup</div>;
  }

  return (
    <div className="review-score-audit-table" data-review-score-audit-table="true">
      <div className="review-score-audit-title">Audit coups scorés</div>
      <table>
        <thead>
          <tr>
            <th>Ply</th>
            <th>Camp</th>
            <th>Coup</th>
            <th>Win loss</th>
            <th>Score coup</th>
            <th>Poids</th>
            <th>Depth</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.ply}-${row.uci}`}>
              <td>{row.ply}</td>
              <td>{row.side}</td>
              <td>{row.san ?? row.uci}</td>
              <td>{formatDebugNumber(row.win_loss)}</td>
              <td>
                {row.included_in_score
                  ? formatDebugNumber(auditMoveScore(row))
                  : row.exclusion_reason ?? "exclu"}
              </td>
              <td>{formatDebugNumber(row.move_weight)}</td>
              <td>
                {row.depth_before ?? "?"}/{row.depth_after ?? "?"}
              </td>
              <td>
                {row.source_before ?? "?"} → {row.source_after ?? "?"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function reviewAnalysisStatusLabel(review: ReviewResponse): string {
  const quality = review.review_analysis_quality ?? "cached";
  const profile = review.review_analysis_profile ?? quality;
  const coverage = `${review.deep_done_count ?? 0}/${review.required_position_count ?? 0} positions`;
  const confidence = reviewScoreConfidenceLabel(review.review_score_confidence);
  const budget = review.total_budget_seconds
    ? ` · temps prévu ${review.total_budget_seconds}s`
    : "";
  const settings =
    review.analysis_limit_mode || review.requested_multipv
      ? ` · Stockfish MultiPV ${review.requested_multipv ?? "?"} · ${
          review.analysis_limit_mode ?? "mode inconnu"
        } · Threads ${review.analysis_threads ?? "?"} · Hash ${
          review.analysis_hash_mb ?? "?"
        } MB`
      : "";
  if (
    (review.legacy_cache_ignored_count ?? 0) > 0 &&
    review.review_analysis_state === "pending"
  ) {
    return `Analyse rapide disponible · lancement ${profile} · ${coverage}${budget}${settings}`;
  }
  if (review.review_analysis_origin === "cached_full") {
    return `Analyse déjà disponible · ${quality} · ${coverage} · confiance ${confidence}`;
  }
  if (review.review_analysis_state === "pending") {
    return `Analyse ${quality} en cours · ${coverage} · confiance ${confidence}`;
  }
  if (review.review_analysis_state === "partial") {
    return `Review partielle · ${quality} · ${coverage} · confiance ${confidence}`;
  }
  if (review.review_analysis_state === "failed") {
    return `Analyse approfondie incomplète · ${coverage}`;
  }
  if (review.review_score_confidence === "low") {
    return `Score indicatif — données limitées · ${coverage}`;
  }
  return `Analyse ${quality} · ${coverage} · confiance ${confidence}`;
}

function formatDebugNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "null";
  }
  return value.toFixed(2);
}

function auditMoveScore(row: ReviewScoreAuditRow): number | null {
  const field = ("move_" + "accur" + "acy") as keyof ReviewScoreAuditRow;
  const value = row[field];
  return typeof value === "number" ? value : null;
}

function reviewIsCompleted(review: ReviewResponse | null): boolean {
  const requiredPositions = review?.required_position_count ?? 0;
  const completedPositions =
    review?.completed_position_count ?? review?.deep_done_count ?? 0;
  return (
    review?.status === "done" &&
    (requiredPositions <= 0 || completedPositions >= requiredPositions) &&
    review.review_analysis_state !== "partial" &&
    review.review_analysis_state !== "incomplete"
  );
}

type ReviewPovTargetColor = "white" | "black" | "both";
type ReviewPovContext = {
  selectedPov: ReviewPov;
  userColor: "white" | "black" | null;
  targetColor: ReviewPovTargetColor;
  isUserPov: boolean;
  options: Array<{ value: ReviewPov; label: string }>;
};

function reviewPovContext(
  review: ReviewResponse | null,
  selectedPov: ReviewPov,
): ReviewPovContext {
  const userColor = normalizedReviewUserColor(review);
  const options: Array<{ value: ReviewPov; label: string }> = userColor
    ? [
        { value: "user", label: "Moi" },
        { value: "white", label: "Blancs" },
        { value: "black", label: "Noirs" },
        { value: "both", label: "Les deux" },
      ]
    : [
        { value: "white", label: "Blancs" },
        { value: "black", label: "Noirs" },
        { value: "both", label: "Les deux" },
      ];
  const normalizedPov =
    selectedPov === "user" && !userColor ? "both" : selectedPov;
  const targetColor =
    normalizedPov === "user"
      ? userColor ?? "both"
      : normalizedPov === "white" || normalizedPov === "black"
        ? normalizedPov
        : "both";
  return {
    selectedPov: normalizedPov,
    userColor,
    targetColor,
    isUserPov: normalizedPov === "user" && Boolean(userColor),
    options,
  };
}

function normalizedReviewUserColor(
  review: ReviewResponse | null,
): "white" | "black" | null {
  const value = String(review?.user_color ?? "").toLowerCase();
  return value === "white" || value === "black" ? value : null;
}

function filteredReviewSections(
  review: ReviewResponse | null,
  targetColor: ReviewPovTargetColor,
): ReviewSections {
  const empty: ReviewSections = {
    to_review: [],
    strong_moves: [],
    missed_opportunities: [],
    all: [],
  };
  if (!review?.review_sections) {
    return empty;
  }
  if (targetColor === "both") {
    return {
      to_review: review.review_sections.to_review ?? [],
      strong_moves: review.review_sections.strong_moves ?? [],
      missed_opportunities: review.review_sections.missed_opportunities ?? [],
      all: review.review_sections.all ?? review.move_annotations ?? [],
    };
  }
  return {
    to_review: filterAnnotationsByColor(review.review_sections.to_review, targetColor),
    strong_moves: filterAnnotationsByColor(review.review_sections.strong_moves, targetColor),
    missed_opportunities: filterAnnotationsByColor(
      review.review_sections.missed_opportunities,
      targetColor,
    ),
    all: filterAnnotationsByColor(
      review.review_sections.all ?? review.move_annotations,
      targetColor,
    ),
  };
}

function filterAnnotationsByColor(
  annotations: ReviewMoveAnnotation[] | undefined,
  color: "white" | "black",
): ReviewMoveAnnotation[] {
  return (annotations ?? []).filter(
    (annotation) => normalizedAnnotationColor(annotation) === color,
  );
}

function normalizedAnnotationColor(
  annotation: ReviewMoveAnnotation,
): "white" | "black" | null {
  const value = String(annotation.color ?? annotation.side ?? "").toLowerCase();
  return value === "white" || value === "black" ? value : null;
}

function countPracticeEligibleItems(sections: ReviewSections): number {
  const seen = new Set<number>();
  for (const annotation of sections.all ?? []) {
    if (isPracticeEligibleAnnotation(annotation)) {
      seen.add(annotation.ply);
    }
  }
  return seen.size;
}

function isPracticeEligibleAnnotation(annotation: ReviewMoveAnnotation): boolean {
  const tags = new Set(annotation.tags ?? []);
  return (
    Boolean(annotation.try_move_supported) &&
    Boolean(annotation.fen_before) &&
    Boolean(annotation.best_move_uci) &&
    (["critical", "decisive", "to_review", "inexact"].includes(
      annotation.primary_category,
    ) ||
      tags.has("missed_opportunity") ||
      tags.has("conversion_issue") ||
      tags.has("defensive_resource_missed") ||
      tags.has("persistent_loss") ||
      tags.has("cluster"))
  );
}

function practiceHintForItem(item: ReviewPracticeItem): string {
  const errorType = item.pedagogical_explanation?.error_type;
  const tags = new Set(item.tags ?? []);
  if (errorType === "tactical" || tags.has("missed_opportunity")) {
    return "cherche une ressource tactique.";
  }
  if (errorType === "conversion" || tags.has("conversion_issue")) {
    return "cherche un coup qui limite le contre-jeu.";
  }
  if (errorType === "defensive" || tags.has("defensive_resource_missed")) {
    return "cherche une ressource défensive.";
  }
  if (errorType === "cluster") {
    return "cherche d'abord un coup solide qui stabilise la position.";
  }
  return "cherche un plan qui améliore tes pièces.";
}

function practiceHintForAnnotation(annotation: ReviewMoveAnnotation): string {
  const errorType = annotation.pedagogical_explanation?.error_type;
  const tags = new Set(annotation.tags ?? []);
  if (errorType === "tactical" || tags.has("missed_opportunity")) {
    return "Cherche d'abord les échecs, captures et menaces.";
  }
  if (errorType === "conversion" || tags.has("conversion_issue")) {
    return "Cherche un coup qui limite le contre-jeu.";
  }
  if (errorType === "defensive" || tags.has("defensive_resource_missed")) {
    return "Cherche une ressource défensive.";
  }
  if (errorType === "cluster" || tags.has("cluster")) {
    return "Cherche d'abord un coup solide qui stabilise la position.";
  }
  return "Cherche un plan qui améliore tes pièces.";
}

function hiddenCoachObjective(
  annotation: ReviewMoveAnnotation,
  explanation: ReviewMoveAnnotation["pedagogical_explanation"],
): string {
  const errorType = explanation?.error_type;
  if (errorType === "tactical") {
    return "Tactique à trouver : observe la position avant de révéler la solution.";
  }
  if (errorType === "conversion") {
    return "Conversion : cherche le coup qui garde le contrôle de la position.";
  }
  if (errorType === "defensive") {
    return "Défense : cherche comment limiter les menaces adverses.";
  }
  if (errorType === "cluster") {
    return "Enchaînement d'erreurs : cherche d'abord à stabiliser la position.";
  }
  if (errorType === "strong_find") {
    return "Coup fort à retrouver : essaie d'identifier l'idée clé.";
  }
  return annotation.impact_label
    ? `Ce moment a eu un impact ${annotation.impact_label.toLowerCase()} sur la partie.`
    : "Ce moment a influencé la partie : cherche le meilleur coup avant de révéler la réponse.";
}

function practiceItemAnnotationLabel(item: ReviewPracticeItem): ReviewMoveAnnotation {
  return {
    ply: item.ply,
    move_number: item.move_number ?? Math.ceil(item.ply / 2),
    color: item.color,
    side: item.color,
    san: item.san ?? null,
    uci: item.uci ?? item.best_move_uci,
    fen_before: item.fen_before,
    fen_after: item.fen_after ?? item.fen_before,
    primary_category: item.primary_category,
    category_label: item.category_label ?? item.primary_category,
    tags: item.tags ?? [],
    tag_labels: item.tag_labels ?? [],
    win_loss: item.win_loss ?? null,
    move_accuracy: item.move_accuracy ?? null,
    criticality_score: null,
    best_move_uci: item.best_move_uci,
    best_move_san: item.best_move_san ?? null,
    acceptable_moves: item.acceptable_moves ?? [],
    pv_line: item.pv_line ?? [],
    pv_line_available: item.pv_line_available,
    pv_line_message: item.pv_line_message,
    evidence_available: true,
    pedagogical_explanation: item.pedagogical_explanation ?? null,
    coach_priority_rank: item.coach_priority_rank ?? null,
    impact_label: item.impact_label ?? null,
    move_quality_label: item.move_quality_label ?? null,
    coach_card_title: item.coach_card_title ?? null,
    compact_label: item.compact_label ?? null,
  };
}

function selectedCoachAnnotationForReview(
  review: ReviewResponse | null,
  selectedCoachPly: number | null,
  selectedMovePly: number | null,
  activeSection: ReviewSectionKey,
  targetColor: ReviewPovTargetColor,
): ReviewMoveAnnotation | null {
  if (!reviewIsCompleted(review)) {
    return null;
  }
  const sections = filteredReviewSections(review, targetColor);
  const all = sections.all;
  if (selectedCoachPly !== null) {
    const selected = all.find((annotation) => annotation.ply === selectedCoachPly);
    if (selected) {
      return selected;
    }
  }
  if (selectedMovePly !== null) {
    const selected = all.find((annotation) => annotation.ply === selectedMovePly);
    if (selected) {
      return selected;
    }
  }
  const sectionRows = sections[activeSection] ?? [];
  return (
    sectionRows[0] ??
    sections.to_review?.[0] ??
    sections.missed_opportunities?.[0] ??
    sections.strong_moves?.[0] ??
    all[0] ??
    null
  );
}

function annotationIndex(
  review: ReviewResponse | null,
  annotation: ReviewMoveAnnotation | null,
): number {
  if (!review || !annotation) {
    return 0;
  }
  const index = (review.move_annotations ?? []).findIndex(
    (candidate) => candidate.ply === annotation.ply && candidate.uci === annotation.uci,
  );
  return index >= 0 ? index : 0;
}

function headlineScoreForReview(
  review: ReviewResponse,
  povContext?: ReviewPovContext,
): number | null | undefined {
  if (!povContext) {
    return (
      review.user_headline_neurochess_score ??
      review.headline_neurochess_score ??
      review.white_headline_neurochess_score ??
      review.black_headline_neurochess_score
    );
  }
  if (povContext.targetColor === "white") {
    return review.white_headline_neurochess_score;
  }
  if (povContext.targetColor === "black") {
    return review.black_headline_neurochess_score;
  }
  if (povContext.isUserPov) {
    return review.user_headline_neurochess_score ?? review.headline_neurochess_score;
  }
  return undefined;
}

function formatHeadlineScore(value: number | null | undefined): string {
  if (!hasReviewScoreValue(value)) {
    return "—";
  }
  return String(Math.round(value));
}

function fallbackReviewSummary(review: ReviewResponse): string {
  const score = headlineScoreForReview(review);
  const gap =
    review.user_diagnostic_gap ??
    Math.max(
      Number(review.white_diagnostic_gap ?? 0),
      Number(review.black_diagnostic_gap ?? 0),
    );
  if (hasReviewScoreValue(score) && score >= 85 && gap < 6) {
    return "Bonne partie : peu d'erreurs importantes détectées.";
  }
  if (gap >= 10) {
    return "Partie correcte en moyenne, mais quelques erreurs ont eu un impact durable.";
  }
  if (hasReviewScoreValue(score) && score < 60) {
    return "Partie difficile : plusieurs coups importants sont à revoir.";
  }
  return "Quelques moments prioritaires expliquent l'essentiel de la Review.";
}

function headlineLabelForPov(povContext: ReviewPovContext): string {
  if (povContext.isUserPov) {
    return "Ton score NeuroChess";
  }
  if (povContext.targetColor === "white") {
    return "Score NeuroChess - Blancs";
  }
  if (povContext.targetColor === "black") {
    return "Score NeuroChess - Noirs";
  }
  return "Scores NeuroChess";
}

function reviewSummaryForPov(
  review: ReviewResponse,
  povContext: ReviewPovContext,
  sections: ReviewSections,
): string {
  if (povContext.isUserPov && review.review_summary_sentence) {
    return review.review_summary_sentence;
  }
  if (povContext.targetColor === "both") {
    const white = review.white_headline_neurochess_score;
    const black = review.black_headline_neurochess_score;
    if (hasReviewScoreValue(white) && hasReviewScoreValue(black)) {
      if (Math.abs(white - black) < 4) {
        return "Les deux camps ont eu une qualité de jeu assez proche.";
      }
      return white > black
        ? "Les Blancs ont été plus stables dans les moments critiques."
        : "Les Noirs ont été plus stables dans les moments critiques.";
    }
    return "Sélectionne Blancs ou Noirs pour voir les priorités d'un joueur.";
  }

  const colorLabel = reviewColorLabel(povContext.targetColor);
  const subject = `Les ${colorLabel}`;
  const score = headlineScoreForReview(review, povContext);
  const gap = diagnosticGapForColor(review, povContext.targetColor);
  const tags = tagCountsForAnnotations(sections.to_review);

  if (hasReviewScoreValue(score) && score >= 85 && Number(gap ?? 0) < 6) {
    return `${subject} ont joué une bonne partie : peu d'erreurs importantes détectées.`;
  }
  if ((tags.get("conversion_issue") ?? 0) >= 2) {
    return `${subject} ont obtenu de bonnes positions, mais la conversion a coûté cher.`;
  }
  if ((tags.get("cluster") ?? 0) >= 2) {
    return `${subject} ont souffert après plusieurs erreurs groupées.`;
  }
  if ((tags.get("missed_opportunity") ?? 0) >= 2) {
    return `${subject} ont manqué plusieurs opportunités tactiques.`;
  }
  if (Number(gap ?? 0) >= 10) {
    return `${subject} ont joué correctement en moyenne, mais quelques erreurs ont eu un impact durable.`;
  }
  if (hasReviewScoreValue(score) && score < 60) {
    return `${subject} ont plusieurs coups importants à revoir.`;
  }
  if (sections.to_review.length > 0) {
    return `${subject} ont quelques moments prioritaires à examiner.`;
  }
  return `${subject} n'ont pas de gros point d'alerte dans cette Review.`;
}

function tagCountsForAnnotations(annotations: ReviewMoveAnnotation[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const annotation of annotations) {
    for (const tag of annotation.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

type ReviewScoreMetricView = {
  label: string;
  value: number | null | undefined;
  signed?: boolean;
  suffix?: string;
};

function comparisonLabelForPov(
  review: ReviewResponse,
  povContext: ReviewPovContext,
): string {
  if (povContext.isUserPov) {
    return `Toi ${formatHeadlineScore(review.user_headline_neurochess_score)} · Adversaire ${formatHeadlineScore(review.opponent_headline_neurochess_score)}`;
  }
  if (povContext.targetColor === "white") {
    return `Blancs ${formatHeadlineScore(review.white_headline_neurochess_score)} · Noirs ${formatHeadlineScore(review.black_headline_neurochess_score)}`;
  }
  if (povContext.targetColor === "black") {
    return `Noirs ${formatHeadlineScore(review.black_headline_neurochess_score)} · Blancs ${formatHeadlineScore(review.white_headline_neurochess_score)}`;
  }
  return `Blancs ${formatHeadlineScore(review.white_headline_neurochess_score)} · Noirs ${formatHeadlineScore(review.black_headline_neurochess_score)}`;
}

function scoreDetailsForPov(
  review: ReviewResponse,
  povContext: ReviewPovContext,
): ReviewScoreMetricView[] {
  if (povContext.isUserPov) {
    return [
      {
        label: "Qualité moyenne des coups",
        value: review.user_lichess_like_accuracy ?? review.user_review_score,
      },
      { label: "Score diagnostic brut", value: review.user_neuro_score },
      {
        label: "Écart diagnostique",
        value: review.user_diagnostic_gap,
        signed: true,
        suffix: " pts",
      },
      {
        label: "Adversaire qualité moyenne",
        value: review.opponent_lichess_like_accuracy ?? review.opponent_review_score,
      },
      { label: "Adversaire diagnostic", value: review.opponent_neuro_score },
    ];
  }
  if (povContext.targetColor === "white" || povContext.targetColor === "black") {
    const color = povContext.targetColor;
    const opponent = color === "white" ? "black" : "white";
    return [
      {
        label: `${reviewColorLabel(color)} qualité moyenne`,
        value: lichessScoreForColor(review, color),
      },
      {
        label: `${reviewColorLabel(color)} diagnostic`,
        value: neuroScoreForColor(review, color),
      },
      {
        label: `${reviewColorLabel(color)} écart`,
        value: diagnosticGapForColor(review, color),
        signed: true,
        suffix: " pts",
      },
      {
        label: `${reviewColorLabel(opponent)} qualité moyenne`,
        value: lichessScoreForColor(review, opponent),
      },
      {
        label: `${reviewColorLabel(opponent)} diagnostic`,
        value: neuroScoreForColor(review, opponent),
      },
    ];
  }
  return [
    { label: "Blancs qualité moyenne", value: lichessScoreForColor(review, "white") },
    { label: "Blancs diagnostic", value: neuroScoreForColor(review, "white") },
    {
      label: "Blancs écart",
      value: diagnosticGapForColor(review, "white"),
      signed: true,
      suffix: " pts",
    },
    { label: "Noirs qualité moyenne", value: lichessScoreForColor(review, "black") },
    { label: "Noirs diagnostic", value: neuroScoreForColor(review, "black") },
    {
      label: "Noirs écart",
      value: diagnosticGapForColor(review, "black"),
      signed: true,
      suffix: " pts",
    },
  ];
}

function lichessScoreForColor(
  review: ReviewResponse,
  color: "white" | "black",
): number | null | undefined {
  return color === "white"
    ? review.white_lichess_like_accuracy ?? review.white_review_score
    : review.black_lichess_like_accuracy ?? review.black_review_score;
}

function neuroScoreForColor(
  review: ReviewResponse,
  color: "white" | "black",
): number | null | undefined {
  return color === "white" ? review.white_neuro_score : review.black_neuro_score;
}

function diagnosticGapForColor(
  review: ReviewResponse,
  color: "white" | "black",
): number | null | undefined {
  return color === "white" ? review.white_diagnostic_gap : review.black_diagnostic_gap;
}

function reviewCompactAnalysisLabel(review: ReviewResponse): string {
  const profile = review.review_analysis_profile ?? review.review_analysis_quality ?? "standard";
  const done = review.completed_position_count ?? review.deep_done_count ?? 0;
  const total = review.required_position_count ?? 0;
  return `Analyse : ${profile} · ${done}/${total} positions`;
}

function categoryTone(category: string): "positive" | "neutral" | "warning" | "danger" | "book" {
  if (category === "book") {
    return "book";
  }
  if (["best", "excellent", "very_good"].includes(category)) {
    return "positive";
  }
  if (["good", "playable"].includes(category)) {
    return "neutral";
  }
  if (["critical", "decisive"].includes(category)) {
    return "danger";
  }
  return "warning";
}

function coachTone(
  annotation: ReviewMoveAnnotation,
  errorType: string | null | undefined,
): "positive" | "neutral" | "warning" | "danger" | "book" | "conversion" | "defense" {
  if (errorType === "strong_find") {
    return "positive";
  }
  if (errorType === "conversion") {
    return "conversion";
  }
  if (errorType === "defensive") {
    return "defense";
  }
  if (errorType === "cluster" || errorType === "tactical") {
    return "danger";
  }
  return categoryTone(annotation.primary_category);
}

function errorTypeLabel(
  errorType: string | null | undefined,
  annotation: ReviewMoveAnnotation,
): string {
  switch (errorType) {
    case "tactical":
      return "Tactique manquée";
    case "positional":
      return "Plan positionnel";
    case "conversion":
      return "Conversion";
    case "defensive":
      return "Défense";
    case "cluster":
      return "Enchaînement d'erreurs";
    case "opening_transition":
      return "Sortie du livre";
    case "strong_find":
      return "Coup fort";
    default:
      return annotation.category_label ?? "À revoir";
  }
}

function formatImpact(value: number | null | undefined): string {
  if (!hasReviewScoreValue(value)) {
    return "non disponible";
  }
  const rounded = Math.round(value);
  const label =
    value < 2
      ? "négligeable"
      : value < 7
        ? "léger"
        : value < 15
          ? "important"
          : value < 30
            ? "très important"
            : "critique";
  return `-${rounded} % (${label})`;
}

function impactLabelFromLoss(value: number | null | undefined): string {
  if (!hasReviewScoreValue(value)) {
    return "non mesuré";
  }
  if (value < 2) {
    return "négligeable";
  }
  if (value < 7) {
    return "léger";
  }
  if (value < 15) {
    return "important";
  }
  if (value < 30) {
    return "très important";
  }
  return "critique";
}

function openingRealityConfidenceLabel(
  confidence: string | null | undefined,
): string {
  if (confidence === "high") {
    return "confiance élevée";
  }
  if (confidence === "medium") {
    return "confiance moyenne";
  }
  if (confidence === "low") {
    return "confiance basse";
  }
  return "diagnostic léger";
}

function openingMoveLabel(ply: number): string {
  const moveNumber = Math.max(1, Math.ceil(ply / 2));
  return `coup ${moveNumber}`;
}

function openingSanLabel(
  san: string | null | undefined,
  color: string | null | undefined,
): string {
  const move = san || "coup inconnu";
  return color === "black" ? `...${move}` : move;
}

function openingLinkedMomentLabel(
  moment: OpeningRealityEvidence["critical_moment_after_exit"] | null,
): string {
  if (!moment) {
    return "pas de perte majeure immédiate";
  }
  const moveLabel =
    typeof moment.move_number === "number"
      ? `coup ${moment.move_number}`
      : typeof moment.ply === "number"
        ? openingMoveLabel(moment.ply)
        : "moment lié";
  const impact =
    typeof moment.win_loss === "number" && Number.isFinite(moment.win_loss)
      ? ` · impact -${Math.round(moment.win_loss)} %`
      : "";
  return `premier moment à revoir au ${moveLabel}${impact}`;
}

function impactPercentage(value: number | null | undefined): number {
  if (!hasReviewScoreValue(value)) {
    return 0;
  }
  return Math.max(4, Math.min(100, Math.round((value / 35) * 100)));
}

function moveQualityLabel(value: number | null | undefined): string {
  if (!hasReviewScoreValue(value)) {
    return "non disponible";
  }
  if (value >= 95) {
    return "Excellente";
  }
  if (value >= 85) {
    return "Très bonne";
  }
  if (value >= 70) {
    return "Correcte";
  }
  if (value >= 50) {
    return "Moyenne";
  }
  if (value >= 30) {
    return "Faible";
  }
  return "Très faible";
}

function humanReason(annotation: ReviewMoveAnnotation): string {
  const tags = annotation.tags ?? [];
  if (tags.includes("missed_opportunity")) {
    return "une opportunité claire a été manquée dans cette position.";
  }
  if (tags.includes("conversion_issue")) {
    return "une bonne position est devenue plus difficile à convertir.";
  }
  if (tags.includes("defensive_resource_missed")) {
    return "un meilleur coup donnait davantage de ressources défensives.";
  }
  if (tags.includes("persistent_loss")) {
    return "la perte est restée visible dans la suite de la partie.";
  }
  if (tags.includes("cluster")) {
    return "ce coup arrive dans une séquence déjà fragile.";
  }
  if (tags.includes("strong_find")) {
    return "tu as trouvé un bon coup dans une position exigeante.";
  }
  if (annotation.primary_category === "critical" || annotation.primary_category === "decisive") {
    return "ce coup a nettement donné plus de chances à l'adversaire.";
  }
  return annotation.reason ?? "ce coup mérite d'être revu dans son contexte.";
}

function coachTextForPov(
  text: string | null | undefined,
  povContext: ReviewPovContext,
  annotation: ReviewMoveAnnotation,
): string | null | undefined {
  if (!text || povContext.isUserPov) {
    return text;
  }
  const colorLabel = reviewColorLabel(annotation.color);
  const subject = `Les ${colorLabel}`;
  const moveSubject = `Le coup des ${colorLabel.toLowerCase()}`;
  return text
    .replace(/\bTu as\b/g, `${subject} ont`)
    .replace(/\btu as\b/g, `${subject} ont`)
    .replace(/\bTu avais\b/g, `${subject} avaient`)
    .replace(/\btu avais\b/g, `${subject} avaient`)
    .replace(/\bTon coup\b/g, moveSubject)
    .replace(/\bton coup\b/g, moveSubject.toLowerCase())
    .replace(/\bTes chances\b/g, `Les chances des ${colorLabel.toLowerCase()}`)
    .replace(/\btes chances\b/g, `les chances des ${colorLabel.toLowerCase()}`)
    .replace(/\btu es\b/g, `${subject} sont`)
    .replace(/\btu\b/g, subject)
    .replace(/\bton\b/g, `le coup des ${colorLabel.toLowerCase()}`)
    .replace(/\bta\b/g, `la décision des ${colorLabel.toLowerCase()}`);
}

function ReviewScoreMetric({
  label,
  value,
  signed = false,
  suffix = " %",
}: {
  label: string;
  value: number | null | undefined;
  signed?: boolean;
  suffix?: string;
}) {
  return (
    <div className="review-score-metric">
      <span>{label}</span>
      <strong>{formatReviewScore(value, { signed, suffix })}</strong>
    </div>
  );
}

function formatReviewScore(
  value: number | null | undefined,
  options: { signed?: boolean; suffix?: string } = {},
): string {
  if (!hasReviewScoreValue(value)) {
    return "non disponible";
  }
  const rounded = Math.round(value);
  const prefix = options.signed && rounded > 0 ? "+" : "";
  return `${prefix}${rounded}${options.suffix ?? " %"}`;
}

function formatOptionalPercent(value: number | null | undefined): string {
  return formatReviewScore(value);
}

function reviewColorLabel(color: string | null | undefined): string {
  return color === "black" ? "Noirs" : "Blancs";
}

function hasReviewScoreValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function reviewMetricsNeedRebuild(review: ReviewResponse): boolean {
  const statusIsCompleted = review.status === "done" || review.status === "completed";
  const coverageIsComplete =
    (review.coverage ?? 0) >= 1 ||
    (review.required_position_count !== undefined &&
      review.required_position_count > 0 &&
      (review.completed_position_count ?? review.deep_done_count ?? 0) >=
        review.required_position_count);
  const hasLegacyAccuracy =
    hasReviewScoreValue(review.user_lichess_like_accuracy ?? review.user_review_score) ||
    hasReviewScoreValue(review.opponent_lichess_like_accuracy ?? review.opponent_review_score) ||
    hasReviewScoreValue(review.white_lichess_like_accuracy ?? review.white_review_score) ||
    hasReviewScoreValue(review.black_lichess_like_accuracy ?? review.black_review_score);
  const missingNeuro =
    (!hasReviewScoreValue(review.user_neuro_score) &&
      hasReviewScoreValue(review.user_lichess_like_accuracy ?? review.user_review_score)) ||
    (!hasReviewScoreValue(review.opponent_neuro_score) &&
      hasReviewScoreValue(review.opponent_lichess_like_accuracy ?? review.opponent_review_score)) ||
    (!hasReviewScoreValue(review.white_neuro_score) &&
      hasReviewScoreValue(review.white_lichess_like_accuracy ?? review.white_review_score)) ||
    (!hasReviewScoreValue(review.black_neuro_score) &&
      hasReviewScoreValue(review.black_lichess_like_accuracy ?? review.black_review_score));
  return (
    statusIsCompleted &&
    coverageIsComplete &&
    hasLegacyAccuracy &&
    (missingNeuro ||
      review.score_availability?.neuro_score === "legacy_needs_rebuild")
  );
}

function reviewScoreAvailabilityReason(review: ReviewResponse): string {
  const reason = review.score_availability?.reason;
  if (reason === "legacy_needs_rebuild") {
    return "Métriques héritées détectées : aucun calcul moteur ne sera relancé.";
  }
  if (reason === "insufficient_moves") {
    return "Trop peu de coups analysables pour calculer le score.";
  }
  if (reason === "missing_data" || reason === "missing_dependency") {
    return "Données de score incomplètes dans le payload actuel.";
  }
  return "Le recalcul utilise uniquement les analyses déjà disponibles.";
}

function reviewScoreConfidenceLabel(confidence: string | null): string {
  if (confidence === "high") {
    return "élevée";
  }
  if (confidence === "medium") {
    return "moyenne";
  }
  if (confidence === "low") {
    return "indicative";
  }
  return "non disponible";
}

export function momentKey(moment: ReviewMoment, index: number): string {
  return `${moment.id ?? "moment"}-${moment.ply}-${moment.played_uci}-${index}`;
}

function ReviewMessage({ children }: { children: ReactNode }) {
  return (
    <div className="review-content">
      <div className="panel-title">Moments à revoir</div>
      <div className="review-message">{children}</div>
    </div>
  );
}

function commentForLabel(label: string): string {
  if (label === "Tournant de partie") {
    return "Ce coup transforme nettement l'équilibre de la partie.";
  }
  if (label === "Avantage laissé filer") {
    return "Le coup recommandé conservait une position plus favorable.";
  }
  if (label === "Aggravation") {
    return "La position était déjà difficile et ce coup l'a rendue plus critique.";
  }
  if (label === "écart notable") {
    return "Le coup recommandé maintenait un meilleur équilibre.";
  }
  if (label === "écart important") {
    return "Le coup recommandé conservait l'avantage.";
  }
  if (label === "écart majeur") {
    return "Le coup recommandé évitait une dégradation importante.";
  }
  if (label === "écart très important") {
    return "Le coup recommandé maintenait la position bien meilleure.";
  }
  return "Moment décisif selon l'analyse approfondie.";
}

function badgeClass(label: string): string {
  if (label === "Tournant de partie") {
    return "badge-major";
  }
  if (label === "Avantage laissé filer") {
    return "badge-important";
  }
  if (label === "Aggravation") {
    return "badge-large";
  }
  if (label === "Moment décisif") {
    return "badge-decisive";
  }
  if (label === "écart notable") {
    return "badge-notable";
  }
  if (label === "écart important") {
    return "badge-important";
  }
  if (label === "écart majeur") {
    return "badge-major";
  }
  if (label === "écart très important") {
    return "badge-large";
  }
  return "badge-decisive";
}

function momentTypeLabel(momentType: ReviewMoment["moment_type"]): string | null {
  if (momentType === "turning_point") {
    return "Tournant de partie";
  }
  if (momentType === "lost_advantage") {
    return "Avantage laissé filer";
  }
  if (momentType === "aggravation") {
    return "Aggravation";
  }
  if (momentType === "decisive") {
    return "Moment décisif";
  }
  if (momentType === "standard_loss") {
    return "Écart important";
  }
  return null;
}

function reviewMomentDelta(
  moment: ReviewMoment,
): { label: string; tone: "loss" | "gain" | "neutral" } | null {
  const before = makeEvaluationDisplayFromEngineScore(
    moment.eval_before_cp,
    moment.mate_before,
  );
  const after = makeEvaluationDisplayFromEngineScore(
    moment.eval_after_cp,
    moment.mate_after,
  );
  if (!before || !after) {
    return null;
  }

  const beforePercent =
    moment.played_by === "black" ? before.black_percent : before.white_percent;
  const afterPercent =
    moment.played_by === "black" ? after.black_percent : after.white_percent;
  const delta = afterPercent - beforePercent;
  if (!Number.isFinite(delta)) {
    return null;
  }

  const rounded = Math.round(delta);
  return {
    label: `${rounded > 0 ? "+" : ""}${rounded} %`,
    tone: delta < -0.5 ? "loss" : delta > 0.5 ? "gain" : "neutral",
  };
}
