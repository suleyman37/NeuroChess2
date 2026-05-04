import type { ReviewPracticeItem } from "../../api/client";
import { StateNotice } from "../StateNotice";
import {
  ANTI_TILT_REPEATED_WRONG_NOTICE,
  PRACTICE_COMPLETED_NOTICE,
  PRACTICE_ILLEGAL_MOVE_NOTICE,
  PRACTICE_NO_ITEMS_NOTICE,
  PRACTICE_REVEAL_NOTICE,
  buildPracticeSaveFailedNotice,
} from "../../degradedStates";
import { errorTypeLabel, reviewColorLabel } from "./reviewLabels";
import { ReviewPvStepper } from "./ReviewPvStepper";
import { buildPracticeSummaryView, coachTextForPov, practiceHintForItem, practiceItemAnnotationLabel } from "./reviewViewModel";
import { reviewAnnotationHasAnyPvLine, reviewAnnotationHasSolutionPvLine } from "./reviewUtils";
import type { ReviewPovContext, ReviewPracticeViewState, ReviewPvLineMode, ReviewPvLineViewState } from "./reviewTypes";

export function ReviewPracticeLaunch({
  eligibleCount,
  dominantTheme,
  onStartPractice,
  onOpenExplorer,
}: {
  eligibleCount: number;
  dominantTheme?: string | null;
  onStartPractice: () => void;
  onOpenExplorer?: () => void;
}) {
  const displayedCount = Math.min(5, eligibleCount);
  return (
    <section className="review-practice-launch" aria-label="Entraînement Review">
      <div>
        <span>Session recommandée</span>
        <strong>{eligibleCount > 0 ? "S'entraîner sur cette Review" : "Plan en construction"}</strong>
        <span>
          {eligibleCount > 0
            ? `${displayedCount} position${displayedCount > 1 ? "s" : ""} issues de cette Review · thème : ${dominantTheme ?? "moments prioritaires"}.`
            : "Aucune position d'entraînement fiable pour l'instant. Explore les moments détectés pour choisir la suite."}
        </span>
      </div>
      {eligibleCount > 0 ? (
        <button
          type="button"
          className="primary"
          data-testid="review-practice-button"
          onClick={onStartPractice}
        >
          Commencer l'entraînement
        </button>
      ) : (
        <button type="button" className="primary" onClick={onOpenExplorer}>
          Explorer les moments
        </button>
      )}
    </section>
  );
}

