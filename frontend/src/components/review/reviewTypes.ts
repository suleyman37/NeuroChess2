import type {
  OpeningRealityEvidence,
  ReviewJobResponse,
  ReviewMoment,
  ReviewMoveAnnotation,
  ReviewPracticeItem,
  ReviewPracticeSessionListItem,
  ReviewPracticeSummary,
  ReviewPvLineMove,
  ReviewResponse,
  ReviewSections,
} from "../../api/client";
import type { ReviewUiState } from "../../reviewState";

export type ReviewPanelProps = {
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
  onStartPractice: () => void;
  onPracticeHint: () => void;
  onPracticeRevealSolution: () => void;
  onPracticeSkip: () => void;
  onPracticeTryAgain: () => void;
  onPracticeNext: () => void;
  onPracticeShowPvLine: (lineMode?: ReviewPvLineMode) => void;
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
  activeReviewFocus: ReviewFocusKey;
  onReviewPovChange: (pov: ReviewPov) => void;
  onReviewFocusChange: (focus: string) => void;
  selectedMovePly: number | null;
  hideEvaluation: boolean;
  analysisProfile: "quick" | "standard" | "deep";
  onAnalysisProfileChange: (profile: "quick" | "standard" | "deep") => void;
};

export type ReviewRunOptions = {
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
export type ReviewLessonStep =
  | "observe"
  | "try"
  | "played"
  | "solution"
  | "compare"
  | "takeaway";
export type ReviewPublicLessonStep = "challenge" | "correction" | "training";
export type ReviewFocusKey = "summary" | "learn" | "practice" | "lab";


export type ReviewSectionKey =
  | "to_review"
  | "strong_moves"
  | "missed_opportunities"
  | "all";


export type ReviewCockpitIndicator = {
  key: "opening" | "tactical" | "conversion" | "defense";
  label: string;
  statusLabel: string;
  detail: string;
  tone: "good" | "watch" | "fragile" | "critical" | "neutral" | "unknown";
};

export type GameStoryEvent = {
  id: string;
  label: string;
  moveLabel: string;
  impactLabel: string;
  tone: "info" | "warning" | "critical" | "positive" | "neutral";
  focus?: ReviewFocusKey;
  annotation?: ReviewMoveAnnotation;
  openingEvidence?: OpeningRealityEvidence;
  showOpeningExit?: boolean;
};


export type ReviewPovTargetColor = "white" | "black" | "both";
export type ReviewPovContext = {
  selectedPov: ReviewPov;
  userColor: "white" | "black" | null;
  targetColor: ReviewPovTargetColor;
  isUserPov: boolean;
  options: Array<{ value: ReviewPov; label: string }>;
};


export type ReviewScoreMetricView = {
  label: string;
  value: number | null | undefined;
  signed?: boolean;
  suffix?: string;
};



export type ReviewLessonStepState = {
  publicStep: ReviewPublicLessonStep;
  revealMode: ReviewSolutionRevealMode;
  hasPlayedMoveOnly: boolean;
  canShowSolutionData: boolean;
  canShowLineComparison: boolean;
  hintVisible: boolean;
  canShowAnyPvLine: boolean;
};

export type ReviewLineComparisonView = {
  playedMove: string;
  solutionMove: string;
  playedLinePreview: string;
  solutionLinePreview: string;
  playedLineAvailable: boolean;
  solutionLineAvailable: boolean;
  playedSummary: string;
  solutionSummary: string;
  mainDifference: string | null;
};

export type ReviewPracticeSummaryView = {
  bestCount: number;
  veryGoodCount: number;
  acceptableCount: number;
  wrongCount: number;
  illegalCount: number;
  revealedCount: number;
  skippedCount: number;
  reviewCount: number;
  solvedCount: number;
  itemCount: number;
};

export type OpeningRealityView = {
  linkedMoment: OpeningRealityEvidence["critical_moment_after_exit"] | null;
  canReviewExit: boolean;
  canShowLinkedMoment: boolean;
};
