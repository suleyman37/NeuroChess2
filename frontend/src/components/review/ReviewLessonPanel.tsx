import type { ReviewMoveAnnotation } from "../../api/client";
import { fr } from "../../i18n";
import {
  impactLabelFromLoss,
  lessonTypeLabel,
  moveQualityLabel,
  reviewColorLabel,
  REVIEW_PUBLIC_LESSON_STEPS,
} from "./reviewLabels";
import { CoachExplanationBlock, ReviewLineComparison } from "./ReviewLineComparison";
import { MoveQualityBadge } from "./MoveQualityBadge";
import {
  getMoveQualityGlyphForAttemptResult,
  getMoveQualityGlyphForHistoricalCategory,
} from "./moveQualityGlyphs";
import { ReviewDecisionCard } from "./ReviewDecisionCard";
import {
  buildReviewCorrectionFeedbackView,
  buildLessonStepState,
  coachTextForPov,
  coachTone,
  hiddenCoachObjective,
  practiceHintForAnnotation,
  publicMainDifferenceText,
} from "./reviewViewModel";
import {
  formatImpact,
  isMicroReviewObservation,
  reviewMomentImportanceLabel,
  reviewMomentReason,
} from "./reviewUtils";
import type {
  ReviewLessonStep,
  ReviewPovContext,
  ReviewPvLineMode,
  ReviewSolutionRevealViewState,
  ReviewTryMoveViewState,
} from "./reviewTypes";