export function ReviewPracticeSessionPanel({
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
    const {
      bestCount,
      veryGoodCount,
      acceptableCount,
      wrongCount,
      illegalCount,
      revealedCount,
      skippedCount,
      reviewCount,
      solvedCount,
      itemCount,
    } = buildPracticeSummaryView(summary, state.items.length);
    return (
      <section
        className="review-practice-panel review-practice-summary"
        aria-label="Résumé de session"
      >
        <div className="review-block-title">
          <span>Session terminée</span>
          <strong>{solvedCount} / {itemCount} positions réussies</strong>
        </div>
        <StateNotice
          compact
          variant={PRACTICE_COMPLETED_NOTICE.variant}
          title={PRACTICE_COMPLETED_NOTICE.title}
          message={PRACTICE_COMPLETED_NOTICE.message}
          primaryActionLabel={PRACTICE_COMPLETED_NOTICE.primaryActionLabel}
          secondaryActionLabel={PRACTICE_COMPLETED_NOTICE.secondaryActionLabel}
          onPrimaryAction={onQuit}
          onSecondaryAction={onRetryFailed}
          testId="practice-complete"
        />
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
          {reviewCount > 0 ? (
            <>
              <button className="primary" type="button" onClick={onRetryFailed}>
                Revoir les positions ratées
              </button>
              <button type="button" onClick={onRedoAll}>
                Tout refaire
              </button>
              <button type="button" onClick={onQuit}>
                Voir résumé
              </button>
            </>
          ) : (
            <>
              <button className="primary" type="button" onClick={onRedoAll}>
                Faire une nouvelle session
              </button>
              <button type="button" onClick={onQuit}>
                Voir résumé
              </button>
            </>
          )}
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
        <StateNotice
          compact
          variant={PRACTICE_NO_ITEMS_NOTICE.variant}
          title={PRACTICE_NO_ITEMS_NOTICE.title}
          message={PRACTICE_NO_ITEMS_NOTICE.message}
          primaryActionLabel={PRACTICE_NO_ITEMS_NOTICE.primaryActionLabel}
          onPrimaryAction={onQuit}
          testId="practice-no-items-notice"
        />
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
  const latestAttemptNumber = Number(state.summary?.latest_attempt?.attempt_number ?? 0);
  const feedbackResult = state.feedback?.result ?? null;
  const repeatedWrongNoticeVisible =
    latestAttemptNumber >= 2 && (feedbackResult === "wrong" || feedbackResult === "illegal");
  const illegalNoticeVisible = feedbackResult === "illegal";
  const revealNoticeVisible = state.solutionRevealed && !state.feedback;
  const saveFailedNotice = state.error ? buildPracticeSaveFailedNotice(state.error) : null;

  return (
    <section
      className="review-practice-panel"
      aria-label="Mode entraînement Review"
      data-testid="practice-panel"
    >
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
          <div
            className={`review-practice-feedback review-practice-feedback-${state.feedback.result}`}
            data-testid="practice-feedback"
          >
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
          <div className="review-practice-solution" data-testid="practice-result">
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
        {illegalNoticeVisible && (
          <StateNotice
            compact
            variant={PRACTICE_ILLEGAL_MOVE_NOTICE.variant}
            title={PRACTICE_ILLEGAL_MOVE_NOTICE.title}
            message={PRACTICE_ILLEGAL_MOVE_NOTICE.message}
            primaryActionLabel={PRACTICE_ILLEGAL_MOVE_NOTICE.primaryActionLabel}
            onPrimaryAction={onTryAgain}
            testId="practice-illegal-move-notice"
          />
        )}
        {repeatedWrongNoticeVisible && (
          <StateNotice
            compact
            variant={ANTI_TILT_REPEATED_WRONG_NOTICE.variant}
            title={ANTI_TILT_REPEATED_WRONG_NOTICE.title}
            message={ANTI_TILT_REPEATED_WRONG_NOTICE.message}
            primaryActionLabel={ANTI_TILT_REPEATED_WRONG_NOTICE.primaryActionLabel}
            secondaryActionLabel={ANTI_TILT_REPEATED_WRONG_NOTICE.secondaryActionLabel}
            onPrimaryAction={onTryAgain}
            onSecondaryAction={onRevealSolution}
            testId="anti-tilt-repeated-wrong-notice"
          />
        )}
        {revealNoticeVisible && (
          <StateNotice
            compact
            variant={PRACTICE_REVEAL_NOTICE.variant}
            title={PRACTICE_REVEAL_NOTICE.title}
            message={PRACTICE_REVEAL_NOTICE.message}
            testId="anti-tilt-reveal-notice"
          />
        )}
        {saveFailedNotice && (
          <StateNotice
            compact
            variant={saveFailedNotice.variant}
            title={saveFailedNotice.title}
            message={saveFailedNotice.message}
            primaryActionLabel={saveFailedNotice.primaryActionLabel}
            secondaryActionLabel={saveFailedNotice.secondaryActionLabel}
            details={saveFailedNotice.details}
            onPrimaryAction={onTryAgain}
            onSecondaryAction={onRevealSolution}
            testId="practice-save-failed-notice"
          />
        )}
      </div>

      <div className="review-action-row">
        {waitingForAttempt && (
          <>
            <button
              type="button"
              data-testid="practice-hint-button"
              onClick={onHint}
              disabled={state.saving}
            >
              Indice
            </button>
            <button
              className="primary"
              type="button"
              data-testid="practice-reveal-button"
              onClick={onRevealSolution}
              disabled={state.saving}
            >
              Voir la correction
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
            {canShowPv && (
              <button
                type="button"
                onClick={() =>
                  onShowPvLine(
                    reviewAnnotationHasSolutionPvLine(itemAnnotation) ? "solution" : "played",
                  )
                }
                disabled={state.saving}
                title="Voir la ligne proposée"
              >
                Voir la ligne
              </button>
            )}
            <button
              className="primary"
              type="button"
              data-testid="practice-next-button"
              onClick={onNext}
              disabled={state.saving}
            >
              {state.currentIndex + 1 >= state.items.length
                ? "Terminer"
                : "Position suivante"}
            </button>
          </>
        )}
      </div>
      {showSolution && pvLineState?.active && (
        <ReviewPvStepper
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


export const ReviewPracticePanel = ReviewPracticeSessionPanel;
