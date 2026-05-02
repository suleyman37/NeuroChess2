import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent } from "react";
import { Chess } from "chess.js";
import {
  createGame,
  classifyGameOpening,
  finishGame,
  getAnalysisByFen,
  getGame,
  getGameHistory,
  cancelReviewJob,
  getReviewJob,
  getGameMoves,
  getGameOpening,
  getReview,
  getReviewPracticeSession,
  getReviewPracticeSessions,
  importPgnGames,
  liveAnalysisStreamUrl,
  playMove,
  previewPgnImport,
  rebuildReviewMetrics,
  abandonReviewPracticeSession,
  completeReviewPracticeSession,
  recordReviewPracticeAttempt,
  retryFailedReviewPracticeSession,
  reconcileReviewJob,
  startReviewJob,
  startReviewPracticeSession,
  startLiveAnalysis,
  stopLiveAnalysis,
  type AnalysisByFen,
  type BoardEvaluationContext,
  type Evaluation,
  type EvaluationSource,
  type GameHistoryItem,
  type GameMoveHistory,
  type GameMoveHistoryItem,
  type GameState,
  type LiveAnalysisUpdate,
  type OpeningRealityEvidence,
  type OpeningClassification,
  type PgnImportPreview,
  type PgnImportResult,
  type RecordedMove,
  type ReviewMoment,
  type ReviewMoveAnnotation,
  type ReviewJobResponse,
  type ReviewPracticeItem,
  type ReviewPracticeSessionListItem,
  type ReviewPracticeSummary,
  type ReviewPvLineMove,
  type ReviewResponse,
} from "./api/client";
import { ChessBoardPanel, type BoardArrow } from "./components/ChessBoardPanel";
import {
  EvaluationBar,
  type EvaluationBarPlaceholder,
} from "./components/EvaluationBar";
import { MoveHistory } from "./components/MoveHistory";
import { LandingPage } from "./components/LandingPage";
import { NeuroChessLogo } from "./components/NeuroChessLogo";
import {
  ReviewPanel,
  momentKey,
  type ReviewFocusKey,
  type ReviewPov,
  type ReviewPvLineMode,
  type ReviewSolutionRevealViewState,
  type ReviewTryMoveViewState,
} from "./components/ReviewPanel";
import { ReviewStepStatus } from "./components/review/ReviewStepStatus";
import {
  annotationIndex,
} from "./components/review/reviewViewModel";
import { makeEvaluationDisplayFromEngineScore } from "./evaluationDisplay";
import {
  INITIAL_REVIEW_STATE,
  MIN_REVIEW_HALF_MOVES,
  REVIEW_NOT_REVIEWABLE_MESSAGE,
  REVIEW_PENDING_TIMEOUT_MS,
  REVIEW_VISIBLE_SPINNER_TIMEOUT_MS,
  isShortGameForReview,
  isReviewTerminalStatus,
  reviewStateReducer,
  reviewStatusFromResponse,
  type ReviewStateEvent,
  type ReviewUiStatus,
  type ReviewUiState,
} from "./reviewState";

type BusyState = "idle" | "new-game" | "move" | "finish" | "load-game";
type PositionMode = "LIVE" | "HISTORICAL" | "REVIEW";
type ActiveTab = "moves" | "review" | "import" | "history" | "info";
type HistoryScope = "mine" | "imported" | "local" | "ai" | "observed" | "all";

function normalizeReviewFocusKey(value: string): ReviewFocusKey {
  if (value === "learn" || value === "practice" || value === "lab") {
    return value;
  }
  if (value === "lesson") {
    return "learn";
  }
  if (value === "opening" || value === "explorer") {
    return "lab";
  }
  return "summary";
}

type EvaluationBarState = {
  evaluation: Evaluation | null;
  source: EvaluationSource | null;
  placeholder: EvaluationBarPlaceholder | null;
  delta: EvaluationDelta | null;
  deltaOverlay: EvaluationDeltaOverlay | null;
};
type EvaluationDelta = {
  label: string;
  tone: "loss" | "gain" | "neutral";
  title: string;
};
type EvaluationDeltaOverlay = {
  topPercent: number;
  heightPercent: number;
  tone: "loss" | "gain" | "neutral";
  label: string;
};
type ReviewBarPhase = "before" | "after";
type ReviewAnalysisProfile = "quick" | "standard" | "deep";
type ReviewReplayState =
  | "idle"
  | "showing_before"
  | "animating_move"
  | "showing_after";
type ReviewReplayMoveMode = "played" | "best";
type GuidedReplayPhase =
  | "context"
  | "decision"
  | "played_move"
  | "impact"
  | "best_move"
  | "pv_line"
  | "summary";
type TryMoveFeedback = ReviewTryMoveViewState["feedback"];
type ReviewTryMoveState = ReviewTryMoveViewState & {
  annotation: ReviewMoveAnnotation | null;
  annotationIndex: number | null;
  fenBefore: string | null;
};
type ReviewPracticeState = {
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
  feedback: NonNullable<TryMoveFeedback> | null;
  solutionRevealed: boolean;
  hintVisible: boolean;
  summary: ReviewPracticeSummary | null;
  error: string | null;
  saving: boolean;
};
type ReviewPvLineState = {
  active: boolean;
  annotationPly: number;
  annotationIndex: number | null;
  moves: ReviewPvLineMove[];
  currentIndex: number;
  currentFen: string;
  autoplay: boolean;
  message: string | null;
  lineMode: ReviewPvLineMode;
  playedLineAvailable: boolean;
  solutionLineAvailable: boolean;
};
type OpeningGuidePhase =
  | "last_book"
  | "exit_move"
  | "after_exit"
  | "post_exit_sequence"
  | "linked_moment"
  | "summary";
type OpeningGuideState = {
  active: boolean;
  phase: OpeningGuidePhase;
  gameId: number | null;
  currentFen: string | null;
  stepIndex: number;
  message: string;
  currentMoveUci: string | null;
  linkedPly: number | null;
};
type ReviewSolutionRevealMode = NonNullable<ReviewSolutionRevealViewState>["state"];
type PersistedAppState = {
  gameId: number | null;
  activeTab: ActiveTab;
  displayedPositionPly: number;
  activeReviewJobId: string | null;
  reviewAnalysisProfile: ReviewAnalysisProfile;
  updatedAt: number;
};
type PositionEvaluationLookup = {
  status: "loading" | "done" | "pending" | "unavailable";
  evaluation: Evaluation | null;
  source: EvaluationSource | null;
};
type OpeningLoadStatus = "idle" | "loading" | "ready" | "not_found" | "error";

const ENGINE_WARMUP_GRACE_MS = 3500;
const BOARD_EVALUATION_RETRY_DELAYS_MS = [500, 1500, 3000, 5000];
const EVAL_VISIBILITY_STORAGE_KEY = "neurochess.hideEvaluation";
const APP_STATE_STORAGE_KEY = "neurochess.appState.v5_3a4d";
const REVIEW_POV_STORAGE_KEY_PREFIX = "neurochess.reviewPov";
const OPENING_INTENTION_STORAGE_KEY_PREFIX = "neurochess.openingIntention";
const REVIEW_STABILIZED_DEEP_SOURCE_KIND = "review_stabilized_deep";
const REVIEW_DEEP_SNAPSHOT_SOURCE_KIND = "review_deep_snapshot";
const REVIEW_REPLAY_INITIAL_DELAY_MS = 1200;
const REVIEW_REPLAY_AFTER_HOLD_MS = 1500;
const REPLAY_INITIAL_PAUSE_MS = 1200;
const REPLAY_MOVE_ANIMATION_MS = 800;
const REPLAY_IMPACT_PAUSE_MS = 1500;
const REPLAY_BEST_MOVE_PAUSE_MS = 1200;
const REPLAY_PV_LINE_PAUSE_MS = 1200;
const REVIEW_REPLAY_MOVE_ANIMATION_MS = REPLAY_MOVE_ANIMATION_MS;
const REVIEW_PLAYED_ARROW_COLOR = "rgba(0, 229, 255, 0.88)";
const REVIEW_BEST_ARROW_COLOR = "rgba(105, 92, 255, 0.9)";
type NeuroChessRoute = "/" | "/app";

const ANALYSIS_UNAVAILABLE_WARNINGS = new Set([
  "analysis_engine_unavailable",
  "engine_unavailable",
  "live_analysis_unavailable",
]);

const EVALUATION_SOURCE_KINDS = new Set([
  "shallow",
  "live",
  "deep",
  "calibration",
  "historical_deep",
  "historical_pending",
  "historical_live",
  "review_deep",
  REVIEW_DEEP_SNAPSHOT_SOURCE_KIND,
  "review_saved",
  REVIEW_STABILIZED_DEEP_SOURCE_KIND,
  "review_live",
  "final_live",
  "initial_live",
  "board_pending",
]);

