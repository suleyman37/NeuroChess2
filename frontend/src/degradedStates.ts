import type { DailyPlanResponse, PgnImportPreview, PgnImportResult } from "./api/client";
import type { StateNoticeVariant } from "./components/StateNotice";
import { fr } from "./i18n";

export type DegradedStateId =
  | "IMPORT_EMPTY_PGN"
  | "IMPORT_INVALID_PGN"
  | "IMPORT_ILLEGAL_MOVES"
  | "IMPORT_DUPLICATE_GAME"
  | "BACKEND_UNAVAILABLE"
  | "BACKEND_REQUEST_FAILED"
  | "DAILY_PLAN_EMPTY"
  | "DAILY_PLAN_PARTIAL"
  | "DAILY_PLAN_CREATE_FAILED"
  | "DAILY_PLAN_PRACTICE_FAILED"
  | "PRACTICE_NO_ITEMS"
  | "PRACTICE_ATTEMPT_SAVE_FAILED"
  | "PRACTICE_ILLEGAL_MOVE"
  | "PRACTICE_REVEAL_USED"
  | "PRACTICE_COMPLETED"
  | "ANTI_TILT_REPEATED_WRONG";

export type DegradedStateNotice = {
  stateId: DegradedStateId;
  variant: StateNoticeVariant;
  title: string;
  message: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  details?: string | null;
};

export function isBackendUnavailableMessage(message: string | null | undefined): boolean {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed")
  );
}

export function buildBackendUnavailableNotice(message?: string | null): DegradedStateNotice {
  const copy = fr.degradedStates.backendUnavailable;
  return {
    stateId: "BACKEND_UNAVAILABLE",
    variant: "danger",
    title: copy.title,
    message: copy.message,
    primaryActionLabel: copy.primaryActionLabel,
    secondaryActionLabel: copy.secondaryActionLabel,
    details: safeDetails(message),
  };
}

export function buildPgnImportNotice({
  errorMessage,
  preview,
  result,
}: {
  errorMessage: string | null;
  preview: PgnImportPreview | null;
  result: PgnImportResult | null;
}): DegradedStateNotice | null {
  if (isBackendUnavailableMessage(errorMessage)) {
    return buildBackendUnavailableNotice(errorMessage);
  }

  if (errorMessage === "IMPORT_EMPTY_PGN" || errorMessage === "pgn_text_required") {
    return {
      stateId: "IMPORT_EMPTY_PGN",
      variant: "info",
      title: fr.import.emptyTitle,
      message: fr.import.emptyMessage,
      primaryActionLabel: fr.actions.pastePgn,
    };
  }

  const invalidPreview = preview && preview.invalid_count > 0 && preview.valid_count === 0;
  if (invalidPreview) {
    const detail = firstError(preview.errors);
    if (looksLikeIllegalPgn(detail)) {
      return {
        stateId: "IMPORT_ILLEGAL_MOVES",
        variant: "warning",
        title: fr.import.illegalTitle,
        message: fr.import.illegalMessage,
        primaryActionLabel: fr.actions.correctPgn,
        secondaryActionLabel: fr.actions.importGame,
        details: detail,
      };
    }
    return {
      stateId: "IMPORT_INVALID_PGN",
      variant: "warning",
      title: fr.import.invalidTitle,
      message: fr.import.invalidMessage,
      primaryActionLabel: fr.actions.correctPgn,
      secondaryActionLabel: fr.actions.seeExample,
      details: detail,
    };
  }

  if (
    result &&
    result.imported_count === 0 &&
    result.invalid_count > 0 &&
    result.duplicate_count === 0
  ) {
    return {
      stateId: "IMPORT_INVALID_PGN",
      variant: "warning",
      title: fr.import.invalidTitle,
      message: fr.import.invalidMessage,
      primaryActionLabel: fr.actions.correctPgn,
      secondaryActionLabel: fr.actions.seeExample,
    };
  }

  if (
    result &&
    result.imported_count === 0 &&
    result.duplicate_count > 0 &&
    result.invalid_count === 0
  ) {
    return {
      stateId: "IMPORT_DUPLICATE_GAME",
      variant: "info",
      title: fr.import.duplicateTitle,
      message: fr.import.duplicateMessage,
      primaryActionLabel: fr.actions.openGame,
      secondaryActionLabel: fr.actions.importGame,
    };
  }

  if (errorMessage) {
    return {
      stateId: "BACKEND_REQUEST_FAILED",
      variant: "warning",
      title: fr.degradedStates.requestFailed.title,
      message: fr.degradedStates.requestFailed.message,
      primaryActionLabel: fr.degradedStates.requestFailed.primaryActionLabel,
      details: safeDetails(errorMessage),
    };
  }

  return null;
}

