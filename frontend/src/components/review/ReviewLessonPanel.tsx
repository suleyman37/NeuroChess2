import type { ReviewMoveAnnotation } from "../../api/client";
import {
  impactLabelFromLoss,
  lessonTypeLabel,
  moveQualityLabel,
  reviewColorLabel,
  REVIEW_PUBLIC_LESSON_STEPS,
} from "./reviewLabels";
import { CoachExplanationBlock, ReviewLineComparison } from "./ReviewLineComparison";
import {
  buildLessonStepState,
  coachTextForPov,
  coachTone,
  hiddenCoachObjective,
  practiceHintForAnnotation,
  publicMainDifferenceText,
} from "./reviewViewModel";
import { formatImpact } from "./reviewUtils";
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
  const hasContrastCoach = Boolean(contrastCoach?.available);
  const tone = coachTone(annotation, explanation?.error_type);
  const tags = annotation.tag_labels?.length
    ? annotation.tag_labels
    : annotation.tags;
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
  const playedMove = annotation.san ?? annotation.uci ?? "coup non disponible";
  const displayedPlayedMove =
    tryActiveForAnnotation && tryMoveState?.attemptedUci
      ? tryMoveState.attemptedSan ?? tryMoveState.attemptedUci
      : playedMove;
  const solutionMove =
    annotation.best_move_san ?? annotation.best_move_uci ?? "solution indisponible";
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
          {annotation.category_label}
        </span>
        {tags.slice(0, 2).map((tag) => (
          <span className="review-tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      {publicStep === "challenge" && (
        <div className="review-lesson-card" data-public-lesson-step="challenge">
          <p className="review-coach-main">Trouve le meilleur coup.</p>
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
                title="Indice"
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
              Indice
            </button>
            <button
              className={
                challengePrimaryAction === "correction" ? "primary" : undefined
              }
              type="button"
              onClick={handleShowCorrection}
            >
              Voir la correction
            </button>
          </div>
          {tryActiveForAnnotation && tryMoveState?.feedback && (
            <div className="review-try-move-panel">
              <strong>Tentative envoyée</strong>
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
              <div className="review-action-row">
                <button type="button" onClick={onTryMoveReset}>
                  Réessayer
                </button>
                <button className="primary" type="button" onClick={handleTryRevealSolution}>
                  Voir la correction
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {publicStep === "correction" && canShowSolutionData && (
        <div className="review-lesson-card" data-public-lesson-step="correction">
          <p className="review-coach-main">Voici ce que ton coup a permis.</p>
          <div className="review-correction-narrative premium">
            <article>
              <span>Ton coup · Problème</span>
              <strong>{displayedPlayedMove}</strong>
              <p>{correctionProblem}</p>
            </article>
            <article>
              <span>Meilleure idée</span>
              <strong>Le meilleur coup était : {solutionMove}</strong>
              <p>{correctionWhy}</p>
            </article>
            <article>
              <span>Pourquoi ça marche</span>
              <p>{formatImpact(annotation.win_loss)} · {impactLabel}</p>
              <p>Qualité : {qualityLabel}</p>
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
            <details className="review-line-comparison-disclosure">
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
              Continuer
            </button>
            {!canShowLineComparison && (canShowAnyPvLine || hasContrastCoach) && (
              <button
                type="button"
                onClick={handleCompareStep}
              >
                Voir la ligne
              </button>
            )}
            {annotation.try_move_supported && (
              <button type="button" onClick={handleTryStep}>
                Réessayer
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