function ReviewCoachMomentCard({
  annotation,
  index,
  active,
  lessonStep,
  onLessonStepChange,
  onNextLessonMoment,
  onReturnToSummary,
  onShowAnnotation,
  onTryMoveAnnotation,
  onShowPvLineAnnotation,
  onTryMoveReset,
  onTryMoveRevealSolution,
  tryMoveState,
  solutionRevealState,
  onSolutionHintAnnotation,
  practiceAvailable,
  onStartPractice,
  povContext,
}: {
  annotation: ReviewMoveAnnotation | null;
  index: number;
  active: boolean;
  lessonStep: ReviewLessonStep;
  onLessonStepChange: (step: ReviewLessonStep) => void;
  onNextLessonMoment: () => void;
  onReturnToSummary: () => void;
  onShowAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
    mode?: "before" | "played" | "best",
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
  practiceAvailable: boolean;
  onStartPractice: () => void;
  povContext: ReviewPovContext;
}) {
  if (!annotation) {
    return null;
  }

  const lessonAnnotation = annotation;
  const explanation = annotation.pedagogical_explanation;
  const contrastCoach = annotation.contrast_coach_explanation;
  const tone = coachTone(annotation, explanation?.error_type);
  const moveTitle = `Coup ${annotation.move_number} — ${reviewColorLabel(
    annotation.color,
  )} au trait`;
  const isUserLanguage = povContext.isUserPov;
  const {
    publicStep,
    canShowSolutionData,
    canShowLineComparison,
    hintVisible,
    canShowAnyPvLine,
  } = buildLessonStepState(annotation, lessonStep, tryMoveState, solutionRevealState);
  const tryActiveForAnnotation =
    tryMoveState?.active && tryMoveState.annotationPly === annotation.ply;
  const playedMove = annotation.san ?? annotation.uci ?? fr.feedback.moveUnavailable;
  const displayedPlayedMove =
    tryActiveForAnnotation && tryMoveState?.attemptedUci
      ? tryMoveState.attemptedSan ?? tryMoveState.attemptedUci
      : playedMove;
  const solutionMove =
    annotation.best_move_san ?? annotation.best_move_uci ?? fr.feedback.solutionUnavailable;
  const correctionFeedback = buildReviewCorrectionFeedbackView(
    annotation,
    displayedPlayedMove,
    tryMoveState,
  );
  const correctionMoveAccepted = correctionFeedback.accepted;
  const tryMoveNeedsRebuild = correctionFeedback.needsRebuild;
  const visibleTags = correctionFeedback.visibleTagLabels;
  const lessonType = lessonTypeLabel(explanation?.error_type);
  const impactLabel = annotation.impact_label ?? impactLabelFromLoss(annotation.win_loss);
  const qualityLabel =
    annotation.move_quality_label ?? moveQualityLabel(annotation.move_accuracy);
  const opponentReply =
    annotation.pv_contrast_evidence?.played_branch?.opponent_best_reply_san ??
    annotation.pv_contrast_evidence?.played_branch?.opponent_best_reply_uci ??
    null;
  const correctionProblem =
    coachTextForPov(explanation?.why_played_move_bad, povContext, annotation) ??
    coachTextForPov(contrastCoach?.what_happened_after_played, povContext, annotation) ??
    (opponentReply
      ? `Après ce coup, l'adversaire peut répondre activement par ${opponentReply}.`
      : "Ce choix laisse plus de contre-jeu que nécessaire.");
  const correctionWhy =
    coachTextForPov(explanation?.why_best_move_good, povContext, annotation) ??
    coachTextForPov(contrastCoach?.why_solution_is_better, povContext, annotation) ??
    publicMainDifferenceText(contrastCoach, explanation) ??
    "La solution garde davantage l'initiative et limite le contre-jeu.";
  const correctionMain = correctionMoveAccepted
    ? fr.feedback.acceptedMain
    : tryMoveNeedsRebuild
      ? fr.feedback.rebuildMain
      : fr.feedback.wrongMain;
  const playedMoveLabel = isUserLanguage ? fr.feedback.yourMove : fr.feedback.playedMove;
  const correctionPlayedLabel = correctionMoveAccepted
    ? `${playedMoveLabel} · ${fr.feedback.acceptedIdea}`
    : tryMoveNeedsRebuild
      ? `${playedMoveLabel} · ${fr.feedback.needsReview}`
      : `${playedMoveLabel} · ${fr.feedback.problem}`;
  const activeTryFeedbackMessage = tryActiveForAnnotation
    ? tryMoveState?.feedback?.message
    : null;
  const tryFeedbackSucceeded = Boolean(
    tryActiveForAnnotation &&
      tryMoveState?.feedback &&
      correctionFeedback.isSuccessAttempt,
  );
  const tryFeedbackTitle = tryFeedbackSucceeded
    ? fr.feedback.successAttemptTitle
    : fr.feedback.attemptSentTitle;
  const tryFeedbackCanShowLine =
    tryFeedbackSucceeded &&
    correctionFeedback.shouldShowLine &&
    !canShowLineComparison &&
    canShowAnyPvLine;
  const tryFeedbackQualityId =
    tryActiveForAnnotation && tryMoveState?.feedback
      ? getMoveQualityGlyphForAttemptResult(tryMoveState.feedback.result)
      : null;
  const historicalQualityId = getMoveQualityGlyphForHistoricalCategory(
    annotation.primary_category,
  );
  const currentAttemptMove =
    tryActiveForAnnotation && tryMoveState?.feedback
      ? tryMoveState.attemptedSan ?? tryMoveState.attemptedUci
      : null;
  const canShowBestIdeaInDecision =
    canShowSolutionData &&
    !tryMoveNeedsRebuild &&
    Boolean(annotation.best_move_uci ?? annotation.best_move_san);
  const acceptedCorrectionText =
    coachTextForPov(
      activeTryFeedbackMessage,
      povContext,
      annotation,
    ) ?? fr.feedback.bestMoveSuccess(displayedPlayedMove);
  const currentAttemptFeedbackText =
    correctionFeedback.attemptResult === "illegal"
      ? fr.feedback.currentAttemptIllegal
      : correctionFeedback.attemptResult === "playable"
        ? fr.feedback.currentAttemptPlayable
        : fr.feedback.currentAttemptWrong;
  const correctionPlayedText = correctionMoveAccepted
    ? acceptedCorrectionText
    : tryMoveNeedsRebuild
      ? fr.feedback.rebuildBeforeCorrection
      : correctionFeedback.showAttemptSpecificFeedback
        ? currentAttemptFeedbackText
        : correctionProblem;
  const trainingTakeaway =
    coachTextForPov(explanation?.training_takeaway, povContext, annotation) ??
    "Dans une position tactique, cherche d'abord les coups forcing.";
  const challengePrimaryAction = annotation.try_move_supported ? "try" : "correction";
  const correctionPrimaryAction = "continue";
  const trainingPrimaryAction = practiceAvailable ? "practice" : "next";

  function handleChallengeStep() {
    onLessonStepChange("observe");
    onTryMoveReset();
    onShowAnnotation(lessonAnnotation, index, "before");
  }

  function handleTryStep() {
    onLessonStepChange("try");
    onTryMoveAnnotation(lessonAnnotation, index);
  }

  function handleHintStep() {
    onLessonStepChange("try");
    onSolutionHintAnnotation(lessonAnnotation, index);
  }

  function handleShowCorrection() {
    onLessonStepChange("solution");
    onShowAnnotation(lessonAnnotation, index, "best");
  }

  function handleTryRevealSolution() {
    onLessonStepChange("solution");
    onTryMoveRevealSolution();
  }

  function handleCompareStep() {
    onLessonStepChange("compare");
  }

  function handleTrainingStep() {
    onLessonStepChange("takeaway");
  }

  return (
    <section
      className={`review-coach-moment review-coach-moment-${tone} ${
        active ? "active" : ""
      }`}
      aria-label="Moment coach courant"
    >
      <div className="review-coach-moment-head">
        <div>
          <span>{publicStep === "challenge" ? "Défi en cours" : "Coach"}</span>
          <h3>{moveTitle}</h3>
          <span data-testid="review-current-moment-side">
            {fr.review.pov.currentMomentSide(reviewColorLabel(annotation.color))}
          </span>
        </div>
        <strong className="review-coach-type">{lessonType}</strong>
      </div>

      <div className="review-public-stepper" aria-label="Progression coach">
        {REVIEW_PUBLIC_LESSON_STEPS.map((step) => (
          <span
            key={step.key}
            className={`review-public-step ${
              publicStep === step.key ? "active" : ""
            }`}
            aria-current={publicStep === step.key ? "step" : undefined}
          >
            {step.label}
          </span>
        ))}
      </div>

      <div className="review-coach-badges">
        <span className={`review-coach-badge review-coach-badge-${tone}`}>
          {correctionFeedback.categoryIsNegative
            ? fr.feedback.acceptedIdea
            : correctionFeedback.categoryLabel}
        </span>
        {visibleTags.slice(0, 2).map((tag) => (
          <span className="review-tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      <ReviewDecisionCard
        className="review-lesson-decision-card"
        historical={{
          label: fr.decisionCard.historicalMove,
          move: playedMove,
          qualityId: historicalQualityId === "unknown" ? null : historicalQualityId,
          qualityContext: "historical",
          rowTestId: "review-decision-card-historical-row",
          badgeTestId: "historical-move-quality-badge",
          legacyBadgeTestId: "review-historical-quality-badge",
          detail: annotation.move_quality_label ?? qualityLabel,
          showUnknownQuality: true,
        }}
        bestIdea={
          canShowBestIdeaInDecision
            ? {
                label: fr.decisionCard.bestIdea,
                move: solutionMove,
                qualityId: "critical_best",
                qualityContext: "solution",
                rowTestId: "review-decision-card-best-row",
                badgeTestId: "best-idea-quality-badge",
                detail: correctionWhy,
              }
            : null
        }
        attempt={
          currentAttemptMove && tryFeedbackQualityId
            ? {
                label: fr.decisionCard.currentAttempt,
                move: currentAttemptMove,
                qualityId: tryFeedbackQualityId,
                qualityContext: "attempt",
                rowTestId: "review-decision-card-attempt-row",
                badgeTestId: "current-attempt-quality-badge",
                legacyBadgeTestId: "review-attempt-quality-badge",
                detail: activeTryFeedbackMessage,
              }
            : null
        }
        why={
          publicStep === "challenge"
            ? reviewMomentReason(annotation) ?? hiddenCoachObjective(annotation, explanation)
            : correctionMoveAccepted
              ? acceptedCorrectionText
              : reviewMomentReason(annotation) ?? correctionWhy
        }
        whyLabel={fr.decisionCard.whyThisMoment}
        momentLabel={reviewMomentImportanceLabel(annotation)}
        microObservation={isMicroReviewObservation(annotation)}
      />

      {publicStep === "challenge" && (
        <div className="review-lesson-card" data-public-lesson-step="challenge">
          <p className="review-coach-main">{fr.practice.challengeTitle}</p>
          <div className="review-challenge-meta">
            <span>{lessonType}</span>
            <span>{moveTitle}</span>
            <span>{impactLabel}</span>
          </div>
          <div className="review-coach-grid">
            <CoachExplanationBlock
              title="Objectif"
              text={hiddenCoachObjective(annotation, explanation)}
            />
            <CoachExplanationBlock
              title="Impact potentiel"
              text={impactLabel}
            />
            {hintVisible && (
              <CoachExplanationBlock
                title={fr.actions.hint}
                text={practiceHintForAnnotation(annotation)}
              />
            )}
          </div>
          <div className="review-action-row">
            {annotation.try_move_supported && (
              <button
                className={challengePrimaryAction === "try" ? "primary" : undefined}
                onClick={handleTryStep}
                type="button"
              >
                Essayer
              </button>
            )}
            <button type="button" onClick={handleHintStep}>
              {fr.actions.hint}
            </button>
            <button
              className={
                challengePrimaryAction === "correction" ? "primary" : undefined
              }
              type="button"
              onClick={handleShowCorrection}
            >
              {fr.actions.showCorrection}
            </button>
          </div>
          {tryActiveForAnnotation && tryMoveState?.feedback && (
            <div className="review-try-move-panel">
              <div className="review-feedback-heading">
                <MoveQualityBadge
                  qualityId={tryFeedbackQualityId}
                  context="attempt"
                  testId="review-attempt-quality-badge"
                />
                <strong>{tryFeedbackTitle}</strong>
              </div>
              <span>
                {coachTextForPov(
                  tryMoveState.feedback.message,
                  povContext,
                  annotation,
                )}
              </span>
              {tryMoveState.attemptedUci && (
                <span>
                  {isUserLanguage ? fr.feedback.yourMove : fr.feedback.playedMove} :{" "}
                  {tryMoveState.attemptedSan ?? tryMoveState.attemptedUci}
                </span>
              )}
              {tryFeedbackSucceeded && (
                <span>{fr.feedback.historicalIdeaMissed}</span>
              )}
              <div className="review-action-row">
                {tryFeedbackSucceeded ? (
                  <>
                    <button
                      className="primary"
                      type="button"
                      onClick={handleTrainingStep}
                    >
                      {fr.actions.continue}
                    </button>
                    {correctionFeedback.shouldShowWhyItWorks && (
                      <button type="button" onClick={handleTryRevealSolution}>
                        {fr.feedback.viewWhyItWorks}
                      </button>
                    )}
                    {tryFeedbackCanShowLine && (
                      <button type="button" onClick={handleCompareStep}>
                        {fr.actions.showLine}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {correctionFeedback.shouldShowRetry && (
                      <button type="button" onClick={onTryMoveReset}>
                        {fr.actions.retry}
                      </button>
                    )}
                    {correctionFeedback.shouldShowCorrection && (
                      <button
                        className="primary"
                        type="button"
                        onClick={handleTryRevealSolution}
                      >
                        {fr.actions.showCorrection}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {publicStep === "correction" && canShowSolutionData && (
        <div className="review-lesson-card" data-public-lesson-step="correction">
          <p className="review-coach-main">{correctionMain}</p>
          <div className="review-correction-narrative premium">
            <article>
              <div className="review-feedback-heading">
                {tryActiveForAnnotation && tryMoveState?.feedback && (
                  <MoveQualityBadge
                    qualityId={tryFeedbackQualityId}
                    context="attempt"
                    size="sm"
                    testId="review-attempt-quality-badge"
                  />
                )}
                <span>{correctionPlayedLabel}</span>
              </div>
              <strong>{displayedPlayedMove}</strong>
              <p>{correctionPlayedText}</p>
            </article>
            {correctionFeedback.showMissedBest && (
              <article>
                <span>{fr.feedback.bestIdea}</span>
                <strong>{fr.feedback.bestMoveMissed(solutionMove)}</strong>
                <p>{correctionWhy}</p>
              </article>
            )}
            {tryMoveNeedsRebuild && (
              <article>
                <span>{fr.feedback.reviewNeedsRebuild}</span>
                <p>{fr.feedback.rebuildBeforeCorrection}</p>
              </article>
            )}
            <article>
              <span>{fr.feedback.correctionWhyTitle}</span>
              {correctionFeedback.showSuccessHistoricalContext ? (
                <>
                  <p>{fr.feedback.historicalIdeaMissed}</p>
                  {correctionFeedback.showRecoveredGain &&
                    correctionFeedback.recoveredGainPoints !== null && (
                      <p>
                        {fr.feedback.recoveredGain(
                          correctionFeedback.recoveredGainPoints,
                        )}
                      </p>
                    )}
                  <p>{fr.feedback.historicalImpact(impactLabel)}</p>
                </>
              ) : correctionFeedback.showAttemptSpecificFeedback ? (
                <p>{currentAttemptFeedbackText}</p>
              ) : correctionFeedback.showHistoricalMoveDiagnostics ? (
                <>
                  <div className="review-historical-quality-row">
                    <MoveQualityBadge
                      qualityId={historicalQualityId}
                      context="historical"
                      size="sm"
                      testId="review-historical-quality-badge"
                    />
                    <span>{fr.feedback.historicalQualityScope}</span>
                  </div>
                  <p>{formatImpact(annotation.win_loss)} · {impactLabel}</p>
                  <p>{fr.feedback.qualityLabel(qualityLabel)}</p>
                </>
              ) : (
                <p>{fr.feedback.rebuildBeforeCorrection}</p>
              )}
            </article>
            <article>
              <span>À retenir</span>
              <p>{trainingTakeaway}</p>
            </article>
            {tryActiveForAnnotation && tryMoveState?.feedback && (
              <article className="review-correction-feedback">
                <span>Feedback</span>
                <p>
                  {coachTextForPov(
                    tryMoveState.feedback.message,
                    povContext,
                    annotation,
                  )}
                </p>
              </article>
            )}
          </div>
          {canShowLineComparison && (
            <details
              className="review-line-comparison-disclosure review-details-disclosure"
              data-testid="review-details-disclosure"
              open
            >
              <summary>Comparer les lignes</summary>
              <ReviewLineComparison
                annotation={annotation}
                index={index}
                contrastCoach={contrastCoach ?? {}}
                explanation={explanation}
                povContext={povContext}
                onShowPvLineAnnotation={onShowPvLineAnnotation}
              />
            </details>
          )}
          <div className="review-action-row">
            <button
              className={correctionPrimaryAction === "continue" ? "primary" : undefined}
              type="button"
              onClick={handleTrainingStep}
            >
              {fr.actions.continue}
            </button>
            {correctionFeedback.shouldShowLine &&
              !canShowLineComparison &&
              canShowAnyPvLine && (
                <button
                  type="button"
                  onClick={handleCompareStep}
                >
                  {fr.actions.showLine}
                </button>
              )}
            {annotation.try_move_supported && correctionFeedback.shouldShowRetry && (
              <button type="button" onClick={handleTryStep}>
                {fr.actions.retry}
              </button>
            )}
          </div>
        </div>
      )}

      {publicStep === "training" && (
        <div className="review-lesson-card" data-public-lesson-step="training">
          <p className="review-coach-main">Transforme ce moment en entraînement.</p>
          <div className="review-training-narrative">
            <p>
              <span>À retenir</span>
              {trainingTakeaway}
            </p>
            <p>
              <span>Prochaine action</span>
              {practiceAvailable
                ? "Rejouer 3 positions tactiques similaires."
                : "Passe au moment suivant pour garder le rythme."}
            </p>
          </div>
          <div className="review-action-row">
            {practiceAvailable && (
              <button
                className={trainingPrimaryAction === "practice" ? "primary" : undefined}
                type="button"
                onClick={onStartPractice}
              >
                S'entraîner
              </button>
            )}
            <button
              className={trainingPrimaryAction === "next" ? "primary" : undefined}
              type="button"
              onClick={onNextLessonMoment}
            >
              Moment suivant
            </button>
            <button type="button" onClick={onReturnToSummary}>
              Retour au résumé
            </button>
          </div>
        </div>
      )}

    </section>
  );
}

export const ReviewLessonPanel = ReviewCoachMomentCard;
