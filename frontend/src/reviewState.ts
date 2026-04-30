export const MIN_REVIEW_HALF_MOVES = 10;
export const REVIEW_VISIBLE_SPINNER_TIMEOUT_MS = 3_000;
export const REVIEW_PENDING_TIMEOUT_MS = 60_000;
export const REVIEW_TIMEOUT_MESSAGE =
  "L'analyse prend plus de temps que prévu. Réessayez plus tard.";
export const REVIEW_PENDING_BACKGROUND_MESSAGE =
  "L'analyse approfondie continue en arrière-plan. Vérifiez à nouveau dans quelques instants.";
export const REVIEW_NOT_REVIEWABLE_MESSAGE =
  "Partie trop courte pour générer une review fiable.";
export const REVIEW_NO_SIGNIFICANT_MOMENTS_MESSAGE =
  "Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile.";
export const REVIEW_STALLED_MESSAGE =
  "L'analyse approfondie n'a pas pu être lancée. Réessayez plus tard.";
export const REVIEW_FAILED_DEEP_MESSAGE =
  "L'analyse approfondie a échoué sur une ou plusieurs positions.";

export function isShortGameForReview(halfMovesCount: number): boolean {
  return halfMovesCount <= MIN_REVIEW_HALF_MOVES;
}

export type ReviewUiStatus =
  | "idle"
  | "generating"
  | "pending"
  | "pending_background"
  | "done"
  | "partial"
  | "not_reviewable"
  | "failed"
  | "stalled"
  | "incomplete"
  | "timeout";

export type ReviewUiState = {
  status: ReviewUiStatus;
  error: string | null;
  pendingStartedAt: number | null;
  pollActive: boolean;
};

export type ReviewResponseLike = {
  status?: string | null;
  reason?: string | null;
  reviewable?: boolean | null;
  empty_reason?: string | null;
  missing_deep_count?: number | null;
  review_work_active?: boolean | null;
  moments?: unknown[] | null;
};

export type ReviewStateEvent =
  | { type: "reset" }
  | { type: "generate_started" }
  | { type: "check_started" }
  | { type: "response_received"; response: ReviewResponseLike; now: number }
  | { type: "visible_spinner_elapsed" }
  | { type: "request_failed"; message: string }
  | { type: "timeout" };

export const INITIAL_REVIEW_STATE: ReviewUiState = {
  status: "idle",
  error: null,
  pendingStartedAt: null,
  pollActive: false,
};

export function reviewStatusFromResponse(
  response: ReviewResponseLike,
): ReviewUiStatus {
  if (
    response.status === "not_reviewable" ||
    response.reviewable === false ||
    response.reason === "game_too_short"
  ) {
    return "not_reviewable";
  }
  if (response.status === "failed") {
    return "failed";
  }
  if (response.status === "stalled") {
    return "stalled";
  }
  if (response.status === "incomplete") {
    return "incomplete";
  }
  if (response.status === "done") {
    return "done";
  }
  if (response.status === "partial") {
    return "partial";
  }
  if (response.status === "pending" || response.status === "running") {
    if (response.review_work_active !== true) {
      return "stalled";
    }
    if (
      response.missing_deep_count === 0 &&
      Array.isArray(response.moments) &&
      response.moments.length === 0
    ) {
      return "done";
    }
    return "pending";
  }
  return "idle";
}

export function reviewStateReducer(
  state: ReviewUiState,
  event: ReviewStateEvent,
): ReviewUiState {
  if (event.type === "reset") {
    return INITIAL_REVIEW_STATE;
  }

  if (event.type === "generate_started" || event.type === "check_started") {
    return {
      status: "generating",
      error: null,
      pendingStartedAt: null,
      pollActive: false,
    };
  }

  if (event.type === "request_failed") {
    return {
      status: "failed",
      error: event.message,
      pendingStartedAt: null,
      pollActive: false,
    };
  }

  if (event.type === "visible_spinner_elapsed") {
    if (state.status === "generating") {
      return {
        status: "stalled",
        error: REVIEW_STALLED_MESSAGE,
        pendingStartedAt: null,
        pollActive: false,
      };
    }
    if (state.status !== "pending") {
      return state;
    }
    return {
      status: "pending_background",
      error: REVIEW_PENDING_BACKGROUND_MESSAGE,
      pendingStartedAt: null,
      pollActive: false,
    };
  }

  if (event.type === "timeout") {
    return {
      status: "timeout",
      error: REVIEW_TIMEOUT_MESSAGE,
      pendingStartedAt: null,
      pollActive: false,
    };
  }

  const status = reviewStatusFromResponse(event.response);
  if (status === "pending") {
    if (state.status === "pending_background") {
      return {
        status: "pending_background",
        error: REVIEW_PENDING_BACKGROUND_MESSAGE,
        pendingStartedAt: null,
        pollActive: false,
      };
    }
    return {
      status,
      error: null,
      pendingStartedAt:
        state.status === "pending" && state.pendingStartedAt !== null
          ? state.pendingStartedAt
          : event.now,
      pollActive: true,
    };
  }

  return {
    status,
    error: null,
    pendingStartedAt: null,
    pollActive: false,
  };
}

export function reviewPanelDisplayStatus(
  review: ReviewResponseLike | null,
  state: ReviewUiState,
): ReviewUiStatus {
  const responseStatus = review ? reviewStatusFromResponse(review) : "idle";

  if (responseStatus === "not_reviewable" || state.status === "not_reviewable") {
    return "not_reviewable";
  }
  if (responseStatus === "failed" || state.status === "failed") {
    return "failed";
  }
  if (responseStatus === "stalled" || state.status === "stalled") {
    return "stalled";
  }
  if (responseStatus === "incomplete" || state.status === "incomplete") {
    return "incomplete";
  }
  if (state.status === "timeout") {
    return "timeout";
  }
  if (responseStatus === "done" || state.status === "done") {
    return "done";
  }
  if (responseStatus === "partial" || state.status === "partial") {
    return "partial";
  }
  if (state.status === "pending_background") {
    return "pending_background";
  }
  if (
    responseStatus === "pending" ||
    state.status === "pending" ||
    state.status === "generating"
  ) {
    return state.status === "generating" ? "generating" : "pending";
  }
  return "idle";
}

export function isReviewTerminalStatus(status: ReviewUiStatus): boolean {
  return (
    status === "not_reviewable" ||
    status === "failed" ||
    status === "stalled" ||
    status === "timeout" ||
    status === "done" ||
    status === "partial"
  );
}

export function shouldPollReview(state: ReviewUiState): boolean {
  return state.status === "pending" && state.pollActive;
}

export function reviewPendingElapsedMs(
  state: ReviewUiState,
  now: number,
): number {
  if (state.pendingStartedAt === null) {
    return 0;
  }
  return Math.max(0, now - state.pendingStartedAt);
}