const HISTORY_SCOPE_FILTERS: Array<{ scope: HistoryScope; label: string }> = [
  { scope: "mine", label: "Mes parties" },
  { scope: "imported", label: "Importées" },
  { scope: "local", label: "Locales" },
  { scope: "ai", label: "IA" },
  { scope: "observed", label: "Observées" },
  { scope: "all", label: "Toutes" },
];

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<NeuroChessRoute>(() =>
    normalizeRoute(readCurrentPath()),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handlePopState = () => {
      setCurrentRoute(normalizeRoute(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (route: NeuroChessRoute) => {
    if (typeof window !== "undefined") {
      if (window.location.pathname !== route) {
        window.history.pushState({ neurochessRoute: route }, "", route);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setCurrentRoute(route);
  };

  if (currentRoute === "/app") {
    return <NeuroChessApp onNavigateHome={() => navigateTo("/")} />;
  }

  return (
    <LandingPage
      onNavigateApp={() => navigateTo("/app")}
      onNavigateHome={() => navigateTo("/")}
    />
  );
}

type NeuroChessAppProps = {
  onNavigateHome: () => void;
};

function NeuroChessApp({ onNavigateHome }: NeuroChessAppProps) {
  const [gameId, setGameId] = useState<number | null>(null);
  const [currentFen, setCurrentFen] = useState<string | null>(null);
  const [viewedFen, setViewedFen] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [moves, setMoves] = useState<RecordedMove[]>([]);
  const [moveHistory, setMoveHistory] = useState<GameMoveHistory | null>(null);
  const [moveHistoryLoading, setMoveHistoryLoading] = useState(false);
  const [moveHistoryError, setMoveHistoryError] = useState<string | null>(null);
  const [displayedPositionPly, setDisplayedPositionPly] = useState(0);
  const [positionMode, setPositionMode] = useState<PositionMode>("LIVE");
  const [selectedReviewMomentId, setSelectedReviewMomentId] =
    useState<string | null>(null);
  const [selectedReviewMovePly, setSelectedReviewMovePly] =
    useState<number | null>(null);
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(
    null,
  );
  const [selectedReviewAnnotation, setSelectedReviewAnnotation] =
    useState<ReviewMoveAnnotation | null>(null);
  const [selectedReviewAnnotationIndex, setSelectedReviewAnnotationIndex] =
    useState<number | null>(null);
  const [guidedReplayPhase, setGuidedReplayPhase] =
    useState<GuidedReplayPhase | null>(null);
  const [reviewBarPhase, setReviewBarPhase] =
    useState<ReviewBarPhase>("before");
  const [reviewReplayState, setReviewReplayState] =
    useState<ReviewReplayState>("idle");
  const [reviewReplayMoveMode, setReviewReplayMoveMode] =
    useState<ReviewReplayMoveMode>("played");
  const [reviewTryMoveState, setReviewTryMoveState] =
    useState<ReviewTryMoveState | null>(null);
  const [reviewPracticeState, setReviewPracticeState] =
    useState<ReviewPracticeState | null>(null);
  const [reviewPracticeHistory, setReviewPracticeHistory] = useState<
    ReviewPracticeSessionListItem[]
  >([]);
  const [reviewPracticeHistoryLoading, setReviewPracticeHistoryLoading] =
    useState(false);
  const [reviewPracticeHistoryError, setReviewPracticeHistoryError] =
    useState<string | null>(null);
  const [guidedPvIndex, setGuidedPvIndex] = useState<number | null>(null);
  const [reviewPvLineState, setReviewPvLineState] =
    useState<ReviewPvLineState | null>(null);
  const [reviewOverlayPositionKey, setReviewOverlayPositionKey] =
    useState<string | null>(null);
  const [reviewOverlayPhase, setReviewOverlayPhase] = useState<string | null>(
    null,
  );
  const [openingGuideState, setOpeningGuideState] =
    useState<OpeningGuideState | null>(null);
  const [reviewOpeningFocusMessage, setReviewOpeningFocusMessage] =
    useState<string | null>(null);
  const [reviewAnimationRequestId, setReviewAnimationRequestId] = useState(0);
  const [reviewSolutionRevealState, setReviewSolutionRevealState] =
    useState<ReviewSolutionRevealViewState | null>(null);
  const [hideEvaluation, setHideEvaluation] = useState(
    readHideEvaluationPreference,
  );
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluationSource, setEvaluationSource] =
    useState<EvaluationSource | null>(null);
  const [evaluationFen, setEvaluationFen] = useState<string | null>(null);
  const [positionEvaluationCache, setPositionEvaluationCache] = useState<
    Record<string, PositionEvaluationLookup>
  >({});
  const [liveAnalysisSessionId, setLiveAnalysisSessionId] =
    useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [liveInfoStatus, setLiveInfoStatus] = useState<string | null>(null);
  const [engineWarningGraceActive, setEngineWarningGraceActive] =
    useState(false);
  const [engineWarmupGraceActive, setEngineWarmupGraceActive] =
    useState(true);
  const [boardEvaluationRetryNonce, setBoardEvaluationRetryNonce] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isGameCompleted, setIsGameCompleted] = useState(false);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [reviewUiState, setReviewUiState] =
    useState<ReviewUiState>(INITIAL_REVIEW_STATE);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewJob, setReviewJob] = useState<ReviewJobResponse | null>(null);
  const [reviewReconcileInFlight, setReviewReconcileInFlight] = useState(false);
  const [reviewAnalysisProfile, setReviewAnalysisProfile] =
    useState<ReviewAnalysisProfile>("standard");
  const [selectedReviewPov, setSelectedReviewPov] = useState<ReviewPov>("both");
  const [reviewFocusKey, setReviewFocusKey] = useState<ReviewFocusKey>("summary");
  const [reviewPollingActiveDebug, setReviewPollingActiveDebug] =
    useState(false);
  const [reviewPendingStartedAtDebug, setReviewPendingStartedAtDebug] =
    useState<number | null>(null);
  const [lastReviewGenerateStatus, setLastReviewGenerateStatus] =
    useState<string | null>(null);
  const [lastReviewGetStatus, setLastReviewGetStatus] =
    useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyState>("idle");
  const [activeTab, setActiveTab] = useState<ActiveTab>("moves");
  const [openingClassification, setOpeningClassification] =
    useState<OpeningClassification | null>(null);
  const [openingStatus, setOpeningStatus] =
    useState<OpeningLoadStatus>("idle");
  const [openingMessage, setOpeningMessage] = useState<string | null>(null);
  const [openingIntentionNote, setOpeningIntentionNote] = useState("");
  const [pgnText, setPgnText] = useState("");
  const [pgnFile, setPgnFile] = useState<File | null>(null);
  const [pgnUserAlias, setPgnUserAlias] = useState("");
  const [pgnPlatform, setPgnPlatform] = useState("unknown");
  const [pgnPreview, setPgnPreview] = useState<PgnImportPreview | null>(null);
  const [pgnImportResult, setPgnImportResult] =
    useState<PgnImportResult | null>(null);
  const [pgnImportLoading, setPgnImportLoading] = useState(false);
  const [pgnImportError, setPgnImportError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<GameHistoryItem[]>([]);
  const [historyScope, setHistoryScope] = useState<HistoryScope>("mine");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyOpeningGameId, setHistoryOpeningGameId] = useState<number | null>(
    null,
  );
  const [selectedHistoryGame, setSelectedHistoryGame] =
    useState<GameHistoryItem | null>(null);
  const boardFenRef = useRef<string | null>(null);
  const currentBoardContextRef = useRef<BoardEvaluationContext>("live");
  const currentLiveSessionRef = useRef<string | null>(null);
  const currentLiveSessionFenRef = useRef<string | null>(null);
  const currentLiveSessionContextRef = useRef<BoardEvaluationContext | null>(null);
  const reviewPendingStartedAtRef = useRef<number | null>(null);
  const reviewAnalysisProfileRef = useRef<ReviewAnalysisProfile>("standard");
  const reviewPollIntervalRef = useRef<number | null>(null);
  const reviewPollInFlightRef = useRef(false);
  const reviewPollRunIdRef = useRef(0);
  const reviewJobPollIntervalRef = useRef<number | null>(null);
  const reviewJobPollInFlightRef = useRef(false);
  const reviewJobRunIdRef = useRef(0);
  const reviewReconcileInFlightRef = useRef(false);
  const reviewVisibleSpinnerTimerRef = useRef<number | null>(null);
  const reviewVisibleSpinnerTimedOutRef = useRef(false);
  const reviewReplayTimersRef = useRef<number[]>([]);
  const reviewAnimationRequestIdRef = useRef(0);
  const boardEvaluationRetryCountRef = useRef(0);
  const boardEvaluationRetryTimerRef = useRef<number | null>(null);
  const boardEvaluationRetryTargetRef = useRef<string | null>(null);
  const engineWarmupGraceTimerRef = useRef<number | null>(null);
  const engineWarmupGameIdRef = useRef<number | null>(null);
  const engineWarmupSessionIdRef = useRef<string | null>(null);
  const restoringAppStateRef = useRef(false);
  const hasValidLiveUpdateRef = useRef(false);
  const hasValidEvaluationRef = useRef(false);
  const liveStoppedNormallyRef = useRef(false);
  const lastLiveUpdateAtRef = useRef(0);

  const hasVisibleEvaluation = hasUsableEvaluation(evaluation, evaluationSource);
  const hasAnalysisUnavailableWarning = warnings.some(isAnalysisUnavailableWarning);
  const suppressTransientAnalysisWarnings =
    hasVisibleEvaluation || engineWarningGraceActive || engineWarmupGraceActive;
  const visibleWarnings = suppressTransientAnalysisWarnings
    ? removeAnalysisUnavailableWarnings(warnings)
    : warnings;
  const engineWarmupNotice = liveInfoStatus ??
    (!hasVisibleEvaluation &&
    hasAnalysisUnavailableWarning &&
    (engineWarningGraceActive || engineWarmupGraceActive)
      ? "Initialisation du moteur..."
      : null);
  const canRequestReview = isGameCompleted;
  const reviewUiBusy =
    reviewUiState.status === "generating" ||
    reviewUiState.status === "pending" ||
    reviewJob?.status === "queued" ||
    reviewJob?.status === "running" ||
    reviewJob?.status === "finalizing";
  const reviewJobRunning =
    reviewJob?.status === "queued" ||
    reviewJob?.status === "running" ||
    reviewJob?.status === "finalizing";
  const liveSuspendedForReview = activeTab === "review" || reviewJobRunning;
  const reviewUiError = reviewUiState.error ?? reviewError;
  const reviewTabVisible =
    canRequestReview || review !== null || reviewUiBusy || reviewUiError !== null;
  const infoTabVisible = import.meta.env.DEV;
  const reviewHalfMovesCount = moveHistory?.moves.length ?? moves.length;
  const currentGameIsShortForReview =
    isShortGameForReview(reviewHalfMovesCount);
  const canNavigate = Boolean(moveHistory) && !moveHistoryLoading && !moveHistoryError;
  const finalDisplayedPly = moveHistory?.moves.length ?? 0;
  const boardFen = viewedFen ?? currentFen;
  const currentReviewOverlayPositionKey = makeReviewOverlayPositionKey(
    gameId,
    boardFen,
    positionMode,
    displayedPositionPly,
    reviewOverlayPhase,
  );
  const selectedReviewMoment =
    selectedReviewIndex !== null ? review?.moments[selectedReviewIndex] ?? null : null;
  const reviewReplayBadge =
    guidedReplayPhase && selectedReviewAnnotation
      ? guidedReplayBadgeText(
          guidedReplayPhase,
          selectedReviewAnnotation,
          selectedReviewPov,
          review,
        )
      : reviewReplayBadgeText(reviewReplayState, reviewReplayMoveMode);
  const reviewReplayDisplayedFenKind = reviewDisplayedFenKind(
    positionMode,
    boardFen,
    currentFen,
    selectedReviewMoment,
  );
  const reviewReplayHasEvalBefore = selectedReviewMoment
    ? reviewMomentEvaluation(selectedReviewMoment, "before") !== null
    : false;
  const reviewReplayHasEvalAfter = selectedReviewMoment
    ? reviewMomentEvaluation(selectedReviewMoment, "after") !== null
    : false;
  const boardEvaluationContext = boardEvaluationContextForPosition(
    positionMode,
    displayedPositionPly,
    finalDisplayedPly,
    isGameCompleted,
  );
  const evaluationBarState = evaluationBarStateForBoardFen(
    positionMode,
    boardFen,
    currentFen,
    evaluation,
    evaluationSource,
    evaluationFen,
    review,
    selectedReviewIndex,
    positionEvaluationCache,
    boardEvaluationContext,
    liveAnalysisSessionId,
    reviewBarPhase,
    reviewReplayMoveMode,
    selectedReviewAnnotation,
    reviewPracticeState,
  );

  useEffect(() => {
    hasValidEvaluationRef.current = hasVisibleEvaluation;
  }, [hasVisibleEvaluation]);

  useEffect(() => {
    boardFenRef.current = boardFen;
  }, [boardFen]);

  useEffect(() => {
    if (
      reviewOverlayPositionKey &&
      currentReviewOverlayPositionKey !== reviewOverlayPositionKey
    ) {
      debugLog("review_overlay_position_key_mismatch_clear", {
        expected: reviewOverlayPositionKey,
        current: currentReviewOverlayPositionKey,
      });
      setReviewOverlayPositionKey(null);
      setReviewOverlayPhase(null);
    }
  }, [currentReviewOverlayPositionKey, reviewOverlayPositionKey]);

  useEffect(() => {
    currentBoardContextRef.current = boardEvaluationContext;
  }, [boardEvaluationContext]);

  useEffect(() => {
    writeHideEvaluationPreference(hideEvaluation);
  }, [hideEvaluation]);

  useEffect(() => {
    reviewAnalysisProfileRef.current = reviewAnalysisProfile;
  }, [reviewAnalysisProfile]);

  useEffect(() => {
    setSelectedReviewPov(readReviewPovPreference(gameId, review));
  }, [gameId, review?.user_color]);

  useEffect(() => {
    setReviewFocusKey("summary");
  }, [gameId, review?.game_id, review?.status]);

  useEffect(() => {
    setOpeningIntentionNote(readOpeningIntentionNote(gameId));
  }, [gameId]);

  useEffect(() => {
    if (!gameId || activeTab !== "review" || !reviewIsCompletedForPractice(review)) {
      setReviewPracticeHistory([]);
      return;
    }
    void loadReviewPracticeHistory(gameId);
  }, [activeTab, gameId, review?.status, review?.completed_position_count]);

  useEffect(() => {
    resetSolutionReveal("game_changed");
  }, [gameId]);

  useEffect(() => {
    return () => {
      clearReviewReplayTimers("unmount", false);
      clearReviewVisibleSpinnerTimer("unmount");
      clearReviewPolling("unmount");
      clearReviewJobPolling("unmount");
    };
  }, []);

  useEffect(() => {
    if (!reviewPvLineState?.active || !reviewPvLineState.autoplay) {
      return;
    }
    if (reviewPvLineState.currentIndex >= reviewPvLineState.moves.length - 1) {
      return;
    }
    const timer = window.setTimeout(() => {
      showManualPvLineStep(reviewPvLineState.currentIndex + 1);
    }, REPLAY_PV_LINE_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [
    reviewPvLineState?.active,
    reviewPvLineState?.autoplay,
    reviewPvLineState?.currentIndex,
    reviewPvLineState?.moves.length,
  ]);

  useEffect(() => {
    if (activeTab !== "review") {
      clearReviewOverlays("review_tab_left");
      resetSolutionReveal("review_tab_left");
      setReviewPracticeState(null);
    }
  }, [activeTab]);

  useEffect(() => {
    void restorePersistedAppState();
  }, []);

  useEffect(() => {
    if (restoringAppStateRef.current) {
      return;
    }
    writePersistedAppState({
      gameId,
      activeTab,
      displayedPositionPly,
      activeReviewJobId: reviewJob?.job_id ?? null,
      reviewAnalysisProfile,
      updatedAt: Date.now(),
    });
  }, [
    activeTab,
    displayedPositionPly,
    gameId,
    reviewAnalysisProfile,
    reviewJob?.job_id,
  ]);

  useEffect(() => {
    if (restoringAppStateRef.current) {
      return;
    }
    clearReviewOverlays("game_id_changed");
    clearReviewVisibleSpinnerTimer("game_id_changed");
    clearReviewPolling("game_id_changed");
    clearReviewJobPolling("game_id_changed");
    setReview(null);
    setReviewJob(null);
    setReviewBarPhase("before");
    reviewVisibleSpinnerTimedOutRef.current = false;
    setLastReviewGenerateStatus(null);
    setLastReviewGetStatus(null);
    dispatchReviewEvent({ type: "reset" });
  }, [gameId]);

  useEffect(() => {
    if (
      !gameId ||
      !isGameCompleted ||
      !currentGameIsShortForReview ||
      (!reviewLoading &&
        !reviewUiBusy &&
        reviewPollIntervalRef.current === null &&
        review?.status !== "pending")
    ) {
      return;
    }

    forceShortGameReviewState("short_game_detected_while_active");
  }, [
    currentGameIsShortForReview,
    gameId,
    isGameCompleted,
    review?.status,
    reviewLoading,
    reviewUiBusy,
  ]);

  useEffect(() => {
    beginEngineWarmupGrace(gameId, liveAnalysisSessionId, "app_startup");
    return () => clearEngineWarmupGraceTimer();
  }, []);

  useEffect(() => {
    if (gameId !== null) {
      beginEngineWarmupGrace(gameId, null, "game");
    }
  }, [gameId]);

  useEffect(() => {
    if (
      hasAnalysisUnavailableWarning &&
      !hasVisibleEvaluation &&
      (engineWarningGraceActive || engineWarmupGraceActive)
    ) {
      debugLog("engine_warmup_warning_suppressed");
    }
  }, [
    engineWarmupGraceActive,
    engineWarningGraceActive,
    hasAnalysisUnavailableWarning,
    hasVisibleEvaluation,
  ]);

  useEffect(() => {
    if (activeTab === "review" && !reviewTabVisible) {
      setActiveTab("moves");
    }
    if (activeTab === "info" && !infoTabVisible) {
      setActiveTab("moves");
    }
  }, [activeTab, infoTabVisible, reviewTabVisible]);

  useEffect(() => {
    if (positionMode === "HISTORICAL" && viewedFen && viewedFen !== currentFen) {
      void loadPositionEvaluation(viewedFen);
    }

  }, [currentFen, positionMode, review, selectedReviewIndex, viewedFen]);

  useEffect(() => {
    if (!boardFen || !gameId) {
      stopCurrentBoardEvaluationSession();
      resetBoardEvaluationRetry(null);
      return;
    }

    if (liveSuspendedForReview || positionMode === "REVIEW") {
      stopCurrentBoardEvaluationSession();
      resetBoardEvaluationRetry(null);
      if (liveSuspendedForReview) {
        setLiveInfoStatus("Live suspendu pendant la Review");
      }
      return;
    }

    const targetKey = boardEvaluationTargetKey(
      boardFen,
      boardEvaluationContext,
      gameId,
      selectedReviewMomentId,
    );
    if (boardEvaluationRetryTargetRef.current !== targetKey) {
      resetBoardEvaluationRetry(targetKey);
    }

    if (
      currentLiveSessionRef.current &&
      currentLiveSessionFenRef.current === boardFen &&
      currentLiveSessionContextRef.current === boardEvaluationContext
    ) {
      return;
    }

    stopCurrentBoardEvaluationSession();
    hasValidLiveUpdateRef.current = false;
    liveStoppedNormallyRef.current = false;
    lastLiveUpdateAtRef.current = 0;
    setLiveStatus(null);
    setLiveInfoStatus(null);

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void startLiveAnalysis({
        fen: boardFen,
        context: boardEvaluationContext,
        game_id: gameId,
        ply: displayedPositionPly,
        review_moment_id: selectedReviewMomentId,
      })
        .then((response) => {
          if (cancelled) {
            void stopLiveAnalysis(response.session_id).catch(() => undefined);
            return;
          }

          currentLiveSessionRef.current = response.session_id;
          currentLiveSessionFenRef.current = response.fen;
          currentLiveSessionContextRef.current = normalizeBoardEvaluationContext(
            response.context,
          );
          setLiveAnalysisSessionId(response.session_id);
        })
        .catch(() => {
          if (!cancelled) {
            scheduleBoardEvaluationRetry(targetKey);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    boardEvaluationContext,
    boardFen,
    displayedPositionPly,
    gameId,
    liveSuspendedForReview,
    boardEvaluationRetryNonce,
    positionMode,
    selectedReviewMomentId,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!canNavigate || isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPreviousPosition();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNextPosition();
      } else if (event.key === "Home") {
        event.preventDefault();
        goInitialPosition();
      } else if (event.key === "End") {
        event.preventDefault();
        goLivePosition();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    currentLiveSessionRef.current = liveAnalysisSessionId;
    hasValidLiveUpdateRef.current = false;
    liveStoppedNormallyRef.current = false;
    lastLiveUpdateAtRef.current = 0;

    if (!liveAnalysisSessionId) {
      return;
    }

    beginEngineWarmupGrace(gameId, liveAnalysisSessionId, "live_session");

    const eventSource = new EventSource(
      liveAnalysisStreamUrl(liveAnalysisSessionId),
    );

    eventSource.onmessage = (event) => {
      let update: LiveAnalysisUpdate;
      try {
        update = JSON.parse(event.data) as LiveAnalysisUpdate;
      } catch {
        return;
      }

      if (update.type === "analysis_stopped") {
        if (update.session_id === currentLiveSessionRef.current) {
          liveStoppedNormallyRef.current = true;
          currentLiveSessionRef.current = null;
          currentLiveSessionFenRef.current = null;
          currentLiveSessionContextRef.current = null;
          setLiveAnalysisSessionId(null);
          setLiveStatus(null);
          eventSource.close();
        }
        return;
      }

      if (update.type === "analysis_error") {
        if (
          update.session_id === currentLiveSessionRef.current &&
          !hasValidLiveUpdateRef.current &&
          !hasValidEvaluationRef.current
        ) {
          scheduleBoardEvaluationRetry(boardEvaluationRetryTargetRef.current);
        }
        if (update.session_id === currentLiveSessionRef.current) {
          currentLiveSessionRef.current = null;
          currentLiveSessionFenRef.current = null;
          currentLiveSessionContextRef.current = null;
          setLiveAnalysisSessionId(null);
        } else {
          debugLog("stale_engine_warning_ignored", {
            sessionId: update.session_id,
          });
        }
        eventSource.close();
        return;
      }

      if (update.session_id !== currentLiveSessionRef.current) {
        return;
      }

      const currentBoardFen = boardFenRef.current;
      if (currentBoardFen && update.fen && update.fen !== currentBoardFen) {
        return;
      }

      const currentContext = currentBoardContextRef.current;
      if (
        update.context &&
        currentContext &&
        normalizeBoardEvaluationContext(update.context) !== currentContext
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastLiveUpdateAtRef.current < 200) {
        return;
      }
      lastLiveUpdateAtRef.current = now;

      if (update.evaluation_display) {
        setEvaluation(update.evaluation_display);
        setEvaluationFen(update.fen ?? currentBoardFen ?? null);
      }
      if (update.evaluation_source) {
        setEvaluationSource({
          ...update.evaluation_source,
          kind: liveSourceKindForContext(currentContext),
        });
      }
      if (
        update.evaluation_display &&
        update.evaluation_source?.kind === "live"
      ) {
        setWarnings(removeAnalysisUnavailableWarnings);
      }
      hasValidLiveUpdateRef.current = true;
      debugLog("engine_warmup_cleared_by_live");
      clearTransientEngineStartupState();
      setLiveStatus(null);
    };

    eventSource.onerror = () => {
      if (
        currentLiveSessionRef.current === liveAnalysisSessionId &&
        !liveStoppedNormallyRef.current &&
        !hasValidLiveUpdateRef.current &&
        !hasValidEvaluationRef.current
      ) {
        scheduleBoardEvaluationRetry(boardEvaluationRetryTargetRef.current);
      } else {
        setLiveStatus(null);
      }
      if (currentLiveSessionRef.current === liveAnalysisSessionId) {
        currentLiveSessionRef.current = null;
        currentLiveSessionFenRef.current = null;
        currentLiveSessionContextRef.current = null;
        setLiveAnalysisSessionId(null);
      }
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [liveAnalysisSessionId]);

  async function handleNewGame() {
    setBusy("new-game");
    setError(null);
    setReview(null);
    setReviewJob(null);
    clearReviewPolling("new_game");
    clearReviewJobPolling("new_game");
    clearReviewOverlays("new_game");
    setReviewBarPhase("before");
    dispatchReviewEvent({ type: "reset" });
    beginEngineWarmupGrace(null, null, "new_game_request");

    try {
      const state = await createGame();
      applyState(state, true);
      await loadMoveHistory(state.game_id, true);
      await loadOpeningClassification(state.game_id);
      setActiveTab("moves");
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusy("idle");
    }
  }

  async function handleMove(uci: string, optimisticFen: string | null) {
    if (
      reviewPracticeState?.active &&
      reviewPracticeState.status === "running" &&
      positionMode === "REVIEW"
    ) {
      await handlePracticeAttempt(uci);
      return;
    }
    if (reviewTryMoveState?.active && positionMode === "REVIEW") {
      handleTryMoveAttempt(uci);
      return;
    }
    if (!gameId || busy !== "idle" || positionMode !== "LIVE") {
      return;
    }
    beginEngineWarmupGrace(gameId, liveAnalysisSessionId, "move_request");

    const previousCurrentFen = currentFen;
    const previousViewedFen = viewedFen;
    setBusy("move");
    setError(null);
    setReview(null);
    setReviewJob(null);
    clearReviewPolling("move");
    clearReviewJobPolling("move");
    clearReviewOverlays("move");
    setReviewBarPhase("before");
    dispatchReviewEvent({ type: "reset" });

    if (optimisticFen) {
      setCurrentFen(optimisticFen);
      setViewedFen(optimisticFen);
    }

    try {
      const state = await playMove(gameId, uci);
      applyState(state, true);
      await loadMoveHistory(gameId, true);
      resetOpeningClassification();
    } catch (err) {
      setCurrentFen(previousCurrentFen);
      setViewedFen(previousViewedFen);
      setError(messageFromError(err));
    } finally {
      setBusy("idle");
    }
  }

  async function handleFinishGame() {
    if (!gameId || busy !== "idle") {
      return;
    }

    setBusy("finish");
    setError(null);

    try {
      const state = await finishGame(gameId);
      applyState(state, true);
      await loadMoveHistory(gameId, true);
      await loadOpeningClassification(gameId);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusy("idle");
    }
  }

  function dispatchReviewEvent(event: ReviewStateEvent) {
    setReviewUiState((current) => {
      const next = reviewStateReducer(current, event);
      debugLog("review_state_transition", {
        from: current.status,
        to: next.status,
        event: event.type,
      });
      return next;
    });
  }

  function clearReviewPolling(reason: string) {
    reviewPollRunIdRef.current += 1;
    clearReviewVisibleSpinnerTimer(reason);
    if (reviewPollIntervalRef.current !== null) {
      window.clearInterval(reviewPollIntervalRef.current);
      reviewPollIntervalRef.current = null;
    }
    reviewPollInFlightRef.current = false;
    reviewPendingStartedAtRef.current = null;
    setReviewPollingActiveDebug(false);
    setReviewPendingStartedAtDebug(null);
    debugLog("review_poll_cleared", { reason });
    debugLog("review_poll_stopped", { reason });
  }

  function clearReviewJobPolling(reason: string) {
    reviewJobRunIdRef.current += 1;
    if (reviewJobPollIntervalRef.current !== null) {
      window.clearInterval(reviewJobPollIntervalRef.current);
      reviewJobPollIntervalRef.current = null;
    }
    reviewJobPollInFlightRef.current = false;
    debugLog("review_job_poll_cleared", { reason });
  }

  function clearReviewVisibleSpinnerTimer(reason: string) {
    if (reviewVisibleSpinnerTimerRef.current !== null) {
      window.clearTimeout(reviewVisibleSpinnerTimerRef.current);
      reviewVisibleSpinnerTimerRef.current = null;
      debugLog("review_visible_spinner_timer_cleared", { reason });
    }
  }

  function clearReviewReplayTimers(reason: string, resetState = true) {
    if (reviewReplayTimersRef.current.length > 0) {
      for (const timerId of reviewReplayTimersRef.current) {
        window.clearTimeout(timerId);
      }
      reviewReplayTimersRef.current = [];
      debugLog("review_replay_timers_cleared", { reason });
    }
    if (resetState) {
      setReviewReplayState("idle");
      setReviewReplayMoveMode("played");
      setGuidedReplayPhase(null);
      setGuidedPvIndex(null);
      setSelectedReviewAnnotation(null);
      setSelectedReviewAnnotationIndex(null);
      setReviewTryMoveState(null);
      setReviewPvLineState(null);
      setReviewOverlayPositionKey(null);
      setReviewOverlayPhase(null);
    }
  }

  function clearReviewOverlays(reason: string, resetState = true) {
    clearReviewReplayTimers(reason, resetState);
    setReviewOverlayPositionKey(null);
    setReviewOverlayPhase(null);
    if (resetState) {
      setGuidedPvIndex(null);
      setReviewPvLineState(null);
      setOpeningGuideState(null);
      setReviewOpeningFocusMessage(null);
    }
  }

  function setReviewOverlayForPosition(
    fen: string | null,
    ply: number,
    phase: string,
  ) {
    setReviewOverlayPhase(phase);
    setReviewOverlayPositionKey(
      makeReviewOverlayPositionKey(gameId, fen, "REVIEW", ply, phase),
    );
  }

  function nextReviewAnimationRequestId(reason: string): number {
    const nextId = reviewAnimationRequestIdRef.current + 1;
    reviewAnimationRequestIdRef.current = nextId;
    setReviewAnimationRequestId(nextId);
    debugLog("review_animation_request", { reason, requestId: nextId });
    return nextId;
  }

  function setSolutionRevealForAnnotation(
    annotation: ReviewMoveAnnotation | null,
    state: ReviewSolutionRevealMode,
  ) {
    if (!annotation) {
      setReviewSolutionRevealState(null);
      setReviewOverlayPositionKey(null);
      setReviewOverlayPhase(null);
      return;
    }
    if (state === "hidden" || state === "hint_shown") {
      setReviewOverlayPositionKey(null);
      setReviewOverlayPhase(null);
      setReviewPvLineState(null);
      setGuidedPvIndex(null);
      setGuidedReplayPhase(null);
    }
    setReviewSolutionRevealState({
      key: makeSolutionRevealKey(gameId, annotation, selectedReviewPov),
      ply: annotation.ply,
      pov: selectedReviewPov,
      state,
    });
  }

  function resetSolutionReveal(reason: string) {
    debugLog("review_solution_reveal_reset", { reason });
    setReviewSolutionRevealState(null);
    setReviewOverlayPositionKey(null);
    setReviewOverlayPhase(null);
    setReviewPvLineState(null);
    setGuidedPvIndex(null);
  }

  function startReviewVisibleSpinnerTimer(gameIdForTimer: number) {
    clearReviewVisibleSpinnerTimer("replace_visible_spinner_timer");
    reviewVisibleSpinnerTimedOutRef.current = false;
    const runId = reviewPollRunIdRef.current;
    reviewVisibleSpinnerTimerRef.current = window.setTimeout(() => {
      if (runId !== reviewPollRunIdRef.current) {
        return;
      }
      triggerReviewPendingBackground(gameIdForTimer);
    }, REVIEW_VISIBLE_SPINNER_TIMEOUT_MS);
    debugLog("review_visible_spinner_timer_created", {
      gameId: gameIdForTimer,
      timeoutMs: REVIEW_VISIBLE_SPINNER_TIMEOUT_MS,
      runId,
    });
  }

  function triggerReviewPendingBackground(gameIdForTimer: number) {
    reviewVisibleSpinnerTimedOutRef.current = true;
    debugLog("review_visible_spinner_timeout", {
      gameId: gameIdForTimer,
      timeoutMs: REVIEW_VISIBLE_SPINNER_TIMEOUT_MS,
    });
    clearReviewPolling("visible_spinner_timeout");
    dispatchReviewEvent({ type: "visible_spinner_elapsed" });
    setReviewError(null);
    setReviewLoading(false);
  }

  function applyReviewResponse(
    response: ReviewResponse,
    now: number,
  ): ReviewUiStatus {
    const guardedResponse =
      response.game_id === gameId &&
      currentGameIsShortForReview &&
      reviewStatusFromResponse(response) !== "not_reviewable"
        ? makeShortGameReviewResponse(response.game_id, reviewHalfMovesCount)
        : response;

    if (guardedResponse !== response) {
      debugLog("review_not_reviewable_wins", {
        status: response.status,
        reason: "frontend_short_game_guard",
        reviewable: false,
        halfMovesCount: reviewHalfMovesCount,
      });
    }

    setReview(guardedResponse);
    dispatchReviewEvent({
      type: "response_received",
      response: guardedResponse,
      now,
    });
    const status = reviewStatusFromResponse(guardedResponse);
    if (status === "not_reviewable") {
      debugLog("review_not_reviewable_wins", {
        status: guardedResponse.status,
        reason: guardedResponse.reason,
        reviewable: guardedResponse.reviewable,
      });
    }
    return status;
  }

  function forceShortGameReviewState(reason: string, activateTab = false) {
    if (!gameId) {
      return;
    }

    reviewVisibleSpinnerTimedOutRef.current = false;
    const response = makeShortGameReviewResponse(gameId, reviewHalfMovesCount);
    debugLog("review_short_game_frontend_guard", {
      gameId,
      halfMovesCount: reviewHalfMovesCount,
      minHalfMoves: MIN_REVIEW_HALF_MOVES,
      reason,
    });
    clearReviewPolling(reason);
    if (activateTab) {
      setActiveTab("review");
    }
    applyReviewResponse(response, Date.now());
    setReviewError(null);
    setReviewLoading(false);
  }

  function startReviewPending(gameIdForPoll: number, now: number) {
    if (currentGameIsShortForReview) {
      forceShortGameReviewState("short_game_before_polling");
      return;
    }

    if (reviewPendingStartedAtRef.current === null) {
      reviewPendingStartedAtRef.current = now;
      setReviewPendingStartedAtDebug(now);
      debugLog("review_pending_started_at", {
        gameId: gameIdForPoll,
        startedAt: now,
      });
    }

    if (reviewPollIntervalRef.current !== null) {
      window.clearInterval(reviewPollIntervalRef.current);
      debugLog("review_poll_cleared", { reason: "replace_pending_poll" });
    }

    const runId = reviewPollRunIdRef.current;
    reviewPollIntervalRef.current = window.setInterval(() => {
      void pollReviewOnce(gameIdForPoll, runId);
    }, 2_000);
    setReviewPollingActiveDebug(true);
    debugLog("review_poll_created", { gameId: gameIdForPoll, runId });
    debugLog("review_poll_started", { gameId: gameIdForPoll, runId });
  }

  function triggerReviewTimeout(gameIdForPoll: number) {
    debugLog("review_timeout_triggered", { gameId: gameIdForPoll });
    debugLog("review_pending_timeout", { gameId: gameIdForPoll });
    clearReviewPolling("timeout");
    dispatchReviewEvent({ type: "timeout" });
    setReviewError(null);
    setReviewLoading(false);
  }

  async function pollReviewOnce(gameIdForPoll: number, runId: number) {
    if (runId !== reviewPollRunIdRef.current || reviewPollInFlightRef.current) {
      return;
    }

    if (currentGameIsShortForReview) {
      setLastReviewGetStatus("blocked_short_game");
      forceShortGameReviewState("short_game_during_poll");
      return;
    }

    const startedAt = reviewPendingStartedAtRef.current;
    if (startedAt === null) {
      clearReviewPolling("missing_pending_started_at");
      return;
    }

    const elapsed = Date.now() - startedAt;
    debugLog("review_pending_elapsed_ms", { gameId: gameIdForPoll, elapsed });
    if (elapsed >= REVIEW_PENDING_TIMEOUT_MS) {
      triggerReviewTimeout(gameIdForPoll);
      return;
    }

    reviewPollInFlightRef.current = true;
    try {
      const targetProfile = reviewAnalysisProfileRef.current;
      debugLog("review_get_request", {
        gameId: gameIdForPoll,
        profile: targetProfile,
      });
      const nextReview = await getReview(gameIdForPoll, {
        profile: targetProfile,
      });
      if (runId !== reviewPollRunIdRef.current) {
        return;
      }

      debugLog("review_get_response", {
        gameId: gameIdForPoll,
        status: nextReview.status,
        reason: nextReview.reason,
        reviewable: nextReview.reviewable,
        empty_reason: nextReview.empty_reason,
        missing_deep_count: nextReview.missing_deep_count,
        analyzed_deep_count: nextReview.analyzed_deep_count,
        total_required_deep_count: nextReview.total_required_deep_count,
        scheduled_deep_count: nextReview.scheduled_deep_count,
        failed_deep_count: nextReview.failed_deep_count,
        failed_deep_details: nextReview.failed_deep_details,
        review_work_active: nextReview.review_work_active,
      });
      setLastReviewGetStatus(nextReview.status);

      const nextStatus = applyReviewResponse(nextReview, Date.now());
      if (nextStatus === "pending") {
        const nextStartedAt = reviewPendingStartedAtRef.current;
        const nextElapsed =
          nextStartedAt === null ? 0 : Date.now() - nextStartedAt;
        debugLog("review_pending_elapsed_ms", {
          gameId: gameIdForPoll,
          elapsed: nextElapsed,
        });
        if (nextElapsed >= REVIEW_PENDING_TIMEOUT_MS) {
          triggerReviewTimeout(gameIdForPoll);
        }
        return;
      }

      if (isReviewTerminalStatus(nextStatus)) {
        clearReviewPolling(`terminal_${nextStatus}`);
      }
    } catch (err) {
      if (runId !== reviewPollRunIdRef.current) {
        return;
      }
      const message = messageFromError(err);
      dispatchReviewEvent({ type: "request_failed", message });
      setReviewError(message);
      clearReviewPolling("poll_error");
    } finally {
      reviewPollInFlightRef.current = false;
    }
  }

  function startReviewJobPolling(job: ReviewJobResponse) {
    clearReviewJobPolling("replace_review_job_poll");
    const runId = reviewJobRunIdRef.current;
    const intervalMs = job.status === "finalizing" ? 1_800 : 1_200;
    reviewJobPollIntervalRef.current = window.setInterval(() => {
      void pollReviewJobOnce(job.job_id, runId);
    }, intervalMs);
    debugLog("review_job_poll_started", {
      jobId: job.job_id,
      status: job.status,
    });
  }

  async function pollReviewJobOnce(jobId: string, runId: number) {
    if (runId !== reviewJobRunIdRef.current || reviewJobPollInFlightRef.current) {
      return;
    }
    reviewJobPollInFlightRef.current = true;
    try {
      const nextJob = await getReviewJob(jobId);
      if (runId !== reviewJobRunIdRef.current) {
        return;
      }
      setReviewJob(nextJob);
      if (reviewJobNeedsExplicitReconcile(nextJob)) {
        clearReviewJobPolling("review_job_needs_reconcile");
        dispatchReviewEvent({
          type: "request_failed",
          message: reviewJobReconcileMessage(nextJob),
        });
        setReviewError(reviewJobReconcileMessage(nextJob));
        return;
      }
      if (nextJob.status === "completed") {
        clearReviewJobPolling("review_job_completed");
        await loadCompletedReviewAfterJob(nextJob);
        return;
      }
      if (
        nextJob.status === "failed" ||
        nextJob.status === "cancelled" ||
        nextJob.status === "incomplete" ||
        nextJob.status === "stalled"
      ) {
        clearReviewJobPolling(`review_job_${nextJob.status}`);
        dispatchReviewEvent({
          type: "request_failed",
          message: reviewJobUserMessage(nextJob),
        });
      }
    } catch (_err) {
      if (runId !== reviewJobRunIdRef.current) {
        return;
      }
      setReviewError("Connexion au backend interrompue.");
    } finally {
      reviewJobPollInFlightRef.current = false;
    }
  }

  async function loadCompletedReviewAfterJob(job: ReviewJobResponse) {
    if (!gameId || job.game_id !== gameId) {
      return;
    }
    try {
      const nextReview = await getReview(job.game_id, {
        profile: job.profile,
      });
      applyReviewResponse(nextReview, Date.now());
      setReviewError(null);
      setReviewLoading(false);
    } catch (_err) {
      setReviewError("Analyse terminee, mais la review finale est indisponible.");
    }
  }

  async function restorePersistedAppState() {
    const saved = readPersistedAppState();
    if (!saved?.gameId) {
      return;
    }

    restoringAppStateRef.current = true;
    setBusy("load-game");
    try {
      const state = await getGame(saved.gameId);
      applyState(state, true);
      const history = await getGameMoves(saved.gameId);
      setMoveHistory(history);
      const restoredPly = clampPly(saved.displayedPositionPly, history.moves.length);
      setViewedFen(fenForHistoryPly(history, restoredPly));
      setDisplayedPositionPly(restoredPly);
      setPositionMode(restoredPly === history.moves.length ? "LIVE" : "HISTORICAL");
      await loadOpeningClassification(saved.gameId);
      setReviewAnalysisProfile(saved.reviewAnalysisProfile);
      setActiveTab(saved.activeTab);

      if (saved.activeReviewJobId) {
        try {
          const restoredJob = await getReviewJob(saved.activeReviewJobId);
          if (restoredJob.game_id === saved.gameId) {
            setReviewJob(restoredJob);
            if (reviewJobNeedsExplicitReconcile(restoredJob)) {
              setReviewError(reviewJobReconcileMessage(restoredJob));
              setActiveTab("review");
              return;
            }
            if (
              restoredJob.status === "queued" ||
              restoredJob.status === "running" ||
              restoredJob.status === "finalizing"
            ) {
              setActiveTab("review");
              startReviewJobPolling(restoredJob);
              return;
            }
            if (restoredJob.status === "completed") {
              const restoredReview = await getReview(restoredJob.game_id, {
                profile: restoredJob.profile,
              });
              setReview(restoredReview);
              dispatchReviewEvent({
                type: "response_received",
                response: restoredReview,
                now: Date.now(),
              });
              setActiveTab("review");
              return;
            }
            if (
              restoredJob.status === "failed" ||
              restoredJob.status === "cancelled" ||
              restoredJob.status === "incomplete" ||
              restoredJob.status === "stalled"
            ) {
              setReviewError(reviewJobUserMessage(restoredJob));
              setActiveTab("review");
              return;
            }
          }
        } catch {
          setReviewJob(null);
          writePersistedAppState({
            ...saved,
            activeReviewJobId: null,
            updatedAt: Date.now(),
          });
        }
      }

      if (saved.activeTab === "review") {
        try {
          const restoredReview = await getReview(saved.gameId, {
            profile: saved.reviewAnalysisProfile,
          });
          setReview(restoredReview);
          dispatchReviewEvent({
            type: "response_received",
            response: restoredReview,
            now: Date.now(),
          });
        } catch {
          setReviewError(null);
        }
      }
    } catch {
      setError("Impossible de restaurer la partie precedente.");
      clearPersistedAppState();
    } finally {
      restoringAppStateRef.current = false;
      setBusy("idle");
    }
  }

  async function handleReview(
    options: {
      forceRetryFailed?: boolean;
      forceReanalysis?: boolean;
      profile?: ReviewAnalysisProfile;
    } = {},
  ) {
    if (!gameId || reviewLoading || reviewUiBusy) {
      return;
    }

    const targetGameId = gameId;
    const targetProfile = options.profile ?? reviewAnalysisProfile;
    setReviewAnalysisProfile(targetProfile);
    const forceReanalysis =
      options.forceReanalysis === true || options.forceRetryFailed === true;
    if (currentGameIsShortForReview) {
      setLastReviewGenerateStatus("blocked_short_game");
      debugLog("review_generate_blocked_short_game", {
        gameId: targetGameId,
        halfMovesCount: reviewHalfMovesCount,
        minHalfMoves: MIN_REVIEW_HALF_MOVES,
      });
      forceShortGameReviewState("short_game_before_generate", true);
      return;
    }

    clearReviewPolling("retry_or_generate");
    clearReviewJobPolling("retry_or_generate");
    setActiveTab("review");
    setReviewLoading(true);
    setReviewError(null);
    setReviewJob(null);
    dispatchReviewEvent({ type: "generate_started" });

    try {
      debugLog("review_job_start_request", {
        gameId: targetGameId,
        force_reanalysis: forceReanalysis,
        profile: targetProfile,
      });
      const job = await startReviewJob(targetGameId, {
        profile: targetProfile,
        forceReanalysis,
      });
      setReviewJob(job);
      setLastReviewGenerateStatus(job.status);
      debugLog("review_job_start_response", {
        gameId: targetGameId,
        jobId: job.job_id,
        status: job.status,
        completed: job.completed_position_count,
        required: job.required_position_count,
      });
      if (job.status === "completed") {
        if (reviewJobNeedsExplicitReconcile(job)) {
          const message = reviewJobReconcileMessage(job);
          dispatchReviewEvent({ type: "request_failed", message });
          setReviewError(message);
          return;
        }
        await loadCompletedReviewAfterJob(job);
        return;
      }
      if (reviewJobNeedsExplicitReconcile(job)) {
        const message = reviewJobReconcileMessage(job);
        dispatchReviewEvent({ type: "request_failed", message });
        setReviewError(message);
        return;
      }
      if (
        job.status === "queued" ||
        job.status === "running" ||
        job.status === "finalizing"
      ) {
        startReviewJobPolling(job);
        return;
      }
      dispatchReviewEvent({
        type: "request_failed",
        message: reviewJobUserMessage(job),
      });
      setReviewError(reviewJobUserMessage(job));
    } catch (err) {
      if (isTooShortReviewError(err)) {
        const response = makeShortGameReviewResponse(
          targetGameId,
          reviewHalfMovesCount,
        );
        setLastReviewGenerateStatus("not_reviewable");
        applyReviewResponse(response, Date.now());
        setReviewError(null);
        clearReviewPolling("not_reviewable_error");
        return;
      }
      const message = messageFromError(err);
      dispatchReviewEvent({ type: "request_failed", message });
      if (positionMode === "REVIEW") {
        goLivePosition();
        setReviewError("Review temporairement indisponible.");
      } else {
        setReviewError("Impossible de générer la review pour le moment.");
      }
      clearReviewPolling("generate_error");
      clearReviewJobPolling("generate_error");
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleReconcileReviewJob() {
    if (!reviewJob?.job_id || reviewReconcileInFlightRef.current) {
      return;
    }
    reviewReconcileInFlightRef.current = true;
    setReviewReconcileInFlight(true);
    setReviewError(null);
    clearReviewJobPolling("explicit_reconcile");
    try {
      const reconciled = await reconcileReviewJob(reviewJob.job_id);
      setReviewJob(reconciled);
      if (reviewJobNeedsExplicitReconcile(reconciled)) {
        setReviewError(reviewJobReconcileMessage(reconciled));
        return;
      }
      if (reconciled.status === "completed") {
        await loadCompletedReviewAfterJob(reconciled);
        return;
      }
      if (
        reconciled.status === "queued" ||
        reconciled.status === "running" ||
        reconciled.status === "finalizing"
      ) {
        startReviewJobPolling(reconciled);
        return;
      }
      setReviewError(reviewJobUserMessage(reconciled));
    } catch (_err) {
      setReviewError("Impossible de verifier l'analyse Review pour le moment.");
    } finally {
      reviewReconcileInFlightRef.current = false;
      setReviewReconcileInFlight(false);
    }
  }

  async function handleCancelReviewJob() {
    if (!reviewJob?.job_id) {
      return;
    }
    try {
      const cancelled = await cancelReviewJob(reviewJob.job_id);
      setReviewJob(cancelled);
      clearReviewJobPolling("cancel_review_job");
      dispatchReviewEvent({
        type: "request_failed",
        message: "Analyse annulee.",
      });
      setReviewError(null);
    } catch (_err) {
      setReviewError("Impossible d'annuler l'analyse pour le moment.");
    }
  }

  async function handleReviewCheck() {
    if (!gameId || reviewLoading || reviewUiBusy) {
      return;
    }

    const targetGameId = gameId;
    const targetProfile = reviewAnalysisProfile;
    if (currentGameIsShortForReview) {
      setLastReviewGetStatus("blocked_short_game");
      forceShortGameReviewState("short_game_before_check", true);
      return;
    }

    clearReviewPolling("check_review");
    setActiveTab("review");
    startReviewVisibleSpinnerTimer(targetGameId);
    setReviewLoading(true);
    setReviewError(null);
    dispatchReviewEvent({ type: "check_started" });

    try {
      debugLog("review_get_request", {
        gameId: targetGameId,
        source: "manual_check",
        profile: targetProfile,
      });
      const nextReview = await getReview(targetGameId, {
        profile: targetProfile,
      });
      setLastReviewGetStatus(nextReview.status);
      debugLog("review_get_response", {
        gameId: targetGameId,
        status: nextReview.status,
        reason: nextReview.reason,
        reviewable: nextReview.reviewable,
        empty_reason: nextReview.empty_reason,
        missing_deep_count: nextReview.missing_deep_count,
        analyzed_deep_count: nextReview.analyzed_deep_count,
        total_required_deep_count: nextReview.total_required_deep_count,
        scheduled_deep_count: nextReview.scheduled_deep_count,
        failed_deep_count: nextReview.failed_deep_count,
        failed_deep_details: nextReview.failed_deep_details,
        review_work_active: nextReview.review_work_active,
      });

      const nextStatus = applyReviewResponse(nextReview, Date.now());
      if (nextStatus === "not_reviewable") {
        setReviewError(null);
        clearReviewPolling("not_reviewable_check");
        return;
      }

      if (nextStatus === "pending") {
        if (reviewVisibleSpinnerTimedOutRef.current) {
          dispatchReviewEvent({ type: "visible_spinner_elapsed" });
          clearReviewPolling("pending_background_check");
          return;
        }
        startReviewPending(targetGameId, Date.now());
        return;
      }

      if (isReviewTerminalStatus(nextStatus)) {
        clearReviewPolling(`terminal_${nextStatus}_check`);
      }
    } catch (err) {
      const message = messageFromError(err);
      dispatchReviewEvent({ type: "request_failed", message });
      setReviewError(message);
      clearReviewPolling("check_error");
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleRebuildReviewMetrics() {
    if (!gameId || reviewLoading || reviewUiBusy) {
      return;
    }

    const targetGameId = gameId;
    const targetProfile = reviewAnalysisProfile;
    setActiveTab("review");
    setReviewLoading(true);
    setReviewError(null);
    try {
      const rebuilt = await rebuildReviewMetrics(targetGameId, {
        profile: targetProfile,
      });
      applyReviewResponse(rebuilt, Date.now());
      setLastReviewGetStatus(rebuilt.status);
      setReviewError(null);
    } catch (err) {
      setReviewError(messageFromError(err));
    } finally {
      setReviewLoading(false);
    }
  }

  function handlePgnFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPgnFile(file);
    setPgnPreview(null);
    setPgnImportResult(null);
    setPgnImportError(null);
  }

  async function handlePgnPreview() {
    if (!pgnFile && !pgnText.trim()) {
      setPgnImportError("Ajoute un fichier PGN ou colle un PGN.");
      return;
    }

    setPgnImportLoading(true);
    setPgnImportError(null);
    setPgnImportResult(null);
    try {
      const preview = await previewPgnImport({ pgnText, file: pgnFile });
      setPgnPreview(preview);
      if (!pgnUserAlias && preview.detected_players.length === 1) {
        setPgnUserAlias(preview.detected_players[0]);
      }
    } catch (err) {
      setPgnImportError(messageFromError(err));
    } finally {
      setPgnImportLoading(false);
    }
  }

  async function handlePgnImport() {
    if (!pgnFile && !pgnText.trim()) {
      setPgnImportError("Ajoute un fichier PGN ou colle un PGN.");
      return;
    }

    setPgnImportLoading(true);
    setPgnImportError(null);
    try {
      const result = await importPgnGames({
        pgnText,
        file: pgnFile,
        userAlias: pgnUserAlias.trim() || null,
        platform: pgnPlatform,
      });
      setPgnImportResult(result);
      await loadHistory();
      setActiveTab("history");
    } catch (err) {
      setPgnImportError(messageFromError(err));
    } finally {
      setPgnImportLoading(false);
    }
  }

  async function loadHistory(nextScope: HistoryScope = historyScope) {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const items = await getGameHistory(50, 0, nextScope);
      setHistoryItems(items);
    } catch (err) {
      setHistoryError(messageFromError(err));
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleHistoryScopeChange(nextScope: HistoryScope) {
    setHistoryScope(nextScope);
    void loadHistory(nextScope);
  }

  async function handleOpenHistoryGame(
    item: GameHistoryItem,
    nextTab: ActiveTab = "moves",
  ) {
    if (busy !== "idle") {
      return;
    }

    setBusy("load-game");
    setHistoryOpeningGameId(item.game_id);
    setHistoryError(null);
    setSelectedHistoryGame(item);
    setReview(null);
    setReviewJob(null);
    setReviewError(null);
    clearReviewPolling("open_history_game");
    clearReviewJobPolling("open_history_game");
    clearReviewOverlays("open_history_game");
    setReviewBarPhase("before");
    dispatchReviewEvent({ type: "reset" });
    beginEngineWarmupGrace(item.game_id, null, "history_game_open");

    try {
      const state = await getGame(item.game_id);
      applyState(state, true);
      await loadMoveHistory(item.game_id, true);
      await loadOpeningClassification(item.game_id);
      setActiveTab(nextTab);
    } catch (err) {
      setHistoryError(historyOpenErrorMessage(item, err));
    } finally {
      setHistoryOpeningGameId(null);
      setBusy("idle");
    }
  }

  async function handleClassifyHistoryGame(item: GameHistoryItem) {
    if (busy !== "idle") {
      return;
    }

    setHistoryOpeningGameId(item.game_id);
    setHistoryError(null);
    try {
      const classification = await classifyGameOpening(item.game_id);
      setHistoryItems((currentItems) =>
        currentItems.map((historyItem) =>
          historyItem.game_id === item.game_id
            ? {
                ...historyItem,
                opening_name: classification.opening_name,
                eco_code: classification.eco_code,
                classification_status: classification.classification_status,
              }
            : historyItem,
        ),
      );
      if (gameId === item.game_id) {
        setOpeningClassification(classification);
        setOpeningStatus("ready");
        setOpeningMessage(null);
      }
    } catch (err) {
      setHistoryError(messageFromError(err));
    } finally {
      setHistoryOpeningGameId(null);
    }
  }

  async function loadMoveHistory(
    targetGameId: number,
    resetToLive: boolean,
  ): Promise<void> {
    setMoveHistoryLoading(true);
    setMoveHistoryError(null);

    try {
      const history = await getGameMoves(targetGameId);
      setMoveHistory(history);
      if (resetToLive) {
        setViewedFen(history.current_fen);
        setDisplayedPositionPly(history.moves.length);
        setPositionMode("LIVE");
        setSelectedReviewMomentId(null);
        setSelectedReviewMovePly(null);
        setSelectedReviewIndex(null);
      }
    } catch (err) {
      setMoveHistoryError(
        `Impossible de charger l'historique de cette partie. ${messageFromError(err)}`,
      );
      if (resetToLive && currentFen) {
        setViewedFen(currentFen);
      }
    } finally {
      setMoveHistoryLoading(false);
    }
  }

  async function loadOpeningClassification(targetGameId: number): Promise<void> {
    setOpeningStatus("loading");
    setOpeningMessage(null);

    try {
      const classification = await getGameOpening(targetGameId);
      setOpeningClassification(classification);
      setOpeningStatus("ready");
    } catch (err) {
      const message = messageFromError(err);
      setOpeningClassification(null);
      if (message.includes("not found") || message.includes("HTTP 404")) {
        setOpeningStatus("not_found");
        setOpeningMessage(null);
      } else {
        setOpeningStatus("error");
        setOpeningMessage(message);
      }
    }
  }

  async function handleClassifyOpening() {
    if (!gameId || openingStatus === "loading") {
      return;
    }

    setOpeningStatus("loading");
    setOpeningMessage("Préparation du book d'ouvertures...");

    try {
      const classification = await classifyGameOpening(gameId);
      setOpeningClassification(classification);
      setOpeningStatus("ready");
      setOpeningMessage(
        classification.classification_status === "unknown"
          ? "Ouverture non reconnue par le book actuel."
          : "Book d'ouvertures local prêt.",
      );
    } catch (err) {
      const message = messageFromError(err);
      setOpeningClassification(null);
      setOpeningStatus("error");
      setOpeningMessage(message);
    }
  }

  function resetOpeningClassification() {
    setOpeningClassification(null);
    setOpeningStatus("not_found");
    setOpeningMessage(null);
  }

  async function loadPositionEvaluation(fen: string): Promise<void> {
    if (positionEvaluationCache[fen]) {
      return;
    }

    setPositionEvaluationCache((cache) => ({
      ...cache,
      [fen]: {
        status: "loading",
        evaluation: null,
        source: null,
      },
    }));

    try {
      const analysis = await getAnalysisByFen(fen, "deep");
      const lookup = lookupFromAnalysis(analysis);
      setPositionEvaluationCache((cache) => ({
        ...cache,
        [fen]: lookup,
      }));
    } catch {
      setPositionEvaluationCache((cache) => ({
        ...cache,
        [fen]: {
          status: "unavailable",
          evaluation: null,
          source: null,
        },
      }));
    }
  }

  function boardEvaluationTargetKey(
    fen: string,
    context: BoardEvaluationContext,
    targetGameId: number,
    reviewMomentId: string | null,
  ): string {
    return `${targetGameId}|${context}|${reviewMomentId ?? ""}|${fen}`;
  }

  function clearBoardEvaluationRetryTimer() {
    if (boardEvaluationRetryTimerRef.current !== null) {
      window.clearTimeout(boardEvaluationRetryTimerRef.current);
      boardEvaluationRetryTimerRef.current = null;
    }
  }

  function clearEngineWarmupGraceTimer() {
    if (engineWarmupGraceTimerRef.current !== null) {
      window.clearTimeout(engineWarmupGraceTimerRef.current);
      engineWarmupGraceTimerRef.current = null;
    }
  }

  function beginEngineWarmupGrace(
    targetGameId: number | null,
    targetSessionId: string | null,
    reason: string,
  ) {
    engineWarmupGameIdRef.current = targetGameId;
    engineWarmupSessionIdRef.current = targetSessionId;
    clearEngineWarmupGraceTimer();
    setEngineWarmupGraceActive(true);
    debugLog("engine_warmup_started_for_game", {
      gameId: targetGameId,
      sessionId: targetSessionId,
      reason,
    });
    engineWarmupGraceTimerRef.current = window.setTimeout(() => {
      engineWarmupGraceTimerRef.current = null;
      setEngineWarmupGraceActive(false);
    }, ENGINE_WARMUP_GRACE_MS);
  }

  function clearTransientEngineWarningState(logEvent: string) {
    clearEngineWarmupGraceTimer();
    engineWarmupGameIdRef.current = null;
    engineWarmupSessionIdRef.current = null;
    setEngineWarmupGraceActive(false);
    setEngineWarningGraceActive(false);
    setLiveInfoStatus(null);
    setLiveStatus(null);
    debugLog(logEvent);
  }

  function resetBoardEvaluationRetry(targetKey: string | null) {
    clearBoardEvaluationRetryTimer();
    boardEvaluationRetryTargetRef.current = targetKey;
    boardEvaluationRetryCountRef.current = 0;
    if (!engineWarmupGraceActive) {
      setEngineWarningGraceActive(false);
      setLiveInfoStatus(null);
    }
  }

  function clearTransientEngineStartupState() {
    clearBoardEvaluationRetryTimer();
    boardEvaluationRetryCountRef.current = 0;
    clearTransientEngineWarningState("live_update_success_clears_warning");
  }

  function scheduleBoardEvaluationRetry(targetKey: string | null) {
    if (!targetKey || targetKey !== boardEvaluationRetryTargetRef.current) {
      return;
    }

    const retryIndex = boardEvaluationRetryCountRef.current;
    if (retryIndex < BOARD_EVALUATION_RETRY_DELAYS_MS.length) {
      const delay = BOARD_EVALUATION_RETRY_DELAYS_MS[retryIndex];
      boardEvaluationRetryCountRef.current = retryIndex + 1;
      setEngineWarningGraceActive(true);
      setLiveInfoStatus("Initialisation du moteur...");
      debugLog("engine_warmup_warning_suppressed", { retryIndex, delay });
      clearBoardEvaluationRetryTimer();
      boardEvaluationRetryTimerRef.current = window.setTimeout(() => {
        boardEvaluationRetryTimerRef.current = null;
        setBoardEvaluationRetryNonce((value) => value + 1);
      }, delay);
      return;
    }

    setEngineWarningGraceActive(false);
    setLiveInfoStatus(null);
    if (!hasValidEvaluationRef.current) {
      debugLog("engine_warning_confirmed_after_retries");
      setLiveStatus("analyse live indisponible");
    }
  }

  function stopCurrentBoardEvaluationSession() {
    const sessionId = currentLiveSessionRef.current;
    if (sessionId) {
      void stopLiveAnalysis(sessionId).catch(() => undefined);
    }
    currentLiveSessionRef.current = null;
    currentLiveSessionFenRef.current = null;
    currentLiveSessionContextRef.current = null;
    setLiveAnalysisSessionId(null);
  }

  function applyState(state: GameState, resetPosition: boolean) {
    const nextLiveSessionId = state.live_analysis_session_id ?? null;
    hasValidLiveUpdateRef.current = false;
    liveStoppedNormallyRef.current = false;
    const nextEvaluation = state.evaluation_display ?? state.evaluation;
    const nextEvaluationSource = state.evaluation_source ?? null;
    const nextWarnings = state.warnings ?? [];
    const nextHasEvaluation = hasUsableEvaluation(nextEvaluation, nextEvaluationSource);
    if (nextWarnings.some(isAnalysisUnavailableWarning)) {
      debugLog("engine_warning_received", { source: "game_state" });
    }
    if (nextHasEvaluation) {
      debugLog("engine_warmup_cleared_by_shallow");
      clearTransientEngineWarningState("shallow_update_success_clears_warning");
    }
    const nextCompleted = isCompletedGameState(state);
    setLiveStatus(null);
    setGameId(state.game_id);
    setCurrentFen(state.fen);
    if (resetPosition) {
      setViewedFen(state.fen);
      setDisplayedPositionPly(state.moves.length);
      setPositionMode("LIVE");
      setSelectedReviewMomentId(null);
      setSelectedReviewMovePly(null);
      setSelectedReviewIndex(null);
    }
    setLegalMoves(state.legal_moves);
    setMoves(state.moves);
    setEvaluation(nextEvaluation);
    setEvaluationSource(nextEvaluationSource);
    setEvaluationFen(nextEvaluation ? state.fen : null);
    currentLiveSessionRef.current = nextLiveSessionId;
    currentLiveSessionFenRef.current = nextLiveSessionId ? state.fen : null;
    currentLiveSessionContextRef.current = nextLiveSessionId ? "live" : null;
    setLiveAnalysisSessionId(nextLiveSessionId);
    setWarnings(
      nextHasEvaluation
        ? removeAnalysisUnavailableWarnings(nextWarnings)
        : nextWarnings,
    );
    setResult(resultFromState(state));
    setIsGameOver(state.is_game_over);
    setIsGameCompleted(nextCompleted);
    if (!nextCompleted) {
      setReview(null);
      setReviewJob(null);
      setReviewError(null);
      clearReviewJobPolling("game_not_completed");
    }
  }

  function handleSelectMove(move: GameMoveHistoryItem) {
    clearReviewOverlays("select_move");
    resetSolutionReveal("select_move");
    const finalPly = moveHistory?.moves.length ?? 0;
    setViewedFen(move.fen_after);
    setDisplayedPositionPly(move.ply);
    setPositionMode(move.ply === finalPly ? "LIVE" : "HISTORICAL");
    setSelectedReviewMomentId(null);
    setSelectedReviewMovePly(null);
    setSelectedReviewIndex(null);
    setReviewPracticeState(null);
    setReviewBarPhase("before");
  }

  function handleShowReviewMoment(
    moment: ReviewMoment,
    index: number,
    moveMode: ReviewReplayMoveMode = "played",
  ) {
    clearReviewOverlays("show_review_moment");
    const animationRequestId = nextReviewAnimationRequestId("show_review_moment");
    const replayKey = momentKey(moment, index);
    const targetUci =
      moveMode === "best" ? moment.best_move_uci ?? null : moment.played_uci;
    const targetFen =
      moveMode === "best"
        ? fenAfterUci(moment.fen_before, targetUci) ?? moment.fen_before
        : moment.fen_after;
    setViewedFen(moment.fen_before);
    setDisplayedPositionPly(Math.max(0, moment.ply - 1));
    setPositionMode("REVIEW");
    setSelectedReviewMomentId(replayKey);
    setSelectedReviewMovePly(moment.ply);
    setSelectedReviewIndex(index);
    setSelectedReviewAnnotation(null);
    setSelectedReviewAnnotationIndex(null);
    resetSolutionReveal("show_review_moment");
    setGuidedReplayPhase(null);
    setReviewReplayMoveMode(moveMode);
    setReviewBarPhase("before");
    setReviewReplayState("showing_before");
    setReviewOverlayPositionKey(null);
    setReviewOverlayPhase(null);
    setActiveTab("review");
    debugLog("review_replay_showing_before", {
      ply: moment.ply,
      replayMoveMode: moveMode,
      playedUci: targetUci,
      hasFenBefore: Boolean(moment.fen_before),
      hasFenAfter: Boolean(targetFen),
      hasEvalBefore: reviewMomentEvaluation(moment, "before") !== null,
      hasEvalAfter: reviewMomentEvaluation(moment, "after") !== null,
    });

    const animateTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      setViewedFen(targetFen);
      setDisplayedPositionPly(moment.ply);
      setReviewOverlayForPosition(targetFen, moment.ply, `legacy_${moveMode}`);
      setReviewBarPhase(moveMode === "played" ? "after" : "before");
      setReviewReplayState("animating_move");
      debugLog("review_replay_animating_move", {
        ply: moment.ply,
        replayMoveMode: moveMode,
        playedUci: targetUci,
      });
    }, REVIEW_REPLAY_INITIAL_DELAY_MS);
    const afterTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      setReviewReplayState("showing_after");
      reviewReplayTimersRef.current = [];
      debugLog("review_replay_showing_after", {
        ply: moment.ply,
        replayMoveMode: moveMode,
        playedUci: targetUci,
      });
    }, REVIEW_REPLAY_INITIAL_DELAY_MS + REVIEW_REPLAY_AFTER_HOLD_MS);
    reviewReplayTimersRef.current = [animateTimer, afterTimer];
  }

  function handleShowReviewAnnotation(
    annotation: ReviewMoveAnnotation,
    index: number,
    mode: "before" | "played" | "best" = "before",
  ) {
    clearReviewOverlays("show_review_annotation");
    const animationRequestId = nextReviewAnimationRequestId(`show_review_annotation_${mode}`);
    setReviewTryMoveState(null);
    const targetUci = mode === "best" ? annotation.best_move_uci ?? null : annotation.uci;
    const targetFen =
      mode === "before"
        ? annotation.fen_before
        : mode === "best"
          ? fenAfterUci(annotation.fen_before, targetUci) ?? annotation.fen_before
          : annotation.fen_after;
    const startPly = Math.max(0, annotation.ply - 1);
    setViewedFen(annotation.fen_before);
    setDisplayedPositionPly(startPly);
    setPositionMode("REVIEW");
    setSelectedReviewMomentId(null);
    setSelectedReviewMovePly(annotation.ply);
    setSelectedReviewIndex(null);
    setSelectedReviewAnnotation(annotation);
    setSelectedReviewAnnotationIndex(index);
    setSolutionRevealForAnnotation(
      annotation,
      mode === "best"
        ? "solution_revealed"
        : mode === "played"
          ? "played_move_shown"
          : "hidden",
    );
    setGuidedReplayPhase(mode === "best" ? "best_move" : mode === "played" ? "played_move" : "decision");
    setReviewReplayMoveMode(mode === "best" ? "best" : "played");
    setReviewBarPhase("before");
    setReviewReplayState("showing_before");
    setReviewOverlayPositionKey(null);
    setReviewOverlayPhase(null);
    setActiveTab("review");
    debugLog("review_annotation_showing_before", {
      ply: annotation.ply,
      index,
      mode,
      primaryCategory: annotation.primary_category,
      tags: annotation.tags,
    });
    if (mode === "before") {
      reviewReplayTimersRef.current = [];
      return;
    }
    const animateTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      setViewedFen(targetFen);
      setDisplayedPositionPly(mode === "best" && targetFen === annotation.fen_before ? startPly : annotation.ply);
      setGuidedReplayPhase(mode === "best" ? "best_move" : "played_move");
      setReviewReplayMoveMode(mode === "best" ? "best" : "played");
      setReviewBarPhase(mode === "played" ? "after" : "before");
      setReviewReplayState("animating_move");
      setReviewOverlayForPosition(
        targetFen,
        mode === "best" && targetFen === annotation.fen_before ? startPly : annotation.ply,
        mode === "best" ? "best_move" : "played_move",
      );
    }, REVIEW_REPLAY_INITIAL_DELAY_MS);
    const afterTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      setReviewReplayState("showing_after");
      reviewReplayTimersRef.current = [];
    }, REVIEW_REPLAY_INITIAL_DELAY_MS + REVIEW_REPLAY_AFTER_HOLD_MS);
    reviewReplayTimersRef.current = [animateTimer, afterTimer];
  }

  function handleSolutionHintAnnotation(
    annotation: ReviewMoveAnnotation,
    index: number,
  ) {
    void index;
    setSolutionRevealForAnnotation(annotation, "hint_shown");
    setSelectedReviewMovePly(annotation.ply);
  }

  function handleGuidedReplayAnnotation(
    annotation: ReviewMoveAnnotation,
    index: number,
  ) {
    clearReviewOverlays("guided_replay_annotation");
    const animationRequestId = nextReviewAnimationRequestId("guided_replay_annotation");
    setReviewTryMoveState(null);
    const bestFen = annotation.best_move_uci
      ? fenAfterUci(annotation.fen_before, annotation.best_move_uci)
      : null;
    setViewedFen(annotation.fen_before);
    setDisplayedPositionPly(Math.max(0, annotation.ply - 1));
    setPositionMode("REVIEW");
    setSelectedReviewMomentId(null);
    setSelectedReviewMovePly(annotation.ply);
    setSelectedReviewIndex(null);
    setSelectedReviewAnnotation(annotation);
    setSelectedReviewAnnotationIndex(index);
    setSolutionRevealForAnnotation(annotation, "solution_revealed");
    setGuidedReplayPhase("decision");
    setReviewReplayMoveMode("played");
    setReviewBarPhase("before");
    setReviewReplayState("showing_before");
    setReviewOverlayPositionKey(null);
    setReviewOverlayPhase(null);
    setActiveTab("review");

    const playedTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      setViewedFen(annotation.fen_after);
      setDisplayedPositionPly(annotation.ply);
      setReviewOverlayForPosition(annotation.fen_after, annotation.ply, "played_move");
      setGuidedReplayPhase("played_move");
      setReviewBarPhase("after");
      setReviewReplayState("animating_move");
    }, REPLAY_INITIAL_PAUSE_MS);
    const impactTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      setGuidedReplayPhase("impact");
      setReviewReplayState("showing_after");
    }, REPLAY_INITIAL_PAUSE_MS + REPLAY_MOVE_ANIMATION_MS + REPLAY_IMPACT_PAUSE_MS);
    const bestTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      setViewedFen(annotation.fen_before);
      setDisplayedPositionPly(Math.max(0, annotation.ply - 1));
      setReviewOverlayPositionKey(null);
      setReviewOverlayPhase(null);
      setGuidedReplayPhase("best_move");
      setReviewReplayMoveMode("best");
      setReviewBarPhase("before");
      setReviewReplayState("showing_before");
    }, REPLAY_INITIAL_PAUSE_MS + REPLAY_MOVE_ANIMATION_MS + REPLAY_IMPACT_PAUSE_MS + 200);
    const bestAfterTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      if (bestFen) {
        setViewedFen(bestFen);
        setReviewOverlayForPosition(bestFen, annotation.ply, "best_move");
      } else {
        setReviewOverlayForPosition(
          annotation.fen_before,
          Math.max(0, annotation.ply - 1),
          "best_move",
        );
      }
      setGuidedReplayPhase("summary");
      setReviewReplayState("showing_after");
      reviewReplayTimersRef.current = [];
    }, REPLAY_INITIAL_PAUSE_MS + REPLAY_MOVE_ANIMATION_MS + REPLAY_IMPACT_PAUSE_MS + REPLAY_BEST_MOVE_PAUSE_MS);

    reviewReplayTimersRef.current = [
      playedTimer,
      impactTimer,
      bestTimer,
      bestAfterTimer,
    ];
  }

  function handleTryMoveAnnotation(annotation: ReviewMoveAnnotation, index: number) {
    clearReviewOverlays("try_move_start");
    nextReviewAnimationRequestId("try_move_start");
    setViewedFen(annotation.fen_before);
    setDisplayedPositionPly(Math.max(0, annotation.ply - 1));
    setPositionMode("REVIEW");
    setSelectedReviewMomentId(null);
    setSelectedReviewMovePly(annotation.ply);
    setSelectedReviewIndex(null);
    setSelectedReviewAnnotation(annotation);
    setSelectedReviewAnnotationIndex(index);
    setSolutionRevealForAnnotation(annotation, "hidden");
    setGuidedReplayPhase(null);
    setGuidedPvIndex(null);
    setReviewReplayMoveMode("played");
    setReviewBarPhase("before");
    setReviewReplayState("idle");
    setReviewOverlayPositionKey(null);
    setReviewOverlayPhase(null);
    setActiveTab("review");
    setReviewTryMoveState({
      active: true,
      annotationPly: annotation.ply,
      annotation,
      annotationIndex: index,
      fenBefore: annotation.fen_before,
      attemptedUci: null,
      attemptedSan: null,
      feedback: null,
      solutionRevealed: false,
    });
  }

  function handleTryMoveAttempt(uci: string) {
    if (!reviewTryMoveState?.active || !reviewTryMoveState.annotation) {
      return;
    }
    const annotation = reviewTryMoveState.annotation;
    clearReviewOverlays("try_move_attempt", false);
    setReviewPvLineState(null);
    setGuidedPvIndex(null);
    const attempt = tryMoveFenAfter(annotation.fen_before, uci);
    const feedback: NonNullable<TryMoveFeedback> = {
      result: "attempted",
      message: "Tentative jouée. Ouvre la correction pour comparer avec la réponse de Review.",
      show_best_move: false,
    };
    setSolutionRevealForAnnotation(annotation, "attempted");
    setReviewTryMoveState({
      ...reviewTryMoveState,
      attemptedUci: uci,
      attemptedSan: attempt.san,
      feedback,
      solutionRevealed: false,
    });
    if (attempt.fenAfter) {
      setViewedFen(attempt.fenAfter);
      setDisplayedPositionPly(annotation.ply);
      setReviewOverlayForPosition(attempt.fenAfter, annotation.ply, "try_attempt");
    } else {
      setViewedFen(annotation.fen_before);
      setDisplayedPositionPly(Math.max(0, annotation.ply - 1));
      setReviewOverlayForPosition(
        annotation.fen_before,
        Math.max(0, annotation.ply - 1),
        "try_attempt",
      );
    }
  }

  function resetTryMoveAttempt() {
    if (!reviewTryMoveState?.annotation) {
      return;
    }
    setViewedFen(reviewTryMoveState.fenBefore);
    setDisplayedPositionPly(Math.max(0, reviewTryMoveState.annotation.ply - 1));
    setReviewOverlayPositionKey(null);
    setReviewOverlayPhase(null);
    setSolutionRevealForAnnotation(reviewTryMoveState.annotation, "hidden");
    setReviewTryMoveState({
      ...reviewTryMoveState,
      attemptedUci: null,
      attemptedSan: null,
      feedback: null,
      solutionRevealed: false,
    });
  }

  function revealTryMoveSolution() {
    if (!reviewTryMoveState?.annotation?.best_move_uci) {
      return;
    }
    const annotation = reviewTryMoveState.annotation;
    clearReviewOverlays("try_move_reveal_solution", false);
    const animationRequestId = nextReviewAnimationRequestId("try_move_reveal_solution");
    const bestMoveUci = annotation.best_move_uci ?? null;
    const solutionFen = fenAfterUci(annotation.fen_before, bestMoveUci) ?? annotation.fen_before;
    setReviewPvLineState(null);
    setGuidedPvIndex(null);
    setViewedFen(annotation.fen_before);
    setDisplayedPositionPly(Math.max(0, annotation.ply - 1));
    setReviewOverlayPositionKey(null);
    setReviewOverlayPhase(null);
    setSolutionRevealForAnnotation(annotation, "solution_revealed");
    setReviewReplayMoveMode("best");
    setGuidedReplayPhase("decision");
    setReviewReplayState("showing_before");
    setReviewTryMoveState({
      ...reviewTryMoveState,
      solutionRevealed: true,
    });
    const solutionTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      setViewedFen(solutionFen);
      setDisplayedPositionPly(solutionFen === annotation.fen_before ? Math.max(0, annotation.ply - 1) : annotation.ply);
      setGuidedReplayPhase("best_move");
      setReviewReplayState("animating_move");
      setReviewOverlayForPosition(
        solutionFen,
        solutionFen === annotation.fen_before ? Math.max(0, annotation.ply - 1) : annotation.ply,
        "try_solution",
      );
      reviewReplayTimersRef.current = [];
    }, REVIEW_REPLAY_INITIAL_DELAY_MS);
    reviewReplayTimersRef.current = [solutionTimer];
  }

  function handleShowPvLineAnnotation(
    annotation: ReviewMoveAnnotation,
    index: number,
    lineMode: ReviewPvLineMode = "solution",
  ) {
    startManualPvLine(annotation, index, "show_pv_line_annotation", lineMode);
  }

  function startManualPvLine(
    annotation: ReviewMoveAnnotation,
    index: number | null,
    reason: string,
    lineMode: ReviewPvLineMode = "solution",
  ) {
    clearReviewOverlays(reason);
    nextReviewAnimationRequestId(reason);
    setViewedFen(annotation.fen_before);
    setDisplayedPositionPly(Math.max(0, annotation.ply - 1));
    setPositionMode("REVIEW");
    setSelectedReviewMomentId(null);
    setSelectedReviewMovePly(annotation.ply);
    setSelectedReviewIndex(null);
    setSelectedReviewAnnotation(annotation);
    setSelectedReviewAnnotationIndex(index);
    setSolutionRevealForAnnotation(annotation, "pv_line");
    setGuidedReplayPhase("pv_line");
    setGuidedPvIndex(null);
    setReviewReplayMoveMode(lineMode === "played" ? "played" : "best");
    setReviewBarPhase("before");
    setReviewReplayState("showing_before");
    setReviewOverlayPositionKey(null);
    setReviewOverlayPhase(null);
    setActiveTab("review");
    const pvLine = reviewPvLineMovesForMode(annotation, lineMode);
    const playedLineAvailable = reviewPvLineMovesForMode(annotation, "played").length > 0;
    const solutionLineAvailable = reviewPvLineMovesForMode(annotation, "solution").length > 0;
    setReviewPvLineState({
      active: true,
      annotationPly: annotation.ply,
      annotationIndex: index,
      moves: pvLine,
      currentIndex: -1,
      currentFen: annotation.fen_before,
      autoplay: false,
      lineMode,
      playedLineAvailable,
      solutionLineAvailable,
      message: pvLine.length ? null : reviewPvLineMessageForMode(annotation, lineMode),
    });
    setReviewPracticeState((current) =>
      current?.active ? { ...current, itemState: "pv_line" } : current,
    );
  }

  function selectManualPvLineMode(lineMode: ReviewPvLineMode) {
    const practiceItem = currentPracticeItem(reviewPracticeState);
    const annotation =
      reviewPracticeState?.active && practiceItem
        ? practiceItemToAnnotation(practiceItem)
        : selectedReviewAnnotation;
    if (!annotation) {
      return;
    }
    const index =
      reviewPracticeState?.active && practiceItem
        ? reviewPracticeState.currentIndex
        : selectedReviewAnnotationIndex;
    startManualPvLine(annotation, index, "manual_pv_line_mode_change", lineMode);
  }

  function showManualPvLineStep(nextIndex: number) {
    const state = reviewPvLineState;
    const annotation = selectedReviewAnnotation;
    if (!state?.active || !annotation) {
      return;
    }
    const startPly = Math.max(0, annotation.ply - 1);
    if (nextIndex < 0) {
      setViewedFen(annotation.fen_before);
      setDisplayedPositionPly(startPly);
      setGuidedPvIndex(null);
      setReviewReplayState("showing_before");
      setReviewOverlayPositionKey(null);
      setReviewOverlayPhase(null);
      setReviewPvLineState({
        ...state,
        currentIndex: -1,
        currentFen: annotation.fen_before,
        message: null,
      });
      return;
    }
    if (nextIndex >= state.moves.length) {
      setReviewPvLineState({ ...state, autoplay: false });
      return;
    }
    const move = state.moves[nextIndex];
    const previousFen =
      nextIndex === 0
        ? annotation.fen_before
        : state.moves[nextIndex - 1]?.fen_after ?? annotation.fen_before;
    const applied = tryMoveFenAfter(previousFen, move.uci);
    if (!applied.legal) {
      setReviewPvLineState({
        ...state,
        autoplay: false,
        message: "La ligne complète n'est pas disponible jusqu'au bout.",
      });
      return;
    }
    const nextFen = move.fen_after || applied.fenAfter || previousFen;
    const nextPly = annotation.ply + nextIndex;
    setViewedFen(nextFen);
    setDisplayedPositionPly(nextPly);
    setGuidedReplayPhase("pv_line");
    setGuidedPvIndex(nextIndex);
    setReviewReplayMoveMode(state.lineMode === "played" ? "played" : "best");
    setReviewReplayState("animating_move");
    setReviewOverlayForPosition(nextFen, nextPly, `pv_line_${state.lineMode}`);
    setReviewPvLineState({
      ...state,
      currentIndex: nextIndex,
      currentFen: nextFen,
      message: null,
    });
  }

  function showPreviousPvLineStep() {
    showManualPvLineStep((reviewPvLineState?.currentIndex ?? 0) - 1);
  }

  function showNextPvLineStep() {
    showManualPvLineStep((reviewPvLineState?.currentIndex ?? -1) + 1);
  }

  function restartManualPvLine() {
    showManualPvLineStep(-1);
  }

  function toggleManualPvLineAutoplay() {
    setReviewPvLineState((current) =>
      current ? { ...current, autoplay: !current.autoplay } : current,
    );
  }

  function closeManualPvLine() {
    clearReviewOverlays("manual_pv_line_close", false);
    setGuidedReplayPhase(null);
    setGuidedPvIndex(null);
    setReviewPvLineState(null);
    setReviewPracticeState((current) =>
      current?.active && current.itemState === "pv_line"
        ? {
            ...current,
            itemState: current.solutionRevealed ? "solution_revealed" : "attempted",
          }
        : current,
    );
  }

  async function loadReviewPracticeHistory(targetGameId: number = gameId ?? 0) {
    if (!targetGameId) {
      return;
    }
    setReviewPracticeHistoryLoading(true);
    setReviewPracticeHistoryError(null);
    try {
      const payload = await getReviewPracticeSessions(targetGameId);
      setReviewPracticeHistory(payload.sessions ?? []);
    } catch (err) {
      setReviewPracticeHistoryError(messageFromError(err));
    } finally {
      setReviewPracticeHistoryLoading(false);
    }
  }

  function practiceStateFromSession(
    session: {
      session_id: number | string;
      status: string;
      items: ReviewPracticeItem[];
      summary: ReviewPracticeSummary;
    },
    activeStatus: "running" | "completed",
  ): ReviewPracticeState {
    const resultByPly = session.summary?.result_by_ply ?? {};
    const firstOpenIndex = session.items.findIndex(
      (item) => !resultByPly[String(item.ply)],
    );
    const currentIndex =
      activeStatus === "running" && firstOpenIndex >= 0 ? firstOpenIndex : 0;
    return {
      active: true,
      sessionId: session.session_id,
      status: activeStatus,
      itemState: activeStatus === "completed" ? "completed" : "awaiting_attempt",
      items: session.items,
      currentIndex,
      attemptedUci: null,
      attemptedSan: null,
      feedback: null,
      solutionRevealed: false,
      hintVisible: false,
      summary: session.summary,
      error: null,
      saving: false,
    };
  }

  async function startPracticeFromSession(
    session: {
      session_id: number | string;
      status: string;
      items: ReviewPracticeItem[];
      summary: ReviewPracticeSummary;
    },
    activeStatus: "running" | "completed" = "running",
  ) {
    const nextState = practiceStateFromSession(session, activeStatus);
    clearReviewOverlays("practice_session_loaded");
    setReviewTryMoveState(null);
    setReviewPracticeState(nextState);
    if (activeStatus === "running" && nextState.items[nextState.currentIndex]) {
      showPracticeItem(nextState.items[nextState.currentIndex], nextState.currentIndex);
    }
    setActiveTab("review");
  }

  async function handleStartReviewPractice() {
    if (!gameId || reviewPracticeState?.status === "starting") {
      return;
    }
    clearReviewOverlays("practice_start");
    setReviewTryMoveState(null);
    setReviewPracticeState({
      active: true,
      sessionId: null,
      status: "starting",
      itemState: "awaiting_attempt",
      items: [],
      currentIndex: 0,
      attemptedUci: null,
      attemptedSan: null,
      feedback: null,
      solutionRevealed: false,
      hintVisible: false,
      summary: null,
      error: null,
      saving: false,
    });
    try {
      const session = await startReviewPracticeSession(gameId, {
        pov: selectedReviewPov,
        scope: "top_priority",
        maxItems: 5,
      });
      const nextState: ReviewPracticeState = {
        active: true,
        sessionId: session.session_id,
        status: "running",
        itemState: "awaiting_attempt",
        items: session.items,
        currentIndex: 0,
        attemptedUci: null,
        attemptedSan: null,
        feedback: null,
        solutionRevealed: false,
        hintVisible: false,
        summary: session.summary,
        error: null,
        saving: false,
      };
      setReviewPracticeState(nextState);
      if (session.items[0]) {
        showPracticeItem(session.items[0], 0);
      }
      void loadReviewPracticeHistory(gameId);
    } catch (err) {
      const message = messageFromError(err);
      setReviewPracticeState(null);
      setReviewError(message);
    }
  }

  async function handlePracticeAttempt(uci: string) {
    const state = reviewPracticeState;
    const item = currentPracticeItem(state);
    if (!state?.active || state.status !== "running" || !item || state.saving) {
      return;
    }
    const annotation = practiceItemToAnnotation(item);
    clearReviewOverlays("practice_attempt", false);
    const attempt = tryMoveFenAfter(annotation.fen_before, uci);
    setSolutionRevealForAnnotation(annotation, "attempted");
    setReviewPvLineState(null);
    setGuidedPvIndex(null);
    setGuidedReplayPhase(null);
    setReviewPracticeState((current) =>
      current
        ? {
            ...current,
            saving: true,
            attemptedUci: uci,
            attemptedSan: attempt.san,
            feedback: null,
            solutionRevealed: false,
            itemState: "attempted",
            error: null,
          }
        : current,
    );
    if (attempt.fenAfter) {
      setViewedFen(attempt.fenAfter);
      setDisplayedPositionPly(annotation.ply);
      setReviewOverlayForPosition(attempt.fenAfter, annotation.ply, "practice_attempt");
    } else {
      setViewedFen(annotation.fen_before);
      setDisplayedPositionPly(Math.max(0, annotation.ply - 1));
      setReviewOverlayForPosition(
        annotation.fen_before,
        Math.max(0, annotation.ply - 1),
        "practice_attempt",
      );
    }
    try {
      const summary = await recordReviewPracticeAttempt(state.sessionId ?? "", {
        ply: item.ply,
        attemptedUci: uci,
      });
      const feedback = summary.attempt_feedback ?? null;
      setReviewPracticeState((current) =>
        current
          ? {
              ...current,
              summary,
              saving: false,
              attemptedSan: feedback?.attempted_san ?? attempt.san,
              feedback,
            }
          : current,
      );
    } catch (err) {
      setReviewPracticeState((current) =>
        current
          ? {
              ...current,
              saving: false,
              error: messageFromError(err),
            }
          : current,
      );
    }
  }

  function showPracticeHint() {
    setReviewPracticeState((current) =>
      current ? { ...current, hintVisible: true, itemState: "hint_shown" } : current,
    );
  }

  async function revealPracticeSolution() {
    const state = reviewPracticeState;
    const item = currentPracticeItem(state);
    if (!state?.active || !item) {
      return;
    }
    const annotation = practiceItemToAnnotation(item);
    clearReviewOverlays("practice_reveal_solution", false);
    const animationRequestId = nextReviewAnimationRequestId("practice_reveal_solution");
    const solutionFen =
      fenAfterUci(annotation.fen_before, annotation.best_move_uci ?? null) ??
      annotation.fen_before;
    setReviewPvLineState(null);
    setViewedFen(annotation.fen_before);
    setDisplayedPositionPly(Math.max(0, annotation.ply - 1));
    setReviewOverlayPositionKey(null);
    setReviewOverlayPhase(null);
    setSolutionRevealForAnnotation(annotation, "solution_revealed");
    setSelectedReviewAnnotation(annotation);
    setSelectedReviewAnnotationIndex(state.currentIndex);
    setReviewReplayMoveMode("best");
    setGuidedReplayPhase("decision");
    setReviewReplayState("showing_before");
    const solutionTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      setViewedFen(solutionFen);
      setDisplayedPositionPly(solutionFen === annotation.fen_before ? Math.max(0, annotation.ply - 1) : annotation.ply);
      setGuidedReplayPhase("best_move");
      setReviewReplayState("animating_move");
      setReviewOverlayForPosition(
        solutionFen,
        solutionFen === annotation.fen_before ? Math.max(0, annotation.ply - 1) : annotation.ply,
        "practice_solution",
      );
      reviewReplayTimersRef.current = [];
    }, REVIEW_REPLAY_INITIAL_DELAY_MS);
    reviewReplayTimersRef.current = [solutionTimer];
    if (state.solutionRevealed || state.saving) {
      setReviewPracticeState((current) =>
        current
          ? { ...current, solutionRevealed: true, itemState: "solution_revealed" }
          : current,
      );
      return;
    }
    setReviewPracticeState((current) =>
      current
        ? {
            ...current,
            saving: true,
            solutionRevealed: true,
            itemState: "solution_revealed",
          }
        : current,
    );
    try {
      const summary = await recordReviewPracticeAttempt(state.sessionId ?? "", {
        ply: item.ply,
        attemptedUci: null,
        result: "revealed",
      });
      setReviewPracticeState((current) =>
        current ? { ...current, summary, saving: false } : current,
      );
    } catch (err) {
      setReviewPracticeState((current) =>
        current
          ? { ...current, saving: false, error: messageFromError(err) }
          : current,
      );
    }
  }

  async function skipPracticeItem() {
    const state = reviewPracticeState;
    const item = currentPracticeItem(state);
    if (!state?.active || !item || state.saving) {
      return;
    }
    clearReviewOverlays("practice_skip_item");
    setReviewPracticeState((current) =>
      current ? { ...current, saving: true, error: null } : current,
    );
    try {
      const summary = await recordReviewPracticeAttempt(state.sessionId ?? "", {
        ply: item.ply,
        attemptedUci: null,
        result: "skipped",
      });
      setReviewPracticeState((current) =>
        current ? { ...current, summary, saving: false } : current,
      );
      await goToNextPracticeItem();
    } catch (err) {
      setReviewPracticeState((current) =>
        current
          ? { ...current, saving: false, error: messageFromError(err) }
          : current,
      );
    }
  }

  function resetPracticeAttempt() {
    const state = reviewPracticeState;
    const item = currentPracticeItem(state);
    if (!state?.active || !item) {
      return;
    }
    showPracticeItem(item, state.currentIndex);
  }

  async function goToNextPracticeItem() {
    const state = reviewPracticeState;
    if (!state?.active) {
      return;
    }
    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.items.length) {
      await completePracticeSession();
      return;
    }
    showPracticeItem(state.items[nextIndex], nextIndex);
  }

  async function completePracticeSession() {
    const state = reviewPracticeState;
    if (!state?.active || !state.sessionId) {
      return;
    }
    clearReviewOverlays("practice_complete");
    setReviewPracticeState((current) =>
      current ? { ...current, saving: true, error: null } : current,
    );
    try {
      const summary = await completeReviewPracticeSession(state.sessionId);
      setReviewPracticeState((current) =>
        current
          ? {
              ...current,
              status: "completed",
              itemState: "completed",
              summary,
              saving: false,
            }
          : current,
      );
      if (gameId) {
        void loadReviewPracticeHistory(gameId);
      }
    } catch (err) {
      setReviewPracticeState((current) =>
        current
          ? { ...current, saving: false, error: messageFromError(err) }
          : current,
      );
    }
  }

  async function retryFailedPracticeSession(sessionId?: number | string | null) {
    const targetSessionId = sessionId ?? reviewPracticeState?.sessionId;
    if (!targetSessionId) {
      return;
    }
    try {
      const retry = await retryFailedReviewPracticeSession(targetSessionId);
      await startPracticeFromSession(retry, "running");
      if (gameId) {
        void loadReviewPracticeHistory(gameId);
      }
    } catch (err) {
      setReviewError(messageFromError(err));
    }
  }

  async function redoPracticeSession() {
    if (!gameId) {
      return;
    }
    await handleStartReviewPractice();
  }

  async function resumePracticeSession(sessionId: number | string) {
    try {
      const detail = await getReviewPracticeSession(sessionId);
      await startPracticeFromSession(detail, "running");
    } catch (err) {
      setReviewError(messageFromError(err));
    }
  }

  async function viewPracticeSessionSummary(sessionId: number | string) {
    try {
      const detail = await getReviewPracticeSession(sessionId);
      await startPracticeFromSession(detail, "completed");
    } catch (err) {
      setReviewError(messageFromError(err));
    }
  }

  async function quitPracticeSession() {
    clearReviewOverlays("practice_quit");
    const state = reviewPracticeState;
    if (state?.active && state.status === "running" && state.sessionId) {
      try {
        await abandonReviewPracticeSession(state.sessionId);
        if (gameId) {
          void loadReviewPracticeHistory(gameId);
        }
      } catch (err) {
        setReviewError(messageFromError(err));
      }
    }
    setReviewPracticeState(null);
  }

  function showPracticePvLine(lineMode: ReviewPvLineMode = "solution") {
    const state = reviewPracticeState;
    const item = currentPracticeItem(state);
    if (!state?.active || !item) {
      return;
    }
    const annotation = practiceItemToAnnotation(item);
    startManualPvLine(annotation, state.currentIndex, "practice_pv_line", lineMode);
  }

  function showPracticeItem(item: ReviewPracticeItem, index: number) {
    clearReviewOverlays("practice_show_item");
    const annotation = practiceItemToAnnotation(item);
    setReviewTryMoveState(null);
    setViewedFen(annotation.fen_before);
    setDisplayedPositionPly(Math.max(0, annotation.ply - 1));
    setPositionMode("REVIEW");
    setSelectedReviewMomentId(null);
    setSelectedReviewMovePly(annotation.ply);
    setSelectedReviewIndex(null);
    setSelectedReviewAnnotation(annotation);
    setSelectedReviewAnnotationIndex(index);
    setSolutionRevealForAnnotation(annotation, "hidden");
    setGuidedReplayPhase(null);
    setGuidedPvIndex(null);
    setReviewReplayMoveMode("played");
    setReviewBarPhase("before");
    setReviewReplayState("idle");
    setActiveTab("review");
    setReviewPracticeState((current) =>
      current
        ? {
            ...current,
            currentIndex: index,
            attemptedUci: null,
            attemptedSan: null,
            feedback: null,
            solutionRevealed: false,
            hintVisible: false,
            itemState: "awaiting_attempt",
            error: null,
            saving: false,
          }
        : current,
    );
  }

  function replaySelectedGuidedMoment() {
    if (!selectedReviewAnnotation || selectedReviewAnnotationIndex === null) {
      return;
    }
    handleGuidedReplayAnnotation(
      selectedReviewAnnotation,
      selectedReviewAnnotationIndex,
    );
  }

  function showGuidedAnnotationByOffset(offset: number) {
    const priorities = review?.review_sections?.to_review ?? [];
    if (priorities.length === 0) {
      return;
    }
    const currentIndex = priorities.findIndex(
      (annotation) => annotation.ply === selectedReviewAnnotation?.ply,
    );
    const nextIndex =
      currentIndex >= 0
        ? (currentIndex + offset + priorities.length) % priorities.length
        : 0;
    handleGuidedReplayAnnotation(priorities[nextIndex], nextIndex);
  }

  function showNextGuidedAnnotation() {
    showGuidedAnnotationByOffset(1);
  }

  function showPreviousGuidedAnnotation() {
    showGuidedAnnotationByOffset(-1);
  }

  function closeGuidedReplay() {
    clearReviewOverlays("close_guided_replay");
  }

  function handleReviewPovChange(nextPov: ReviewPov) {
    const normalized = normalizeReviewPovForReview(nextPov, review);
    clearReviewOverlays("review_pov_changed");
    resetSolutionReveal("review_pov_changed");
    setReviewPracticeState(null);
    setSelectedReviewPov(normalized);
    writeReviewPovPreference(gameId, normalized);
  }

  function handleOpeningIntentionNoteChange(note: string) {
    setOpeningIntentionNote(note);
    writeOpeningIntentionNote(gameId, note);
  }

  function handleReviewFocusChange(focus: string) {
    const nextFocus = normalizeReviewFocusKey(focus);
    setReviewFocusKey(nextFocus);
    clearReviewOverlays(`review_focus_${nextFocus}`);
    resetSolutionReveal(`review_focus_${nextFocus}`);
  }

  function handleShowOpeningExit(evidence: OpeningRealityEvidence) {
    const fenBeforeExit = evidence.fen_before_exit ?? evidence.out_of_book_fen ?? null;
    const exitMoveUci = evidence.exit_move_uci ?? evidence.out_of_book_move_uci ?? null;
    const exitPly = evidence.exit_ply ?? evidence.out_of_book_ply ?? 0;
    if (!fenBeforeExit) {
      return;
    }
    const fenAfterExit =
      evidence.fen_after_exit ?? fenAfterUci(fenBeforeExit, exitMoveUci) ?? fenBeforeExit;
    const lastBookFen = evidence.last_book_fen ?? fenBeforeExit;
    clearReviewOverlays("show_opening_exit");
    const animationRequestId = nextReviewAnimationRequestId("show_opening_exit");
    resetSolutionReveal("show_opening_exit");
    setViewedFen(lastBookFen);
    setDisplayedPositionPly(Math.max(0, evidence.last_book_ply ?? exitPly - 1));
    setPositionMode("REVIEW");
    setSelectedReviewMomentId(null);
    setSelectedReviewMovePly(null);
    setSelectedReviewIndex(null);
    setSelectedReviewAnnotation(null);
    setSelectedReviewAnnotationIndex(null);
    setReviewTryMoveState(null);
    setReviewBarPhase("before");
    setReviewReplayState("showing_before");
    setOpeningGuideState({
      active: true,
      phase: "last_book",
      gameId,
      currentFen: lastBookFen,
      stepIndex: 0,
      message: "Dernier moment encore dans le livre.",
      currentMoveUci: null,
      linkedPly: evidence.critical_moment_after_exit?.ply ?? null,
    });
    setReviewOpeningFocusMessage("Dernier moment encore dans le livre.");
    setActiveTab("review");
    const exitTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      setViewedFen(fenAfterExit);
      setDisplayedPositionPly(exitPly);
      setReviewBarPhase("before");
      setReviewReplayState("animating_move");
      setReviewOverlayForPosition(fenAfterExit, exitPly, "opening_exit_move");
      setOpeningGuideState({
        active: true,
        phase: "exit_move",
        gameId,
        currentFen: fenAfterExit,
        stepIndex: 1,
        message: `Coup de sortie : ${openingMoveText(evidence)}. La partie quitte la ligne connue.`,
        currentMoveUci: exitMoveUci,
        linkedPly: evidence.critical_moment_after_exit?.ply ?? null,
      });
      setReviewOpeningFocusMessage("Coup de sortie du livre.");
    }, 1000);
    const afterExitTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      setViewedFen(fenAfterExit);
      setDisplayedPositionPly(exitPly);
      setReviewOverlayPositionKey(null);
      setReviewOverlayPhase(null);
      setReviewReplayState("showing_after");
      setOpeningGuideState({
        active: true,
        phase: "after_exit",
        gameId,
        currentFen: fenAfterExit,
        stepIndex: 2,
        message: "Position après sortie : il faut jouer par compréhension, pas par mémoire.",
        currentMoveUci: null,
        linkedPly: evidence.critical_moment_after_exit?.ply ?? null,
      });
      setReviewOpeningFocusMessage("Position après sortie du livre.");
    }, 2200);
    const summaryTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      const hasLinkedMoment = typeof evidence.critical_moment_after_exit?.ply === "number";
      setOpeningGuideState({
        active: true,
        phase: "summary",
        gameId,
        currentFen: fenAfterExit,
        stepIndex: 3,
        message: hasLinkedMoment
          ? "Le premier vrai problème arrive quelques coups plus tard."
          : "Pas de gros problème détecté immédiatement après la sortie.",
        currentMoveUci: null,
        linkedPly: evidence.critical_moment_after_exit?.ply ?? null,
      });
      setReviewOpeningFocusMessage(
        hasLinkedMoment
          ? "Premier problème après la sortie disponible."
          : "Pas de gros problème juste après la sortie.",
      );
      reviewReplayTimersRef.current = [];
    }, 3400);
    reviewReplayTimersRef.current = [exitTimer, afterExitTimer, summaryTimer];
  }

  function handleShowOpeningLinkedMoment(
    ply: number,
    evidence?: OpeningRealityEvidence,
  ) {
    const annotations = review?.move_annotations ?? [];
    const annotation = annotations.find((item) => item.ply === ply);
    if (!annotation) {
      setReviewOpeningFocusMessage("Moment lié indisponible dans cette Review.");
      return;
    }
    const index = annotations.findIndex((item) => item.ply === annotation.ply);
    const normalizedPov = normalizeReviewPovForReview(selectedReviewPov, review);
    const targetColor =
      normalizedPov === "user" ? normalizedReviewUserColor(review) : normalizedPov;
    if (
      targetColor !== "both" &&
      annotation.color &&
      targetColor !== annotation.color
    ) {
      setSelectedReviewPov("both");
      writeReviewPovPreference(gameId, "both");
    }
    const exitPly = evidence?.exit_ply ?? evidence?.out_of_book_ply ?? null;
    const startFen =
      evidence?.fen_after_exit ??
      (evidence?.fen_before_exit && evidence?.exit_move_uci
        ? fenAfterUci(evidence.fen_before_exit, evidence.exit_move_uci)
        : null) ??
      evidence?.out_of_book_fen ??
      annotation.fen_before;
    const sequence =
      moveHistory?.moves.filter(
        (move) =>
          typeof exitPly === "number" &&
          move.ply > exitPly &&
          move.ply < annotation.ply,
      ) ?? [];
    clearReviewOverlays("show_opening_linked_moment");
    const animationRequestId = nextReviewAnimationRequestId("show_opening_linked_moment");
    resetSolutionReveal("show_opening_linked_moment");
    setViewedFen(startFen);
    setDisplayedPositionPly(Math.max(0, exitPly ?? annotation.ply - 1));
    setPositionMode("REVIEW");
    setReviewReplayState("showing_before");
    setReviewBarPhase("before");
    setOpeningGuideState({
      active: true,
      phase: "post_exit_sequence",
      gameId,
      currentFen: startFen,
      stepIndex: 0,
      message: "Depuis la sortie du livre, voici comment on arrive au premier moment important.",
      currentMoveUci: null,
      linkedPly: annotation.ply,
    });
    setReviewOpeningFocusMessage("Séquence après la sortie du livre.");
    if (!sequence.length) {
      const directTimer = window.setTimeout(() => {
        if (animationRequestId !== reviewAnimationRequestIdRef.current) {
          return;
        }
        handleShowReviewAnnotation(annotation, Math.max(0, index), "before");
        setOpeningGuideState({
          active: true,
          phase: "linked_moment",
          gameId,
          currentFen: annotation.fen_before,
          stepIndex: 1,
          message: "Séquence intermédiaire indisponible, position critique affichée.",
          currentMoveUci: null,
          linkedPly: annotation.ply,
        });
        setReviewOpeningFocusMessage("Premier vrai moment critique après la sortie.");
        reviewReplayTimersRef.current = [];
      }, 900);
      reviewReplayTimersRef.current = [directTimer];
      return;
    }
    const timers = sequence.map((move, sequenceIndex) =>
      window.setTimeout(() => {
        if (animationRequestId !== reviewAnimationRequestIdRef.current) {
          return;
        }
        setViewedFen(move.fen_after);
        setDisplayedPositionPly(move.ply);
        setReviewReplayState("animating_move");
        setReviewOverlayForPosition(move.fen_after, move.ply, `opening_sequence_${sequenceIndex}`);
        setOpeningGuideState({
          active: true,
          phase: "post_exit_sequence",
          gameId,
          currentFen: move.fen_after,
          stepIndex: sequenceIndex + 1,
          message: `Coup intermédiaire ${sequenceIndex + 1}/${sequence.length} après la sortie.`,
          currentMoveUci: move.played_uci,
          linkedPly: annotation.ply,
        });
        setReviewOpeningFocusMessage("Séquence après la sortie du livre.");
      }, 900 + sequenceIndex * 900),
    );
    const finalTimer = window.setTimeout(() => {
      if (animationRequestId !== reviewAnimationRequestIdRef.current) {
        return;
      }
      handleShowReviewAnnotation(annotation, Math.max(0, index), "before");
      setOpeningGuideState({
        active: true,
        phase: "linked_moment",
        gameId,
        currentFen: annotation.fen_before,
        stepIndex: sequence.length + 1,
        message: "Premier vrai moment critique après la sortie.",
        currentMoveUci: null,
        linkedPly: annotation.ply,
      });
      setReviewOpeningFocusMessage("Premier vrai moment critique après la sortie.");
      reviewReplayTimersRef.current = [];
    }, 1000 + sequence.length * 900);
    reviewReplayTimersRef.current = [...timers, finalTimer];
  }

  function showHistoricalPly(ply: number) {
    if (!moveHistory) {
      return;
    }
    clearReviewOverlays("show_historical_ply");
    resetSolutionReveal("show_historical_ply");
    const clamped = clamp(ply, 0, moveHistory.moves.length);
    const nextFen =
      clamped === 0
        ? moveHistory.initial_fen
        : moveHistory.moves[clamped - 1].fen_after;
    setViewedFen(nextFen);
    setDisplayedPositionPly(clamped);
    setPositionMode(clamped === moveHistory.moves.length ? "LIVE" : "HISTORICAL");
    setSelectedReviewMomentId(null);
    setSelectedReviewMovePly(null);
    setSelectedReviewIndex(null);
    setReviewPracticeState(null);
    setReviewBarPhase("before");
  }

  function goInitialPosition() {
    if (!moveHistory) {
      return;
    }
    clearReviewOverlays("go_initial_position");
    resetSolutionReveal("go_initial_position");
    setViewedFen(moveHistory.initial_fen);
    setDisplayedPositionPly(0);
    setPositionMode(moveHistory.moves.length === 0 ? "LIVE" : "HISTORICAL");
    setSelectedReviewMomentId(null);
    setSelectedReviewMovePly(null);
    setSelectedReviewIndex(null);
    setReviewPracticeState(null);
    setReviewBarPhase("before");
  }

  function goPreviousPosition() {
    showHistoricalPly(displayedPositionPly - 1);
  }

  function goNextPosition() {
    showHistoricalPly(displayedPositionPly + 1);
  }

  function goLivePosition() {
    clearReviewOverlays("go_live_position");
    resetSolutionReveal("go_live_position");
    if (!moveHistory) {
      if (currentFen) {
      setViewedFen(currentFen);
      }
      setPositionMode("LIVE");
      setReviewPracticeState(null);
      setReviewBarPhase("before");
      return;
    }
    setViewedFen(moveHistory.current_fen);
    setDisplayedPositionPly(moveHistory.moves.length);
    setPositionMode("LIVE");
    setSelectedReviewMomentId(null);
    setSelectedReviewMovePly(null);
    setSelectedReviewIndex(null);
    setReviewPracticeState(null);
    setReviewBarPhase("before");
  }

  function showReviewByOffset(offset: number) {
    if (!review || review.moments.length === 0 || selectedReviewIndex === null) {
      return;
    }
    const nextIndex = selectedReviewIndex + offset;
    if (nextIndex < 0 || nextIndex >= review.moments.length) {
      return;
    }
    handleShowReviewMoment(review.moments[nextIndex], nextIndex);
  }

  function handleReviewStepStatusPrevious() {
    if (reviewPvLineState?.active) {
      showManualPvLineStep(reviewPvLineState.currentIndex - 1);
      return;
    }
    if (selectedReviewAnnotation) {
      showPreviousGuidedAnnotation();
      return;
    }
    showReviewByOffset(-1);
  }

  function handleReviewStepStatusNext() {
    if (reviewPvLineState?.active) {
      showManualPvLineStep(reviewPvLineState.currentIndex + 1);
      return;
    }
    if (selectedReviewAnnotation) {
      showNextGuidedAnnotation();
      return;
    }
    showReviewByOffset(1);
  }

  function handleReviewStepStatusReplay() {
    if (reviewPvLineState?.active) {
      restartManualPvLine();
      return;
    }
    if (selectedReviewAnnotation && selectedReviewAnnotationIndex !== null) {
      handleShowReviewAnnotation(selectedReviewAnnotation, selectedReviewAnnotationIndex, "before");
      return;
    }
    if (selectedReviewIndex !== null && review?.moments[selectedReviewIndex]) {
      handleShowReviewMoment(review.moments[selectedReviewIndex], selectedReviewIndex);
    }
  }

  const reviewStepStatusCanPrevious =
    positionMode === "REVIEW" &&
    (reviewPvLineState?.active
      ? reviewPvLineState.currentIndex >= 0
      : selectedReviewAnnotation
        ? (review?.review_sections?.to_review?.length ?? 0) > 1
        : selectedReviewIndex !== null && selectedReviewIndex > 0);
  const reviewStepStatusCanNext =
    positionMode === "REVIEW" &&
    (reviewPvLineState?.active
      ? reviewPvLineState.currentIndex < reviewPvLineState.moves.length - 1
      : selectedReviewAnnotation
        ? (review?.review_sections?.to_review?.length ?? 0) > 1
        : selectedReviewIndex !== null &&
          Boolean(review?.moments.length) &&
          selectedReviewIndex < (review?.moments.length ?? 0) - 1);
  const reviewStepStatusCanReplay =
    positionMode === "REVIEW" &&
    Boolean(reviewPvLineState?.active || selectedReviewAnnotation || selectedReviewMoment);
  const activeReviewDisplayFocus: ReviewFocusKey = reviewPracticeState?.active
    ? "practice"
    : reviewFocusKey;
  const boardBadge = positionBadge(
    positionMode,
    displayedPositionPly,
    moveHistory,
    review,
    selectedReviewIndex,
    reviewOpeningFocusMessage,
  );
  const boardAriaLabel = boardLabel(
    positionMode,
    displayedPositionPly,
    moveHistory,
    review,
    selectedReviewIndex,
    reviewOpeningFocusMessage,
  );
  const tryMoveActive =
    Boolean(reviewTryMoveState?.active) && positionMode === "REVIEW";
  const practiceMoveActive =
    Boolean(
      reviewPracticeState?.active &&
        reviewPracticeState.status === "running" &&
        ["awaiting_attempt", "hint_shown"].includes(reviewPracticeState.itemState) &&
        !reviewPracticeState.saving,
    ) && positionMode === "REVIEW";
  const boardDisabled =
    busy !== "idle" ||
    !gameId ||
    (!tryMoveActive &&
      !practiceMoveActive &&
      (isGameCompleted || positionMode !== "LIVE"));
  const reviewSquareStyles = buildReviewSquareStyles(
    positionMode,
    review,
    selectedReviewIndex,
    reviewReplayMoveMode,
    currentReviewOverlayPositionKey,
    reviewOverlayPositionKey,
  );
  const reviewBoardArrows = buildReviewBoardArrows(
    positionMode,
    selectedReviewMoment,
    selectedReviewAnnotation,
    reviewReplayMoveMode,
    reviewReplayState,
    guidedReplayPhase,
    guidedPvIndex,
    reviewTryMoveState,
    reviewPracticeState,
    reviewPvLineState,
    openingGuideState,
    currentReviewOverlayPositionKey,
    reviewOverlayPositionKey,
  );
  const statusText =
    busy === "move"
      ? "Coup en cours..."
      : busy === "new-game"
        ? "Création..."
        : busy === "finish"
          ? "Finalisation..."
          : evaluation
            ? "Analyse disponible"
            : "Prêt";

  return (
    <main className="app">
      <header className="topbar app-header">
        <div className="app-logo-stack app-brand">
          <NeuroChessLogo
            href="/"
            onClick={(event) => {
              event.preventDefault();
              onNavigateHome();
            }}
            variant="header"
            className="app-brand-logo"
          />
          <div className="app-brand-title">
            <span>Chess · Decision Science</span>
            <p>{statusText}</p>
          </div>
        </div>
        <div className="actions app-header-actions">
          <button onClick={handleNewGame} disabled={busy !== "idle"}>
            Nouvelle partie
          </button>
          <button
            onClick={handleFinishGame}
            disabled={!gameId || busy !== "idle" || isGameCompleted}
          >
            Terminer partie
          </button>
          <button
            className={!canRequestReview ? "header-primary-action" : undefined}
            onClick={() => setActiveTab("import")}
          >
            Importer PGN
          </button>
          <button
            onClick={() => {
              setActiveTab("history");
              void loadHistory();
            }}
          >
            Voir l'historique
          </button>
          <label className="evaluation-toggle">
            <input
              type="checkbox"
              checked={hideEvaluation}
              onChange={event => setHideEvaluation(event.currentTarget.checked)}
            />
            Masquer l'évaluation
          </label>
          {canRequestReview && (
            <button
              className="header-primary-action"
              onClick={() => handleReview()}
              disabled={reviewLoading || reviewUiBusy}
            >
              Voir la review
            </button>
          )}
        </div>
      </header>

      {error && <div className="alert">{error}</div>}
      {visibleWarnings.length > 0 && (
        <div className="warning">
          {visibleWarnings.map(warningMessage).join(", ")}
        </div>
      )}
      {engineWarmupNotice && <div className="status-note">{engineWarmupNotice}</div>}
      {liveStatus && <div className="warning">{liveStatus}</div>}
      {gameId && (
        <div className="opening-summary">
          <span>{openingSummary(openingClassification, openingStatus)}</span>
          {openingMessage && <span className="opening-message">{openingMessage}</span>}
          {!openingClassification && (
            <button
              type="button"
              onClick={handleClassifyOpening}
              disabled={openingStatus === "loading"}
            >
              Classifier l'ouverture
            </button>
          )}
        </div>
      )}

      <section className="analysis-layout">
        <EvaluationBar
          evaluation={evaluationBarState.evaluation}
          source={evaluationBarState.source}
          placeholder={evaluationBarState.placeholder}
          delta={evaluationBarState.delta}
          deltaOverlay={evaluationBarState.deltaOverlay}
          hidden={hideEvaluation}
        />

        <section className="board-column">
          {boardBadge && <div className="position-badge">{boardBadge}</div>}
          {reviewReplayBadge && (
            <div
              className={`review-replay-badge review-replay-badge-${reviewReplayState}`}
              aria-live="polite"
            >
              {reviewReplayBadge}
            </div>
          )}
          <ChessBoardPanel
            fen={boardFen}
            disabled={boardDisabled}
            ariaLabel={boardAriaLabel}
            squareStyles={reviewSquareStyles}
            customArrows={reviewBoardArrows}
            animationDuration={
              positionMode === "REVIEW" ? REVIEW_REPLAY_MOVE_ANIMATION_MS : 300
            }
            onMove={handleMove}
          />
          <div className="board-nav" aria-label="Navigation de partie">
            <button onClick={goInitialPosition} disabled={!canNavigate || displayedPositionPly === 0}>
              &lt;&lt;
            </button>
            <button onClick={goPreviousPosition} disabled={!canNavigate || displayedPositionPly === 0}>
              &lt;
            </button>
            <button onClick={goNextPosition} disabled={!canNavigate || displayedPositionPly >= finalDisplayedPly}>
              &gt;
            </button>
            <button onClick={goLivePosition} disabled={!canNavigate || displayedPositionPly >= finalDisplayedPly}>
              &gt;&gt;
            </button>
            {positionMode !== "LIVE" && (
              <button onClick={goLivePosition}>
                ↻ {isGameCompleted ? "Position finale" : "Position actuelle"}
              </button>
            )}
          </div>
          {activeTab === "review" && (
            <ReviewStepStatus
              focusKey={activeReviewDisplayFocus}
              annotation={selectedReviewAnnotation}
              moment={selectedReviewMoment}
              guidedPhase={guidedReplayPhase}
              pvLineState={reviewPvLineState}
              practiceState={reviewPracticeState}
              openingFocusMessage={reviewOpeningFocusMessage}
              canPrevious={reviewStepStatusCanPrevious}
              canNext={reviewStepStatusCanNext}
              canReplay={reviewStepStatusCanReplay}
              onPrevious={handleReviewStepStatusPrevious}
              onNext={handleReviewStepStatusNext}
              onReplay={handleReviewStepStatusReplay}
            />
          )}
        </section>

        <aside className="right-panel">
          <div className="tabs" role="tablist" aria-label="Panneau de partie">
            <button
              id="tab-moves"
              role="tab"
              aria-selected={activeTab === "moves"}
              aria-controls="panel-moves"
              onClick={() => setActiveTab("moves")}
            >
              Coups
            </button>
            {reviewTabVisible && (
              <button
                id="tab-review"
                role="tab"
                aria-selected={activeTab === "review"}
                aria-controls="panel-review"
                onClick={() => setActiveTab("review")}
              >
                Review
              </button>
            )}
            <button
              id="tab-import"
              role="tab"
              aria-selected={activeTab === "import"}
              aria-controls="panel-import"
              onClick={() => setActiveTab("import")}
            >
              Import PGN
            </button>
            <button
              id="tab-history"
              role="tab"
              aria-selected={activeTab === "history"}
              aria-controls="panel-history"
              onClick={() => {
                setActiveTab("history");
                void loadHistory();
              }}
            >
              Historique
            </button>
            {import.meta.env.DEV && (
              <button
                id="tab-info"
                role="tab"
                aria-selected={activeTab === "info"}
                aria-controls="panel-info"
                onClick={() => setActiveTab("info")}
              >
                Infos
              </button>
            )}
          </div>

          <section
            id="panel-moves"
            role="tabpanel"
            aria-labelledby="tab-moves"
            hidden={activeTab !== "moves"}
            className="tab-panel"
          >
            <MoveHistory
              history={moveHistory}
              loading={moveHistoryLoading}
              error={moveHistoryError}
              displayedPositionPly={displayedPositionPly}
              selectedReviewMovePly={selectedReviewMovePly}
              onSelectMove={handleSelectMove}
              onRetry={() => {
                if (gameId) {
                  void loadMoveHistory(gameId, false);
                }
              }}
            />
          </section>

          {reviewTabVisible && (
            <section
              id="panel-review"
              role="tabpanel"
              aria-labelledby="tab-review"
              hidden={activeTab !== "review"}
              className="tab-panel"
            >
              <ReviewPanel
                review={review}
                reviewJob={reviewJob}
                error={reviewError}
                uiState={reviewUiState}
                selectedMomentId={selectedReviewMomentId}
                onGenerate={handleReview}
                onRetry={handleReview}
                onForceReanalysis={(profile) =>
                  handleReview({
                    forceReanalysis: true,
                    profile: profile ?? reviewAnalysisProfile,
                  })
                }
                onCancelJob={handleCancelReviewJob}
                onReconcileJob={handleReconcileReviewJob}
                reviewReconcileInFlight={reviewReconcileInFlight}
                onCheck={handleReviewCheck}
                onRebuildMetrics={handleRebuildReviewMetrics}
                onShowMoment={handleShowReviewMoment}
                onShowAnnotation={handleShowReviewAnnotation}
                onShowOpeningExit={handleShowOpeningExit}
                onShowOpeningLinkedMoment={handleShowOpeningLinkedMoment}
                openingIntentionNote={openingIntentionNote}
                onOpeningIntentionNoteChange={handleOpeningIntentionNoteChange}
                onGuidedReplayAnnotation={handleGuidedReplayAnnotation}
                onTryMoveAnnotation={handleTryMoveAnnotation}
                onShowPvLineAnnotation={handleShowPvLineAnnotation}
                onTryMoveReset={resetTryMoveAttempt}
                onTryMoveRevealSolution={revealTryMoveSolution}
                tryMoveState={reviewTryMoveState}
                solutionRevealState={reviewSolutionRevealState}
                onSolutionHintAnnotation={handleSolutionHintAnnotation}
                onSolutionReset={resetSolutionReveal}
                practiceState={reviewPracticeState}
                practicePvLineState={reviewPvLineState}
                onStartPractice={handleStartReviewPractice}
                onPracticeHint={showPracticeHint}
                onPracticeRevealSolution={revealPracticeSolution}
                onPracticeSkip={skipPracticeItem}
                onPracticeTryAgain={resetPracticeAttempt}
                onPracticeNext={goToNextPracticeItem}
                onPracticeShowPvLine={showPracticePvLine}
                onPracticePvPrevious={showPreviousPvLineStep}
                onPracticePvNext={showNextPvLineStep}
                onPracticePvRestart={restartManualPvLine}
                onPracticePvToggleAutoplay={toggleManualPvLineAutoplay}
                onPracticePvSelectLine={selectManualPvLineMode}
                onPracticePvClose={closeManualPvLine}
                onPracticeQuit={quitPracticeSession}
                onPracticeRetryFailed={() => retryFailedPracticeSession()}
                onPracticeRedoAll={redoPracticeSession}
                practiceHistory={reviewPracticeHistory}
                practiceHistoryLoading={reviewPracticeHistoryLoading}
                practiceHistoryError={reviewPracticeHistoryError}
                onPracticeHistoryRefresh={() => {
                  if (gameId) {
                    void loadReviewPracticeHistory(gameId);
                  }
                }}
                onPracticeResumeSession={resumePracticeSession}
                onPracticeViewSessionSummary={viewPracticeSessionSummary}
                onPracticeRetryFailedSession={retryFailedPracticeSession}
                selectedReviewPov={selectedReviewPov}
                activeReviewFocus={activeReviewDisplayFocus}
                onReviewPovChange={handleReviewPovChange}
                onReviewFocusChange={handleReviewFocusChange}
                selectedMovePly={selectedReviewMovePly}
                hideEvaluation={hideEvaluation}
                analysisProfile={reviewAnalysisProfile}
                onAnalysisProfileChange={setReviewAnalysisProfile}
              />
              {import.meta.env.DEV && activeReviewDisplayFocus === "lab" && (
                <details className="review-debug" data-review-debug="true">
                  <summary>Debug Review</summary>
                  <div className="review-debug-title">Review debug:</div>
                  <dl>
                    <dt>game_id</dt>
                    <dd>{gameId ?? "null"}</dd>
                    <dt>halfMovesCount</dt>
                    <dd>{reviewHalfMovesCount}</dd>
                    <dt>MIN_REVIEW_HALF_MOVES</dt>
                    <dd>{MIN_REVIEW_HALF_MOVES}</dd>
                    <dt>isShortGameForReview</dt>
                    <dd>{currentGameIsShortForReview ? "true" : "false"}</dd>
                    <dt>reviewUiState</dt>
                    <dd>{reviewUiState.status}</dd>
                    <dt>review.status reçu</dt>
                    <dd>{review?.status ?? "null"}</dd>
                    <dt>review_work_active</dt>
                    <dd>{review?.review_work_active === undefined ? "null" : review.review_work_active ? "true" : "false"}</dd>
                    <dt>scheduled_deep_count</dt>
                    <dd>{review?.scheduled_deep_count ?? "null"}</dd>
                    <dt>failed_deep_count</dt>
                    <dd>{review?.failed_deep_count ?? "null"}</dd>
                    <dt>failed_deep_details</dt>
                    <dd>{JSON.stringify(review?.failed_deep_details ?? [])}</dd>
                    <dt>loading</dt>
                    <dd>{reviewLoading ? "true" : "false"}</dd>
                    <dt>pollingActive</dt>
                    <dd>{reviewPollingActiveDebug ? "true" : "false"}</dd>
                    <dt>pendingStartedAt</dt>
                    <dd>{reviewPendingStartedAtDebug ?? "null"}</dd>
                    <dt>lastGenerateStatus</dt>
                    <dd>{lastReviewGenerateStatus ?? "null"}</dd>
                    <dt>lastGetStatus</dt>
                    <dd>{lastReviewGetStatus ?? "null"}</dd>
                  </dl>
                  <div className="review-debug-title">reviewReplayDebug:</div>
                  <dl>
                    <dt>reviewReplayState</dt>
                    <dd>{reviewReplayState}</dd>
                    <dt>reviewReplayMoveMode</dt>
                    <dd>{reviewReplayMoveMode}</dd>
                    <dt>positionMode</dt>
                    <dd>{positionMode}</dd>
                    <dt>displayedFenKind</dt>
                    <dd>{reviewReplayDisplayedFenKind}</dd>
                    <dt>playedUci</dt>
                    <dd>
                      {reviewReplayMoveMode === "best"
                        ? selectedReviewMoment?.best_move_uci ?? "null"
                        : selectedReviewMoment?.played_uci ?? "null"}
                    </dd>
                    <dt>hasFenBefore</dt>
                    <dd>{selectedReviewMoment?.fen_before ? "true" : "false"}</dd>
                    <dt>hasFenAfter</dt>
                    <dd>{selectedReviewMoment?.fen_after ? "true" : "false"}</dd>
                    <dt>hasEvalBefore</dt>
                    <dd>{reviewReplayHasEvalBefore ? "true" : "false"}</dd>
                    <dt>hasEvalAfter</dt>
                    <dd>{reviewReplayHasEvalAfter ? "true" : "false"}</dd>
                    <dt>hideEvaluation</dt>
                    <dd>{hideEvaluation ? "true" : "false"}</dd>
                    <dt>animationDuration</dt>
                    <dd>
                      {positionMode === "REVIEW"
                        ? REVIEW_REPLAY_MOVE_ANIMATION_MS
                        : 300}
                    </dd>
                  </dl>
                </details>
              )}
            </section>
          )}

          <section
            id="panel-import"
            role="tabpanel"
            aria-labelledby="tab-import"
            hidden={activeTab !== "import"}
            className="tab-panel"
          >
            <div className="review-content">
              <div className="panel-title">Importer PGN</div>
              <div className="import-form">
                <label>
                  Fichier PGN
                  <input
                    type="file"
                    accept=".pgn,.txt"
                    onChange={handlePgnFileChange}
                  />
                </label>
                <label>
                  Coller PGN
                  <textarea
                    value={pgnText}
                    onChange={(event) => {
                      setPgnText(event.target.value);
                      setPgnPreview(null);
                      setPgnImportResult(null);
                      setPgnImportError(null);
                    }}
                    rows={8}
                  />
                </label>
                <label>
                  Plateforme
                  <select
                    value={pgnPlatform}
                    onChange={(event) => setPgnPlatform(event.target.value)}
                  >
                    <option value="unknown">unknown</option>
                    <option value="chesscom">chesscom</option>
                    <option value="lichess">lichess</option>
                  </select>
                </label>
                {pgnPreview?.needs_user_alias && (
                  <label>
                    Quel pseudo est le vôtre ?
                    <select
                      value={pgnUserAlias}
                      onChange={(event) => setPgnUserAlias(event.target.value)}
                    >
                      <option value="">Non précisé</option>
                      {pgnPreview.detected_players.map((player) => (
                        <option key={player} value={player}>
                          {player}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!pgnPreview?.needs_user_alias && (
                  <label>
                    Pseudo utilisateur
                    <input
                      value={pgnUserAlias}
                      onChange={(event) => setPgnUserAlias(event.target.value)}
                    />
                  </label>
                )}
                <div className="import-actions">
                  <button onClick={handlePgnPreview} disabled={pgnImportLoading}>
                    Prévisualiser
                  </button>
                  <button onClick={handlePgnImport} disabled={pgnImportLoading}>
                    Importer
                  </button>
                </div>
              </div>

              {pgnImportError && <div className="review-note">{pgnImportError}</div>}

              {pgnPreview && (
                <div className="import-report">
                  <div>
                    {pgnPreview.valid_count} parties valides, {pgnPreview.duplicate_count} doublons, {pgnPreview.invalid_count} erreurs
                  </div>
                  <div>
                    Joueurs détectés : {pgnPreview.detected_players.join(", ") || "aucun"}
                  </div>
                  {pgnPreview.sample_games.length > 0 && (
                    <ul>
                      {pgnPreview.sample_games.map((game, index) => (
                        <li key={`${game.white}-${game.black}-${index}`}>
                          {game.date ?? "date inconnue"} · {game.white ?? "?"} - {game.black ?? "?"} · {game.result ?? "*"} · {game.eco ?? "ECO ?"} {game.opening ?? ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {pgnImportResult && (
                <div className="import-report">
                  <div>{pgnImportResult.imported_count} parties importées</div>
                  {(pgnImportResult.repaired_count ?? 0) > 0 && (
                    <div>{pgnImportResult.repaired_count} parties réparées</div>
                  )}
                  <div>{pgnImportResult.duplicate_count} doublons</div>
                  <div>{pgnImportResult.invalid_count} erreurs</div>
                  <div>{pgnImportResult.classified_count} ouvertures classifiées</div>
                  <button
                    onClick={() => {
                      setActiveTab("history");
                      void loadHistory();
                    }}
                  >
                    Voir l'historique
                  </button>
                </div>
              )}
            </div>
          </section>

          <section
            id="panel-history"
            role="tabpanel"
            aria-labelledby="tab-history"
            hidden={activeTab !== "history"}
            className="tab-panel"
          >
            <div className="review-content">
              <div className="panel-title">Historique</div>
              <div className="history-scope-filters" role="tablist" aria-label="Filtres historique">
                {HISTORY_SCOPE_FILTERS.map((filter) => (
                  <button
                    key={filter.scope}
                    type="button"
                    role="tab"
                    aria-selected={historyScope === filter.scope}
                    className={historyScope === filter.scope ? "active" : ""}
                    onClick={() => handleHistoryScopeChange(filter.scope)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              {historyLoading && <div className="review-note">Chargement...</div>}
              {historyError && <div className="review-note">{historyError}</div>}
              {!historyLoading && historyItems.length === 0 && (
                <div className="review-note">{historyEmptyMessage(historyScope)}</div>
              )}
              {historyItems.length > 0 && (
                <div className="game-library" aria-label="Bibliothèque de parties">
                  {historyItems.map((item) => (
                    <article
                      key={item.game_id}
                      className={`game-history-card metadata-${item.metadata_quality}`}
                    >
                      <div className="game-history-meta">
                        <span className="history-badge source">
                          {historySourceBadge(item)}
                        </span>
                        <span className="history-badge category">
                          {historyCategoryLabel(item)}
                        </span>
                        {item.is_special_position && (
                          <span className="history-badge special">
                            Position spéciale
                          </span>
                        )}
                        {item.import_status && item.import_status !== "ok" && (
                          <span className="history-badge warning">
                            Import partiel
                          </span>
                        )}
                        <span className="history-date">
                          {historyDateAndCadence(item)}
                        </span>
                      </div>
                      <div className="game-history-main">
                        <div>
                          <div className="game-history-title">{item.display_title}</div>
                          <div className="game-history-subtitle">{item.display_subtitle}</div>
                        </div>
                        <div className="game-history-status">
                          <span>{historyResultLabel(item)}</span>
                          <span>{historyOpeningLabel(item)}</span>
                          <span>Analyse · {historyAnalysisLabel(item)}</span>
                        </div>
                      </div>
                      <div className="game-history-actions">
                        <button
                          type="button"
                          onClick={() => {
                            void handleOpenHistoryGame(item);
                          }}
                          disabled={busy !== "idle"}
                        >
                          Ouvrir
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleOpenHistoryGame(item, "review");
                          }}
                          disabled={
                            busy !== "idle" ||
                            !item.is_reviewable ||
                            (item.import_status ?? "ok") !== "ok"
                          }
                        >
                          {item.review_summary_status === "review_available"
                            ? "Voir review"
                            : "Analyser"}
                        </button>
                        {canClassifyHistoryOpening(item) && (
                          <button
                            type="button"
                            onClick={() => {
                              void handleClassifyHistoryGame(item);
                            }}
                            disabled={historyOpeningGameId === item.game_id}
                          >
                            {historyOpeningGameId === item.game_id
                              ? "Classification..."
                              : "Classifier ouverture"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {selectedHistoryGame && (
                <div className="review-note">
                  Partie #{selectedHistoryGame.game_id} · {selectedHistoryGame.display_title}
                  {gameId === selectedHistoryGame.game_id ? " · chargée sur l'échiquier" : ""}
                </div>
              )}
            </div>
          </section>

          {import.meta.env.DEV && (
            <section
              id="panel-info"
              role="tabpanel"
              aria-labelledby="tab-info"
              hidden={activeTab !== "info"}
              className="tab-panel debug"
            >
              <div className="panel-title">Infos</div>
              <dl>
                <dt>Game</dt>
                <dd>{gameId ?? "—"}</dd>
                <dt>Résultat</dt>
                <dd>{result ?? (isGameOver ? "*" : "En cours")}</dd>
                <dt>Coups légaux</dt>
                <dd>{legalMoves.length}</dd>
                <dt>Mode</dt>
                <dd>{positionMode}</dd>
                <dt>Ply affiché</dt>
                <dd>{displayedPositionPly}</dd>
                <dt>FEN affichée</dt>
                <dd className="fen">{boardFen ?? "Aucune partie"}</dd>
                <dt>FEN actuelle</dt>
                <dd className="fen">{currentFen ?? "Aucune partie"}</dd>
              </dl>
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}

function readCurrentPath(): string {
  if (typeof window === "undefined") {
    return "/";
  }
  return window.location.pathname || "/";
}

function normalizeRoute(pathname: string): NeuroChessRoute {
  return pathname.startsWith("/app") ? "/app" : "/";
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur inconnue";
}

function historySourceBadge(item: GameHistoryItem): string {
  if (item.source_platform === "lichess") {
    return "Lichess";
  }
  if (item.source_platform === "chesscom") {
    return "Chess.com";
  }
  if (item.game_category === "local_ai") {
    return "IA";
  }
  if (item.game_category === "imported_observed") {
    return "Observée";
  }
  if (item.metadata_quality === "poor") {
    return "Incomplète";
  }
  if (item.source === "pgn_import") {
    return "PGN";
  }
  return "Local";
}

function historyCategoryLabel(item: GameHistoryItem): string {
  if (item.game_category === "imported_user") {
    return "Importée";
  }
  if (item.game_category === "imported_observed") {
    return "Observée";
  }
  if (item.game_category === "local_ai") {
    return "IA";
  }
  if (item.game_category === "analysis_sandbox") {
    return "Sandbox";
  }
  if (item.game_category === "unknown") {
    return "Incomplète";
  }
  return "Local";
}

function historyDateAndCadence(item: GameHistoryItem): string {
  const parts: string[] = [];
  if (item.date_played) {
    parts.push(item.date_played);
  }
  if (item.time_control_category !== "unknown") {
    parts.push(timeControlCategoryLabel(item.time_control_category));
  }
  if (item.time_control) {
    parts.push(item.time_control);
  }
  return parts.length > 0 ? parts.join(" · ") : "Date inconnue";
}

function timeControlCategoryLabel(category: string): string {
  if (category === "bullet") {
    return "Bullet";
  }
  if (category === "blitz") {
    return "Blitz";
  }
  if (category === "rapid") {
    return "Rapid";
  }
  if (category === "classical") {
    return "Classique";
  }
  return "Cadence inconnue";
}

function historyResultLabel(item: GameHistoryItem): string {
  if (item.result_from_user_pov === "win") {
    return "Victoire";
  }
  if (item.result_from_user_pov === "loss") {
    return "Défaite";
  }
  if (item.result_from_user_pov === "draw" || item.result === "1/2-1/2") {
    return "Nulle";
  }
  return item.result ?? "Résultat inconnu";
}

function historyOpeningLabel(item: GameHistoryItem): string {
  if (
    item.classification_status === "not_applicable_from_position" ||
    item.is_special_position
  ) {
    return "Ouverture non applicable - position initiale spéciale";
  }
  if (item.eco_code || item.opening_name) {
    return [item.eco_code, item.opening_name].filter(Boolean).join(" ");
  }
  return "non classifiée";
}

function historyAnalysisLabel(item: GameHistoryItem): string {
  if (item.review_summary_status === "review_available") {
    return "Review disponible";
  }
  if (item.review_summary_status === "analysis_in_progress") {
    return "Analyse en cours";
  }
  if (item.review_summary_status === "no_significant_moments") {
    return "Aucun moment majeur";
  }
  if (item.review_summary_status === "too_short") {
    return "Trop courte";
  }
  if (item.review_summary_status === "analysis_failed") {
    return "Échec analyse";
  }
  return "À analyser";
}

function historyOpenErrorMessage(item: GameHistoryItem, err: unknown): string {
  const detail = messageFromError(err);
  if ((item.import_status ?? "ok") !== "ok") {
    return `Cette partie importée n'est pas ouvrable pour le moment : ${item.import_error ?? detail}`;
  }
  if (item.is_special_position) {
    return `Impossible de reconstruire cette partie depuis sa position initiale spéciale. ${detail}. Réimportez le PGN pour réparer l'import si nécessaire.`;
  }
  return `Impossible d'ouvrir cette partie. ${detail}`;
}

function canClassifyHistoryOpening(item: GameHistoryItem): boolean {
  if (
    item.is_special_position ||
    item.classification_status === "not_applicable_from_position"
  ) {
    return false;
  }
  return !["matched", "partial"].includes(item.classification_status);
}

function historyEmptyMessage(scope: HistoryScope): string {
  if (scope === "ai") {
    return "Aucune partie IA pour le moment.";
  }
  if (scope === "observed") {
    return "Aucune partie observée.";
  }
  if (scope === "local") {
    return "Aucune partie locale.";
  }
  if (scope === "imported") {
    return "Aucune partie importée.";
  }
  return "Aucune partie dans cette vue.";
}

function isTooShortReviewError(error: unknown): boolean {
  const message = messageFromError(error);
  return (
    message.includes("game_too_short_for_review") ||
    message.includes("game too short")
  );
}

function makeShortGameReviewResponse(
  gameId: number,
  actualHalfMoves: number,
): ReviewResponse {
  return {
    game_id: gameId,
    status: "not_reviewable",
    reason: "game_too_short",
    empty_reason: "game_too_short",
    min_half_moves: MIN_REVIEW_HALF_MOVES,
    actual_half_moves: actualHalfMoves,
    half_moves_count: actualHalfMoves,
    min_half_moves_for_review: MIN_REVIEW_HALF_MOVES,
    reviewable: false,
    review_schema_version: "post_game_review_v1",
    selection_algorithm_version: "moment_selection_stabilized_v5",
    coverage: 0,
    missing_deep_count: 0,
    analyzed_deep_count: 0,
    total_required_deep_count: 0,
    scheduled_deep_count: 0,
    failed_deep_count: 0,
    failed_deep_details: [],
    review_work_active: false,
    white_review_score: null,
    black_review_score: null,
    user_review_score: null,
    opponent_review_score: null,
    white_lichess_like_accuracy: null,
    black_lichess_like_accuracy: null,
    user_lichess_like_accuracy: null,
    opponent_lichess_like_accuracy: null,
    white_public_neuro_score: null,
    black_public_neuro_score: null,
    user_public_neuro_score: null,
    opponent_public_neuro_score: null,
    public_neuro_score: null,
    public_score_formula_version: "public_neuro_score_lichess_like_v1",
    qualitative_game_label: "Partie à analyser",
    qualitative_game_label_formula_version: "qualitative_game_label_v1",
    white_neuro_score: null,
    black_neuro_score: null,
    user_neuro_score: null,
    opponent_neuro_score: null,
    white_diagnostic_gap: null,
    black_diagnostic_gap: null,
    user_diagnostic_gap: null,
    opponent_diagnostic_gap: null,
    score_availability: {
      lichess_like: "missing_data",
      neuro_score: "missing_data",
      diagnostic_gap: "missing_dependency",
      reason: "game_too_short",
    },
    review_score_deprecated: true,
    review_score_alias_of: "lichess_like_accuracy",
    review_score_confidence: null,
    score_formula_version: "dual_lichess_neuro_v1",
    move_accuracy_formula_version: "lichess_exp_uncertainty_v1",
    game_accuracy_formula_version: "lichess_weighted_harmonic_v1",
    neuro_score_formula_version: "neuro_diagnostic_regularized_v1",
    score_analyzed_moves_white: 0,
    score_analyzed_moves_black: 0,
    score_missing_moves_white: 0,
    score_missing_moves_black: 0,
    deep_coverage: 0,
    required_position_count: 0,
    deep_done_count: 0,
    deep_missing_count: 0,
    deep_failed_count: 0,
    review_analysis_origin: "insufficient",
    review_analysis_state: "insufficient",
    review_analysis_quality: "cached",
    review_analysis_profile: "standard",
    review_score_profile: "standard",
    analysis_profile_used: null,
    completed_position_count: 0,
    pending_position_count: 0,
    failed_position_count: 0,
    total_budget_seconds: 0,
    elapsed_seconds: 0,
    estimated_remaining_seconds: 0,
    per_position_time_ms: 0,
    analysis_limit_mode: null,
    requested_multipv: 3,
    average_depth_reached: null,
    min_depth_reached: null,
    max_depth_reached: null,
    cache_hits: 0,
    cache_misses: 0,
    legacy_cache_ignored_count: 0,
    number_of_moves_white: 0,
    number_of_moves_black: 0,
    white_score_debug: null,
    black_score_debug: null,
    review_score_audit_rows: [],
    message: REVIEW_NOT_REVIEWABLE_MESSAGE,
    warnings: [],
    moments: [],
  };
}

function warningMessage(warning: string): string {
  if (
    warning === "analysis_engine_unavailable" ||
    warning === "engine_unavailable"
  ) {
    return "Moteur d'analyse indisponible. Vérifie le chemin Stockfish ou NEUROCHESS_STOCKFISH_PATH.";
  }

  if (warning === "invalid_fen") {
    return "FEN invalide.";
  }

  return warning;
}

function hasUsableEvaluation(
  evaluation: Evaluation | null,
  source: EvaluationSource | null,
): boolean {
  return evaluation !== null && isKnownEvaluationSource(source?.kind);
}

function isKnownEvaluationSource(kind: string | undefined): boolean {
  return Boolean(kind && EVALUATION_SOURCE_KINDS.has(kind));
}

function removeAnalysisUnavailableWarnings(warnings: string[]): string[] {
  return warnings.filter(
    (warning) => !ANALYSIS_UNAVAILABLE_WARNINGS.has(warning),
  );
}

function isAnalysisUnavailableWarning(warning: string): boolean {
  return ANALYSIS_UNAVAILABLE_WARNINGS.has(warning);
}

function debugLog(event: string, details?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.debug(`[NeuroChess] ${event}`, details ?? {});
  }
}

function isCompletedGameState(state: GameState): boolean {
  return state.is_game_over || Number(state.game?.completed ?? 0) === 1;
}

function resultFromState(state: GameState): string | null {
  const gameResult = state.game?.result;
  return state.result ?? (typeof gameResult === "string" ? gameResult : null);
}

function openingSummary(
  classification: OpeningClassification | null,
  status: OpeningLoadStatus,
): string {
  if (status === "loading") {
    return "Ouverture : chargement...";
  }
  if (classification?.classification_status === "not_applicable_from_position") {
    return "Ouverture : non applicable - position initiale speciale";
  }
  if (!classification || classification.classification_status === "unknown") {
    return "Ouverture : non classifiée";
  }

  const parts = [`Ouverture : ${classification.opening_name ?? "non classifiée"}`];
  if (classification.eco_code) {
    parts.push(classification.eco_code);
  }
  if (classification.last_book_ply !== null) {
    parts.push(`livre jusqu'au coup ${classification.last_book_ply}`);
  }
  if (
    classification.out_of_book_ply !== null &&
    classification.out_of_book_color
  ) {
    parts.push(
      `sortie au coup ${classification.out_of_book_ply}, ${colorLabel(
        classification.out_of_book_color,
      )}`,
    );
  }
  return parts.join(" · ");
}

function colorLabel(color: "white" | "black"): string {
  return color === "white" ? "Blancs" : "Noirs";
}

function lookupFromAnalysis(analysis: AnalysisByFen): PositionEvaluationLookup {
  if (analysis.status === "pending" || analysis.status === "running") {
    return {
      status: "pending",
      evaluation: null,
      source: {
        kind: "historical_pending",
        depth: analysis.depth ?? null,
        time_ms: analysis.analysis_time_ms ?? null,
        nodes: null,
        engine_version: analysis.engine_version ?? "unknown",
      },
    };
  }

  if (analysis.status !== "done") {
    return {
      status: "unavailable",
      evaluation: null,
      source: null,
    };
  }

  const analysisJson = analysis.analysis_json ?? {};
  const stabilized = analysisJson.stabilized_eval;
  const evaluation = makeEvaluationDisplayFromEngineScore(
    stabilized?.final_eval_cp ?? analysisJson.eval_cp,
    stabilized?.final_mate_in ?? analysisJson.mate_in,
  );
  if (!evaluation) {
    return {
      status: "unavailable",
      evaluation: null,
      source: null,
    };
  }

  return {
    status: "done",
    evaluation,
    source: {
      kind: stabilized
        ? REVIEW_STABILIZED_DEEP_SOURCE_KIND
        : "historical_deep",
      depth: stabilized?.final_depth ?? analysisJson.depth ?? analysis.depth ?? null,
      time_ms:
        stabilized?.time_ms ??
        analysisJson.analysis_time_ms ??
        analysis.analysis_time_ms ??
        null,
      nodes: stabilized?.nodes ?? null,
      engine_version:
        stabilized?.engine_version ??
        analysisJson.engine_version ??
        analysis.engine_version ??
        "unknown",
    },
  };
}

function evaluationBarStateForBoardFen(
  mode: PositionMode,
  boardFen: string | null,
  currentFen: string | null,
  evaluation: Evaluation | null,
  source: EvaluationSource | null,
  evaluationFen: string | null,
  review: ReviewResponse | null,
  selectedReviewIndex: number | null,
  positionEvaluationCache: Record<string, PositionEvaluationLookup>,
  context: BoardEvaluationContext,
  liveAnalysisSessionId: string | null,
  reviewBarPhase: ReviewBarPhase,
  reviewReplayMoveMode: ReviewReplayMoveMode,
  selectedReviewAnnotation: ReviewMoveAnnotation | null,
  reviewPracticeState: ReviewPracticeState | null,
): EvaluationBarState {
  if (
    mode === "LIVE" &&
    boardFen &&
    evaluationFen === boardFen &&
    evaluation &&
    source
  ) {
    return {
      evaluation,
      source,
      placeholder: null,
      delta: null,
      deltaOverlay: null,
    };
  }

  if (mode === "LIVE" && boardFen === currentFen && evaluation && source) {
    return {
      evaluation,
      source,
      placeholder: null,
      delta: null,
      deltaOverlay: null,
    };
  }

  if (mode === "HISTORICAL") {
    const lookup = boardFen ? positionEvaluationCache[boardFen] : null;
    if (lookup?.evaluation) {
      return {
        evaluation: lookup.evaluation,
        source: lookup.source,
        placeholder: null,
        delta: null,
        deltaOverlay: null,
      };
    }
    if (boardFen && evaluationFen === boardFen && evaluation && source) {
      return {
        evaluation,
        source,
        placeholder: null,
        delta: null,
        deltaOverlay: null,
      };
    }
    if (lookup?.status === "loading" || lookup?.status === "pending") {
      return {
        evaluation: null,
        source: null,
        placeholder: {
          label: "analyse en cours",
          sourceLabel: "historique",
          sourceTitle: "analyse de la position historique en cours",
        },
        delta: null,
        deltaOverlay: null,
      };
    }

    return {
      evaluation: null,
      source: null,
      placeholder: {
        label: "analyse indisponible",
        sourceLabel: "historique",
        sourceTitle: boardFen === currentFen
          ? "position courante sans evaluation disponible"
          : "aucune analyse disponible pour la position historique",
      },
      delta: null,
      deltaOverlay: null,
    };
  }

  const moment =
    selectedReviewIndex !== null ? review?.moments[selectedReviewIndex] : null;
  if (moment) {
    const reviewEvaluation = reviewMomentEvaluation(moment, reviewBarPhase);
    if (reviewEvaluation) {
      return {
        evaluation: reviewEvaluation,
        source: {
          kind: reviewMomentSourceKind(moment),
          depth: reviewMomentDepth(moment, reviewBarPhase),
          time_ms: null,
          nodes: null,
          engine_version: "unknown",
        },
        placeholder: null,
        delta:
          reviewReplayMoveMode === "played" ? reviewMomentDelta(moment) : null,
        deltaOverlay:
          reviewReplayMoveMode === "played"
            ? reviewMomentDeltaOverlay(moment)
            : null,
      };
    }
    return {
      evaluation: null,
      source: null,
      placeholder: {
        label: "Évaluation non disponible pour ce moment.",
        sourceLabel: "review",
        sourceTitle: "données review absentes pour ce moment",
      },
      delta: null,
      deltaOverlay: null,
    };
  }

  return {
    evaluation: null,
    source: null,
    placeholder: {
      label: reviewPracticeState?.active
        ? selectedReviewAnnotation
          ? `Mode entraînement · ${formatGuidedImpact(selectedReviewAnnotation.win_loss)}`
          : "Mode entraînement"
        : selectedReviewAnnotation
          ? `Impact du moment : ${formatGuidedImpact(selectedReviewAnnotation.win_loss)}`
          : "Review guidée",
      sourceLabel: "review",
      sourceTitle: reviewPracticeState?.active
        ? "trouve le meilleur coup en mode entraînement"
        : "évaluation figée pendant la Review",
    },
    delta: null,
    deltaOverlay: null,
  };
}

function reviewMomentEvaluation(
  moment: ReviewMoment,
  phase: ReviewBarPhase,
): Evaluation | null {
  const evalCp = phase === "after" ? moment.eval_after_cp : moment.eval_before_cp;
  const mateIn = phase === "after" ? moment.mate_after : moment.mate_before;
  return makeEvaluationDisplayFromEngineScore(evalCp, mateIn);
}

function reviewMomentSourceKind(_moment: ReviewMoment): string {
  return REVIEW_DEEP_SNAPSHOT_SOURCE_KIND;
}

function reviewMomentDepth(
  moment: ReviewMoment,
  phase: ReviewBarPhase,
): number | null {
  return phase === "after"
    ? moment.eval_depth_after ?? null
    : moment.eval_depth_before ?? null;
}

function reviewMomentDelta(moment: ReviewMoment): EvaluationDelta | null {
  const before = reviewMomentEvaluation(moment, "before");
  const after = reviewMomentEvaluation(moment, "after");
  if (!before || !after) {
    return null;
  }

  const beforePercent = playerPercentForMoment(before, moment.played_by);
  const afterPercent = playerPercentForMoment(after, moment.played_by);
  const delta = afterPercent - beforePercent;
  if (!Number.isFinite(delta)) {
    return null;
  }

  const rounded = Math.round(delta);
  const tone =
    delta < -0.5 ? "loss" : delta > 0.5 ? "gain" : "neutral";
  return {
    label: `${rounded > 0 ? "+" : ""}${rounded} %`,
    tone,
    title:
      tone === "loss"
        ? "perte de probabilité de gain pour le joueur"
        : tone === "gain"
          ? "gain de probabilité de gain pour le joueur"
          : "variation neutre pour le joueur",
  };
}

function reviewMomentDeltaOverlay(
  moment: ReviewMoment,
): EvaluationDeltaOverlay | null {
  const before = reviewMomentEvaluation(moment, "before");
  const after = reviewMomentEvaluation(moment, "after");
  const delta = reviewMomentDelta(moment);
  if (!before || !after || !delta) {
    return null;
  }

  const beforeWhite = clamp(before.white_percent, 0, 100);
  const afterWhite = clamp(after.white_percent, 0, 100);
  const heightPercent = Math.abs(beforeWhite - afterWhite);
  if (heightPercent < 1) {
    return null;
  }

  return {
    topPercent: 100 - Math.max(beforeWhite, afterWhite),
    heightPercent,
    tone: delta.tone,
    label: delta.label,
  };
}

function playerPercentForMoment(
  evaluation: Evaluation,
  playedBy: ReviewMoment["played_by"],
): number {
  return playedBy === "black"
    ? evaluation.black_percent
    : evaluation.white_percent;
}

function reviewReplayBadgeText(
  state: ReviewReplayState,
  moveMode: ReviewReplayMoveMode,
): string | null {
  if (state === "showing_before") {
    return "Position avant le coup";
  }
  if (state === "animating_move") {
    return moveMode === "best" ? "Meilleur coup suggéré" : "Coup joué";
  }
  if (state === "showing_after") {
    return moveMode === "best"
      ? "Position après le meilleur coup"
      : "Position après le coup";
  }
  return null;
}

function guidedReplayBadgeText(
  phase: GuidedReplayPhase,
  annotation: ReviewMoveAnnotation,
  selectedPov: ReviewPov,
  review: ReviewResponse | null,
): string {
  const isUserPov = isUserReviewPov(selectedPov, review);
  const colorLabel = reviewColorLabelForPov(annotation.color);
  if (phase === "context") {
    return "Contexte";
  }
  if (phase === "decision") {
    return "Position critique";
  }
  if (phase === "played_move") {
    return isUserPov ? "Ton coup dans la partie" : `Coup des ${colorLabel}`;
  }
  if (phase === "impact") {
    return `${isUserPov ? "Impact sur tes chances" : `Impact pour les ${colorLabel.toLowerCase()}`} : ${formatGuidedImpact(annotation.win_loss)}`;
  }
  if (phase === "best_move") {
    return `Solution : ${annotation.best_move_san ?? annotation.best_move_uci ?? "non disponible"}`;
  }
  if (phase === "pv_line") {
    return "Ligne proposée par le moteur";
  }
  return "À retenir";
}

function guidedReplayPhaseLabel(phase: GuidedReplayPhase): string {
  if (phase === "context") {
    return "Contexte";
  }
  if (phase === "decision") {
    return "Position critique";
  }
  if (phase === "played_move") {
    return "Coup joué";
  }
  if (phase === "impact") {
    return "Impact";
  }
  if (phase === "best_move") {
    return "Solution";
  }
  if (phase === "pv_line") {
    return "Ligne moteur";
  }
  return "À retenir";
}

function guidedReplayExplanation(
  annotation: ReviewMoveAnnotation,
  phase: GuidedReplayPhase,
  selectedPov: ReviewPov,
  review: ReviewResponse | null,
): string {
  const isUserPov = isUserReviewPov(selectedPov, review);
  const colorLabel = reviewColorLabelForPov(annotation.color);
  const transform = (text: string) =>
    isUserPov ? text : coachTextForReviewPov(text, colorLabel);
  if (phase === "context") {
    return "Contexte : ce coup amène la position critique.";
  }
  if (phase === "decision") {
    return isUserPov
      ? "Voici la position avant le moment critique. Prends une seconde pour chercher le bon coup."
      : `Voici la position avant la décision des ${colorLabel.toLowerCase()}. Prends une seconde pour chercher le bon coup.`;
  }
  if (phase === "played_move") {
    return transform(
      annotation.pedagogical_explanation?.why_played_move_bad ??
      "Observe pourquoi le choix de la partie ne répond pas au problème principal."
    );
  }
  if (phase === "impact") {
    return `${isUserPov ? "Impact sur tes chances" : `Impact pour les ${colorLabel.toLowerCase()}`} : ${formatGuidedImpact(annotation.win_loss)}.`;
  }
  if (phase === "best_move") {
    return transform(
      annotation.pedagogical_explanation?.why_best_move_good ??
      "La solution conserve davantage tes chances dans cette position."
    );
  }
  if (phase === "pv_line") {
    return annotation.pv_line_available
      ? "La ligne déroule les premiers coups déjà stockés dans l'analyse Review."
      : "Ligne complète indisponible ; seul le meilleur coup est affiché.";
  }
  return transform(
    annotation.pedagogical_explanation?.training_takeaway ??
    annotation.reason ??
    "Rejoue le moment pour fixer l'idée principale."
  );
}

function formatGuidedImpact(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "non disponible";
  }
  return `-${Math.round(value)} %`;
}

function openingMoveText(evidence: OpeningRealityEvidence): string {
  const move = evidence.exit_move_san ?? evidence.out_of_book_move_san ?? "coup inconnu";
  const color = evidence.exit_color ?? evidence.side_to_move_at_exit;
  return color === "black" ? `...${move}` : move;
}

function readReviewPovPreference(
  gameId: number | null,
  review: ReviewResponse | null,
): ReviewPov {
  const fallback = normalizedReviewUserColor(review) ? "user" : "white";
  if (typeof window === "undefined" || !gameId) {
    return fallback;
  }
  try {
    return normalizeReviewPovForReview(
      window.localStorage.getItem(reviewPovStorageKey(gameId)) as ReviewPov | null,
      review,
    );
  } catch {
    return fallback;
  }
}

function writeReviewPovPreference(gameId: number | null, pov: ReviewPov): void {
  if (typeof window === "undefined" || !gameId) {
    return;
  }
  try {
    window.localStorage.setItem(reviewPovStorageKey(gameId), pov);
  } catch {
    // Local UI preference only.
  }
}

function reviewPovStorageKey(gameId: number): string {
  return `${REVIEW_POV_STORAGE_KEY_PREFIX}.${gameId}`;
}

function readOpeningIntentionNote(gameId: number | null): string {
  if (typeof window === "undefined" || !gameId) {
    return "";
  }
  try {
    return window.localStorage.getItem(openingIntentionStorageKey(gameId)) ?? "";
  } catch {
    return "";
  }
}

function writeOpeningIntentionNote(gameId: number | null, note: string): void {
  if (typeof window === "undefined" || !gameId) {
    return;
  }
  try {
    const key = openingIntentionStorageKey(gameId);
    if (note.trim()) {
      window.localStorage.setItem(key, note);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Local UI note only.
  }
}

function openingIntentionStorageKey(gameId: number): string {
  return `${OPENING_INTENTION_STORAGE_KEY_PREFIX}.${gameId}`;
}

function normalizeReviewPovForReview(
  value: ReviewPov | string | null | undefined,
  review: ReviewResponse | null,
): ReviewPov {
  const userColor = normalizedReviewUserColor(review);
  if (value === "user") {
    return userColor ? "user" : "white";
  }
  if (value === "white" || value === "black" || value === "both") {
    return value;
  }
  return userColor ? "user" : "white";
}

function normalizedReviewUserColor(
  review: ReviewResponse | null,
): "white" | "black" | null {
  const value = String(review?.user_color ?? "").toLowerCase();
  return value === "white" || value === "black" ? value : null;
}

function isUserReviewPov(
  selectedPov: ReviewPov,
  review: ReviewResponse | null,
): boolean {
  return selectedPov === "user" && Boolean(normalizedReviewUserColor(review));
}

function reviewColorLabelForPov(color: string | null | undefined): string {
  return String(color).toLowerCase() === "black" ? "Noirs" : "Blancs";
}

function coachTextForReviewPov(text: string, colorLabel: string): string {
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

function reviewDisplayedFenKind(
  mode: PositionMode,
  boardFen: string | null,
  currentFen: string | null,
  moment: ReviewMoment | null,
): "before" | "after" | "live" | "unknown" {
  if (moment && boardFen === moment.fen_before) {
    return "before";
  }
  if (moment && boardFen === moment.fen_after) {
    return "after";
  }
  if (mode === "LIVE" || (boardFen && currentFen && boardFen === currentFen)) {
    return "live";
  }
  return "unknown";
}

function fenAfterUci(fen: string, uci: string | null): string | null {
  if (!uci || uci.length < 4) {
    return null;
  }
  try {
    const board = new Chess(fen);
    const move = board.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
    return move ? board.fen() : null;
  } catch (_err) {
    return null;
  }
}

function tryMoveFenAfter(
  fen: string,
  uci: string,
): { fenAfter: string | null; san: string | null; legal: boolean } {
  if (!uci || uci.length < 4) {
    return { fenAfter: null, san: null, legal: false };
  }
  try {
    const board = new Chess(fen);
    const move = board.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
    return move
      ? { fenAfter: board.fen(), san: move.san, legal: true }
      : { fenAfter: null, san: null, legal: false };
  } catch (_err) {
    return { fenAfter: null, san: null, legal: false };
  }
}

function currentPracticeItem(
  state: ReviewPracticeState | null,
): ReviewPracticeItem | null {
  if (!state?.items.length) {
    return null;
  }
  return state.items[state.currentIndex] ?? null;
}

function reviewIsCompletedForPractice(review: ReviewResponse | null): boolean {
  if (!review) {
    return false;
  }
  return review.status === "done" || review.status === "completed";
}

function reviewPvLineMovesForMode(
  annotation: ReviewMoveAnnotation,
  lineMode: ReviewPvLineMode,
): ReviewPvLineMove[] {
  const contrastBranch =
    lineMode === "played"
      ? annotation.pv_contrast_evidence?.played_branch
      : annotation.pv_contrast_evidence?.best_branch;
  const contrastLine = contrastBranch?.pv ?? [];
  const fallbackLine = lineMode === "solution" ? annotation.pv_line ?? [] : [];
  return (contrastLine.length ? contrastLine : fallbackLine).slice(0, 8);
}

function reviewPvLineMessageForMode(
  annotation: ReviewMoveAnnotation,
  lineMode: ReviewPvLineMode,
): string {
  if (lineMode === "played") {
    return "Ligne après le coup joué indisponible.";
  }
  return (
    annotation.pv_line_message ??
    "Ligne complète de la solution indisponible."
  );
}

function practiceItemToAnnotation(item: ReviewPracticeItem): ReviewMoveAnnotation {
  return {
    ply: item.ply,
    move_number: item.move_number ?? Math.ceil(item.ply / 2),
    color: item.color,
    side: item.color,
    san: item.san ?? item.uci ?? null,
    uci: item.uci ?? item.best_move_uci,
    fen_before: item.fen_before,
    fen_after: item.fen_after ?? item.fen_before,
    primary_category: item.primary_category,
    category_label: item.category_label ?? item.primary_category,
    tags: item.tags ?? [],
    tag_labels: item.tag_labels ?? [],
    reason: item.pedagogical_explanation?.main_message ?? undefined,
    win_loss: item.win_loss ?? null,
    move_accuracy: item.move_accuracy ?? null,
    criticality_score: null,
    missed_gain: null,
    player_win_percent_before: null,
    player_win_percent_after: null,
    player_percent_before: null,
    player_percent_after: null,
    best_move_uci: item.best_move_uci,
    best_move_san: item.best_move_san ?? null,
    top_moves: [],
    try_move_supported: item.try_move_supported,
    acceptable_moves: item.acceptable_moves ?? [],
    pv_line: item.pv_line ?? [],
    pv_line_available: item.pv_line_available ?? false,
    pv_line_message: item.pv_line_message ?? null,
    pv_contrast_evidence: item.pv_contrast_evidence ?? null,
    evidence_available: true,
    pedagogical_explanation: item.pedagogical_explanation ?? null,
    contrast_coach_explanation: item.contrast_coach_explanation ?? null,
    coach_priority_rank: item.coach_priority_rank ?? null,
    impact_label: item.impact_label ?? null,
    move_quality_label: item.move_quality_label ?? null,
    coach_card_title: item.coach_card_title ?? null,
    compact_label: item.compact_label ?? null,
  };
}

function boardEvaluationContextForPosition(
  mode: PositionMode,
  displayedPositionPly: number,
  finalDisplayedPly: number,
  isGameCompleted: boolean,
): BoardEvaluationContext {
  if (mode === "REVIEW") {
    return "review";
  }
  if (mode === "HISTORICAL") {
    return displayedPositionPly === 0 ? "initial" : "historical";
  }
  if (isGameCompleted) {
    return "final";
  }
  if (displayedPositionPly === 0 && finalDisplayedPly > 0) {
    return "initial";
  }
  return "live";
}

function normalizeBoardEvaluationContext(
  context: string | null | undefined,
): BoardEvaluationContext {
  if (
    context === "historical" ||
    context === "review" ||
    context === "final" ||
    context === "initial"
  ) {
    return context;
  }
  return "live";
}

function liveSourceKindForContext(context: BoardEvaluationContext): string {
  if (context === "historical") {
    return "historical_live";
  }
  if (context === "review") {
    return "review_live";
  }
  if (context === "final") {
    return "final_live";
  }
  if (context === "initial") {
    return "initial_live";
  }
  return "live";
}

function boardEvaluationPendingPlaceholder(
  context: BoardEvaluationContext,
): EvaluationBarState {
  const sourceLabel = sourceLabelForContext(context);
  return {
    evaluation: null,
    source: null,
    placeholder: {
      label: "analyse live continue",
      sourceLabel,
      sourceTitle: `Stockfish analyse la position ${sourceLabel} tant qu'elle reste affichee`,
    },
    delta: null,
    deltaOverlay: null,
  };
}

function reviewJobUserMessage(job: ReviewJobResponse): string {
  if (job.status === "cancelled") {
    return "Analyse annulee.";
  }
  if (job.status === "failed") {
    return job.error_message ?? "Analyse echouee.";
  }
  if (job.status === "incomplete") {
    return job.error_message ?? "Analyse incomplete.";
  }
  if (job.status === "stalled") {
    return job.error_message ?? "Analyse bloquee temporairement.";
  }
  return "État Review à vérifier.";
}

function reviewJobNeedsExplicitReconcile(job: ReviewJobResponse): boolean {
  return Boolean(job.derived_needs_reconcile && job.can_reconcile);
}

function reviewJobReconcileMessage(job: ReviewJobResponse): string {
  if (job.derived_reconcile_reason === "completed_without_review") {
    return "Analyse terminee, finalisation Review a verifier.";
  }
  if (job.derived_reconcile_reason === "coverage_complete") {
    return "Toutes les positions sont analysees. Finalisation Review a lancer.";
  }
  return "Analyse peut etre bloquee - verification possible.";
}

function readPersistedAppState(): PersistedAppState | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(APP_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
    if (typeof parsed.gameId !== "number") {
      return null;
    }
    return {
      gameId: parsed.gameId,
      activeTab: normalizeActiveTab(parsed.activeTab),
      displayedPositionPly: Number(parsed.displayedPositionPly ?? 0),
      activeReviewJobId:
        typeof parsed.activeReviewJobId === "string"
          ? parsed.activeReviewJobId
          : null,
      reviewAnalysisProfile: normalizeUserReviewProfile(
        parsed.reviewAnalysisProfile,
      ),
      updatedAt: Number(parsed.updatedAt ?? 0),
    };
  } catch {
    return null;
  }
}

function writePersistedAppState(state: PersistedAppState): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!state.gameId) {
      window.localStorage.removeItem(APP_STATE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Preference persistence should never break the app.
  }
}

function clearPersistedAppState(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(APP_STATE_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function normalizeActiveTab(value: unknown): ActiveTab {
  return value === "review" ||
    value === "import" ||
    value === "history" ||
    value === "info" ||
    value === "moves"
    ? value
    : "moves";
}

function normalizeUserReviewProfile(value: unknown): ReviewAnalysisProfile {
  return value === "deep" ? "deep" : "standard";
}

function clampPly(value: number, maxPly: number): number {
  if (!Number.isFinite(value)) {
    return maxPly;
  }
  return Math.max(0, Math.min(maxPly, Math.trunc(value)));
}

function fenForHistoryPly(history: GameMoveHistory, ply: number): string {
  if (ply <= 0) {
    return history.initial_fen;
  }
  return history.moves[ply - 1]?.fen_after ?? history.current_fen;
}

function sourceLabelForContext(context: BoardEvaluationContext): string {
  if (context === "historical") {
    return "historique";
  }
  if (context === "review") {
    return "review";
  }
  if (context === "final") {
    return "finale";
  }
  if (context === "initial") {
    return "depart";
  }
  return "live";
}

function positionBadge(
  mode: PositionMode,
  displayedPositionPly: number,
  history: GameMoveHistory | null,
  review: ReviewResponse | null,
  selectedReviewIndex: number | null,
  reviewOpeningFocusMessage: string | null,
): string | null {
  if (mode === "LIVE") {
    return null;
  }
  if (mode === "HISTORICAL") {
    if (displayedPositionPly === 0) {
      return "Position initiale";
    }
    const move = history?.moves[displayedPositionPly - 1];
    return move ? `Coup ${move.ply} — ${move.played_san}` : "Position historique";
  }
  if (reviewOpeningFocusMessage) {
    return reviewOpeningFocusMessage;
  }
  if (selectedReviewIndex !== null && review?.moments[selectedReviewIndex]) {
    const moment = review.moments[selectedReviewIndex];
    const phase = displayedPositionPly >= moment.ply ? "après" : "avant";
    return `Moment à revoir #${selectedReviewIndex + 1} — ${phase} le coup ${moment.ply} (${moment.played_san ?? moment.played_uci})`;
  }
  return "Moment à revoir";
}

function boardLabel(
  mode: PositionMode,
  displayedPositionPly: number,
  history: GameMoveHistory | null,
  review: ReviewResponse | null,
  selectedReviewIndex: number | null,
  reviewOpeningFocusMessage: string | null,
): string {
  if (mode === "LIVE") {
    return "Échiquier de la partie";
  }
  if (mode === "HISTORICAL") {
    const move = history?.moves[displayedPositionPly - 1];
    return move
      ? `Position après le coup ${move.ply}, ${move.played_san}`
      : "Position initiale de la partie";
  }
  if (reviewOpeningFocusMessage) {
    return reviewOpeningFocusMessage;
  }
  const index = selectedReviewIndex;
  const moment = index !== null ? review?.moments[index] : null;
  if (index !== null && moment) {
    const phase = displayedPositionPly >= moment.ply ? "après" : "avant";
    return `Position ${phase} le coup ${moment.ply}, moment à revoir #${index + 1}`;
  }
  return "Position avant un moment à revoir";
}

function buildReviewSquareStyles(
  mode: PositionMode,
  review: ReviewResponse | null,
  selectedReviewIndex: number | null,
  moveMode: ReviewReplayMoveMode,
  currentOverlayPositionKey: string | null,
  expectedOverlayPositionKey: string | null,
): Record<string, CSSProperties> | undefined {
  if (
    mode !== "REVIEW" ||
    selectedReviewIndex === null ||
    !review ||
    expectedOverlayPositionKey === null ||
    currentOverlayPositionKey !== expectedOverlayPositionKey
  ) {
    return undefined;
  }
  const moment = review.moments[selectedReviewIndex];
  if (!moment) {
    return undefined;
  }

  const styles: Record<string, CSSProperties> = {};
  if (moveMode === "best") {
    addUciSquares(styles, moment.best_move_uci, "rgba(0, 229, 255, 0.34)");
  } else {
    addUciSquares(styles, moment.played_uci, "rgba(0, 229, 255, 0.36)");
    addUciSquares(styles, moment.best_move_uci, "rgba(105, 92, 255, 0.24)");
  }
  return styles;
}

function makeReviewOverlayPositionKey(
  gameId: number | null,
  fen: string | null,
  mode: PositionMode,
  ply: number | null | undefined,
  phase: string | null | undefined,
): string | null {
  if (!fen || mode !== "REVIEW" || !phase) {
    return null;
  }
  return `${gameId ?? "no-game"}:${ply ?? "unknown"}:${mode}:${phase}:${fen}`;
}

function makeSolutionRevealKey(
  gameId: number | null,
  annotation: ReviewMoveAnnotation,
  pov: ReviewPov,
): string {
  return `${gameId ?? "no-game"}:${annotation.ply}:${pov}`;
}

function buildReviewBoardArrows(
  mode: PositionMode,
  moment: ReviewMoment | null,
  annotation: ReviewMoveAnnotation | null,
  moveMode: ReviewReplayMoveMode,
  replayState: ReviewReplayState,
  guidedPhase: GuidedReplayPhase | null,
  guidedPvIndex: number | null,
  tryMoveState: ReviewTryMoveState | null,
  practiceState: ReviewPracticeState | null,
  pvLineState: ReviewPvLineState | null,
  openingGuideState: OpeningGuideState | null,
  currentOverlayPositionKey: string | null,
  expectedOverlayPositionKey: string | null,
): BoardArrow[] | undefined {
  if (mode !== "REVIEW") {
    return undefined;
  }
  if (
    expectedOverlayPositionKey === null ||
    currentOverlayPositionKey !== expectedOverlayPositionKey
  ) {
    return undefined;
  }
  if (openingGuideState?.active) {
    const color =
      openingGuideState.phase === "exit_move"
        ? REVIEW_PLAYED_ARROW_COLOR
        : "rgba(79, 124, 255, 0.82)";
    return uciToBoardArrow(openingGuideState.currentMoveUci, color);
  }
  if (practiceState?.active) {
    if (practiceState.itemState === "pv_line" && annotation) {
      const pvMove =
        pvLineState?.moves?.[guidedPvIndex ?? 0]?.uci ??
        annotation.pv_line?.[guidedPvIndex ?? 0]?.uci ??
        annotation.best_move_uci ??
        null;
      return uciToBoardArrow(
        pvMove,
        pvLineState?.lineMode === "played"
          ? REVIEW_PLAYED_ARROW_COLOR
          : REVIEW_BEST_ARROW_COLOR,
      );
    }
    if (practiceState.solutionRevealed && annotation) {
      return uciToBoardArrow(annotation.best_move_uci ?? null, REVIEW_BEST_ARROW_COLOR);
    }
    if (practiceState.feedback && practiceState.attemptedUci) {
      return uciToBoardArrow(practiceState.attemptedUci, REVIEW_PLAYED_ARROW_COLOR);
    }
    return undefined;
  }
  if (tryMoveState?.active) {
    if (tryMoveState.solutionRevealed) {
      return uciToBoardArrow(
        tryMoveState.annotation?.best_move_uci ?? null,
        REVIEW_BEST_ARROW_COLOR,
      );
    }
    if (tryMoveState.attemptedUci) {
      return uciToBoardArrow(tryMoveState.attemptedUci, REVIEW_PLAYED_ARROW_COLOR);
    }
    return undefined;
  }
  if (annotation && guidedPhase) {
    if (guidedPhase === "best_move" || guidedPhase === "summary") {
      return uciToBoardArrow(annotation.best_move_uci ?? null, REVIEW_BEST_ARROW_COLOR);
    }
    if (guidedPhase === "pv_line") {
      const pvMove =
        pvLineState?.moves?.[guidedPvIndex ?? 0]?.uci ??
        annotation.pv_line?.[guidedPvIndex ?? 0]?.uci ??
        annotation.pv_line?.[0]?.uci ??
        annotation.best_move_uci ??
        null;
      return uciToBoardArrow(
        pvMove,
        pvLineState?.lineMode === "played"
          ? REVIEW_PLAYED_ARROW_COLOR
          : REVIEW_BEST_ARROW_COLOR,
      );
    }
    if (guidedPhase === "played_move" || guidedPhase === "impact") {
      return uciToBoardArrow(annotation.uci, REVIEW_PLAYED_ARROW_COLOR);
    }
    return undefined;
  }
  if (!moment || replayState === "idle") {
    return undefined;
  }
  const uci = moveMode === "best" ? moment.best_move_uci : moment.played_uci;
  const color =
    moveMode === "best" ? REVIEW_BEST_ARROW_COLOR : REVIEW_PLAYED_ARROW_COLOR;
  return uciToBoardArrow(uci, color);
}

function uciToBoardArrow(uci: string | null, color: string): BoardArrow[] | undefined {
  if (!uci || uci.length < 4) {
    return undefined;
  }
  return [[uci.slice(0, 2), uci.slice(2, 4), color]];
}

function addUciSquares(
  styles: Record<string, CSSProperties>,
  uci: string | null,
  color: string,
) {
  if (!uci || uci.length < 4) {
    return;
  }
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const highlight = {
    background:
      `radial-gradient(circle at center, ${color} 0%, rgba(0, 229, 255, 0.18) 42%, rgba(0, 0, 0, 0) 76%)`,
    boxShadow: `inset 0 0 0 1px ${color}, 0 0 18px ${color}`,
  };
  styles[from] = highlight;
  styles[to] = highlight;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

function readHideEvaluationPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(EVAL_VISIBILITY_STORAGE_KEY) === "true";
  } catch (_err) {
    return false;
  }
}

function writeHideEvaluationPreference(hidden: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      EVAL_VISIBILITY_STORAGE_KEY,
      hidden ? "true" : "false",
    );
  } catch (_err) {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
