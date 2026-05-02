import type { ReviewPracticeSessionListItem } from "../../api/client";

export function ReviewPracticeHistory({
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