export function buildDailyPlanNotice({
  dailyPlan,
  errorMessage,
}: {
  dailyPlan: DailyPlanResponse | null;
  errorMessage: string | null;
}): DegradedStateNotice | null {
  if (isBackendUnavailableMessage(errorMessage)) {
    return buildBackendUnavailableNotice(errorMessage);
  }
  if (errorMessage) {
    return {
      stateId: "DAILY_PLAN_CREATE_FAILED",
      variant: "warning",
      title: fr.degradedStates.dailyPlanCreateFailed.title,
      message: fr.degradedStates.dailyPlanCreateFailed.message,
      primaryActionLabel: fr.degradedStates.dailyPlanCreateFailed.primaryActionLabel,
      details: safeDetails(errorMessage),
    };
  }
  if (dailyPlan?.status === "empty" || (dailyPlan && dailyPlan.item_count === 0)) {
    return {
      stateId: "DAILY_PLAN_EMPTY",
      variant: "info",
      title: fr.degradedStates.dailyPlanEmpty.title,
      message: fr.degradedStates.dailyPlanEmpty.message,
      primaryActionLabel: fr.degradedStates.dailyPlanEmpty.primaryActionLabel,
    };
  }
  if (dailyPlan?.status === "partial") {
    return {
      stateId: "DAILY_PLAN_PARTIAL",
      variant: "warning",
      title: fr.degradedStates.dailyPlanPartial.title,
      message: fr.degradedStates.dailyPlanPartial.message,
      primaryActionLabel: fr.degradedStates.dailyPlanPartial.primaryActionLabel,
    };
  }
  return null;
}

export function buildPracticeSaveFailedNotice(message?: string | null): DegradedStateNotice {
  if (isBackendUnavailableMessage(message)) {
    return {
      ...buildBackendUnavailableNotice(message),
      stateId: "PRACTICE_ATTEMPT_SAVE_FAILED",
      title: fr.degradedStates.practiceSaveFailed.title,
      message: fr.degradedStates.practiceSaveFailed.message,
      primaryActionLabel: fr.degradedStates.practiceSaveFailed.primaryActionLabel,
      secondaryActionLabel: fr.degradedStates.practiceSaveFailed.secondaryActionLabel,
    };
  }
  return {
    stateId: "PRACTICE_ATTEMPT_SAVE_FAILED",
    variant: "warning",
    title: fr.degradedStates.practiceSaveFailed.title,
    message: fr.degradedStates.practiceSaveFailed.message,
    primaryActionLabel: fr.degradedStates.practiceSaveFailed.primaryActionLabel,
    secondaryActionLabel: fr.degradedStates.practiceSaveFailed.secondaryActionLabel,
    details: safeDetails(message),
  };
}

export const PRACTICE_NO_ITEMS_NOTICE: DegradedStateNotice = {
  stateId: "PRACTICE_NO_ITEMS",
  variant: "info",
  title: fr.degradedStates.practiceNoItems.title,
  message: fr.degradedStates.practiceNoItems.message,
  primaryActionLabel: fr.degradedStates.practiceNoItems.primaryActionLabel,
};

export const PRACTICE_ILLEGAL_MOVE_NOTICE: DegradedStateNotice = {
  stateId: "PRACTICE_ILLEGAL_MOVE",
  variant: "warning",
  title: fr.degradedStates.practiceIllegalMove.title,
  message: fr.degradedStates.practiceIllegalMove.message,
  primaryActionLabel: fr.degradedStates.practiceIllegalMove.primaryActionLabel,
};

export const PRACTICE_REVEAL_NOTICE: DegradedStateNotice = {
  stateId: "PRACTICE_REVEAL_USED",
  variant: "info",
  title: fr.degradedStates.practiceRevealUsed.title,
  message: fr.degradedStates.practiceRevealUsed.message,
};

export const PRACTICE_COMPLETED_NOTICE: DegradedStateNotice = {
  stateId: "PRACTICE_COMPLETED",
  variant: "success",
  title: fr.degradedStates.practiceCompleted.title,
  message: fr.degradedStates.practiceCompleted.message,
  primaryActionLabel: fr.degradedStates.practiceCompleted.primaryActionLabel,
  secondaryActionLabel: fr.degradedStates.practiceCompleted.secondaryActionLabel,
};

export const ANTI_TILT_REPEATED_WRONG_NOTICE: DegradedStateNotice = {
  stateId: "ANTI_TILT_REPEATED_WRONG",
  variant: "info",
  title: fr.degradedStates.antiTiltRepeatedWrong.title,
  message: fr.degradedStates.antiTiltRepeatedWrong.message,
  primaryActionLabel: fr.degradedStates.antiTiltRepeatedWrong.primaryActionLabel,
  secondaryActionLabel: fr.degradedStates.antiTiltRepeatedWrong.secondaryActionLabel,
};

function firstError(errors?: string[] | null): string | null {
  return errors?.find((error) => error.trim().length > 0) ?? null;
}

function looksLikeIllegalPgn(message: string | null): boolean {
  const normalized = String(message ?? "").toLowerCase();
  return normalized.includes("illegal") || normalized.includes("illegal san");
}

function safeDetails(message?: string | null): string | null {
  if (!message) {
    return null;
  }
  return String(message).slice(0, 500);
}
