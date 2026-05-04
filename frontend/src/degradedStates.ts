import type { DailyPlanResponse, PgnImportPreview, PgnImportResult } from "./api/client";
import type { StateNoticeVariant } from "./components/StateNotice";

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
  return {
    stateId: "BACKEND_UNAVAILABLE",
    variant: "danger",
    title: "NeuroChess local ne répond pas",
    message:
      "L’interface est ouverte, mais le service local ne répond pas pour le moment.",
    primaryActionLabel: "Réessayer",
    secondaryActionLabel: "Voir l’aide locale",
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
      title: "Colle une partie pour commencer",
      message: "Ajoute un PGN ou importe une partie pour lancer l’analyse.",
      primaryActionLabel: "Coller un PGN",
    };
  }

  const invalidPreview = preview && preview.invalid_count > 0 && preview.valid_count === 0;
  if (invalidPreview) {
    const detail = firstError(preview.errors);
    if (looksLikeIllegalPgn(detail)) {
      return {
        stateId: "IMPORT_ILLEGAL_MOVES",
        variant: "warning",
        title: "Un coup n’est pas légal",
        message:
          "La partie contient un coup que NeuroChess ne peut pas rejouer correctement.",
        primaryActionLabel: "Corriger le PGN",
        secondaryActionLabel: "Importer une autre partie",
        details: detail,
      };
    }
    return {
      stateId: "IMPORT_INVALID_PGN",
      variant: "warning",
      title: "PGN non reconnu",
      message:
        "Le texte ne ressemble pas à une partie PGN complète. Vérifie le copier-coller puis réessaie.",
      primaryActionLabel: "Corriger le PGN",
      secondaryActionLabel: "Voir un exemple",
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
      title: "PGN non reconnu",
      message:
        "Le texte ne ressemble pas à une partie PGN complète. Vérifie le copier-coller puis réessaie.",
      primaryActionLabel: "Corriger le PGN",
      secondaryActionLabel: "Voir un exemple",
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
      title: "Partie déjà importée",
      message: "Cette partie est déjà dans Mes parties.",
      primaryActionLabel: "Ouvrir la partie",
      secondaryActionLabel: "Importer une autre partie",
    };
  }

  if (errorMessage) {
    return {
      stateId: "BACKEND_REQUEST_FAILED",
      variant: "warning",
      title: "Action non terminée",
      message:
        "L’action n’a pas pu être terminée. Tes données déjà enregistrées restent conservées.",
      primaryActionLabel: "Réessayer",
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
      title: "Plan indisponible",
      message: "Le plan du jour n’a pas pu être préparé.",
      primaryActionLabel: "Réessayer",
      details: safeDetails(errorMessage),
    };
  }
  if (dailyPlan?.status === "empty" || (dailyPlan && dailyPlan.item_count === 0)) {
    return {
      stateId: "DAILY_PLAN_EMPTY",
      variant: "info",
      title: "Plan en construction",
      message: "Importe quelques parties et termine des exercices pour obtenir un plan fiable.",
      primaryActionLabel: "Importer une partie",
    };
  }
  if (dailyPlan?.status === "partial") {
    return {
      stateId: "DAILY_PLAN_PARTIAL",
      variant: "warning",
      title: "Plan court aujourd’hui",
      message:
        "On a moins de positions que prévu, mais tu peux déjà travailler utilement.",
      primaryActionLabel: "Commencer",
    };
  }
  return null;
}

export function buildPracticeSaveFailedNotice(message?: string | null): DegradedStateNotice {
  if (isBackendUnavailableMessage(message)) {
    return {
      ...buildBackendUnavailableNotice(message),
      stateId: "PRACTICE_ATTEMPT_SAVE_FAILED",
      title: "Tentative non enregistrée",
      message: "Le coup a été joué, mais la sauvegarde n’a pas abouti.",
      primaryActionLabel: "Réessayer d’enregistrer",
      secondaryActionLabel: "Voir la correction",
    };
  }
  return {
    stateId: "PRACTICE_ATTEMPT_SAVE_FAILED",
    variant: "warning",
    title: "Tentative non enregistrée",
    message: "Le coup a été joué, mais la sauvegarde n’a pas abouti.",
    primaryActionLabel: "Réessayer d’enregistrer",
    secondaryActionLabel: "Voir la correction",
    details: safeDetails(message),
  };
}

export const PRACTICE_NO_ITEMS_NOTICE: DegradedStateNotice = {
  stateId: "PRACTICE_NO_ITEMS",
  variant: "info",
  title: "Pas encore d’exercice",
  message: "Importe et analyse quelques parties pour créer des positions d’entraînement.",
  primaryActionLabel: "Importer une partie",
};

export const PRACTICE_ILLEGAL_MOVE_NOTICE: DegradedStateNotice = {
  stateId: "PRACTICE_ILLEGAL_MOVE",
  variant: "warning",
  title: "Ce coup n’est pas légal",
  message: "Essaie un coup autorisé dans cette position.",
  primaryActionLabel: "Réessayer",
};

export const PRACTICE_REVEAL_NOTICE: DegradedStateNotice = {
  stateId: "PRACTICE_REVEAL_USED",
  variant: "info",
  title: "Correction consultée",
  message: "Bonne décision de regarder. Cette position reviendra bientôt.",
};

export const PRACTICE_COMPLETED_NOTICE: DegradedStateNotice = {
  stateId: "PRACTICE_COMPLETED",
  variant: "success",
  title: "Session terminée",
  message: "Ces positions reviendront au bon moment.",
  primaryActionLabel: "Retour à Aujourd’hui",
  secondaryActionLabel: "Revoir mes erreurs",
};

export const ANTI_TILT_REPEATED_WRONG_NOTICE: DegradedStateNotice = {
  stateId: "ANTI_TILT_REPEATED_WRONG",
  variant: "info",
  title: "Position difficile",
  message:
    "Cette position est difficile. Prends ton temps : l’objectif est d’apprendre, pas de réussir du premier coup.",
  primaryActionLabel: "Réessayer",
  secondaryActionLabel: "Voir la correction",
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
